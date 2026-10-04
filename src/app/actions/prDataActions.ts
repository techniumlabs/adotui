import { produce } from "immer";
import type { PullRequest } from "../../domain/types";
import type { AppState } from "../types";
import { useAppStore } from "../store";

type DiffData = { rawDiff: string; additions: number; deletions: number } | null;

/**
 * Addresses one PR in the tree. Async results carry the PR they were fetched
 * for — never "whatever is selected when they land", which may be another PR.
 */
export type PrTarget = Pick<PullRequest, "organizationUrl" | "project" | "repository" | "id">;

/**
 * Single place for the org → repo → PR walk. Repo names are unique per
 * project, not per organization, so the project is part of the match.
 */
const findPrInDraft = (draft: AppState, target: PrTarget): PullRequest | undefined =>
  draft.data.organizations
    .find((org) => org.organizationUrl === target.organizationUrl)
    ?.repositories.find((repo) => repo.project === target.project && repo.name === target.repository)
    ?.pullRequests.find((pr) => pr.id === target.id);

const mutate = (recipe: (draft: AppState) => void): void => {
  useAppStore.setState(produce(recipe));
};

/** `target` is the PR snapshot the diff was fetched for (its iteration commits included). */
export const updateFileDiff = (target: PullRequest, filePath: string, diffData: DiffData): void => {
  mutate((draft) => {
    const pr = findPrInDraft(draft, target);
    // A diff fetched for an older iteration must not land on the new one.
    if (!pr || pr.iterSourceCommit !== target.iterSourceCommit || pr.iterTargetCommit !== target.iterTargetCommit) return;
    const file = pr.changedFiles.find((f) => f.path === filePath);
    if (!file) return;
    file.rawDiff = diffData ? diffData.rawDiff : "Error loading diff";
    file.additions = diffData?.additions ?? 0;
    file.deletions = diffData?.deletions ?? 0;
    file.loadingDiff = false;
  });
};

export const setFileLoading = (target: PrTarget, filePath: string): void => {
  mutate((draft) => {
    const file = findPrInDraft(draft, target)?.changedFiles.find((f) => f.path === filePath);
    if (file) file.loadingDiff = true;
  });
};

export const updatePr = (target: PrTarget, updates: Partial<PullRequest>): void => {
  mutate((draft) => {
    const pr = findPrInDraft(draft, target);
    if (!pr) return;
    // An iteration's file list never changes, so unless the details name a
    // different one, keep the files already shown with their loaded diffs.
    // No commits at all means the file fetch failed: keep what is shown too.
    const newIteration =
      updates.iterSourceCommit !== undefined &&
      (updates.iterSourceCommit !== pr.iterSourceCommit || updates.iterTargetCommit !== pr.iterTargetCommit);
    if (!newIteration) {
      const { changedFiles: _files, iterSourceCommit: _source, iterTargetCommit: _target, ...rest } = updates;
      Object.assign(pr, rest);
    } else {
      Object.assign(pr, updates);
    }
  });
};
