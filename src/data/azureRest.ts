/**
 * Azure DevOps helpers for PR comments and pipeline runs — implemented
 * entirely via the Azure CLI (`az devops invoke` / `az pipelines runs list`).
 * No direct HTTP/REST calls, no PAT handling — the CLI manages auth.
 */

import { tmpdir } from "node:os";
import { join } from "node:path";
import type {
  CommentType,
  PipelineRun,
  PrCommentThread,
  RunResult,
  RunState,
} from "../domain/types";
import { run, runJson } from "./command";
import { AZ, orgArgs } from "./azureCommon";
import { debugLog } from "../app/utils";

// ─── az devops invoke helpers ─────────────────────────────────────────────────

/**
 * GET via `az devops invoke --area git --resource pullRequestThreads`.
 * Returns parsed JSON or null on any failure (no org configured, no auth, etc.)
 */
const invokeGet = async <T>(
  organization: string,
  area: string,
  resource: string,
  routeParameters: string[],
  queryParameters: string[] = [],
): Promise<T | null> => {
  const args: string[] = [
    "devops",
    "invoke",
    "--area",
    area,
    "--resource",
    resource,
    "--route-parameters",
    ...routeParameters,
    "--api-version",
    "7.1",
    "--output",
    "json",
    ...orgArgs(organization),
  ];

  if (queryParameters.length > 0) {
    args.push("--query-parameters", ...queryParameters);
  }

  try {
    debugLog("invokeGet", args);
    return await runJson<T>(AZ, args, { timeoutMs: 20_000 });
  } catch {
    return null;
  }
};

/** Shared helper for POST and PATCH mutations via az devops invoke. */
const invokeMutate = async <T>(
  method: "POST" | "PATCH",
  organization: string,
  area: string,
  resource: string,
  routeParameters: string[],
  body: unknown,
  queryParameters: string[] = [],
): Promise<T | null> => {
  const tmpPath = join(tmpdir(), `adotui_invoke_${Date.now()}_${Math.random().toString(36).slice(2)}.json`);
  try {
    await Bun.write(tmpPath, JSON.stringify(body));
    const args: string[] = [
      "devops", "invoke",
      "--area", area,
      "--resource", resource,
      "--route-parameters", ...routeParameters,
      "--http-method", method,
      "--in-file", tmpPath,
      "--media-type", "application/json",
      "--api-version", "7.1",
      "--output", "json",
      ...orgArgs(organization),
    ];
    if (queryParameters.length > 0) {
      args.push("--query-parameters", ...queryParameters);
    }
    return await runJson<T>(AZ, args, { timeoutMs: 20_000 });
  } catch {
    return null;
  } finally {
    try {
      const { unlink } = await import("node:fs/promises");
      await unlink(tmpPath);
    } catch { /* ignore */ }
  }
};

const invokePost = <T>(
  organization: string, area: string, resource: string,
  routeParameters: string[], body: unknown, queryParameters?: string[],
): Promise<T | null> =>
  invokeMutate<T>("POST", organization, area, resource, routeParameters, body, queryParameters);

const invokePatch = <T>(
  organization: string, area: string, resource: string,
  routeParameters: string[], body: unknown, queryParameters?: string[],
): Promise<T | null> =>
  invokeMutate<T>("PATCH", organization, area, resource, routeParameters, body, queryParameters);

const invokeDelete = async <T>(
  organization: string,
  area: string,
  resource: string,
  routeParameters: string[],
  queryParameters: string[] = [],
): Promise<T | null> => {
  const args: string[] = [
    "devops",
    "invoke",
    "--area",
    area,
    "--resource",
    resource,
    "--route-parameters",
    ...routeParameters,
    "--http-method",
    "DELETE",
    "--api-version",
    "7.1",
    "--output",
    "json",
    ...orgArgs(organization),
  ];

  if (queryParameters.length > 0) {
    args.push("--query-parameters", ...queryParameters);
  }

  try {
    const result = await run(AZ, args, { timeoutMs: 20_000 });
    if (!result.stdout.trim()) {
      return {} as T;
    }
    return JSON.parse(result.stdout) as T;
  } catch {
    return null;
  }
};

