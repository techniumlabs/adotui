/**
 * PR comment threads and pipeline runs over the Azure DevOps REST API
 * (see adoFetch.ts). Mutations return a boolean so the UI can report a
 * failure without unwinding; read failures return null so callers can tell
 * "could not load" from "nothing there".
 */
import type {
  CommentType,
  PipelineRun,
  PrCommentThread,
  RunResult,
  RunState,
} from "../domain/types";
import { adoDelete, adoGet, adoPatch, adoPost, seg, type AdoList } from "./adoFetch";
import { debugLog } from "../app/utils";

// ─── PR Comment types ─────────────────────────────────────────────────────────

export interface RawThread {
  id: number;
  status?: string;
  isDeleted?: boolean;
  threadContext?: {
    filePath?: string;
    rightFileStart?: { line?: number };
  } | null;
  comments?: RawComment[];
}

export interface RawComment {
  id: number;
  author?: { displayName?: string; uniqueName?: string };
  content?: string;
  publishedDate?: string;
  lastUpdatedDate?: string;
  commentType?: string;
  isDeleted?: boolean;
}

/**
 * Normalizes raw pullRequestThreads payloads: drops deleted threads and
 * comments, filters system comments, and removes threads left empty.
 * Exported for tests.
 */
export const normalizeThreads = (rawThreads: RawThread[]): PrCommentThread[] =>
  rawThreads
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

/** `.../pullRequests/{id}/threads` for a repo (id or name both resolve). */
const threadsPath = (project: string, repositoryId: string, prId: number): string =>
  `${seg(project)}/_apis/git/repositories/${seg(repositoryId)}/pullRequests/${prId}/threads`;

// ─── PR Comments ──────────────────────────────────────────────────────────────

/**
 * Fetches PR comment threads. Returns null when the fetch fails (transient
 * network/auth error) so callers can distinguish "could not load" from "no
 * comments" — a silent [] used to get cached and shown as empty.
 */
export const fetchPrComments = async (
  organizationUrl: string,
  project: string,
  repositoryId: string,
  prId: number,
): Promise<PrCommentThread[] | null> => {
  if (process.env.ADOTUI_MOCK) {
    const { getMockComments } = await import("./mock");
    return getMockComments(prId);
  }

  try {
    const data = await adoGet<AdoList<RawThread>>(
      organizationUrl,
      threadsPath(project, repositoryId, prId),
    );
    if (!data?.value) return null;
    return normalizeThreads(data.value);
  } catch (e) {
    debugLog("fetchPrComments error", e);
    return null;
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

  try {
    await adoPost(organizationUrl, threadsPath(project, repositoryId, prId), body);
    return true;
  } catch (e) {
    debugLog("postPrComment error", e);
    return false;
  }
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
  try {
    await adoPost(
      organizationUrl,
      `${threadsPath(project, repositoryId, prId)}/${threadId}/comments`,
      { parentCommentId, content, commentType: 1 },
    );
    return true;
  } catch (e) {
    debugLog("replyToPrThread error", e);
    return false;
  }
};

export const updatePrThreadStatus = async (
  organizationUrl: string,
  project: string,
  repositoryId: string,
  prId: number,
  threadId: number,
  statusId: number, // 1: Active, 2: Fixed, 3: WontFix, 4: Closed, 5: ByDesign, 6: Pending
): Promise<boolean> => {
  try {
    await adoPatch(
      organizationUrl,
      `${threadsPath(project, repositoryId, prId)}/${threadId}`,
      { status: statusId },
    );
    return true;
  } catch (e) {
    debugLog("updatePrThreadStatus error", e);
    return false;
  }
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
  try {
    await adoPatch(
      organizationUrl,
      `${threadsPath(project, repositoryId, prId)}/${threadId}/comments/${commentId}`,
      { content },
    );
    return true;
  } catch (e) {
    debugLog("editPrComment error", e);
    return false;
  }
};

export const deletePrComment = async (
  organizationUrl: string,
  project: string,
  repositoryId: string,
  prId: number,
  threadId: number,
  commentId: number,
): Promise<boolean> => {
  try {
    await adoDelete(
      organizationUrl,
      `${threadsPath(project, repositoryId, prId)}/${threadId}/comments/${commentId}`,
    );
    return true;
  } catch (e) {
    debugLog("deletePrComment error", e);
    return false;
  }
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
  let rows: RawRun[];

  try {
    const data = await adoGet<AdoList<RawRun>>(
      organizationUrl,
      `${seg(project)}/_apis/build/builds`,
      { query: { "$top": 30, queryOrder: "queueTimeDescending" }, timeoutMs: 25_000 },
    );
    rows = data.value ?? [];
  } catch (e) {
    // No build service access or no pipelines in the project: show nothing.
    debugLog("fetchPipelineRuns error", e);
    return [];
  }

  return rows.map(
    (r): PipelineRun => ({
      id: r.id ?? 0,
      name: r.buildNumber ?? `Run #${r.id ?? 0}`,
      pipelineName: r.definition?.name ?? "Unknown Pipeline",
      state: mapRunState(r.status),
      result: mapRunResult(r.result),
      startTime: r.startTime ?? r.queueTime ?? null,
      finishTime: r.finishTime ?? null,
      url: r._links?.web?.href ?? "",
    }),
  );
};

export const mapRunState = (status?: string): RunState => {
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

export const mapRunResult = (result?: string): RunResult | null => {
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
