export type PullRequestStatus = "active" | "completed" | "abandoned";
export type ReviewState = "pending" | "approved" | "changes-requested" | "missing-required";

export interface PullRequestFileChange {
  path: string;
  /** Previous path when the file was renamed (the diff's old side lives there). */
  originalPath?: string;
  status: "added" | "modified" | "deleted";
  additions: number;
  deletions: number;
  diff: string[];
  /** Complete unified diff text fetched from Azure DevOps (includes --- +++ @@ headers). */
  rawDiff?: string;
  /** Indicates if the diff content is currently being loaded from Azure. */
  loadingDiff?: boolean;
}

export type MergeStatus =
  | "succeeded"
  | "conflicts"
  | "rejectedByPolicy"
  | "queued"
  | "failure"
  | "notSet";

// ─── PR Comments ─────────────────────────────────────────────────────────────

export type CommentType = "text" | "codeChange" | "system";

export interface PrCommentThread {
  id: number;
  status: "active" | "fixed" | "wontFix" | "closed" | "byDesign" | "pending" | "unknown";
  comments: PrComment[];
  /** File path this thread is anchored to (null = PR-level comment). */
  filePath: string | null;
  lineNumber: number | null;
}

export interface PrComment {
  id: number;
  threadId: number;
  author: string;
  authorEmail?: string;
  content: string;
  publishedDate: string;
  lastUpdatedDate: string;
  commentType: CommentType;
  isDeleted: boolean;
}

// ─── Pipeline Runs ───────────────────────────────────────────────────────────

export type RunResult = "canceled" | "failed" | "succeeded" | "none";
export type RunState = "canceling" | "completed" | "inProgress" | "none";

export interface PipelineRun {
  id: number;
  name: string;
  pipelineName: string;
  state: RunState;
  result: RunResult | null;
  startTime: string | null;
  finishTime: string | null;
  url: string;
}

export interface PullRequestWorkItem {
  id: number;
  title: string;
  state: string;
  type: string;
  url: string;
}

// ─── Core PR ─────────────────────────────────────────────────────────────────

export interface PullRequest {
  id: number;
  title: string;
  author: string;
  draft: boolean;
  status: PullRequestStatus;
  reviewState: ReviewState;
  sourceBranch: string;
  targetBranch: string;
  updatedAt: string;
  comments: number;
  activeComments: number;
  checksPassed: number;
  checksTotal: number;
  url: string;
  tags?: string[];
  changedFiles: PullRequestFileChange[];
  mergeStatus: MergeStatus;
  workItems?: PullRequestWorkItem[];
  reviewers?: { displayName: string; uniqueName: string }[];
  /**
   * Routing info identifying where this PR lives, used to dispatch `az`
   * actions unambiguously (independent of how the tree is grouped/labelled).
   */
  organizationUrl: string;
  project: string;
  repository: string;
  /** The repository's internal Azure DevOps ID (used for API calls). */
  repositoryId?: string;
  /** The project's internal Azure DevOps id (needed for policy artifact ids). */
  projectId?: string;
  iterSourceCommit?: string;
  iterTargetCommit?: string;
  /** Head of the source branch at the last merge; completing sends it (see PrRef). */
  lastMergeSourceCommit?: string;
  detailsLoaded?: boolean;
}

export interface RepositoryNode {
  name: string;
  /** Azure DevOps project this repository belongs to. */
  project: string;
  pullRequests: PullRequest[];
}

export interface OrganizationNode {
  name: string;
  /** Full Azure DevOps organization URL (e.g. https://dev.azure.com/contoso). */
  organizationUrl: string;
  repositories: RepositoryNode[];
}

export interface AppData {
  organizations: OrganizationNode[];
  currentUserEmail?: string;
}

export type MergeStrategy = "noFastForward" | "squash" | "rebase" | "rebaseMerge";

/** How a PR is merged when completed (the UI's editable options). */
export type CompletionOptions = {
  autoCompleteIgnoreConfigIds: number[];
  bypassPolicy: boolean;
  bypassReason: string;
  deleteSourceBranch: boolean;
  mergeCommitMessage: string;
  mergeStrategy: MergeStrategy;
  squashMerge: boolean;
  transitionWorkItems: boolean;
};

/** What the "new pull request" form sends. Branch names are short (`main`, not `refs/heads/main`). */
export type NewPullRequest = {
  sourceBranch: string;
  targetBranch: string;
  title: string;
  description: string;
  draft: boolean;
};

/** A repository's branches (short names, sorted) and its default branch, if it has one. */
export type RepoBranches = { branches: string[]; defaultBranch: string | null };