// ─── PR Comment types ─────────────────────────────────────────────────────────

interface RawThread {
  id: number;
  status?: string;
  isDeleted?: boolean;
  threadContext?: {
    filePath?: string;
    rightFileStart?: { line?: number };
  } | null;
  comments?: RawComment[];
}

interface RawComment {
  id: number;
  author?: { displayName?: string; uniqueName?: string };
  content?: string;
  publishedDate?: string;
  lastUpdatedDate?: string;
  commentType?: string;
  isDeleted?: boolean;
}

// ─── PR Comments ──────────────────────────────────────────────────────────────

export const fetchPrComments = async (
  organizationUrl: string,
  project: string,
  repositoryId: string,
  prId: number,
): Promise<PrCommentThread[]> => {
  if (process.env.ADOTUI_MOCK) {
    const { getMockComments } = await import("./mock");
    return getMockComments(prId);
  }

  // az devops invoke --area git --resource pullRequestThreads
  //   --route-parameters project=<p> repositoryId=<r> pullRequestId=<id>
  try {
    const data = await invokeGet<{ value?: RawThread[] }>(
      organizationUrl,
      "git",
      "pullRequestThreads",
      [
        `project=${project}`,
        `repositoryId=${repositoryId}`,
        `pullRequestId=${prId}`,
      ],
    );
    // debugLog("fetchPrComments", data);
    if (!data?.value) return [];

    return data.value
      .filter((thread) => !thread.isDeleted)
      .map((thread) => ({
        id: thread.id,
        status: (thread.status ?? "unknown") as PrCommentThread["status"],
        filePath: thread.threadContext?.filePath ?? null,
        lineNumber: thread.threadContext?.rightFileStart?.line ?? null,
        comments: (thread.comments ?? [])
          .filter((c) => !c.isDeleted && c.commentType !== "system")
          .map(
            (c): import("../domain/types").PrComment => ({
              id: c.id,
              threadId: thread.id,
              author: c.author?.displayName ?? "Unknown",
              authorEmail: c.author?.uniqueName,
              content: c.content ?? "",
              publishedDate: c.publishedDate ?? "",
              lastUpdatedDate: c.lastUpdatedDate ?? "",
              commentType: (c.commentType ?? "text") as CommentType,
              isDeleted: false,
            }),
          ),
      }))
      .filter((t) => t.comments.length > 0);
  } catch (e) {
    debugLog("fetchPrComments error", e);
    return [];
  }
};

export const postPrComment = async (
  organizationUrl: string,
  project: string,
  repositoryId: string,
  prId: number,
  content: string,
  threadContext?: { filePath?: string; rightFileStart?: { line?: number, offset?: number }; rightFileEnd?: { line?: number, offset?: number }; leftFileStart?: { line?: number, offset?: number }; leftFileEnd?: { line?: number, offset?: number } },
  pullRequestThreadContext?: { changeTrackingId?: number; iterationContext?: { firstComparingIteration?: number; secondComparingIteration?: number } }
): Promise<boolean> => {
  const body = {
    comments: [{ parentCommentId: 0, content, commentType: 1 }],
    status: 1, // active
    ...(threadContext ? { threadContext } : {}),
    ...(pullRequestThreadContext ? { pullRequestThreadContext } : {}),
  };

  const result = await invokePost<{ id: number }>(
    organizationUrl,
    "git",
    "pullRequestThreads",
    [
      `project=${project}`,
      `repositoryId=${repositoryId}`,
      `pullRequestId=${prId}`,
    ],
    body,
  );

  return result !== null;
};

export const replyToPrThread = async (
  organizationUrl: string,
  project: string,
  repositoryId: string,
  prId: number,
  threadId: number,
  parentCommentId: number,
  content: string,
): Promise<boolean> => {
  const body = { parentCommentId, content, commentType: 1 };

  const result = await invokePost<{ id: number }>(
    organizationUrl,
    "git",
    "pullRequestThreadComments",
    [
      `project=${project}`,
      `repositoryId=${repositoryId}`,
      `pullRequestId=${prId}`,
      `threadId=${threadId}`,
    ],
    body,
  );

  return result !== null;
};

