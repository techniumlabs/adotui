import type { Key } from "ink";
import type { AppHandle } from "../useAppState";
import { SCROLL_TO_END } from "../../constants";

export function handleFiles(input: string, key: Key, app: AppHandle, _exitApp: () => void): void {
  const { setState, actions } = app;

  if (input === "]") { actions.changeFileSelection(1); return; }
  if (input === "[") { actions.changeFileSelection(-1); return; }

  if (key.pageDown) { setState((c) => ({ ...c, diffScrollOffset: c.diffScrollOffset + 10 })); return; }
  if (key.pageUp)   { setState((c) => ({ ...c, diffScrollOffset: Math.max(0, c.diffScrollOffset - 10) })); return; }

  if (input === "G") { setState((c) => ({ ...c, diffScrollOffset: SCROLL_TO_END })); return; }
  if (input === "g") { setState((c) => ({ ...c, diffScrollOffset: 0 })); return; }

  if (input === "h" || key.leftArrow) {
    setState((c) => ({ ...c, focus: "list", banner: "Focus: list" }));
    return;
  }
  if (input === "d") {
    setState((c) => ({ ...c, focus: "detail", banner: "Focus: detail. Press 'h' for files, 'd' for PR list." }));
  }
}
