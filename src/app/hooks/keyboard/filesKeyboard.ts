import type { Key } from "ink";
import type { AppHandle } from "../useAppState";
import { patchState } from "../../store";

/**
 * File-level bindings for the files pane. The left/right arrows switch
 * files — view-local, like the comments pane's reply selection — and h
 * alone leaves to the PR list. Row-level diff navigation lives in
 * src/app/components/diff/diffKeyboard.ts.
 */
export function handleFiles(input: string, key: Key, app: AppHandle, _exitApp: () => void): void {
  const { actions } = app;

  if (key.rightArrow) { actions.changeFileSelection(1); return; }
  if (key.leftArrow)  { actions.changeFileSelection(-1); return; }

  if (input === "h") {
    patchState({ focus: "list", banner: "Focus: list" });
  }
}
