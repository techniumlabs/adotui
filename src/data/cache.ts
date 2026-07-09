import type { PrCommentThread, PipelineRun } from "../domain/types";

type CacheEntry<T> = { value: T; expiresAt: number };

const TTL_MS = 2 * 60 * 1000; // 2 minutes

const commentCache = new Map<string, CacheEntry<PrCommentThread[]>>();
const runsCache = new Map<string, CacheEntry<PipelineRun[]>>();

const isAlive = <T>(entry: CacheEntry<T> | undefined): entry is CacheEntry<T> =>
  entry !== undefined && Date.now() < entry.expiresAt;

const makeEntry = <T>(value: T): CacheEntry<T> => ({
  value,
  expiresAt: Date.now() + TTL_MS,
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

import { homedir } from "node:os";
import { join } from "node:path";
import type { AppData } from "../domain/types";

const APP_CACHE_DIR = join(homedir(), ".cache", "adotui");
const APP_CACHE_FILE = join(APP_CACHE_DIR, "data_cache.json");

/**
 * Reads the cached AppData from disk if it exists.
 */
export const readAppCache = async (): Promise<AppData | null> => {
  try {
    const file = Bun.file(APP_CACHE_FILE);
    if (await file.exists()) {
      return (await file.json()) as AppData;
    }
  } catch (_err) {
    // Ignore cache read errors (corrupted JSON, etc)
  }
  return null;
};

/**
 * Writes the live AppData to the cache directory asynchronously.
 */
export const writeAppCache = async (data: AppData): Promise<void> => {
  try {
    await Bun.write(APP_CACHE_FILE, JSON.stringify(data, null, 2));
  } catch (_err) {
    // Silently ignore cache write errors
  }
};
