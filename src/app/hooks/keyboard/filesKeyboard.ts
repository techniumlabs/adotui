import type { Key } from "ink";
import type { AppHandle } from "../useAppState";
import { patchState } from "../../store";

/**
 * File-level bindings for the files pane: switching files and leaving the
 * pane. Row-level diff navigation (j/k, g/G, PageUp/PageDown) is owned by
 * the diff view itself (src/app/components/diff/diffKeyboard.ts) so that
 * exactly one handler reacts per keypress.
 */
export function handleFiles(input: string, key: Key, app: AppHandle, _exitApp: () => void): void {
  const { actions } = app;

  if (input === "]") { actions.changeFileSelection(1); return; }
  if (input === "[") { actions.changeFileSelection(-1); return; }

  if (input === "h" || key.leftArrow) {
    patchState({ focus: "list", banner: "Focus: list" });
    return;
  }
  if (input === "d") {
    patchState({ focus: "detail", banner: "Focus: detail. Press 'h' for files, 'd' for PR list." });
  }
}
