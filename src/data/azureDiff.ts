/**
 * On-demand unified diffs for PR files: fetches raw file content at two
 * commits from the Azure DevOps git items REST API (through the shared
 * client in adoFetch.ts, so it gets retries and token refresh) and diffs
 * them with `git diff --no-index`.
 */
import { withTempFile } from "./tempFile";
import type { PullRequestFileChange } from "../domain/types";
import { adoGetText, seg } from "./adoFetch";
import { debugLog } from "../app/utils";

/**
 * Fetches the raw text content of a file at a specific commit from the Azure
 * DevOps git items REST API. Returns null on any failure (missing file,
 * network error, auth error).
 */
const fetchFileAtCommit = async (
  organization: string,
  project: string,
  repositoryId: string,
  filePath: string,
  commitId: string,
): Promise<string | null> => {
  try {
    return await adoGetText(
      organization,
      `${seg(project)}/_apis/git/repositories/${seg(repositoryId)}/items`,
      {
        query: {
          path: filePath,
          "versionDescriptor.version": commitId,
          "versionDescriptor.versionType": "commit",
        },
        timeoutMs: 15_000,
      },
    );
  } catch (e) {
    debugLog("fetchFileAtCommit failed", filePath, commitId, e);
    return null;
  }
};

/**
 * `git diff --no-index` rather than the system `diff`: git is already a
 * prerequisite for anyone reviewing PRs and, unlike `diff`, is on the PATH on
 * Windows. Flags pin the output against user gitconfig (colour, external
 * diff drivers, textconv, context size).
 */
const GIT_DIFF_ARGS = ["diff", "--no-index", "--no-color", "--no-ext-diff", "--no-textconv", "-U3", "--"];

/**
 * Computes a unified diff between old and new file content. Returns the diff
 * text (`--- a/<old>` / `+++ b/<new>` headers, then hunks) and add/delete line
 * counts. Works for empty files (added/deleted); identical content yields "".
 * Throws if git cannot run or fails.
 */
const buildUnifiedDiff = async (
  oldFilePath: string,
  filePath: string,
  oldContent: string,
  newContent: string,
): Promise<{ rawDiff: string; additions: number; deletions: number }> =>
  withTempFile(oldContent, (oldPath) =>
    withTempFile(newContent, async (newPath) => {
      const proc = Bun.spawn(["git", ...GIT_DIFF_ARGS, oldPath, newPath], {
        stdin: "ignore",
        stdout: "pipe",
        stderr: "ignore",
        // Bun.spawn snapshots the environment at startup unless told otherwise.
        env: process.env,
      });
      const [output, exitCode] = await Promise.all([new Response(proc.stdout).text(), proc.exited]);
      // --no-index exits 1 when the files differ; anything higher is a failure.
      if (exitCode > 1) throw new Error(`git diff exited with code ${exitCode}`);
      if (output === "") return { rawDiff: "", additions: 0, deletions: 0 };

      // Everything before the first hunk is git's own header, which names the
      // temp files: replace it with the real paths. A binary file has no hunk.
      const hunkStart = output.search(/^@@/m);
      if (hunkStart === -1) {
        return { rawDiff: `Binary files a/${oldFilePath} and b/${filePath} differ\n`, additions: 0, deletions: 0 };
      }
      const body = output.slice(hunkStart);
      const lines = body.split("\n");
      return {
        rawDiff: `--- a/${oldFilePath}\n+++ b/${filePath}\n${body}`,
        // Hunk bodies only hold ' ', '+', '-', '\' and '@@' lines, so a
        // content line like "++x" is counted correctly.
        additions: lines.filter((l) => l.startsWith("+")).length,
        deletions: lines.filter((l) => l.startsWith("-")).length,
      };
    }, { prefix: "adotui-b" }),
  { prefix: "adotui-a" });

/**
 * Fetches the raw diff for a single file on-demand to avoid rate-limiting.
 */
export const fetchFileDiff = async (
  organization: string,
  project: string,
  repositoryId: string,
  file: PullRequestFileChange,
  sourceCommit: string,
  targetCommit: string,
): Promise<{ rawDiff: string; additions: number; deletions: number } | null> => {
  // A renamed file's old content lives at its original path.
  const oldFilePath = file.originalPath ?? file.path;
  try {
    const [oldContent, newContent] = await Promise.all([
      file.status === "added"
        ? Promise.resolve("")
        : fetchFileAtCommit(organization, project, repositoryId, `/${oldFilePath}`, targetCommit),
      file.status === "deleted"
        ? Promise.resolve("")
        : fetchFileAtCommit(organization, project, repositoryId, `/${file.path}`, sourceCommit),
    ]);

    if (oldContent !== null && newContent !== null) {
      return await buildUnifiedDiff(oldFilePath, file.path, oldContent, newContent);
    }
  } catch (e) {
    debugLog("fetchFileDiff failed", file.path, e);
  }
  return null;
};
