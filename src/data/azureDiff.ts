/**
 * On-demand unified diffs for PR files: fetches raw file content at two
 * commits from the Azure DevOps git items REST API (through the shared
 * client in adoFetch.ts, so it gets retries and token refresh) and diffs
 * them with the system `diff`.
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
 * Computes a unified diff string between old and new file content using the
 * system `diff` command.  Returns the diff text and add/delete line counts.
 * Works for both text files and empty files (added/deleted).
 */
const buildUnifiedDiff = async (
  oldFilePath: string,
  filePath: string,
  oldContent: string,
  newContent: string,
): Promise<{ rawDiff: string; additions: number; deletions: number }> =>
  withTempFile(oldContent, (oldPath) =>
    withTempFile(newContent, async (newPath) => {
      const proc = Bun.spawn([
        "diff",
        "-u",
        "-L", `a/${oldFilePath}`,
        "-L", `b/${filePath}`,
        oldPath, newPath,
      ], { stdin: "ignore", stdout: "pipe", stderr: "ignore" });

      const rawDiff = await new Response(proc.stdout).text();
      await proc.exited;

      const lines = rawDiff.split("\n");
      const additions = lines.filter(
        (l) => l.startsWith("+") && !l.startsWith("+++"),
      ).length;
      const deletions = lines.filter(
        (l) => l.startsWith("-") && !l.startsWith("---"),
      ).length;

      return { rawDiff, additions, deletions };
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
