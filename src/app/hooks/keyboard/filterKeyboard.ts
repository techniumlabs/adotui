import type { Key } from "ink";
import type { AppHandle } from "../useAppState";

/** Modal handler for the live "/" filter prompt. */
export function handleFilter(input: string, key: Key, app: AppHandle, _exitApp: () => void): void {
  const { actions } = app;

  if (key.escape) { actions.cancelFilter(); return; }
  if (key.return) { actions.applyFilter(); return; }
  if (key.backspace || key.delete) {
    actions.editFilterText((t) => t.slice(0, -1));
    return;
  }
  if (!key.ctrl && !key.meta && input) {
    actions.editFilterText((t) => t + input);
  }
}
