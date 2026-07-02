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
