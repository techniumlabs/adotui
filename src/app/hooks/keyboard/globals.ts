import type { Key } from "ink";
import type { AppHandle } from "../useAppState";
import { FOCUS_ORDER, DEFAULT_COMPLETION_OPTIONS } from "../../constants";
import { openInBrowser } from "../../utils";
import { patchState, updateState } from "../../store";
import type { AppState, FocusArea } from "../../types";

type GlobalCommand = (app: AppHandle, exitApp: () => void) => void;

const TREE_FILTERS = ["me", "with-prs", "all"];

const cycleTreeFilter: GlobalCommand = () =>
  updateState((c) => {
    const nextFilter = TREE_FILTERS[(TREE_FILTERS.indexOf(c.treeFilter) + 1) % TREE_FILTERS.length] ?? "me";
    return { treeFilter: nextFilter, selectedOrgIndex: 0, selectedRepoIndex: 0, selectedPrIndex: 0, banner: `Filter changed to: ${nextFilter}` };
  });

/** Single-key commands that work in any non-modal focus. */
const COMMANDS: Partial<Record<string, GlobalCommand>> = {
  "?": () => updateState((c) => ({ previousFocus: c.focus, focus: "help", banner: "Help view" })),
  q: (_app, exitApp) => { exitApp(); process.exit(0); },
  ":": () => updateState((c) => ({ previousFocus: c.focus, focus: "command", commandText: "", banner: "Command mode." })),
  "/": ({ actions }) => actions.openFilterPrompt(),
  v: cycleTreeFilter,
  V: cycleTreeFilter,
  a: ({ actions }) => actions.armConfirm("approve"),
  x: ({ actions }) => actions.armConfirm("reject"),
  b: ({ actions }) => actions.armConfirm("abandon"),
  c: ({ actions }) => actions.openCompletionEditor(DEFAULT_COMPLETION_OPTIONS),
};

/** PR tabs 1-3 (4 = pipelines, debug builds only). */
const TAB_KEYS: Partial<Record<string, Partial<AppState>>> = {
  "1": { focus: "detail", fileFilter: "", banner: "Focus: Overview" },
  "2": { focus: "files", selectedFileIndex: 0, diffScrollOffset: 0, banner: "Focus: Diff" },
  "3": { focus: "comments", fileFilter: "", banner: "Focus: Comments" },
};
const PR_PANES: readonly FocusArea[] = ["detail", "files", "comments", "runs"];
/** Panes where ← goes back (in Diff and Comments, ← moves within the pane). */
const LEFT_EXITS: readonly FocusArea[] = ["detail", "runs"];

/** Tab switching and "back to the PR list"; only with a PR selected. */
const handlePrNavigation = (input: string, key: Key, focus: FocusArea): boolean => {
  const tab = TAB_KEYS[input];
  if (tab) { patchState(tab); return true; }
  if (input === "4") {
    if (process.env.NODE_ENV === "debug") patchState({ focus: "runs", fileFilter: "", banner: "Focus: Pipelines" });
    return true;
  }
  if ((input === "h" && PR_PANES.includes(focus)) || (key.leftArrow && LEFT_EXITS.includes(focus))) {
    patchState({ focus: "list", fileFilter: "", banner: "Focus: list" });
    return true;
  }
  return false;
};

/** Handles shortcuts that work in any non-special focus (after confirm gate and commentInputActive guard). */
export function handleGlobals(
  input: string,
  key: Key,
  app: AppHandle,
  exitApp: () => void,
): boolean {
  const { state, selectedPr, actions } = app;

  if (key.tab) {
    const delta = key.shift ? -1 : 1;
    updateState((current) => {
      const len = FOCUS_ORDER.length;
      let nextIndex = (FOCUS_ORDER.indexOf(current.focus) + delta + len) % len;
      let nextFocus = FOCUS_ORDER[nextIndex] ?? "tree";
      // Skip panes that are not cycle targets: command mode always, and the
      // pipelines pane outside debug builds.
      while (nextFocus === "command" || (nextFocus === "runs" && process.env.NODE_ENV !== "debug")) {
        nextIndex = (nextIndex + delta + len) % len;
        nextFocus = FOCUS_ORDER[nextIndex] ?? "tree";
      }
      const fileFilter = current.focus === "files" && nextFocus !== "files" ? "" : current.fileFilter;
      return { focus: nextFocus, fileFilter, banner: `Focus: ${nextFocus}` };
    });
    return true;
  }

  if (selectedPr && handlePrNavigation(input, key, state.focus)) return true;

  const command = COMMANDS[input];
  if (command) {
    command(app, exitApp);
    return true;
  }

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
