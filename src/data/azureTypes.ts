/**
 * Raw wire shapes returned by `az repos ...` (Azure DevOps REST payloads).
 *
 * These intentionally mark most fields optional/loose: Azure DevOps output
 * varies across API versions and CLI extension versions. The normalizers in
 * azureNormalize.ts defensively map these to the strict domain types.
 */

export interface AzureIdentityRef {
  id?: string;
  displayName?: string;
  uniqueName?: string;
  vote?: number;
  isRequired?: boolean;
}

export interface AzureRepositoryRef {
  id?: string;
  name?: string;
  project?: { id?: string; name?: string };
  webUrl?: string;
  remoteUrl?: string;
}

export interface AzurePullRequest {
  pullRequestId?: number;
  codeReviewId?: number;
  title?: string;
  description?: string;
  status?: string; // "active" | "completed" | "abandoned"
  isDraft?: boolean;
  createdBy?: AzureIdentityRef;
  creationDate?: string;
  sourceRefName?: string; // refs/heads/foo
  targetRefName?: string;
  reviewers?: AzureIdentityRef[];
  repository?: AzureRepositoryRef;
  mergeStatus?: string;
  labels?: { id?: string; name?: string; active?: boolean }[];
  lastMergeSourceCommit?: { commitId?: string };
  lastMergeTargetCommit?: { commitId?: string };
  url?: string;
}

/** `az repos list` element. */
export interface AzureRepository {
  id?: string;
  name?: string;
  webUrl?: string;
  remoteUrl?: string;
  project?: { id?: string; name?: string };
  isDisabled?: boolean;
}

/** `az repos pr policy list` element (used for check rollups). */
export interface AzurePolicyEvaluation {
  status?: string; // "approved" | "queued" | "running" | "rejected" | "notApplicable"
  configuration?: { isBlocking?: boolean; type?: { displayName?: string } };
}

/** PR iteration change entry from the REST changes endpoint. */
export interface AzureIterationChange {
  changeType?: string; // "add" | "edit" | "delete" | "rename" | ...
  item?: { path?: string; gitObjectType?: string; isFolder?: boolean };
}

export interface AzureIterationChanges {
  changeEntries?: AzureIterationChange[];
}

export interface AzureIteration {
  id?: number;
}

export interface AzureIterationList {
  value?: AzureIteration[];
}