export const updatePrThreadStatus = async (
  organizationUrl: string,
  project: string,
  repositoryId: string,
  prId: number,
  threadId: number,
  statusId: number, // 1: Active, 2: Fixed, 3: WontFix, 4: Closed, 5: ByDesign, 6: Pending
): Promise<boolean> => {
  const body = { status: statusId };

  const result = await invokePatch<{ id: number }>(
    organizationUrl,
    "git",
    "pullRequestThreads",
    [
      `project=${project}`,
      `repositoryId=${repositoryId}`,
      `pullRequestId=${prId}`,
      `threadId=${threadId}`,
    ],
    body,
  );

  return result !== null;
};

export const editPrComment = async (
  organizationUrl: string,
  project: string,
  repositoryId: string,
  prId: number,
  threadId: number,
  commentId: number,
  content: string,
): Promise<boolean> => {
  const body = { content };

  const result = await invokePatch<{ id: number }>(
    organizationUrl,
    "git",
    "pullRequestThreadComments",
    [
      `project=${project}`,
      `repositoryId=${repositoryId}`,
      `pullRequestId=${prId}`,
      `threadId=${threadId}`,
      `commentId=${commentId}`,
    ],
    body,
  );

  return result !== null;
};

export const deletePrComment = async (
  organizationUrl: string,
  project: string,
  repositoryId: string,
  prId: number,
  threadId: number,
  commentId: number,
): Promise<boolean> => {
  const result = await invokeDelete<unknown>(
    organizationUrl,
    "git",
    "pullRequestThreadComments",
    [
      `project=${project}`,
      `repositoryId=${repositoryId}`,
      `pullRequestId=${prId}`,
      `threadId=${threadId}`,
      `commentId=${commentId}`,
    ],
  );

  return result !== null;
};

// ─── Pipeline Runs ────────────────────────────────────────────────────────────

interface RawRun {
  id?: number;
  buildNumber?: string;
  status?: string;
  result?: string;
  startTime?: string;
  finishTime?: string;
  queueTime?: string;
  definition?: { name?: string };
  _links?: { web?: { href?: string } };
}

export const fetchPipelineRuns = async (
  organizationUrl: string,
  project: string,
): Promise<PipelineRun[]> => {
  // `az pipelines runs list` is a first-class CLI command — prefer it over invoke.
  let rows: RawRun[] = [];

  try {
    rows = await runJson<RawRun[]>(
      AZ,
      [
        "pipelines",
        "runs",
        "list",
        "--top",
        "30",
        "--query-order",
        "QueueTimeDesc",
        "--project",
        project,
        "--output",
        "json",
        ...orgArgs(organizationUrl),
      ],
      { timeoutMs: 25_000 },
    );
  } catch {
    // If pipelines extension isn't installed or project has no pipelines, return empty.
    return [];
  }

  return rows.map(
    (r): PipelineRun => ({
      id: r.id ?? 0,
      name: r.buildNumber ?? `Run #${r.id ?? 0}`,
      pipelineName: r.definition?.name ?? "Unknown Pipeline",
      // `az pipelines runs list` uses "inProgress"/"completed" etc.
      state: mapRunState(r.status),
      result: mapRunResult(r.result),
      startTime: r.startTime ?? r.queueTime ?? null,
      finishTime: r.finishTime ?? null,
      url: r._links?.web?.href ?? "",
    }),
  );
};

const mapRunState = (status?: string): RunState => {
  switch (status?.toLowerCase()) {
    case "inprogress":
    case "in_progress":
      return "inProgress";
    case "cancelling":
    case "canceling":
      return "canceling";
    case "completed":
      return "completed";
    case "notstarted":
    case "postponed":
      return "none";
    default:
      return "none";
  }
};

const mapRunResult = (result?: string): RunResult | null => {
  if (!result) return null;
  switch (result.toLowerCase()) {
    case "succeeded":
    case "partiallysucceeded":
      return "succeeded";
    case "failed":
      return "failed";
    case "canceled":
    case "cancelled":
      return "canceled";
    default:
      return "none";
  }
};
