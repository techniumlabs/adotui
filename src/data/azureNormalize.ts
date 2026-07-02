import type {
  MergeStatus,
  PullRequest,
  PullRequestFileChange,
  PullRequestStatus,
  ReviewState,
} from "../domain/types";
import type {
  AzureIterationChange,
  AzurePolicyEvaluation,
  AzurePullRequest,
} from "./azureTypes";

/** Strip the refs/heads/ prefix from an Azure ref name. */
export const shortBranch = (ref: string | undefined): string => {
  if (!ref) {
    return "";
  }
  return ref.replace(/^refs\/heads\//, "").replace(/^refs\/pull\//, "pull/");
};

/** Short, human-readable label for an organization URL (last path segment). */
export const orgLabel = (organizationUrl: string): string => {
  const trimmed = organizationUrl.replace(/\/+$/, "");
  return trimmed.split("/").pop() || trimmed;
};

const normalizeStatus = (status: string | undefined): PullRequestStatus => {
  switch (status) {
    case "completed":
      return "completed";
    case "abandoned":
      return "abandoned";
    default:
      return "active";
  }
};

/**
 * Derives an aggregate review state from PR reviewer votes.
 * Azure vote values: 10 approved, 5 approved-with-suggestions, 0 no vote,
 * -5 waiting for author (soft, non-blocking), -10 rejected (hard block).
 * Only a hard rejection (-10) forces "changes-requested"; "waiting for author"
 * (-5) is treated as non-blocking and does not override approvals.
 */
export const deriveReviewState = (pr: AzurePullRequest): ReviewState => {
  const votes = (pr.reviewers ?? []).map((reviewer) => reviewer.vote ?? 0);

  if (votes.some((vote) => vote <= -10)) {
    return "changes-requested";
  }

  if (votes.some((vote) => vote >= 5)) {
    return "approved";
  }

  return "pending";
};

/** Builds the browser URL for a PR. */
export const buildPrUrl = (
  organization: string,
  project: string,
  repository: string,
  prId: number,
): string => {
  const org = organization.replace(/\/+$/, "");
  return `${org}/${encodeURIComponent(project)}/_git/${encodeURIComponent(
    repository,
  )}/pullrequest/${prId}`;
};

/**
 * Rolls up policy evaluations into passed/total counts for the checks display.
 */
export const summarizeChecks = (
  policies: AzurePolicyEvaluation[],
): { passed: number; total: number } => {
  const relevant = policies.filter(
    (policy) => policy.configuration?.isBlocking !== false,
  );
  const total = relevant.length;
  const passed = relevant.filter(
    (policy) => policy.status === "approved",
  ).length;
  return { passed, total };
};

const changeTypeToStatus = (
  changeType: string | undefined,
): PullRequestFileChange["status"] => {
  const normalized = (changeType ?? "").toLowerCase();
  if (normalized.includes("add")) {
    return "added";
  }
  if (normalized.includes("delete")) {
    return "deleted";
  }
  return "modified";
};

/**
 * Maps PR iteration change entries to domain file-change stubs. Azure's change
 * list does not include line-level diffs, so `diff` is left empty and
 * additions/deletions default to 0 (populated lazily elsewhere if desired).
 */
export const normalizeFileChanges = (
  changes: AzureIterationChange[],
): PullRequestFileChange[] => {
  return changes
    .filter((change) => change.item && !change.item.isFolder && change.item.path)
    .map((change) => ({
      path: (change.item?.path ?? "").replace(/^\//, ""),
      status: changeTypeToStatus(change.changeType),
      additions: 0,
      deletions: 0,
      diff: [],
    }));
};

const normalizeMergeStatus = (status: string | undefined): MergeStatus => {
  switch (status) {
    case "succeeded": return "succeeded";
    case "conflicts": return "conflicts";
    case "rejectedByPolicy": return "rejectedByPolicy";
    case "queued": return "queued";
    case "failure": return "failure";
    default: return "notSet";
  }
};

/**
 * Maps a raw Azure PR into the domain PullRequest. `changedFiles` and check
 * counts are provided separately (they require extra API calls) and default to
 * empty when not supplied.
 */
export const normalizePullRequest = (
  pr: AzurePullRequest,
  context: {
    organization: string;
    project: string;
    repository: string;
    changedFiles?: PullRequestFileChange[];
    checksPassed?: number;
    checksTotal?: number;
    commentCount?: number;
  },
): PullRequest => {
  const id = pr.pullRequestId ?? 0;

  return {
    id,
    title: pr.title ?? "(untitled)",
    author: pr.createdBy?.displayName ?? pr.createdBy?.uniqueName ?? "unknown",
    draft: pr.isDraft ?? false,
    status: normalizeStatus(pr.status),
    reviewState: deriveReviewState(pr),
    sourceBranch: shortBranch(pr.sourceRefName),
    targetBranch: shortBranch(pr.targetRefName),
    updatedAt: pr.creationDate ?? new Date().toISOString(),
    comments: context.commentCount ?? 0,
    checksPassed: context.checksPassed ?? 0,
    checksTotal: context.checksTotal ?? 0,
    url: buildPrUrl(
      context.organization,
      context.project,
      context.repository,
      id,
    ),
    changedFiles: context.changedFiles ?? [],
    mergeStatus: normalizeMergeStatus(pr.mergeStatus),
    organizationUrl: context.organization,
    project: context.project,
    repository: context.repository,
  };
};
