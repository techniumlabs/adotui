import { useCallback, useEffect, useRef } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { AppState } from "../types";
import { REFRESH_INTERVAL_MS } from "../constants";
import { clamp, getVisiblePrs } from "../utils";
import { loadInitialData, reloadData } from "../dataController";
import { useAppStore } from "../store";

type AddToast = (msg: string, type?: "info" | "success" | "error") => void;

export function useRefresh(
  autoRefresh: boolean,
  setState: Dispatch<SetStateAction<AppState>>,
  addToast: AddToast,
) {
  const isRefreshingRef = useRef(false);
  const pendingReasonRef = useRef<"manual" | "initial" | null>(null);

  const doRefresh = useCallback((reason: "manual" | "auto" | "initial") => {
    // The setup screen owns the app while it's open — background auto-refresh
    // would collide with the load kicked off by "Save & Load Configuration".
    if (reason === "auto" && useAppStore.getState().loadState === "setup") return;
    if (isRefreshingRef.current) {
      // Never drop a user-initiated refresh: run it after the current one.
      if (reason !== "auto") pendingReasonRef.current = reason;
      return;
    }
    isRefreshingRef.current = true;

    if (reason !== "auto") {
      setState((current) => ({
        ...current,
        loadState: "loading",
        loadProgress: null,
        banner:
          reason === "initial"
            ? "Loading pull requests from Azure DevOps..."
            : "Refreshing from Azure DevOps...",
      }));
    }

    const onProgress = (msg: string, progress?: { current: number; total: number }) => {
      setState((current) => ({
        ...current,
        banner: msg,
        ...(progress ? { loadProgress: progress } : {}),
      }));
    };

    const load = () =>
      reason === "initial" ? loadInitialData(true, onProgress) : reloadData(onProgress);

    void load()
      .then((result) => {
        if (!result.ok && result.errorType !== "missing") {
          addToast(result.banner, "error");
        }
        if (result.fromCache) {
          setTimeout(() => doRefresh("auto"), 50);
        }
        setState((current) => {
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
            ...current,
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
        isRefreshingRef.current = false;
        const pending = pendingReasonRef.current;
        pendingReasonRef.current = null;
        if (pending) doRefresh(pending);
      });
  }, [setState, addToast]);

  // Auto-refresh interval
  useEffect(() => {
    if (!autoRefresh) return;
    const timer = setInterval(() => doRefresh("auto"), REFRESH_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [autoRefresh, doRefresh]);

  return { doRefresh };
}
