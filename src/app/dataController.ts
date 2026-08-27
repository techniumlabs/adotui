import { loadConfig } from "../data/config";
import {
  checkAzAvailable,
  loadAppData,
  type LoadPartial,
  type LoadProgress,
  type PrRef,
} from "../data/azure";
import { MOCK_DATA } from "../data/mock";
import { runJson } from "../data/command";
import type { AppData, PullRequest, RepositoryNode } from "../domain/types";
import { countTotalPrs } from "./utils";

export interface LoadResult {
  data: AppData;
  banner: string;
  ok: boolean;
  fromCache?: boolean;
  errorType?: "missing" | "invalid";
}

const isMockMode = (): boolean => {
  const value = process.env.ADOTUI_MOCK;
  return value === "1" || value === "true";
};

/** Streaming hooks handed down to loadAppData. */
export interface StreamOptions {
  onPartial?: (partial: LoadPartial) => void;
  requestId?: number;
}

/**
 * The signed-in identity cannot change mid-session, so resolve it once. This
 * also keeps it off the critical path of every subsequent load.
 * `undefined` = not resolved yet, `null` = resolved but unavailable.
 */
let cachedUserEmail: string | null | undefined;

const resolveCurrentUser = async (): Promise<string | null> => {
  if (cachedUserEmail !== undefined) return cachedUserEmail;
  const result = await runJson<{ user?: { name?: string } }>(
    "az",
    ["account", "show", "--output", "json"],
  ).catch(() => null);
  cachedUserEmail = result?.user?.name ?? null;
  return cachedUserEmail;
};

/**
 * How long streamed partials wait for the identity before being released
 * anyway. The default "me" tree filter needs `currentUserEmail`: releasing
 * partials without it shows every repo and then visibly drops rows when it
 * lands, so a brief wait buys a stable first paint.
 */
const IDENTITY_WAIT_MS = 500;

/**
 * Replays MOCK_DATA as timed partials so streaming is demoable offline:
 *   ADOTUI_MOCK=1 ADOTUI_MOCK_STREAM=1 bun run start
 * Tests set ADOTUI_MOCK_STREAM_MS to keep the replay fast.
 */
const mockStreamDelayMs = (): number => {
  const configured = Number(process.env.ADOTUI_MOCK_STREAM_MS);
  return Number.isFinite(configured) && configured >= 0 ? configured : 60;
};

const streamMockData = async (stream: StreamOptions): Promise<void> => {
  const orgs = MOCK_DATA.organizations;
  const projectsOf = (org: typeof orgs[number]): Map<string, RepositoryNode[]> => {
    const byProject = new Map<string, RepositoryNode[]>();
    for (const repo of org.repositories) {
      const list = byProject.get(repo.project) ?? [];
      list.push(repo);
      byProject.set(repo.project, list);
    }
    return byProject;
  };
  const total = orgs.reduce((acc, org) => acc + projectsOf(org).size, 0);
  let current = 0;
  const emit = (
    org: typeof orgs[number],
    project: string | null,
    repositories: RepositoryNode[],
  ): void => {
    stream.onPartial?.({
      requestId: stream.requestId ?? 0,
      organizationUrl: org.organizationUrl,
      organizationName: org.name,
      project,
      repositories,
      warnings: [],
      progress: { current, total },
      currentUserEmail: MOCK_DATA.currentUserEmail,
    });
  };

  for (const org of orgs) emit(org, null, []);
  for (const org of orgs) {
    for (const [project, repositories] of projectsOf(org)) {
      await Bun.sleep(mockStreamDelayMs());
      current += 1;
      emit(org, project, repositories);
    }
  }
};

import { readAppCache, writeAppCache } from "../data/cache";

/**
 * Resolves config and loads live data from Azure DevOps. Falls back to mock
 * data when ADOTUI_MOCK is set. Never throws — errors are returned as banners.
 */
export type LoadProgressHandler = (msg: string, progress?: LoadProgress) => void;

