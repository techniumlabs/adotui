import { createHash } from "node:crypto";
import { unlink } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { AppData, PrCommentThread, PipelineRun } from "../domain/types";
import type { AdoConfig } from "./config";
import { CACHE_KEY_HASH_CHARS, VIEW_CACHE_TTL_MS } from "./constants";

type CacheEntry<T> = { value: T; expiresAt: number };

const commentCache = new Map<string, CacheEntry<PrCommentThread[]>>();
const runsCache = new Map<string, CacheEntry<PipelineRun[]>>();

const isAlive = <T>(entry: CacheEntry<T> | undefined): entry is CacheEntry<T> =>
  entry !== undefined && Date.now() < entry.expiresAt;

const makeEntry = <T>(value: T): CacheEntry<T> => ({
  value,
  expiresAt: Date.now() + VIEW_CACHE_TTL_MS,
});

// ─── Comments ────────────────────────────────────────────────────────────────

export const getCommentCache = (key: string): PrCommentThread[] | null => {
  const entry = commentCache.get(key);
  return isAlive(entry) ? entry.value : null;
};

export const setCommentCache = (key: string, threads: PrCommentThread[]): void => {
  commentCache.set(key, makeEntry(threads));
};

export const invalidateCommentCache = (key: string): void => {
  commentCache.delete(key);
};

export const commentCacheKey = (
  organizationUrl: string,
  project: string,
  repositoryId: string,
  prId: number,
): string => `${organizationUrl}|${project}|${repositoryId}|${prId}`;

// ─── Pipeline Runs ────────────────────────────────────────────────────────────

export const getRunsCache = (key: string): PipelineRun[] | null => {
  const entry = runsCache.get(key);
  return isAlive(entry) ? entry.value : null;
};

export const setRunsCache = (key: string, runs: PipelineRun[]): void => {
  runsCache.set(key, makeEntry(runs));
};

export const runsCacheKey = (organizationUrl: string, project: string): string =>
  `${organizationUrl}|${project}`;


// ─── Whole-app data (on disk) ────────────────────────────────────────────────

/** Overridable so tests (and users) can keep the cache off the real home directory. */
const appCacheDir = (): string => process.env.ADOTUI_CACHE_DIR || join(homedir(), ".cache", "adotui");

/**
 * The cache is keyed by what changes a load's result. The PAT is deliberately
 * left out: it grants access but does not change the data, and a credential
 * must not influence a file name.
 */
const appCacheFile = (config: AdoConfig): string => {
  const key = createHash("sha256")
    .update(JSON.stringify([config.projects, config.status, config.top, config.reviewer, config.creator]))
    .digest("hex")
    .slice(0, CACHE_KEY_HASH_CHARS);
  return join(appCacheDir(), `data_cache-${key}.json`);
};

/** Single shared file used before the cache was keyed per config. */
const LEGACY_APP_CACHE_FILE = "data_cache.json";

/**
 * Reads the cached AppData for this config from disk, if any. A different
 * config never sees another config's cache (it would flash its organizations
 * until the first load replaced them).
 */
export const readAppCache = async (config: AdoConfig): Promise<AppData | null> => {
  try {
    return (await Bun.file(appCacheFile(config)).json()) as AppData;
  } catch (_err) {
    // Ignore cache read errors (missing file, corrupted JSON, etc)
  }
  return null;
};

/**
 * Writes the live AppData for this config to the cache directory.
 * ponytail: files for configs no longer used are never pruned; add a cap if configs churn.
 */
export const writeAppCache = async (data: AppData, config: AdoConfig): Promise<void> => {
  try {
    // Bun.write creates missing parent directories.
    await Bun.write(appCacheFile(config), JSON.stringify(data));
    // The old shared file would otherwise linger forever holding another config's PRs.
    await unlink(join(appCacheDir(), LEGACY_APP_CACHE_FILE)).catch(() => {});
  } catch (_err) {
    // Silently ignore cache write errors
  }
};
