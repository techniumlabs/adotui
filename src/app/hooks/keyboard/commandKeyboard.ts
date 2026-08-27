import type { Key } from "ink";
import type { AppHandle } from "../useAppState";
import { patchState, updateState } from "../../store";

export function handleCommand(input: string, key: Key, app: AppHandle, exitApp: () => void): void {
  const { actions } = app;

  if (key.escape) {
    patchState({ commandText: "", focus: "tree" });
    actions.addToast("Command cancelled.", "info");
    return;
  }
  if (key.return) { actions.executeCommand(app.state.commandText, exitApp); return; }
  if (key.backspace || key.delete) {
    updateState((c) => ({ commandText: c.commandText.slice(0, -1) }));
    return;
  }
  if (!key.ctrl && !key.meta && input) {
    updateState((c) => ({ commandText: `${c.commandText}${input}` }));
  }
}
