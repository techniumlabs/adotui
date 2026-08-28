import type { Key } from "ink";
import type { AppHandle } from "../useAppState";
import { patchState } from "../../store";

export function handleList(input: string, key: Key, app: AppHandle, _exitApp: () => void): void {
  const { actions } = app;

  if (key.downArrow) { actions.changePrSelection(1); return; }
  if (key.upArrow)   { actions.changePrSelection(-1); return; }

  if (input === "h" || key.leftArrow) {
    patchState({ focus: "tree", banner: "Focus: tree" });
    return;
  }
  if (input === "l" || key.rightArrow || key.return) {
    patchState({ focus: "detail", banner: "Focus: detail" });
    return;
  }
  if (input === "m") {
    patchState({ focus: "comments", banner: "Comments view. n=new comment  r=reply  h=back" });
    return;
  }
  if (input === "p" && process.env.NODE_ENV === "debug") {
    patchState({ focus: "runs", banner: "Pipeline runs. arrows=navigate  o=open  R=reload  h=back" });
  }
}
