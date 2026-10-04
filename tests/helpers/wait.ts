/**
 * Polling helpers for UI tests. A fixed `delay(n)` encodes how fast the
 * machine is; on a loaded CI runner the app has not finished loading, or has
 * not rendered yet, when it expires. Wait for the condition instead.
 */

/** Resolves once `predicate` holds; throws naming `what` after `timeoutMs`. */
export const until = async (predicate: () => boolean, what: string, timeoutMs = 5_000): Promise<void> => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((res) => setTimeout(res, 20));
  }
  throw new Error(`timed out waiting for ${what}`);
};

/** Presses `key` until `predicate` holds, so a press made too early (and ignored) is retried. */
export const pressUntil = async (
  stdin: { write: (data: string) => void },
  key: string,
  predicate: () => boolean,
  what: string,
): Promise<void> => {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    stdin.write(key);
    try {
      await until(predicate, what, 250);
      return;
    } catch {
      // not yet: press again
    }
  }
  throw new Error(`timed out waiting for ${what}`);
};
