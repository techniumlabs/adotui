import type { Key } from "ink";
import type { AppHandle } from "../useAppState";
import { patchState, updateState } from "../../store";

export function handleTree(input: string, key: Key, app: AppHandle, _exitApp: () => void): void {
  const { actions } = app;

  if (input === "j" || key.downArrow)  { actions.moveTreeSelection(0, 1); return; }
  if (input === "k" || key.upArrow)    { actions.moveTreeSelection(0, -1); return; }
  if (input === "h" || key.leftArrow)  { actions.moveTreeSelection(-1, 0, "Organization changed."); return; }

  if (input === "l" || key.rightArrow || key.return) {
    actions.moveTreeSelection(1, 0, "Organization changed.");
    if (key.return) patchState({ focus: "list", banner: "Focus: list" });
    return;
  }
  if (input === "v") {
    updateState((c) => {
      const next = c.treeFilter === "all" ? "with-prs" : "all";
      return {
        treeFilter: next,
        banner: next === "with-prs" ? "Filter: showing repos with PRs only." : "Filter: showing all repos.",
      };
    });
  }
}
