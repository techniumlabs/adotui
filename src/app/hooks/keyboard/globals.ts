import type { Key } from "ink";
import type { AppHandle } from "../useAppState";
import { FOCUS_ORDER, DEFAULT_COMPLETION_OPTIONS } from "../../constants";
import { openInBrowser } from "../../utils";
import { patchState, updateState } from "../../store";

/** Handles shortcuts that work in any non-special focus (after confirm gate and commentInputActive guard). */
export function handleGlobals(
  input: string,
  key: Key,
  app: AppHandle,
  exitApp: () => void,
): boolean {
  const { state, selectedPr, actions } = app;

  if (key.tab) {
    updateState((current) => {
      let nextIndex = (FOCUS_ORDER.indexOf(current.focus) + 1) % FOCUS_ORDER.length;
      let nextFocus = FOCUS_ORDER[nextIndex] ?? "tree";
      if (nextFocus === "runs" && process.env.NODE_ENV !== "debug") {
        nextIndex = (nextIndex + 1) % FOCUS_ORDER.length;
        nextFocus = FOCUS_ORDER[nextIndex] ?? "tree";
      }
      const resolved = nextFocus === "command" ? "tree" : nextFocus;
      const fileFilter = current.focus === "files" && resolved !== "files" ? "" : current.fileFilter;
      return { focus: resolved, fileFilter, banner: `Focus: ${resolved}` };
    });
    return true;
  }

  if (selectedPr) {
    if (input === "1") { patchState({ focus: "detail", fileFilter: "", banner: "Focus: Overview" }); return true; }
    if (input === "2") { patchState({ focus: "files", selectedFileIndex: 0, diffScrollOffset: 0, banner: "Focus: Diff" }); return true; }
    if (input === "3") { patchState({ focus: "comments", fileFilter: "", banner: "Focus: Comments" }); return true; }
    if (input === "4") {
      if (process.env.NODE_ENV === "debug") {
        patchState({ focus: "runs", fileFilter: "", banner: "Focus: Pipelines" });
      }
      return true;
    }

    if (input === "h" && ["detail", "files", "comments", "runs"].includes(state.focus)) {
      patchState({ focus: "list", fileFilter: "", banner: "Focus: list" }); return true;
    }
    if (key.leftArrow && ["detail", "files", "runs"].includes(state.focus)) {
      patchState({ focus: "list", fileFilter: "", banner: "Focus: list" }); return true;
    }
  }

  if (input === "?") {
    updateState((c) => ({ previousFocus: c.focus, focus: "help", banner: "Help view" }));
    return true;
  }
  if (input === "q") { exitApp(); process.exit(0); return true; }
  if (input === "/") {
    updateState((c) => ({ previousFocus: c.focus, focus: "command", commandText: "", banner: "Command mode." }));
    return true;
  }
  if (input === "v" || input === "V") {
    updateState((c) => {
      const filters = ["me", "with-prs", "all"];
      const currentIndex = filters.indexOf(c.treeFilter);
      const nextIndex = (currentIndex + 1) % filters.length;
      const nextFilter = filters[nextIndex] ?? "me";
      return { treeFilter: nextFilter, selectedOrgIndex: 0, selectedRepoIndex: 0, selectedPrIndex: 0, banner: `Filter changed to: ${nextFilter}` };
    });
    return true;
  }
  if (input === "a") { actions.armConfirm("approve"); return true; }
  if (input === "x") { actions.armConfirm("reject"); return true; }
  if (input === "b") { actions.armConfirm("abandon"); return true; }
  if (input === "c") { actions.openCompletionEditor(DEFAULT_COMPLETION_OPTIONS); return true; }

  // Guard: suppress r/o shortcuts when focus is comments or runs
  if (state.focus === "comments" || state.focus === "runs") return true;

  if (input === "r") { actions.doRefresh("manual"); return true; }
  if (input === "o" && selectedPr) {
    openInBrowser(selectedPr.url);
    actions.addToast("Opened PR in browser.", "success");
    return true;
  }

  return false;
}
