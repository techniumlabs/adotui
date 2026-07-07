import type { Key } from "ink";
import type { AppHandle } from "../useAppState";

export function handleList(input: string, key: Key, app: AppHandle, _exitApp: () => void): void {
  const { setState, actions } = app;

  if (input === "j" || key.downArrow) { actions.changePrSelection(1); return; }
  if (input === "k" || key.upArrow)   { actions.changePrSelection(-1); return; }

  if (input === "h" || key.leftArrow) {
    setState((c) => ({ ...c, focus: "tree", banner: "Focus: tree" }));
    return;
  }
  if (input === "l" || key.rightArrow || key.return) {
    setState((c) => ({ ...c, focus: "detail", banner: "Focus: detail" }));
    return;
  }
  if (input === "m") {
    setState((c) => ({ ...c, focus: "comments", banner: "Comments view. n=new comment  r=reply  h=back" }));
    return;
  }
  if (input === "p") {
    setState((c) => ({ ...c, focus: "runs", banner: "Pipeline runs. j/k=navigate  o=open  h=back" }));
  }
}
