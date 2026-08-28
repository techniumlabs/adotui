import type { Key } from "ink";
import type { AppHandle } from "../useAppState";
import { updateState } from "../../store";

export function handleHelp(input: string, key: Key, _app: AppHandle, exitApp: () => void): void {
  if (input === "q") { exitApp(); process.exit(0); return; }
  if (input === "?" || key.escape || input === "h") {
    updateState((c) => ({ focus: c.previousFocus ?? "list", banner: `Focus: ${c.previousFocus ?? "list"}` }));
  }
}
