/**
 * Thin, CLI-agnostic process runner built on Bun.spawn.
 *
 * Mirrors the ghui CommandRunner pattern: it is the single place a subprocess
 * is spawned. `run` returns raw stdout/stderr/exitCode; `runJson` parses stdout
 * as JSON. Non-zero exit codes and JSON parse failures surface as CommandError.
 */

export interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

export class CommandError extends Error {
  readonly command: string;
  readonly args: readonly string[];
  readonly detail: string;

  constructor(command: string, args: readonly string[], detail: string) {
    super(`\`${command} ${args.join(" ")}\` failed: ${detail}`);
    this.name = "CommandError";
    this.command = command;
    this.args = args;
    this.detail = detail;
  }
}

const DEFAULT_TIMEOUT_MS = 20_000;

const readStream = async (
  stream: ReadableStream<Uint8Array> | undefined,
): Promise<string> => {
  if (!stream) {
    return "";
  }
  return await new Response(stream).text();
};

export interface RunOptions {
  timeoutMs?: number;
}

/**
 * Runs a command, capturing stdout/stderr. Rejects with CommandError on a
 * non-zero exit code, a timeout, or a spawn failure (e.g. `az` not installed).
 */
export const run = async (
  command: string,
  args: readonly string[],
  options: RunOptions = {},
): Promise<CommandResult> => {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  let proc: Bun.Subprocess<"ignore", "pipe", "pipe">;
  try {
    proc = Bun.spawn({
      cmd: [command, ...args],
      stdin: "ignore",
      stdout: "pipe",
      stderr: "pipe",
    });
  } catch (cause) {
    const detail =
      cause instanceof Error ? cause.message : `Failed to launch ${command}`;
    throw new CommandError(command, args, detail);
  }

  const timer = setTimeout(() => {
    proc.kill("SIGKILL");
  }, timeoutMs);

  let exitCode: number;
  let stdout: string;
  let stderr: string;
  try {
    [exitCode, stdout, stderr] = await Promise.all([
      proc.exited,
      readStream(proc.stdout),
      readStream(proc.stderr),
    ]);
  } catch (cause) {
    proc.kill("SIGKILL");
    const detail =
      cause instanceof Error ? cause.message : `Failed while running ${command}`;
    throw new CommandError(command, args, detail);
  } finally {
    clearTimeout(timer);
  }

  if (exitCode !== 0) {
    const detail =
      stderr.trim() ||
      stdout.trim() ||
      `exited with code ${exitCode} (possibly timed out)`;
    throw new CommandError(command, args, detail);
  }

  return { stdout, stderr, exitCode };
};

/**
 * Runs a command and parses stdout as JSON of type T.
 */
export const runJson = async <T>(
  command: string,
  args: readonly string[],
  options: RunOptions = {},
): Promise<T> => {
  const result = await run(command, args, options);
  try {
    return JSON.parse(result.stdout) as T;
  } catch (cause) {
    const detail = `Could not parse JSON output: ${
      cause instanceof Error ? cause.message : String(cause)
    }`;
    throw new CommandError(command, args, detail);
  }
};
