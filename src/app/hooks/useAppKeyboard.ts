import { useInput } from "ink";
import { COMPLETION_FIELD_COUNT, DEFAULT_COMPLETION_OPTIONS, FOCUS_ORDER } from "../constants";
import { clamp, cycleMergeStrategy, openInBrowser } from "../utils";
import type { useAppState } from "./useAppState";

export function useAppKeyboard(
  app: ReturnType<typeof useAppState>,
  exitApp: () => void,
) {
  const { state, setState, selectedPr, actions } = app;

  useInput((input, key) => {
    if (key.ctrl && input === "c") {
      exitApp();
      return;
    }

    // Confirmation gate for destructive vote actions (approve/reject).
    if (state.pendingConfirm) {
      const confirmed = input === "y" || key.return;
      const pending = state.pendingConfirm;
      setState((current) => ({ ...current, pendingConfirm: null }));

      if (!confirmed) {
        setState((current) => ({
          ...current,
          banner: `${pending.kind} cancelled.`,
        }));
        return;
      }

      actions.runConfirmedAction(pending);
      return;
    }

    if (state.focus === "completion") {
      if (key.escape) {
        setState((current) => ({
          ...current,
          focus: "list",
          banner: "Completion cancelled.",
        }));
        return;
      }

      // Cursors 4, 5, 6 are free-text fields — only arrow keys navigate there.
      const isTextField = state.completionCursor >= 4 && state.completionCursor <= 6;

      if (key.upArrow || (!isTextField && input === "k")) {
        setState((current) => ({
          ...current,
          completionCursor: clamp(
            current.completionCursor - 1,
            0,
            COMPLETION_FIELD_COUNT - 1,
          ),
        }));
        return;
      }

      if (key.downArrow || (!isTextField && input === "j")) {
        setState((current) => ({
          ...current,
          completionCursor: clamp(
            current.completionCursor + 1,
            0,
            COMPLETION_FIELD_COUNT - 1,
          ),
        }));
        return;
      }

      if (key.tab) {
        setState((current) => ({
          ...current,
          completionCursor: clamp(
            current.completionCursor + 1,
            0,
            COMPLETION_FIELD_COUNT - 1,
          ),
        }));
        return;
      }

      if (key.return) {
        if (state.completionCursor === COMPLETION_FIELD_COUNT - 1) {
          actions.submitCompletion();
        } else {
          setState((current) => ({
            ...current,
            completionCursor: clamp(
              current.completionCursor + 1,
              0,
              COMPLETION_FIELD_COUNT - 1,
            ),
          }));
        }
        return;
      }

      setState((current) => {
        const cursor = current.completionCursor;
        const options = current.completionOptions;

        if (cursor === 0 && (key.leftArrow || input === "h")) {
          const nextStrategy = cycleMergeStrategy(options.mergeStrategy, -1);
          return {
            ...current,
            completionOptions: {
              ...options,
              mergeStrategy: nextStrategy,
              squashMerge: nextStrategy === "squash",
            },
          };
        }

        if (cursor === 0 && (key.rightArrow || input === "l")) {
          const nextStrategy = cycleMergeStrategy(options.mergeStrategy, 1);
          return {
            ...current,
            completionOptions: {
              ...options,
              mergeStrategy: nextStrategy,
              squashMerge: nextStrategy === "squash",
            },
          };
        }

        if (
          cursor === 1 &&
          (key.leftArrow || key.rightArrow || input === " ")
        ) {
          return {
            ...current,
            completionOptions: {
              ...options,
              deleteSourceBranch: !options.deleteSourceBranch,
            },
          };
        }

        if (
          cursor === 2 &&
          (key.leftArrow || key.rightArrow || input === " ")
        ) {
          return {
            ...current,
            completionOptions: {
              ...options,
              transitionWorkItems: !options.transitionWorkItems,
            },
          };
        }

        if (
          cursor === 3 &&
          (key.leftArrow || key.rightArrow || input === " ")
        ) {
          return {
            ...current,
            completionOptions: {
              ...options,
              bypassPolicy: !options.bypassPolicy,
            },
          };
        }

        if (cursor === 4) {
          if (key.backspace || key.delete) {
            return {
              ...current,
              completionOptions: {
                ...options,
                bypassReason: options.bypassReason.slice(0, -1),
              },
            };
          }

          if (!key.ctrl && !key.meta && input && input !== " ") {
            return {
              ...current,
              completionOptions: {
                ...options,
                bypassReason: `${options.bypassReason}${input}`,
              },
            };
          }
        }

        if (cursor === 5) {
          if (key.backspace || key.delete) {
            return {
              ...current,
              completionOptions: {
                ...options,
                mergeCommitMessage: options.mergeCommitMessage.slice(0, -1),
              },
            };
          }

          if (!key.ctrl && !key.meta && input && input !== " ") {
            return {
              ...current,
              completionOptions: {
                ...options,
                mergeCommitMessage: `${options.mergeCommitMessage}${input}`,
              },
            };
          }
        }

        if (cursor === 6) {
          if (key.backspace || key.delete) {
            return {
              ...current,
              completionOptions: {
                ...options,
                autoCompleteIgnoreConfigIds:
                  options.autoCompleteIgnoreConfigIds.slice(0, -1),
              },
            };
          }

          if (!key.ctrl && !key.meta && input && /[0-9,\s]/.test(input)) {
            const text =
              `${options.autoCompleteIgnoreConfigIds.join(",")}${input}`.replace(
                /\s+/g,
                "",
              );
            return {
              ...current,
              completionOptions: {
                ...options,
                autoCompleteIgnoreConfigIds: text
                  .split(",")
                  .map((entry) => Number(entry.trim()))
                  .filter((entry) => Number.isFinite(entry)),
              },
            };
          }
        }

        if (
          cursor === 7 &&
          (key.leftArrow || key.rightArrow || input === " ")
        ) {
          const nextSquash = !options.squashMerge;
          return {
            ...current,
            completionOptions: {
              ...options,
              squashMerge: nextSquash,
              mergeStrategy: nextSquash
                ? "squash"
                : options.mergeStrategy === "squash"
                  ? "noFastForward"
                  : options.mergeStrategy,
            },
          };
        }

        return current;
      });

      return;
    }

    if (state.focus === "command") {
      if (key.escape) {
        setState((current) => ({
          ...current,
          commandText: "",
          focus: "tree",
        }));
        actions.addToast("Command cancelled.", "info");
        return;
      }

      if (key.return) {
        actions.executeCommand(state.commandText);
        return;
      }

      if (key.backspace || key.delete) {
        setState((current) => ({
          ...current,
          commandText: current.commandText.slice(0, -1),
        }));
        return;
      }

      if (!key.ctrl && !key.meta && input) {
        setState((current) => ({
          ...current,
          commandText: `${current.commandText}${input}`,
        }));
      }

      return;
    }

    // ── Guard: suppress global shortcuts if typing ───────────────────────────
    if (state.commentInputActive || state.prFilterMode) {
      return; // swallow global shortcuts so they don't intercept text input
    }

    // ── Global Focus Cycle (Tab) ─────────────────────────────────────────────
    if (key.tab) {
      setState((current) => {
        const nextIndex =
          (FOCUS_ORDER.indexOf(current.focus) + 1) % FOCUS_ORDER.length;
        const nextFocus = FOCUS_ORDER[nextIndex] ?? "tree";
        return {
          ...current,
          focus: nextFocus === "command" ? "tree" : nextFocus,
          banner: `Focus: ${nextFocus === "command" ? "tree" : nextFocus}`,
        };
      });
      return;
    }

    // ── Global Pane Switching (1-4) ──────────────────────────────────────────
    // Allow switching panes from anywhere, as long as a PR is selected.
    if (selectedPr) {
      if (input === "1") {
        setState((current) => ({ ...current, focus: "detail", banner: "Focus: Overview" }));
        return;
      }
      if (input === "2") {
        setState((current) => ({ ...current, focus: "files", selectedFileIndex: 0, diffScrollOffset: 0, banner: "Focus: Diff" }));
        return;
      }
      if (input === "3") {
        setState((current) => ({ ...current, focus: "comments", banner: "Focus: Comments" }));
        return;
      }
      if (input === "4") {
        setState((current) => ({ ...current, focus: "runs", banner: "Focus: Pipelines" }));
        return;
      }

      // Global 'h' to return to PR list from any of the 4 panes
      if ((input === "h") && ["detail", "files", "comments", "runs"].includes(state.focus)) {
        setState((current) => ({ ...current, focus: "list", banner: "Focus: list" }));
        return;
      }
      if ((key.leftArrow) && ["detail", "files", "runs"].includes(state.focus)) {
        setState((current) => ({ ...current, focus: "list", banner: "Focus: list" }));
        return;
      }
    }

    // ── Guard: Prevent global shortcut conflicts ─────────────────────────────
    // If we are in comments or runs (and not typing), we only want to allow 
    // the pane switching shortcuts above. We must return early here so that
    // global shortcuts like 'r' (refresh) don't fire when the user presses 'r'
    // to reply in the CommentsView.
    if (state.focus === "comments" || state.focus === "runs") {
      return;
    }

    if (input === "/") {
      setState((current) => ({
        ...current,
        focus: "command",
        commandText: "",
        banner: "Command mode.",
      }));
      return;
    }

    if (input === "q") {
      exitApp();
      return;
    }

    if (input === "r") {
      actions.doRefresh("manual");
      return;
    }

    if (input === "a") {
      actions.armConfirm("approve");
      return;
    }

    if (input === "x") {
      actions.armConfirm("reject");
      return;
    }

    if (input === "c") {
      actions.openCompletionEditor(DEFAULT_COMPLETION_OPTIONS);
      return;
    }

    if (input === "o" && selectedPr) {
      openInBrowser(selectedPr.url);
      actions.addToast("Opened PR in browser.", "success");
      return;
    }
    // (Removed u/s diff mode shortcuts per user request)

    if (state.focus === "tree") {
      if (input === "j" || key.downArrow) {
        actions.moveTreeSelection(0, 1);
      }

      if (input === "k" || key.upArrow) {
        actions.moveTreeSelection(0, -1);
      }

      if (input === "l" || key.rightArrow || key.return) {
        actions.moveTreeSelection(1, 0, "Organization changed.");
        if (key.return) {
          setState((current) => ({
            ...current,
            focus: "list",
            banner: "Focus: list",
          }));
        }
      }

      if (input === "h" || key.leftArrow) {
        actions.moveTreeSelection(-1, 0, "Organization changed.");
      }

      if (input === "v") {
        setState((current) => {
          const next = current.treeFilter === "all" ? "with-prs" : "all";
          return {
            ...current,
            treeFilter: next,
            banner: next === "with-prs" ? "Filter: showing repos with PRs only." : "Filter: showing all repos.",
          };
        });
      }

      return;
    }

    if (state.focus === "list") {
      // ── PR filter input mode ─────────────────────────────────────────────
      if (state.prFilterMode) {
        if (key.escape) {
          setState((current) => ({
            ...current,
            prFilterMode: false,
            prFilter: "",
            banner: "Filter cleared.",
          }));
          return;
        }
        if (key.return) {
          setState((current) => ({ ...current, prFilterMode: false, banner: `Filtering by: "${current.prFilter}"` }));
          return;
        }
        if (key.backspace || key.delete) {
          setState((current) => ({ ...current, prFilter: current.prFilter.slice(0, -1) }));
          return;
        }
        if (!key.ctrl && !key.meta && input) {
          setState((current) => ({ ...current, prFilter: current.prFilter + input }));
        }
        return;
      }

      // Clear filter with Esc when not in filter-input mode
      if (key.escape && state.prFilter) {
        setState((current) => ({ ...current, prFilter: "", banner: "Filter cleared." }));
        return;
      }

      // Enter filter mode
      if (input === "f") {
        setState((current) => ({
          ...current,
          prFilterMode: true,
          prFilter: "",
          banner: "Filter PRs — type to search, Enter to confirm, Esc to clear",
        }));
        return;
      }

      if (input === "j" || key.downArrow) {
        actions.changePrSelection(1);
      }

      if (input === "k" || key.upArrow) {
        actions.changePrSelection(-1);
      }

      if (input === "h" || key.leftArrow) {
        setState((current) => ({
          ...current,
          focus: "tree",
          banner: "Focus: tree",
        }));
      }

      if (input === "l" || key.rightArrow || key.return) {
        setState((current) => ({
          ...current,
          focus: "detail",
          banner: "Focus: detail",
        }));
      }

      // m → open comments pane
      if (input === "m") {
        setState((current) => ({
          ...current,
          focus: "comments",
          banner: "Comments view. n=new comment  r=reply  h=back",
        }));
      }

      // p → open pipeline runs pane
      if (input === "p") {
        setState((current) => ({
          ...current,
          focus: "runs",
          banner: "Pipeline runs. j/k=navigate  o=open  h=back",
        }));
      }

      return;
    }

    if (state.focus === "detail") {
      if (input === "h" || key.leftArrow) {
        setState((current) => ({
          ...current,
          focus: "list",
          banner: "Focus: list",
        }));
      }

      if (input === "l" || key.rightArrow) {
        setState((current) => ({
          ...current,
          focus: "files",
          selectedFileIndex: 0,
          banner: "Focus: files",
        }));
      }
      return;
    }

    if (state.focus === "files") {
      // ] → next file, [ → prev file, restore scroll states
      if (input === "]") {
        actions.changeFileSelection(1);
        return;
      }

      if (input === "[") {
        actions.changeFileSelection(-1);
        return;
      }

      // PageDown → scroll diff down; PageUp → scroll diff up
      if (key.pageDown) {
        setState((current) => ({
          ...current,
          diffScrollOffset: current.diffScrollOffset + 10,
        }));
        return;
      }

      if (key.pageUp) {
        setState((current) => ({
          ...current,
          diffScrollOffset: Math.max(0, current.diffScrollOffset - 10),
        }));
        return;
      }

      // G → jump to end (large sentinel), g → jump to top
      if (input === "G") {
        setState((current) => ({ ...current, diffScrollOffset: 99999 }));
        return;
      }

      if (input === "g") {
        setState((current) => ({ ...current, diffScrollOffset: 0 }));
        return;
      }

      if (input === "h" || key.leftArrow) {
        setState((current) => ({
          ...current,
          focus: "list",
          banner: "Focus: list",
        }));
        return;
      }

      if (input === "d") {
        setState((current) => ({
          ...current,
          focus: "detail",
          banner: "Focus: detail. Press 'h' for files, 'd' for PR list.",
        }));
        return;
      }
      return;
    }
  });
}
