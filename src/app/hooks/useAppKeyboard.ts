import { useInput } from "ink";
import type { useAppState } from "./useAppState";
import { handleGlobals } from "./keyboard/globals";
import { handleHelp } from "./keyboard/helpKeyboard";
import { handleCompletion } from "./keyboard/completionKeyboard";
import { handleCommand } from "./keyboard/commandKeyboard";
import { handleTree } from "./keyboard/treeKeyboard";
import { handleList } from "./keyboard/listKeyboard";
import { handleDetail } from "./keyboard/detailKeyboard";
import { handleFiles } from "./keyboard/filesKeyboard";

type AppHandle = ReturnType<typeof useAppState>;

export function useAppKeyboard(app: AppHandle, exitApp: () => void) {
  const { state, setState, actions } = app;

  useInput(
    (input, key) => {
      // 1. Ctrl+C always exits immediately
      if (key.ctrl && input === "c") { exitApp(); process.exit(0); return; }
    

    // 2. Confirmation gate — awaiting y/n for a destructive action
    if (state.pendingConfirm) {
      const confirmed = input === "y" || key.return;
      const pending = state.pendingConfirm;
      setState((c) => ({
        ...c,
        pendingConfirm: null,
        banner: confirmed ? c.banner : `${pending.kind} cancelled.`,
      }));
      if (confirmed) {
        actions.runConfirmedAction(pending);
      }
      return;
    }

    // 3. Modal focus handlers (handle the entire input exclusively)
    if (state.focus === "help")       { handleHelp(input, key, app, exitApp); return; }
    if (state.focus === "completion") { handleCompletion(input, key, app, exitApp); return; }
    if (state.focus === "command")    { handleCommand(input, key, app, exitApp); return; }

    // 4. Guard: suppress global shortcuts while comment input is active
    if (state.commentInputActive) return;

    // 5. Global shortcuts (Tab, pane switch, ?, q, /, a, x, c, r, o)
    if (handleGlobals(input, key, app, exitApp)) return;

    // 6. Per-focus navigation handlers
    if (state.focus === "tree")   { handleTree(input, key, app, exitApp); return; }
    if (state.focus === "list")   { handleList(input, key, app, exitApp); return; }
    if (state.focus === "detail") { handleDetail(input, key, app, exitApp); return; }
    if (state.focus === "files")  { handleFiles(input, key, app, exitApp); return; }
    // "comments" and "runs" — handled by their own internal components; globals guard is enough
    },
    { isActive: state.loadState !== "setup" }
  );
}
