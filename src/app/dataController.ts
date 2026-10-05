import { loadConfig } from "../data/config";
import {
  getCurrentIdentity,
  loadAppData,
  type LoadPartial,
  type LoadProgress,
  type PrRef,
} from "../data/azure";
import { clearAuthHeaderCache } from "../data/azureAuth";
import { readAppCache, writeAppCache } from "../data/cache";
import { MOCK_DATA } from "../data/mock";
import type { AppData, RepositoryNode } from "../domain/types";
import { countTotalPrs } from "./utils";
import { IDENTITY_WAIT_MS } from "./constants";

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

/** The PAT this module copied from the config into the environment, if any. */
let patFromConfig: string | undefined;
/** What AZURE_DEVOPS_EXT_PAT held before the config's PAT replaced it. */
let envPatBefore: string | undefined;

/**
 * The config's `pat` becomes AZURE_DEVOPS_EXT_PAT, which every request reads.
 * Config is re-read on each refresh, so a `pat` that was deleted from it must
 * leave the environment too — otherwise the old (maybe bad) PAT keeps winning
 * over `az login` until a restart. Only what this function put there is taken
 * back out, and a PAT the user had exported themselves is restored.
 */
export const applyConfigPat = (pat: string | undefined): void => {
  if (pat) {
    if (patFromConfig === undefined) envPatBefore = process.env.AZURE_DEVOPS_EXT_PAT;
    process.env.AZURE_DEVOPS_EXT_PAT = pat;
    patFromConfig = pat;
    return;
  }
  if (patFromConfig === undefined) return;
  // Leave alone anything that changed the variable since (it is not ours to undo).
  if (process.env.AZURE_DEVOPS_EXT_PAT === patFromConfig) {
    if (envPatBefore === undefined) delete process.env.AZURE_DEVOPS_EXT_PAT;
    else process.env.AZURE_DEVOPS_EXT_PAT = envPatBefore;
    clearAuthHeaderCache(); // the next request acquires an az token (or uses the restored PAT)
  }
  patFromConfig = undefined;
  envPatBefore = undefined;
};

const resolveCurrentUser = async (organization: string): Promise<string | null> => {
  if (cachedUserEmail !== undefined) return cachedUserEmail;
  // Asked of the first configured organization: one config is one sign-in.
  cachedUserEmail = (await getCurrentIdentity(organization))?.email ?? null;
  return cachedUserEmail;
};

/**
 * Replays MOCK_DATA as timed partials so streaming is demoable offline:
 *   ADOTUI_MOCK=1 ADOTUI_MOCK_STREAM=1 bun run start
 * ADOTUI_MOCK_STREAM_MS is the pause between steps; ADOTUI_MOCK_STREAM_BATCH
 * (default 1) is how many projects arrive per step. Tests use a bigger batch:
 * a CI runner's timers fire 30-170ms late, so 106 separate waits took seconds,
 * while a handful of longer ones keeps the replay short and its length stable.
 */
const mockStreamDelayMs = (): number => {
  const configured = Number(process.env.ADOTUI_MOCK_STREAM_MS);
  return Number.isFinite(configured) && configured >= 0 ? configured : 60;
};

const mockStreamBatch = (): number => {
  const configured = Math.floor(Number(process.env.ADOTUI_MOCK_STREAM_BATCH));
  return Number.isFinite(configured) && configured >= 1 ? configured : 1;
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

  const batch = mockStreamBatch();
  let sinceWait = 0;
  for (const org of orgs) emit(org, null, []);
  for (const org of orgs) {
    for (const [project, repositories] of projectsOf(org)) {
      if (sinceWait % batch === 0) await Bun.sleep(mockStreamDelayMs());
      sinceWait += 1;
      current += 1;
      emit(org, project, repositories);
    }
  }
};

export type LoadProgressHandler = (msg: string, progress?: LoadProgress) => void;

/**
 * Resolves config and loads live data from Azure DevOps. Falls back to mock
 * data when ADOTUI_MOCK is set. Never throws — errors are returned as banners.
 */
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

  applyConfigPat(configResult.config.pat);

  if (allowCache) {
    const cachedData = await readAppCache(configResult.config);
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
    const identityPromise = resolveCurrentUser(configResult.config.projects[0]!.organization);
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
    await writeAppCache(data, configResult.config);

    return {
      data,
      banner:
        warnings.length > 0
          ? `${base} ${warnings.length} warning(s): ${warnings[0]}`
          : base,
      ok: true,
    };
  } catch (cause) {
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
  lastMergeSourceCommit?: string;
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
    ...(parts.lastMergeSourceCommit ? { lastMergeSourceCommit: parts.lastMergeSourceCommit } : {}),
  };
};