export const loadInitialData = async (
  allowCache = false,
  onProgress?: LoadProgressHandler,
  stream?: StreamOptions,
): Promise<LoadResult> => {
  if (isMockMode()) {
    if (stream?.onPartial && process.env.ADOTUI_MOCK_STREAM) {
      await streamMockData(stream);
    }
    return {
      data: MOCK_DATA,
      banner: "Mock mode (ADOTUI_MOCK). Showing sample data.",
      ok: true,
    };
  }

  const configResult = await loadConfig();

  if (!configResult.ok) {
    const hint =
      "Create ~/.config/adotui/config.json or adotui.config.json in your " +
      "project, set ADOTUI_CONFIG=/path/to/config.json, or ADOTUI_MOCK=1 for a demo.";
    return {
      data: { organizations: [] },
      banner: `${configResult.error} ${hint}`,
      ok: false,
      errorType: configResult.errorType,
    };
  }

  if (configResult.config.pat) {
    process.env.AZURE_DEVOPS_EXT_PAT = configResult.config.pat;
  }

  if (allowCache) {
    const cachedData = await readAppCache();
    if (cachedData) {
      return {
        data: cachedData,
        banner: `Loaded ${countTotalPrs(cachedData)} PR(s) from cache. Syncing fresh data...`,
        ok: true,
        fromCache: true,
      };
    }
  }

  try {
    const identityPromise = resolveCurrentUser();
    let identity: string | null = cachedUserEmail ?? null;
    let identityReleased = cachedUserEmail !== undefined;
    let buffered: LoadPartial[] = [];

    const emitPartial = (partial: LoadPartial): void => {
      stream?.onPartial?.({
        ...partial,
        ...(identity ? { currentUserEmail: identity } : {}),
      });
    };
    const releaseBuffered = (): void => {
      if (identityReleased) return;
      identityReleased = true;
      for (const partial of buffered) emitPartial(partial);
      buffered = [];
    };

    void identityPromise.then((email) => {
      identity = email;
      releaseBuffered();
    });
    const identityTimer = setTimeout(releaseBuffered, IDENTITY_WAIT_MS);

    const onPartial = stream?.onPartial
      ? (partial: LoadPartial): void => {
          if (identityReleased) emitPartial(partial);
          else buffered.push(partial);
        }
      : undefined;

    const [{ data, warnings }, currentUserEmail] = await Promise.all([
      loadAppData(configResult.config, {
        onProgress,
        onPartial,
        requestId: stream?.requestId,
        fetchDetails: false,
      }),
      identityPromise,
    ]);
    clearTimeout(identityTimer);
    releaseBuffered();

    if (currentUserEmail) {
      data.currentUserEmail = currentUserEmail;
    }

    const base = `Loaded ${countTotalPrs(data)} PR(s) from ${data.organizations.length} org(s).`;
    
    // Save live data to cache so next launch is instant
    await writeAppCache(data);

    return {
      data,
      banner:
        warnings.length > 0
          ? `${base} ${warnings.length} warning(s): ${warnings[0]}`
          : base,
      ok: true,
    };
  } catch (cause) {
    const az = await checkAzAvailable();
    if (!az.ok) {
      return { data: { organizations: [] }, banner: az.error, ok: false };
    }
    return {
      data: { organizations: [] },
      banner: `Failed to load data: ${
        cause instanceof Error ? cause.message : String(cause)
      }`,
      ok: false,
    };
  }
};

/** Reloads live data (used by manual/auto refresh). */
export const reloadData = async (
  onProgress?: LoadProgressHandler,
  stream?: StreamOptions,
): Promise<LoadResult> => loadInitialData(false, onProgress, stream);

/**
 * Builds a PrRef from explicit routing parts. Returns null in mock mode (no
 * live target) or when routing info is missing.
 */
export const resolvePrRefFromParts = (parts: {
  organizationUrl: string;
  project: string;
  repository: string;
  prId: number;
}): PrRef | null => {
  if (isMockMode()) {
    return null;
  }
  if (!parts.organizationUrl || !parts.project || !parts.repository || !parts.prId) {
    return null;
  }
  return {
    organization: parts.organizationUrl,
    project: parts.project,
    repository: parts.repository,
    prId: parts.prId,
  };
};

/**
 * Builds a PrRef for a pull request directly from the routing info carried on
 * the PR itself. Returns null in mock mode (no live target) or when routing
 * info is missing (e.g. legacy/mock PRs).
 */
export const resolvePrRef = (pr: PullRequest): PrRef | null =>
  resolvePrRefFromParts({
    organizationUrl: pr.organizationUrl,
    project: pr.project,
    repository: pr.repository,
    prId: pr.id,
  });
