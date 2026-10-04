import * as fs from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Opt-in debug logging. Enabled with ADOTUI_DEBUG=1 (or "true"); writes to
 * ADOTUI_DEBUG_FILE when set, otherwise <tmpdir>/adotui-debug.log — never
 * into the current working directory. Env vars are read per call so tests
 * can toggle them.
 */

const isEnabled = (): boolean => {
  const value = process.env.ADOTUI_DEBUG;
  return value === "1" || value === "true";
};

export const debugLogPath = (): string =>
  process.env.ADOTUI_DEBUG_FILE ?? join(tmpdir(), "adotui-debug.log");

export const debugLog = (...args: unknown[]): void => {
  if (!isEnabled()) return;
  const msg = args
    .map((arg) => (typeof arg === "object" ? JSON.stringify(arg, null, 2) : String(arg)))
    .join(" ");
  fs.appendFileSync(debugLogPath(), `${msg}\n`);
};
