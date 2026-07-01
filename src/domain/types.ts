export type PullRequestStatus = "active" | "completed" | "abandoned";
export type ReviewState = "pending" | "approved" | "changes-requested";

export interface PullRequestFileChange {
  path: string;
  status: "added" | "modified" | "deleted";
  additions: number;
  deletions: number;
  diff: string[];
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
}

export interface RepositoryNode {
  name: string;
  pullRequests: PullRequest[];
}

export interface OrganizationNode {
  name: string;
  repositories: RepositoryNode[];
}

export interface AppData {
  organizations: OrganizationNode[];
}
