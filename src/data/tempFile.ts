import { unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Writes `content` to a uniquely named file in the OS temp directory, runs
 * `fn` with its path, and always deletes the file afterwards (delete
 * failures are ignored).
 */
export const withTempFile = async <T>(
  content: string,
  fn: (path: string) => Promise<T>,
  options: { prefix?: string; suffix?: string } = {},
): Promise<T> => {
  const { prefix = "adotui", suffix = "" } = options;
  const path = join(
    tmpdir(),
    `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}${suffix}`,
  );
  await Bun.write(path, content);
  try {
    return await fn(path);
  } finally {
    await unlink(path).catch(() => {});
  }
};
