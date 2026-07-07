import type { Key } from "ink";
import type { AppHandle } from "../useAppState";
import { FOCUS_ORDER, DEFAULT_COMPLETION_OPTIONS } from "../../constants";
import { openInBrowser } from "../../utils";

/** Handles shortcuts that work in any non-special focus (after confirm gate and commentInputActive guard). */
export function handleGlobals(
  input: string,
  key: Key,
  app: AppHandle,
  exitApp: () => void,
): boolean {
  const { state, setState, selectedPr, actions } = app;

  if (key.tab) {
    setState((current) => {
      const nextIndex = (FOCUS_ORDER.indexOf(current.focus) + 1) % FOCUS_ORDER.length;
      const nextFocus = FOCUS_ORDER[nextIndex] ?? "tree";
      const resolved = nextFocus === "command" ? "tree" : nextFocus;
      const fileFilter = current.focus === "files" && resolved !== "files" ? "" : current.fileFilter;
      return { ...current, focus: resolved, fileFilter, banner: `Focus: ${resolved}` };
    });
    return true;
  }

  if (selectedPr) {
    if (input === "1") { setState((c) => ({ ...c, focus: "detail", fileFilter: "", banner: "Focus: Overview" })); return true; }
    if (input === "2") { setState((c) => ({ ...c, focus: "files", selectedFileIndex: 0, diffScrollOffset: 0, banner: "Focus: Diff" })); return true; }
    if (input === "3") { setState((c) => ({ ...c, focus: "comments", fileFilter: "", banner: "Focus: Comments" })); return true; }
    if (input === "4") { setState((c) => ({ ...c, focus: "runs", fileFilter: "", banner: "Focus: Pipelines" })); return true; }

    if (input === "h" && ["detail", "files", "comments", "runs"].includes(state.focus)) {
      setState((c) => ({ ...c, focus: "list", fileFilter: "", banner: "Focus: list" })); return true;
    }
    if (key.leftArrow && ["detail", "files", "runs"].includes(state.focus)) {
      setState((c) => ({ ...c, focus: "list", fileFilter: "", banner: "Focus: list" })); return true;
    }
  }

  if (input === "?") {
    setState((c) => ({ ...c, previousFocus: c.focus, focus: "help", banner: "Help view" }));
    return true;
  }
  if (input === "q") { exitApp(); process.exit(0); return true; }
  if (input === "/") {
    setState((c) => ({ ...c, previousFocus: c.focus, focus: "command", commandText: "", banner: "Command mode." }));
    return true;
  }
  if (input === "a") { actions.armConfirm("approve"); return true; }
  if (input === "x") { actions.armConfirm("reject"); return true; }
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
