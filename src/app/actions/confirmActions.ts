import type { PullRequest } from "../../domain/types";
import type { AppState, CompletionOptions, ConfirmKind, LoadState, PrTarget } from "../types";
import { DEFAULT_COMPLETION_OPTIONS } from "../constants";
import { serializeCompletionOptions } from "../utils";
import {
  abandonPr,
  approvePr,
  completePr,
  completionStrategyNote,
  rejectPr,
  type PrRef,
} from "../../data/azure";
import { resolvePrRefFromParts } from "../dataController";
import { getState, patchState, updateState } from "../store";
import { selectSelectedPr } from "../selectors";
import { doRefresh } from "./refreshActions";

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
    kind === "abandon"  ? "PR abandoned."                             :
    `PR completed and merged. ${serializeCompletionOptions(opts)}${
      completionStrategyNote(opts) ? ` ${completionStrategyNote(opts)}` : ""
    }`;

  transformPrById(
    { organizationUrl: target.organizationUrl, repository: target.repository, prId: target.prId },
    optimistic,
    pendingBanner,
    "loading",
  );

  const ref = resolvePrRefFromParts({
    organizationUrl: target.organizationUrl,
    project: target.project,
    repository: target.repository,
    prId: target.prId,
  });

  if (!ref) {
    patchState({ banner: "Applied locally (no live ref: mock mode or PR missing routing info)." });
    return;
  }

  const action = (r: PrRef): Promise<void> =>
    kind === "approve"  ? approvePr(r)  :
    kind === "reject"   ? rejectPr(r)   :
    kind === "abandon"  ? abandonPr(r)  :
    completePr(r, opts);

  action(ref)
    .then(() => {
      patchState({ banner: successBanner, loadState: "ready" });
      doRefresh("auto");
    })
    .catch((cause: unknown) => {
      patchState({
        banner: `Action failed: ${cause instanceof Error ? cause.message : String(cause)}`,
        loadState: "error",
      });
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
