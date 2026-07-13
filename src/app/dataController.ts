import { loadConfig } from "../data/config";
import {
  checkAzAvailable,
  loadAppData,
  type PrRef,
} from "../data/azure";
import { MOCK_DATA } from "../data/mock";
import { runJson } from "../data/command";
import type { AppData, PullRequest } from "../domain/types";
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

import { readAppCache, writeAppCache } from "../data/cache";

/**
 * Resolves config and loads live data from Azure DevOps. Falls back to mock
 * data when ADOTUI_MOCK is set. Never throws — errors are returned as banners.
 */
export const loadInitialData = async (allowCache = false, onProgress?: (msg: string) => void): Promise<LoadResult> => {
  if (isMockMode()) {
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
    const [{ data, warnings }, currentUserResult] = await Promise.all([
      loadAppData(configResult.config, { onProgress, fetchDetails: false }),
      runJson<{ user?: { name?: string } }>("az", ["account", "show", "--output", "json"]).catch(() => null)
    ]);

    if (currentUserResult?.user?.name) {
      data.currentUserEmail = currentUserResult.user.name;
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
export const reloadData = async (onProgress?: (msg: string) => void): Promise<LoadResult> => loadInitialData(false, onProgress);

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
