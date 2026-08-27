import { produce } from "immer";
import type { PullRequest } from "../../domain/types";
import type { AppState } from "../types";
import { getState, useAppStore } from "../store";
import { selectSelectedPr } from "../selectors";

type DiffData = { rawDiff: string; additions: number; deletions: number } | null;

/** Single place for the org → repo → PR walk previously duplicated per action. */
const findPrInDraft = (
  draft: AppState,
  organizationUrl: string,
  repository: string,
  prId: number,
): PullRequest | undefined =>
  draft.data.organizations
    .find((org) => org.organizationUrl === organizationUrl)
    ?.repositories.find((repo) => repo.name === repository)
    ?.pullRequests.find((pr) => pr.id === prId);

const mutate = (recipe: (draft: AppState) => void): void => {
  useAppStore.setState(produce(recipe));
};

export const updateFileDiff = (filePath: string, diffData: DiffData): void => {
  const selectedPr = selectSelectedPr(getState());
  if (!selectedPr) return;
  mutate((draft) => {
    const file = findPrInDraft(draft, selectedPr.organizationUrl, selectedPr.repository, selectedPr.id)
      ?.changedFiles?.find((f) => f.path === filePath);
    if (!file) return;
    file.rawDiff = diffData ? diffData.rawDiff : "Error loading diff";
    file.additions = diffData?.additions ?? 0;
    file.deletions = diffData?.deletions ?? 0;
    file.loadingDiff = false;
  });
};

export const setFileLoading = (filePath: string): void => {
  const selectedPr = selectSelectedPr(getState());
  if (!selectedPr) return;
  mutate((draft) => {
    const file = findPrInDraft(draft, selectedPr.organizationUrl, selectedPr.repository, selectedPr.id)
      ?.changedFiles?.find((f) => f.path === filePath);
    if (file) file.loadingDiff = true;
  });
};

export const updatePr = (
  orgUrl: string,
  repoName: string,
  prId: number,
  updates: Partial<PullRequest>,
): void => {
  mutate((draft) => {
    const pr = findPrInDraft(draft, orgUrl, repoName, prId);
    if (pr) Object.assign(pr, updates);
  });
};
