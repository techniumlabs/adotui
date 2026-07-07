import type { Key } from "ink";
import type { AppHandle } from "../useAppState";

export function handleCommand(input: string, key: Key, app: AppHandle, _exitApp: () => void): void {
  const { setState, actions } = app;

  if (key.escape) {
    setState((c) => ({ ...c, commandText: "", focus: "tree" }));
    actions.addToast("Command cancelled.", "info");
    return;
  }
  if (key.return) { actions.executeCommand(app.state.commandText); return; }
  if (key.backspace || key.delete) {
    setState((c) => ({ ...c, commandText: c.commandText.slice(0, -1) }));
    return;
  }
  if (!key.ctrl && !key.meta && input) {
    setState((c) => ({ ...c, commandText: `${c.commandText}${input}` }));
  }
}
