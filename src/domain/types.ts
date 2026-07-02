export type PullRequestStatus = "active" | "completed" | "abandoned";
export type ReviewState = "pending" | "approved" | "changes-requested";

export interface PullRequestFileChange {
  path: string;
  status: "added" | "modified" | "deleted";
  additions: number;
  deletions: number;
  diff: string[];
  /** Complete unified diff text fetched from Azure DevOps (includes --- +++ @@ headers). */
  rawDiff?: string;
}

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
  checksPassed: number;
  checksTotal: number;
  url: string;
  changedFiles: PullRequestFileChange[];
  /**
   * Routing info identifying where this PR lives, used to dispatch `az`
   * actions unambiguously (independent of how the tree is grouped/labelled).
   */
  organizationUrl: string;
  project: string;
  repository: string;
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
}
