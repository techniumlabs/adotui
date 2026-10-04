import { loadInitialData, reloadData, type LoadResult } from "../dataController";
import type { AppData } from "../../domain/types";
import type { LoadState } from "../types";
import { CACHE_REVALIDATE_DELAY_MS, PARTIAL_COMMIT_MS, PROGRESS_THROTTLE_MS } from "../constants";
import { getState, patchState, updateState } from "../store";
import { clampSelection } from "../selectors";
import { addToast } from "./toastActions";
import { mergeLoadPartials } from "./mergePartial";
import type { LoadPartial } from "../../data/azure";

export type RefreshReason = "manual" | "auto" | "initial";

/** Module-level guards: the store is module-global, so these are too. */
let isRefreshing = false;
let pendingReason: "manual" | "initial" | null = null;

/**
 * Monotonic id of the in-flight load. The isRefreshing mutex serializes loads,
 * but a superseded load's in-flight promises still resolve afterwards, so
 * every streamed event is checked against this before it reaches the store.
 */
let loadEpoch = 0;

let partialQueue: LoadPartial[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let lastFlushAt = 0;
let streamedAny = false;

const clearFlushTimer = (): void => {
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
};

/**
 * Folds the buffered partials into a single commit.
 *
 * Guards run BEFORE the store is touched and the commit is skipped when
 * nothing actually changed: zustand notifies every listener on any set, and
 * useAppState subscribes without a selector, so even a no-op update costs a
 * full frame.
 */
const flushPartials = (epoch: number): void => {
  clearFlushTimer();
  if (epoch !== loadEpoch) {
    partialQueue = [];
    return;
  }
  if (partialQueue.length === 0) return;

  const batch = partialQueue;
  partialQueue = [];
  lastFlushAt = Date.now();

  const current = getState();
  const data = mergeLoadPartials(current.data, batch);
  const progress = batch[batch.length - 1]!.progress;
  const progressChanged =
    current.loadProgress?.current !== progress.current ||
    current.loadProgress?.total !== progress.total;

  if (data === current.data && !progressChanged) return;

  streamedAny = true;
  patchState({ data, loadProgress: progress, ...clampSelection(current, data) });
};

/** Test hook: drops in-flight bookkeeping so suites do not leak into each other. */
export const resetRefreshState = (): void => {
  clearFlushTimer();
  partialQueue = [];
  streamedAny = false;
  isRefreshing = false;
  pendingReason = null;
  loadEpoch += 1;
};

/** The tree once a load finishes (see the comment at the call site). */
const settledData = (current: AppData, result: LoadResult, keepStreamed: boolean): AppData => {
  if (!result.ok) return current;
  if (!keepStreamed) return result.data;
  const email = result.data.currentUserEmail;
  return email && email !== current.currentUserEmail ? { ...current, currentUserEmail: email } : current;
};

/** The banner once a load finishes. */
const settledBanner = (result: LoadResult, reason: RefreshReason, isMissingConfig: boolean): string => {
  if (isMissingConfig) {
    return result.ok ? "Welcome to the configuration setup wizard!" : "No configuration found. Welcome to initial setup!";
  }
  if (!result.ok) return "Failed to load data. See toast for details.";
  return reason === "auto" ? `Auto-refresh synced. ${result.banner}` : result.banner;
};

export const doRefresh = (reason: RefreshReason): void => {
  // The setup screen owns the app while it's open — background auto-refresh
  // would collide with the load kicked off by "Save & Load Configuration".
  if (reason === "auto" && getState().loadState === "setup") return;
  if (isRefreshing) {
    // Never drop a user-initiated refresh: run it after the current one.
    if (reason !== "auto") pendingReason = reason;
    return;
  }
  isRefreshing = true;
  const epoch = ++loadEpoch;
  clearFlushTimer();
  partialQueue = [];
  streamedAny = false;

  if (reason !== "auto") {
    patchState({
      loadState: "loading",
      loadProgress: null,
      banner:
        reason === "initial"
          ? "Loading pull requests from Azure DevOps..."
          : "Refreshing from Azure DevOps...",
    });
  }

  // Throttle progress updates: with many projects these fire far faster
  // than the terminal can comfortably repaint, and each one re-renders the
  // whole frame. Final (current === total) updates always pass through.
  let lastProgressAt = 0;
  const onProgress = (msg: string, progress?: { current: number; total: number }) => {
    const now = Date.now();
    const isFinal = progress !== undefined && progress.current >= progress.total;
    if (!isFinal && now - lastProgressAt < PROGRESS_THROTTLE_MS) {
      return;
    }
    lastProgressAt = now;
    patchState({
      banner: msg,
      ...(progress ? { loadProgress: progress } : {}),
    });
  };

  // Auto refreshes run silently: progress updates would tick the banner
  // (and force repaints) while the user is working. Their partials are still
  // collected, but only folded in by the trailing flush - one commit - so they
  // go through the same upsert as a manual refresh: repos keep their place,
  // loaded PR details survive, and a project that fails to load keeps its rows.
  const streaming = reason !== "auto";
  const progressHandler = streaming ? onProgress : undefined;

  const onPartial = (partial: LoadPartial): void => {
    if (partial.requestId !== epoch || epoch !== loadEpoch) return;
    partialQueue.push(partial);
    if (!streaming || flushTimer) return;
    const delay = Math.max(0, PARTIAL_COMMIT_MS - (Date.now() - lastFlushAt));
    flushTimer = setTimeout(() => flushPartials(epoch), delay);
  };

  const stream = { onPartial, requestId: epoch };
  const load = () =>
    reason === "initial"
      ? loadInitialData(true, progressHandler, stream)
      : reloadData(progressHandler, stream);

  void load()
    .then((result) => {
      // Trailing flush: the buffered tail must land before the final commit
      // composes its state, or a late partial would re-appear afterwards.
      flushPartials(epoch);
      if (epoch !== loadEpoch) return;

      if (!result.ok && result.errorType !== "missing") {
        addToast(result.banner, "error");
      }
      if (result.fromCache) {
        setTimeout(() => doRefresh("auto"), CACHE_REVALIDATE_DELAY_MS);
      }
      updateState((current) => {
        // A streamed load's accumulated tree IS what the user just watched
        // build, in arrival order. Replacing it with result.data (config
        // order) would re-shuffle the rows at the very end and move the
        // selection, so only adopt result.data when nothing streamed. A failed
        // load returns an empty tree: keep what is on screen instead.
        const keepStreamed = streamedAny && result.ok && !result.fromCache;
        const nextData = settledData(current.data, result, keepStreamed);

        const isMissingConfig = (!result.ok && result.errorType === "missing") || process.env.ADOTUI_FORCE_SETUP === "1";
        let nextLoadState: LoadState = result.ok ? "ready" : "error";
        if (isMissingConfig) nextLoadState = "setup";

        return {
          loadProgress: null,
          data: nextData,
          ...clampSelection(current, nextData),
          lastRefreshISO: new Date().toISOString(),
          loadState: nextLoadState,
          banner: settledBanner(result, reason, isMissingConfig),
        };
      });
    })
    .finally(() => {
      clearFlushTimer();
      partialQueue = [];
      isRefreshing = false;
      const pending = pendingReason;
      pendingReason = null;
      if (pending) doRefresh(pending);
    });
};
