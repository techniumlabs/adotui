import { useEffect, useMemo, useState } from "react";
import type { AppState } from "../types";
import { SPLASH_EMPTY_DISMISS_MS } from "../constants";

/**
 * The two screens before the main UI: the splash (until real repositories
 * arrive) and the setup wizard (kept mounted while the load it kicked off
 * runs, so it can show fetch progress before handing over).
 */
export function useStartupScreens(state: Pick<AppState, "loadState" | "data">) {
  const [showSplash, setShowSplash] = useState(process.env.NODE_ENV !== "test");
  const [setupLoading, setSetupLoading] = useState(false);

  // The load streams in, so the tree can be shown the moment real
  // repositories land. Dismissing on the first ORGANIZATION would swap the
  // splash for an empty tree, which is worse than the splash itself.
  const hasRepositories = useMemo(
    () => state.data.organizations.some((org) => org.repositories.length > 0),
    [state.data],
  );

  useEffect(() => {
    if (state.loadState === "setup") {
      setShowSplash(false);
      return;
    }
    if (!showSplash) return;
    if (hasRepositories) {
      setShowSplash(false);
      return;
    }
    // Nothing arrived at all (empty config, or an error): dismiss shortly
    // after the load settles rather than holding a splash over a finished
    // screen.
    if (state.loadState !== "loading") {
      const t = setTimeout(() => setShowSplash(false), SPLASH_EMPTY_DISMISS_MS);
      return () => clearTimeout(t);
    }
  }, [state.loadState, hasRepositories, showSplash]);

  // Once the setup-initiated load settles, hand over to the main UI.
  useEffect(() => {
    if (setupLoading && (state.loadState === "ready" || state.loadState === "error")) {
      setSetupLoading(false);
    }
  }, [state.loadState, setupLoading]);

  return { showSplash, setupLoading, beginSetupLoad: () => setSetupLoading(true) };
}
