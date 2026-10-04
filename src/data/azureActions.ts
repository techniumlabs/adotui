/**
 * PR mutations — vote, abandon, complete — over the Azure DevOps REST API
 * (see adoFetch.ts). They throw AdoHttpError when Azure DevOps refuses; the
 * confirm flow turns that into a banner.
 */
import type { CompletionOptions } from "../domain/types";
import { AdoHttpError, adoGet, adoPatch, adoPut, seg } from "./adoFetch";
import { getCurrentIdentity } from "./azureIdentity";
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

export const completePr = async (ref: PrRef, options: CompletionOptions): Promise<void> => {
  // Prefer the commit the user reviewed; fall back to the PR's current head
  // for refs that never carried one (cached or mock-era data).
  const commitId =
    ref.lastMergeSourceCommit ??
    (await adoGet<AzurePullRequest>(ref.organization, pullRequestPath(ref))).lastMergeSourceCommit?.commitId;
  if (!commitId) {
    throw new Error("This PR has no merge source commit yet (its merge may still be computing) — refresh and try again.");
  }
  try {
    await adoPatch(ref.organization, pullRequestPath(ref), {
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
};
