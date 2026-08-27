import { useEffect, useMemo } from "react";
import { useAppStore } from "../store";
import { selectSelectedOrg, selectSelectedRepo } from "../selectors";
import { countActivePrs, countTotalPrs, getVisiblePrs } from "../utils";
import { REFRESH_INTERVAL_MS } from "../constants";
import { appActions } from "../actions";

/** Shared type for the return value of useAppState, used by keyboard handlers. */
export type AppHandle = ReturnType<typeof useAppState>;

/**
 * Root state hook: subscribes to the store, derives the current selection,
 * and owns the app lifecycle effects (initial load, auto-refresh interval).
 * All mutations live in `src/app/actions/` — `actions` is a stable
 * module-level object, so its identity never invalidates children or effects.
 */
export function useAppState() {
  const state = useAppStore();

  const selectedOrg = selectSelectedOrg(state);
  const selectedRepo = selectSelectedRepo(state);

  const visiblePrs = useMemo(
    () => getVisiblePrs(selectedRepo, state.treeFilter, state.data.currentUserEmail),
    [selectedRepo, state.treeFilter, state.data.currentUserEmail],
  );
  const selectedPr = visiblePrs[state.selectedPrIndex];

  const totalPrs = useMemo(() => countTotalPrs(state.data), [state.data]);
  const repoCount = useMemo(
    () => state.data.organizations.reduce((acc, org) => acc + org.repositories.length, 0),
    [state.data],
  );
  const activePrs = useMemo(() => countActivePrs(state.data), [state.data]);

  // Initial data load.
  useEffect(() => {
    appActions.doRefresh("initial");
  }, []);

  // Auto-refresh interval.
  useEffect(() => {
    if (!state.autoRefresh) return;
    const timer = setInterval(() => appActions.doRefresh("auto"), REFRESH_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [state.autoRefresh]);

  return {
    state,
    selectedOrg,
    selectedRepo,
    visiblePrs,
    selectedPr,
    totalPrs,
    repoCount,
    activePrs,
    actions: appActions,
  };
}
