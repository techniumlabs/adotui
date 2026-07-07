import type { Key } from "ink";
import type { AppHandle } from "../useAppState";

export function handleDetail(input: string, key: Key, app: AppHandle, _exitApp: () => void): void {
  const { setState } = app;

  if (input === "h" || key.leftArrow) {
    setState((c) => ({ ...c, focus: "list", banner: "Focus: list" }));
    return;
  }
  if (input === "l" || key.rightArrow) {
    setState((c) => ({ ...c, focus: "files", selectedFileIndex: 0, banner: "Focus: files" }));
  }
}
