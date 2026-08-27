/**
 * On-demand unified diffs for PR files: fetches raw file content at two
 * commits from the Azure DevOps git items REST API (the only direct REST
 * usage in adotui — see azureAuth.ts) and diffs them with the system `diff`.
 */
import { unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import type { PullRequestFileChange } from "../domain/types";
import { getAdoAuthHeader } from "./azureAuth";

/**
 * Fetches the raw text content of a file at a specific commit from the Azure
 * DevOps git items REST API.  Returns null on any failure (missing file,
 * binary file, network error, auth error).
 */
const fetchFileAtCommit = async (
  organization: string,
  project: string,
  repositoryId: string,
  filePath: string,
  commitId: string,
  authHeader: string,
): Promise<string | null> => {
  const org = organization.replace(/\/+$/, "");
  const url =
    `${org}/${encodeURIComponent(project)}/_apis/git/repositories/` +
    `${encodeURIComponent(repositoryId)}/items` +
    `?path=${encodeURIComponent(filePath)}` +
    `&versionDescriptor.version=${encodeURIComponent(commitId)}` +
    `&versionDescriptor.versionType=commit` +
    `&api-version=7.1`;
  try {
    const resp = await fetch(url, {
      headers: { Authorization: authHeader, Accept: "text/plain" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!resp.ok) return null;
    return await resp.text();
  } catch {
    return null;
  }
};

/**
 * Computes a unified diff string between old and new file content using the
 * system `diff` command.  Returns the diff text and add/delete line counts.
 * Works for both text files and empty files (added/deleted).
 */
const buildUnifiedDiff = async (
  filePath: string,
  oldContent: string,
  newContent: string,
): Promise<{ rawDiff: string; additions: number; deletions: number }> => {
  const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const oldPath = join(tmpdir(), `adotui-a-${id}`);
  const newPath = join(tmpdir(), `adotui-b-${id}`);
  await writeFile(oldPath, oldContent);
  await writeFile(newPath, newContent);

  const proc = spawn("diff", [
    "-u",
    "-L", `a/${filePath}`,
    "-L", `b/${filePath}`,
    oldPath, newPath,
  ], {
    stdio: ["ignore", "pipe", "ignore"],
  });

  const rawDiff = await new Promise<string>((resolve) => {
    let out = "";
    proc.stdout.on("data", (chunk) => { out += chunk; });
    proc.on("close", () => resolve(out));
  });

  await unlink(oldPath).catch(() => { });
  await unlink(newPath).catch(() => { });

  const lines = rawDiff.split("\n");
  const additions = lines.filter(
    (l) => l.startsWith("+") && !l.startsWith("+++"),
  ).length;
  const deletions = lines.filter(
    (l) => l.startsWith("-") && !l.startsWith("---"),
  ).length;

  return { rawDiff, additions, deletions };
};

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
  const authHeader = await getAdoAuthHeader();
  if (!authHeader) return null;

  const filePath = `/${file.path}`;
  try {
    const [oldContent, newContent] = await Promise.all([
      file.status === "added"
        ? Promise.resolve("")
        : fetchFileAtCommit(organization, project, repositoryId, filePath, targetCommit, authHeader),
      file.status === "deleted"
        ? Promise.resolve("")
        : fetchFileAtCommit(organization, project, repositoryId, filePath, sourceCommit, authHeader),
    ]);

    if (oldContent !== null && newContent !== null) {
      return await buildUnifiedDiff(file.path, oldContent, newContent);
    }
  } catch (e) {
    console.error(`Error fetching diff for ${file.path}:`, e);
  }
  return null;
};
