import type { Key } from "ink";
import type { AppHandle } from "../useAppState";
import { patchState } from "../../store";

export function handleDetail(input: string, key: Key, _app: AppHandle, _exitApp: () => void): void {
  if (input === "h" || key.leftArrow) {
    patchState({ focus: "list", banner: "Focus: list" });
    return;
  }
  if (input === "l" || key.rightArrow) {
    patchState({ focus: "files", selectedFileIndex: 0, banner: "Focus: files" });
  }
}
