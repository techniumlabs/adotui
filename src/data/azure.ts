import { unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import type {
  AppData,
  OrganizationNode,
  PullRequest,
  PullRequestFileChange,
  PullRequestWorkItem,
  RepositoryNode,
} from "../domain/types";
import type { CompletionOptions } from "../app/types";
import { CommandError, run, runJson } from "./command";
import type { AdoConfig, AdoProjectConfig } from "./config";
import type {
  AzureIteration,
  AzureIterationChanges,
  AzureIterationList,
  AzurePolicyEvaluation,
  AzurePullRequest,
  AzureRepository,
} from "./azureTypes";
import {
  normalizeFileChanges,
  normalizePullRequest,
  orgLabel,
  summarizeChecks,
} from "./azureNormalize";
import { fetchPrComments } from "./azureRest";

import { AZ, orgArgs, jsonOutput } from "./azureCommon";

/** Identifies a specific PR for actions. */
export interface PrRef {
  organization: string;
  project: string;
  repository: string;
  prId: number;
}

/**
 * Returns an Authorization header value for direct Azure DevOps REST calls.
 * Prefers a PAT from AZURE_DEVOPS_EXT_PAT; falls back to an AAD bearer token
 * obtained via `az account get-access-token`.
 */
const getAdoAuthHeader = async (): Promise<string | null> => {
  const pat = process.env.AZURE_DEVOPS_EXT_PAT;
  if (pat) {
    return `Basic ${btoa(`:${pat}`)}`;
  }
  try {
    const result = await runJson<{ accessToken: string }>(AZ, [
      "account",
      "get-access-token",
      "--resource",
      "499b84ac-1321-427f-aa17-267ca6975798",
      ...jsonOutput,
    ], { timeoutMs: 10_000 });
    return `Bearer ${result.accessToken}`;
  } catch {
    return null;
  }
};

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

/** Verifies the az CLI and the azure-devops extension are available. */
export const checkAzAvailable = async (): Promise<
  { ok: true } | { ok: false; error: string }
> => {
  try {
    await run(AZ, ["repos", "-h"], { timeoutMs: 15_000 });
    return { ok: true };
  } catch (cause) {
    if (cause instanceof CommandError) {
      return {
        ok: false,
        error:
          `Azure CLI check failed: ${cause.detail}. ` +
          `Ensure 'az' is installed, you're logged in (az login), and the ` +
          `azure-devops extension is present (az extension add --name azure-devops).`,
      };
    }
    return { ok: false, error: String(cause) };
  }
};

interface AzureProject {
  id: string;
  name: string;
  state: string;
}

/** Lists all projects in an organization. */
const listProjects = async (
  organization: string,
): Promise<AzureProject[]> => {
  const result = await runJson<{ value: AzureProject[] }>(AZ, [
    "devops",
    "project",
    "list",
    ...orgArgs(organization),
    ...jsonOutput,
  ]);
  return result.value.filter((proj) => proj.state === "wellFormed" && !!proj.name);
};

/** Lists repositories in a project (auto-discovery). */
const listRepositories = async (
  project: AdoProjectConfig,
): Promise<AzureRepository[]> => {
  const repos = await runJson<AzureRepository[]>(AZ, [
    "repos",
    "list",
    ...orgArgs(project.organization),
    "--project",
    project.project!,
    ...jsonOutput,
  ]);
  return repos.filter((repo) => repo.isDisabled !== true && !!repo.name);
};

/** Lists PRs for a repository in a project. */
const listPullRequests = async (
  config: AdoConfig,
  project: AdoProjectConfig,
  repository: string,
): Promise<AzurePullRequest[]> => {
  const args = [
    "repos",
    "pr",
    "list",
    ...orgArgs(project.organization),
    "--project",
    project.project!,
    "--repository",
    repository,
    "--status",
    config.status ?? "active",
    "--top",
    String(config.top ?? 50),
    ...jsonOutput,
  ];

  if (config.reviewer) {
    args.push("--reviewer", config.reviewer);
  }
  if (config.creator) {
    args.push("--creator", config.creator);
  }

  return await runJson<AzurePullRequest[]>(AZ, args);
};

/** Fetches blocking policy evaluations for a PR (check rollup). */
const listPrPolicies = async (
  organization: string,
  project: string,
  prId: number,
): Promise<AzurePolicyEvaluation[]> => {
  try {
    return await runJson<AzurePolicyEvaluation[]>(AZ, [
      "repos",
      "pr",
      "policy",
      "list",
      "--id",
      String(prId),
      ...orgArgs(organization),
      "--project",
      project,
      ...jsonOutput,
    ]);
  } catch {
    // Policies may be unavailable; treat as no checks rather than failing.
    return [];
  }
};

/** Fetches work items linked to a PR. */
const listPrWorkItems = async (
  organization: string,
  prId: number,
): Promise<PullRequestWorkItem[]> => {
  try {
    const rawItems = await runJson<any[]>(AZ, [
      "repos",
      "pr",
      "work-item",
      "list",
      "--id",
      String(prId),
      ...orgArgs(organization),
      ...jsonOutput,
    ]);

    return rawItems.map((raw) => ({
      id: raw.id,
      title: raw.fields?.["System.Title"] ?? "Unknown Work Item",
      state: raw.fields?.["System.State"] ?? "Unknown",
      type: raw.fields?.["System.WorkItemType"] ?? "Unknown",
      url: raw.url,
    }));
  } catch {
    return [];
  }
};

/**
 * Fetches changed files for a PR via the REST changes endpoint.
 * Uses the latest iteration. When source and target commit SHAs are provided,
 * fetches actual file content from the Azure DevOps git items API and computes
 * a unified diff for each file so the diff pane has real content to render.
 */
const listPrFileChanges = async (
  organization: string,
  project: string,
  repositoryId: string,
  prId: number,
  sourceCommit: string | undefined,
  targetCommit: string | undefined,
): Promise<{ files: PullRequestFileChange[]; iterSourceCommit?: string; iterTargetCommit?: string }> => {
  try {
    const iterations = await runJson<AzureIterationList>(AZ, [
      "devops",
      "invoke",
      "--area",
      "git",
      "--resource",
      "pullRequestIterations",
      "--route-parameters",
      `project=${project}`,
      `repositoryId=${repositoryId}`,
      `pullRequestId=${prId}`,
      ...orgArgs(organization),
      "--api-version",
      "7.1",
      ...jsonOutput,
    ]);

    const latestIter = (iterations.value ?? []).reduce(
      (max, it) => ((it.id ?? 0) > (max.id ?? 0) ? it : max),
      { id: 0 } as AzureIteration,
    );
    const latest = latestIter.id ?? 0;
    if (latest === 0) {
      return { files: [] };
    }

    const iterSourceCommit = sourceCommit ?? latestIter.sourceRefCommit?.commitId;
    const iterTargetCommit = targetCommit ?? latestIter.commonRefCommit?.commitId ?? latestIter.targetRefCommit?.commitId;

    const changes = await runJson<AzureIterationChanges>(AZ, [
      "devops",
      "invoke",
      "--area",
      "git",
      "--resource",
      "pullRequestIterationChanges",
      "--route-parameters",
      `project=${project}`,
      `repositoryId=${repositoryId}`,
      `pullRequestId=${prId}`,
      `iterationId=${latest}`,
      ...orgArgs(organization),
      "--api-version",
      "7.1",
      "--query-parameters",
      "$top=10000",
      ...jsonOutput,
    ]);

    const files = normalizeFileChanges(changes.changeEntries ?? []);

    return { files, iterSourceCommit, iterTargetCommit };
  } catch {
    return { files: [] };
  }
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

/** Wraps errors into a synthetic PR entry so one bad repo doesn't break all. */
const hydratePullRequest = async (
  project: AdoProjectConfig,
  repository: string,
  raw: AzurePullRequest,
  options: { fetchDetails: boolean },
): Promise<PullRequest> => {
  const prId = raw.pullRequestId ?? 0;
  const repositoryId = raw.repository?.id ?? repository;
  const sourceCommit = raw.lastMergeSourceCommit?.commitId;
  const targetCommit = raw.lastMergeTargetCommit?.commitId;
  const projectStr = project.project!;

  let changedFiles: PullRequestFileChange[] = [];
  let checksPassed = 0;
  let checksTotal = 0;
  let workItems: PullRequestWorkItem[] = [];
  let commentCount = 0;
  let activeCommentCount = 0;
  let iterSourceCommit: string | undefined;
  let iterTargetCommit: string | undefined;

  if (options.fetchDetails && prId > 0) {
    const [fileRes, policies, items, threads] = await Promise.all([
      listPrFileChanges(
        project.organization,
        projectStr,
        repositoryId,
        prId,
        sourceCommit,
        targetCommit,
      ),
      listPrPolicies(project.organization, projectStr, prId),
      listPrWorkItems(project.organization, prId),
      fetchPrComments(project.organization, projectStr, repositoryId, prId),
    ]);
    changedFiles = fileRes.files;
    iterSourceCommit = fileRes.iterSourceCommit;
    iterTargetCommit = fileRes.iterTargetCommit;
    const checks = summarizeChecks(policies);
    checksPassed = checks.passed;
    checksTotal = checks.total;
    workItems = items;
    commentCount = threads.reduce((acc, t) => acc + t.comments.length, 0);
    activeCommentCount = threads.reduce(
      (acc, t) => acc + (t.status === "active" || t.status === "pending" ? t.comments.length : 0),
      0
    );
  }

  return {
    ...normalizePullRequest(raw, {
      organization: project.organization,
      project: projectStr,
      repository,
      changedFiles,
      checksPassed,
      checksTotal,
      commentCount,
      activeCommentCount,
    }),
    workItems,
    iterSourceCommit,
    iterTargetCommit,
  };
};

export interface LoadOptions {
  /** When true, fetch per-PR file changes and policy checks (slower). */
  fetchDetails?: boolean;
  /** Callback fired to report current loading progress. */
  onProgress?: (msg: string) => void;
}

/**
 * Loads the full AppData tree across every configured org/project, discovering
 * repositories when not explicitly listed. Repos and projects are fetched
 * concurrently; a failure in one repo/project is captured and surfaced as an
 * empty node rather than aborting the whole load.
 */
export const loadAppData = async (
  config: AdoConfig,
  options: LoadOptions = {},
): Promise<{ data: AppData; warnings: string[] }> => {
  const warnings: string[] = [];
  const fetchDetails = options.fetchDetails ?? true;

  // Group projects by organization so the tree top level is per-org.
  const byOrg = new Map<string, AdoProjectConfig[]>();
  for (const project of config.projects) {
    const list = byOrg.get(project.organization) ?? [];
    list.push(project);
    byOrg.set(project.organization, list);
  }

  const organizations: OrganizationNode[] = [];

  for (const [organization, projects] of byOrg) {
    const repositories: RepositoryNode[] = [];

    const resolvedProjects: AdoProjectConfig[] = [];
    for (const project of projects) {
      if (!project.project) {
        try {
          options.onProgress?.(`Discovering projects in ${orgLabel(organization)}...`);
          const discovered = await listProjects(organization);
          for (const dp of discovered) {
            resolvedProjects.push({
              organization: project.organization,
              project: dp.name,
              repositories: project.repositories,
            });
          }
        } catch (cause) {
          warnings.push(
            `Could not list projects for ${organization}: ${cause instanceof CommandError ? cause.detail : String(cause)
            }`,
          );
        }
      } else {
        resolvedProjects.push(project);
      }
    }

    for (const project of resolvedProjects) {
      let repoNames = project.repositories ?? [];

      if (repoNames.length === 0) {
        try {
          options.onProgress?.(`Discovering repos for ${project.project}...`);
          const discovered = await listRepositories(project);
          repoNames = discovered
            .map((repo) => repo.name)
            .filter((name): name is string => !!name);
        } catch (cause) {
          warnings.push(
            `Could not list repos for ${project.project}: ${cause instanceof CommandError ? cause.detail : String(cause)
            }`,
          );
          continue;
        }
      }

      const repoNodes = await Promise.all(
        repoNames.map(async (repository): Promise<RepositoryNode> => {
          try {
            options.onProgress?.(`Fetching PRs for ${project.project}/${repository}...`);
            const rawPrs = await listPullRequests(config, project, repository);
            const pullRequests = await Promise.all(
              rawPrs.map((raw) =>
                hydratePullRequest(project, repository, raw, { fetchDetails }),
              ),
            );
            return { name: repository, project: project.project!, pullRequests };
          } catch (cause) {
            warnings.push(
              `Could not list PRs for ${project.project}/${repository}: ${cause instanceof CommandError ? cause.detail : String(cause)
              }`,
            );
            return { name: repository, project: project.project!, pullRequests: [] };
          }
        }),
      );

      repositories.push(...repoNodes);
    }

    // Label the org node by its short name (last URL segment) for readability.
    organizations.push({
      name: orgLabel(organization),
      organizationUrl: organization,
      repositories,
    });
  }

  return { data: { organizations }, warnings };
};

// --- PR actions ------------------------------------------------------------

/**
 * `az repos pr update` only exposes `--squash` for merge control; the other
 * domain strategies (noFastForward / rebase / rebaseMerge) cannot be selected
 * via this CLI and are governed by branch policy / server defaults. Callers
 * should surface `completionStrategyNote` to avoid claiming an unsupported
 * strategy was applied.
 */
export const completionStrategyNote = (
  options: CompletionOptions,
): string | null => {
  if (options.mergeStrategy === "squash" || options.mergeStrategy === "noFastForward") {
    return null;
  }
  return `Note: '${options.mergeStrategy}' is not selectable via az; Azure used its policy/default merge.`;
};

const mergeStrategyToAzFlags = (options: CompletionOptions): string[] => {
  // Azure `pr update` completion only supports --squash; other strategies are
  // governed by branch policy. We pass squash when selected (see
  // completionStrategyNote for how unsupported strategies are surfaced).
  const flags: string[] = [];
  flags.push("--squash", options.mergeStrategy === "squash" ? "true" : "false");
  flags.push(
    "--delete-source-branch",
    options.deleteSourceBranch ? "true" : "false",
  );
  flags.push(
    "--transition-work-items",
    options.transitionWorkItems ? "true" : "false",
  );
  if (options.bypassPolicy) {
    flags.push("--bypass-policy", "true");
    if (options.bypassReason) {
      flags.push("--bypass-policy-reason", options.bypassReason);
    }
  }
  if (options.mergeCommitMessage) {
    flags.push("--merge-commit-message", options.mergeCommitMessage);
  }
  return flags;
};

export const setVote = async (
  ref: PrRef,
  vote: "approve" | "approve-with-suggestions" | "reject" | "reset" | "wait-for-author",
): Promise<void> => {
  await run(AZ, [
    "repos",
    "pr",
    "set-vote",
    "--id",
    String(ref.prId),
    "--vote",
    vote,
    ...orgArgs(ref.organization),
    ...jsonOutput,
  ]);
};

export const approvePr = (ref: PrRef): Promise<void> => setVote(ref, "approve");

export const rejectPr = (ref: PrRef): Promise<void> => setVote(ref, "reject");

export const abandonPr = async (ref: PrRef): Promise<void> => {
  await run(AZ, [
    "repos",
    "pr",
    "update",
    "--id",
    String(ref.prId),
    "--status",
    "abandoned",
    ...orgArgs(ref.organization),
    ...jsonOutput,
  ]);
};

export const completePr = async (
  ref: PrRef,
  options: CompletionOptions,
): Promise<void> => {
  await run(AZ, [
    "repos",
    "pr",
    "update",
    "--id",
    String(ref.prId),
    "--status",
    "completed",
    ...mergeStrategyToAzFlags(options),
    ...orgArgs(ref.organization),
    ...jsonOutput,
  ]);
};
