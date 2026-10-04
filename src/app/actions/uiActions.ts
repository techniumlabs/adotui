import { getState, patchState } from "../store";
import type { AppState } from "../types";

/** PR tabs by their number key. */
const PR_TABS: Partial<Record<string, Partial<AppState>>> = {
  "1": { focus: "detail", fileFilter: "", banner: "Focus: Overview" },
  "2": { focus: "files", selectedFileIndex: 0, diffScrollOffset: 0, banner: "Focus: Diff" },
  "3": { focus: "comments", fileFilter: "", banner: "Focus: Comments" },
};
const PIPELINES_TAB: Partial<AppState> = { focus: "runs", fileFilter: "", banner: "Focus: Pipelines" };

/** Opens the PR tab for `key` (its number key, or a click on its label); false when `key` is no tab key. */
export const openPrTab = (key: string): boolean => {
  if (key === "4") {
    // The key always exists; the tab only in debug builds.
    if (process.env.NODE_ENV === "debug") patchState(PIPELINES_TAB);
    return true;
  }
  const tab = PR_TABS[key];
  if (!tab) return false;
  patchState(tab);
  return true;
};

export const setDiffScrollOffset = (offset: number): void => {
  patchState({ diffScrollOffset: offset });
};

export const setDiffSelectedRow = (row: number): void => {
  patchState({ diffSelectedRow: row });
};

export const setCommentInputActive = (active: boolean): void => {
  if (getState().commentInputActive === active) return;
  patchState({ commentInputActive: active });
};
