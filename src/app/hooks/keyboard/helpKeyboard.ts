import type { Key } from "ink";
import type { AppHandle } from "../useAppState";

export function handleHelp(input: string, key: Key, app: AppHandle, exitApp: () => void): void {
  const { setState } = app;
  if (input === "q") { exitApp(); process.exit(0); return; }
  if (input === "?" || key.escape || input === "h") {
    setState((c) => ({ ...c, focus: c.previousFocus ?? "list", banner: `Focus: ${c.previousFocus ?? "list"}` }));
  }
}
