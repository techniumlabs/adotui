import type { PullRequest } from "../../domain/types";
import type { AppState, CompletionOptions, ConfirmKind, LoadState, PrTarget } from "../types";
import { DEFAULT_COMPLETION_OPTIONS } from "../constants";
import { serializeCompletionOptions } from "../utils";
import {
  abandonPr,
  approvePr,
  completePr,
  rejectPr,
  type CompletionOutcome,
} from "../../data/azure";
import { resolvePrRefFromParts } from "../dataController";
import { getState, patchState, updateState } from "../store";
import { selectSelectedPr } from "../selectors";
import { doRefresh } from "./refreshActions";
import { addToast } from "./toastActions";

const transformPrById = (
  target: { organizationUrl: string; repository: string; prId: number },
  transformer: (pr: PullRequest) => PullRequest,
  successBanner: string,
  newLoadState?: LoadState,
): void => {
  updateState((current) => {
    let matched = false;
    const organizations = current.data.organizations.map((orgItem) => {
      if (orgItem.organizationUrl !== target.organizationUrl) return orgItem;
      return {
        ...orgItem,
        repositories: orgItem.repositories.map((repoItem) => {
          if (repoItem.name !== target.repository) return repoItem;
          return {
            ...repoItem,
            pullRequests: repoItem.pullRequests.map((prItem) => {
              if (prItem.id !== target.prId) return prItem;
              matched = true;
              return transformer(prItem);
            }),
          };
        }),
      };
    });
    if (!matched) return {};
    return {
      data: { ...current.data, organizations },
      banner: successBanner,
      ...(newLoadState ? { loadState: newLoadState } : {}),
    };
  });
};

/**
 * What to tell the user once a completion has settled. Azure DevOps accepts a
 * completion before it has merged anything, so "accepted" is not "merged".
 */
export const describeCompletion = (
  outcome: CompletionOutcome,
  target: Pick<PrTarget, "prId">,
  options: CompletionOptions,
): { banner: string; ok: boolean } => {
  switch (outcome.state) {
    case "completed":
      return { banner: `PR completed and merged. ${serializeCompletionOptions(options)}`, ok: true };
    case "failed":
      return { banner: `Could not complete PR #${target.prId}: ${outcome.reason}.`, ok: false };
    case "pending":
      return {
        banner: `Completion of PR #${target.prId} was requested but Azure DevOps has not finished — refresh (r) to see the result.`,
        ok: true,
      };
  }
};

export const runConfirmedAction = (confirm: NonNullable<AppState["pendingConfirm"]>): void => {
  const { kind, target, completionOptions } = confirm;

  const optimistic = (pr: PullRequest): PullRequest => {
    switch (kind) {
      case "approve":  return { ...pr, reviewState: "approved" };
      case "reject":   return { ...pr, reviewState: "changes-requested" };
      case "abandon":  return { ...pr, status: "abandoned" };
      case "complete": return { ...pr, status: "completed" };
    }
  };

  const pendingBanner =
    kind === "approve"  ? "Approving PR..."  :
    kind === "reject"   ? "Rejecting PR..."  :
    kind === "abandon"  ? "Abandoning PR..." : "Completing PR...";

  const opts = completionOptions ?? DEFAULT_COMPLETION_OPTIONS;
  const successBanner =
    kind === "approve"  ? "PR approved."                              :
    kind === "reject"   ? "PR rejected (changes requested)."          :
    "PR abandoned.";

  const ref = resolvePrRefFromParts({
    organizationUrl: target.organizationUrl,
    project: target.project,
    repository: target.repository,
    prId: target.prId,
    lastMergeSourceCommit: target.lastMergeSourceCommit,
  });
  const locator = { organizationUrl: target.organizationUrl, repository: target.repository, prId: target.prId };

  if (!ref) {
    // Mock mode: nothing to ask, so apply the outcome locally.
    transformPrById(locator, optimistic, pendingBanner, "loading");
    patchState({ banner: "Applied locally (no live ref: mock mode or PR missing routing info)." });
    return;
  }

  if (kind === "complete") {
    // Not applied optimistically: the merge may still fail, and a PR that
    // showed "completed" and then reappeared as active would be a lie.
    patchState({ banner: pendingBanner, loadState: "loading" });
    completePr(ref, opts)
      .then((outcome) => {
        const { banner, ok } = describeCompletion(outcome, target, opts);
        if (outcome.state === "completed") transformPrById(locator, optimistic, banner, "ready");
        else patchState({ banner, loadState: "ready" });
        if (!ok) addToast(banner, "error");
        doRefresh("auto");
      })
      .catch(reportActionFailure);
    return;
  }

  transformPrById(locator, optimistic, pendingBanner, "loading");
  (kind === "approve" ? approvePr(ref) : kind === "reject" ? rejectPr(ref) : abandonPr(ref))
    .then(() => {
      patchState({ banner: successBanner, loadState: "ready" });
      doRefresh("auto");
    })
    .catch(reportActionFailure);
};

const reportActionFailure = (cause: unknown): void => {
  patchState({
    banner: `Action failed: ${cause instanceof Error ? cause.message : String(cause)}`,
    loadState: "error",
  });
};

export const armConfirm = (kind: ConfirmKind, completionOptions?: CompletionOptions): void => {
  const selectedPr = selectSelectedPr(getState());
  if (!selectedPr) {
    patchState({ banner: "No PR selected." });
    return;
  }
  const target: PrTarget = {
    organizationUrl: selectedPr.organizationUrl,
    project: selectedPr.project,
    repository: selectedPr.repository,
    prId: selectedPr.id,
    title: selectedPr.title,
    lastMergeSourceCommit: selectedPr.lastMergeSourceCommit,
  };
  const verb =
    kind === "approve"  ? "Approve"        :
    kind === "reject"   ? "Reject"         :
    kind === "abandon"  ? "Abandon"        : "Complete & merge";
  const suffix = kind === "abandon" || kind === "complete" ? " (irreversible)" : "";
  patchState({
    pendingConfirm: completionOptions ? { kind, target, completionOptions } : { kind, target },
    ...(kind === "complete" ? { focus: "list" as const } : {}),
    banner: `${verb} PR #${target.prId} "${target.title}"${suffix}? (y/n)`,
  });
};
