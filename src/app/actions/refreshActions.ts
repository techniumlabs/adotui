import { clamp, getVisiblePrs } from "../utils";
import { loadInitialData, reloadData } from "../dataController";
import { getState, patchState, updateState } from "../store";
import { addToast } from "./toastActions";

export type RefreshReason = "manual" | "auto" | "initial";

/** Module-level guards: the store is module-global, so these are too. */
let isRefreshing = false;
let pendingReason: "manual" | "initial" | null = null;

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
    if (!isFinal && now - lastProgressAt < 250) {
      return;
    }
    lastProgressAt = now;
    patchState({
      banner: msg,
      ...(progress ? { loadProgress: progress } : {}),
    });
  };

  // Auto refreshes run silently: progress updates would tick the banner
  // (and force repaints) while the user is working.
  const progressHandler = reason === "auto" ? undefined : onProgress;
  const load = () =>
    reason === "initial" ? loadInitialData(true, progressHandler) : reloadData(progressHandler);

  void load()
    .then((result) => {
      if (!result.ok && result.errorType !== "missing") {
        addToast(result.banner, "error");
      }
      if (result.fromCache) {
        setTimeout(() => doRefresh("auto"), 50);
      }
      updateState((current) => {
        const orgCount = result.data.organizations.length;
        const nextOrgIndex = clamp(current.selectedOrgIndex, 0, Math.max(0, orgCount - 1));
        const nextOrg = result.data.organizations[nextOrgIndex];
        const repoCount = nextOrg?.repositories.length ?? 0;
        const nextRepoIndex = clamp(current.selectedRepoIndex, 0, Math.max(0, repoCount - 1));
        const nextRepo = nextOrg?.repositories[nextRepoIndex];
        const nextVisible = getVisiblePrs(nextRepo, current.treeFilter, result.data.currentUserEmail);

        const isMissingConfig = (!result.ok && result.errorType === "missing") || process.env.ADOTUI_FORCE_SETUP === "1";
        const nextLoadState = isMissingConfig ? "setup" : (result.ok ? "ready" : "error");

        return {
          loadProgress: null,
          data: result.data,
          selectedOrgIndex: nextOrgIndex,
          selectedRepoIndex: nextRepoIndex,
          selectedPrIndex: clamp(current.selectedPrIndex, 0, Math.max(0, nextVisible.length - 1)),
          lastRefreshISO: new Date().toISOString(),
          loadState: nextLoadState,
          banner: result.ok
            ? (isMissingConfig
              ? "Welcome to the configuration setup wizard!"
              : (reason === "auto"
                ? `Auto-refresh synced. ${result.banner}`
                : result.banner))
            : isMissingConfig
              ? "No configuration found. Welcome to initial setup!"
              : "Failed to load data. See toast for details.",
        };
      });
    })
    .finally(() => {
      isRefreshing = false;
      const pending = pendingReason;
      pendingReason = null;
      if (pending) doRefresh(pending);
    });
};
