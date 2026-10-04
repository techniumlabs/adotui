/**
 * PR mutations — vote, abandon, complete — over the Azure DevOps REST API
 * (see adoFetch.ts). They throw AdoHttpError when Azure DevOps refuses; the
 * confirm flow turns that into a banner.
 */
import type { CompletionOptions, NewPullRequest } from "../domain/types";
import type { RepoRef } from "./refs";
import { AdoHttpError, adoGet, adoPatch, adoPost, adoPut, seg } from "./adoFetch";
import { getCurrentIdentity } from "./azureIdentity";
import { debugLog } from "../shared/debugLog";
import type { AzurePullRequest } from "./azureTypes";

/** Identifies a specific PR for actions. */
export interface PrRef {
  organization: string;
  project: string;
  repository: string;
  prId: number;
  /**
   * Head of the source branch when the user last saw the PR. Completion sends
   * it so Azure DevOps refuses to merge commits pushed since the review.
   */
  lastMergeSourceCommit?: string;
}

/** Azure DevOps error code: the source branch moved since `lastMergeSourceCommit`. */
const SOURCE_MODIFIED_CODE = "TF401192";

/** IdentityRefWithVote.vote values. */
const VOTE_APPROVE = 10;
const VOTE_REJECT = -10;

const pullRequestPath = (ref: PrRef): string =>
  `${seg(ref.project)}/_apis/git/repositories/${seg(ref.repository)}/pullrequests/${ref.prId}`;

const castVote = async (ref: PrRef, vote: number): Promise<void> => {
  const me = await getCurrentIdentity(ref.organization);
  if (!me) throw new Error("Could not determine your Azure DevOps identity, so the vote was not cast.");
  await adoPut(ref.organization, `${pullRequestPath(ref)}/reviewers/${me.id}`, { id: me.id, vote });
};

export const approvePr = (ref: PrRef): Promise<void> => castVote(ref, VOTE_APPROVE);

export const rejectPr = (ref: PrRef): Promise<void> => castVote(ref, VOTE_REJECT);

export const abandonPr = async (ref: PrRef): Promise<void> => {
  await adoPatch(ref.organization, pullRequestPath(ref), { status: "abandoned" });
};

/** GitPullRequestCompletionOptions; optional fields are sent only when set. */
const toCompletionOptions = (options: CompletionOptions) => ({
  mergeStrategy: options.mergeStrategy,
  deleteSourceBranch: options.deleteSourceBranch,
  transitionWorkItems: options.transitionWorkItems,
  ...(options.bypassPolicy
    ? { bypassPolicy: true, ...(options.bypassReason ? { bypassReason: options.bypassReason } : {}) }
    : {}),
  ...(options.mergeCommitMessage ? { mergeCommitMessage: options.mergeCommitMessage } : {}),
});

/**
 * How a completion ended. Azure DevOps answers the PATCH with 200 as soon as the
 * completion is QUEUED ("mergeStatus": "queued"); the merge itself runs
 * afterwards and can still fail on conflicts or policy. Measured live: a clean
 * PR reads `completed` ~1.5 s later, a conflicting one flips back to `active`
 * with "mergeStatus": "conflicts" and no queue time.
 */
export type CompletionOutcome =
  | { state: "completed" }
  | { state: "failed"; reason: string }
  /** Still queued when we stopped waiting — the result is not known. */
  | { state: "pending" };

const MERGE_FAILURES: Record<string, string> = {
  conflicts: "the PR has merge conflicts — resolve them in Azure DevOps, then complete again",
  rejectedByPolicy: "blocked by branch policy (a required check or reviewer is missing)",
  failure: "Azure DevOps could not merge it",
};

const COMPLETION_POLL_INTERVAL_MS = 1_000;
const COMPLETION_POLL_ATTEMPTS = 15;

/** What a PR snapshot says about a completion in flight; null = still deciding. */
const settledOutcome = (pr: AzurePullRequest): CompletionOutcome | null => {
  if (pr.status === "completed") return { state: "completed" };
  if (pr.status === "abandoned") return { state: "failed", reason: "the PR was abandoned in the meantime" };
  const failure = pr.mergeStatus ? MERGE_FAILURES[pr.mergeStatus] : undefined;
  // `queued` is the intermediate state; a failure only counts once the queue has drained.
  if (failure && !pr.completionQueueTime) return { state: "failed", reason: pr.mergeFailureMessage || failure };
  return null;
};

/** Watches a queued completion until it settles or the attempts run out. */
const awaitCompletion = async (ref: PrRef, first: AzurePullRequest, intervalMs: number): Promise<CompletionOutcome> => {
  let snapshot = first;
  for (let attempt = 0; attempt <= COMPLETION_POLL_ATTEMPTS; attempt += 1) {
    const outcome = settledOutcome(snapshot);
    if (outcome) return outcome;
    if (attempt === COMPLETION_POLL_ATTEMPTS) break;
    await Bun.sleep(intervalMs);
    try {
      snapshot = await adoGet<AzurePullRequest>(ref.organization, pullRequestPath(ref));
    } catch (cause) {
      // A failed look says nothing about the merge: report "unknown", never a false failure.
      debugLog("completion status check failed", ref.prId, cause);
      return { state: "pending" };
    }
  }
  return { state: "pending" };
};

/**
 * Completes a PR and reports how it ended. Throws when Azure DevOps refuses
 * the request outright (stale source commit, policy, permissions); a request
 * it accepts and then fails to merge comes back as `failed`.
 */
export const completePr = async (
  ref: PrRef,
  options: CompletionOptions,
  pollIntervalMs = COMPLETION_POLL_INTERVAL_MS,
): Promise<CompletionOutcome> => {
  // Prefer the commit the user reviewed; fall back to the PR's current head
  // for refs that never carried one (cached or mock-era data).
  const commitId =
    ref.lastMergeSourceCommit ??
    (await adoGet<AzurePullRequest>(ref.organization, pullRequestPath(ref))).lastMergeSourceCommit?.commitId;
  if (!commitId) {
    throw new Error("This PR has no merge source commit yet (its merge may still be computing) — refresh and try again.");
  }
  let accepted: AzurePullRequest;
  try {
    accepted = await adoPatch<AzurePullRequest>(ref.organization, pullRequestPath(ref), {
      status: "completed",
      lastMergeSourceCommit: { commitId },
      completionOptions: toCompletionOptions(options),
    });
  } catch (cause) {
    // Verified live: pushing to the source branch after the review makes Azure
    // DevOps answer 409 TF401192, which is the guard doing its job.
    if (cause instanceof AdoHttpError && cause.detail.includes(SOURCE_MODIFIED_CODE)) {
      throw new Error(
        "The source branch changed since you last loaded this PR — refresh, review the new commits, then complete again.",
        { cause },
      );
    }
    throw cause;
  }
  return awaitCompletion(ref, accepted, pollIntervalMs);
};

/** Opens a pull request; throws AdoHttpError with Azure DevOps' reason when it refuses. */
export const createPullRequest = async (repo: RepoRef, pr: NewPullRequest): Promise<{ id: number }> => {
  if (process.env.ADOTUI_MOCK) return { id: (await import("./mock")).MOCK_CREATED_PR_ID };
  const created = await adoPost<{ pullRequestId?: number }>(
    repo.organizationUrl,
    `${seg(repo.project)}/_apis/git/repositories/${seg(repo.repositoryId)}/pullrequests`,
    {
      sourceRefName: `refs/heads/${pr.sourceBranch}`,
      targetRefName: `refs/heads/${pr.targetBranch}`,
      title: pr.title,
      description: pr.description,
      isDraft: pr.draft,
    },
  );
  return { id: created.pullRequestId ?? 0 };
};

