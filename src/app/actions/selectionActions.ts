import { getState, patchState, updateState } from "../store";
import type { AppState } from "../types";
import { selectSelectedPr } from "../selectors";
import { clamp, getVisiblePrs, getVisibleFiles, matchesTreeFilter } from "../utils";

export const moveTreeSelection = (orgDelta: number, repoDelta: number, banner?: string): void => {
  updateState((current) => {
    const filter = current.treeFilter;
    const flatList: { orgIndex: number; repoIndex: number }[] = [];

    current.data.organizations.forEach((org, orgIdx) => {
      let added = false;
      org.repositories.forEach((repo, repoIdx) => {
        const matchingPrs =
          filter === "all" || filter === "with-prs"
            ? repo.pullRequests
            : repo.pullRequests.filter((pr) =>
                matchesTreeFilter(pr, filter, current.data.currentUserEmail),
              );
        if (filter === "all" || matchingPrs.length > 0) {
          flatList.push({ orgIndex: orgIdx, repoIndex: repoIdx });
          added = true;
        }
      });
      if (!added) flatList.push({ orgIndex: orgIdx, repoIndex: 0 });
    });

    if (flatList.length === 0) return {};

    let currentIndex = flatList.findIndex(
      (item) => item.orgIndex === current.selectedOrgIndex && item.repoIndex === current.selectedRepoIndex,
    );
    if (currentIndex === -1) {
      currentIndex = flatList.findIndex((item) => item.orgIndex === current.selectedOrgIndex);
      if (currentIndex === -1) currentIndex = 0;
    }

    let nextIndex = currentIndex;
    if (repoDelta !== 0) {
      nextIndex = clamp(currentIndex + repoDelta, 0, flatList.length - 1);
    } else if (orgDelta !== 0) {
      const currentOrgIndex = flatList[currentIndex]!.orgIndex;
      const targetOrgIndex = clamp(currentOrgIndex + orgDelta, 0, current.data.organizations.length - 1);
      const nextOrgFirstItem = flatList.findIndex((item) => item.orgIndex === targetOrgIndex);
      if (nextOrgFirstItem !== -1) nextIndex = nextOrgFirstItem;
    }

    const { orgIndex, repoIndex } = flatList[nextIndex]!;
    return treePatch(current, orgIndex, repoIndex, banner);
  });
};

/** Selecting a tree node: the PR index is clamped to the new repo's visible PRs. */
const treePatch = (current: AppState, orgIndex: number, repoIndex: number, banner?: string): Partial<AppState> => {
  const repo = current.data.organizations[orgIndex]?.repositories[repoIndex];
  const visible = getVisiblePrs(repo, current.treeFilter, current.data.currentUserEmail);
  return {
    selectedOrgIndex: orgIndex,
    selectedRepoIndex: repoIndex,
    selectedPrIndex: clamp(current.selectedPrIndex, 0, Math.max(0, visible.length - 1)),
    fileFilter: "",
    banner: banner ?? current.banner,
  };
};

/** A click on a tree row: an organization row opens its first visible repo, a repo row selects it. */
export const selectTreeNode = (orgIndex: number, repoIndex?: number): void => {
  const current = getState();
  if (repoIndex === undefined) {
    if (orgIndex !== current.selectedOrgIndex) moveTreeSelection(orgIndex - current.selectedOrgIndex, 0);
  } else if (orgIndex !== current.selectedOrgIndex || repoIndex !== current.selectedRepoIndex) {
    updateState((c) => treePatch(c, orgIndex, repoIndex));
  }
  if (getState().focus !== "tree") patchState({ focus: "tree" });
};

/** A click on a PR row (`index` into the visible PRs). */
export const selectPr = (index: number): void => {
  const delta = index - getState().selectedPrIndex;
  if (delta !== 0) changePrSelection(delta);
  if (getState().focus !== "list") patchState({ focus: "list" });
};

/** A click on a file in the Diff tab (`index` into the visible files). */
export const selectFile = (index: number): void => {
  const delta = index - getState().selectedFileIndex;
  if (delta !== 0) changeFileSelection(delta);
};

export const changePrSelection = (delta: number): void => {
  updateState((current) => {
    const org = current.data.organizations[current.selectedOrgIndex];
    const repo = org?.repositories[current.selectedRepoIndex];
    const visible = getVisiblePrs(repo, current.treeFilter, current.data.currentUserEmail);
    if (visible.length === 0) return {};

    const nextIndex = clamp(current.selectedPrIndex + delta, 0, visible.length - 1);
    if (nextIndex === current.selectedPrIndex) return {};

    const currentPr = visible[current.selectedPrIndex];
    const visibleFiles = getVisibleFiles(currentPr, current.fileFilter);
    const currentFile = visibleFiles[current.selectedFileIndex];
    const newScrollStates = { ...current.fileScrollStates };
    if (currentPr && currentFile) {
      newScrollStates[`${currentPr.id}:${currentFile.path}`] = {
        offset: current.diffScrollOffset,
        row: current.diffSelectedRow,
      };
    }
    return {
      selectedPrIndex: nextIndex,
      selectedFileIndex: 0,
      diffScrollOffset: 0,
      diffSelectedRow: 0,
      fileFilter: "",
      fileScrollStates: newScrollStates,
    };
  });
};

export const changeFileSelection = (delta: number): void => {
  updateState((current) => {
    // selectedPrIndex indexes the FILTERED list, like everywhere else (selectSelectedPr).
    const pr = selectSelectedPr(current);
    const visibleFiles = getVisibleFiles(pr, current.fileFilter);
    if (!pr || visibleFiles.length === 0) return {};

    const nextIndex = clamp(current.selectedFileIndex + delta, 0, visibleFiles.length - 1);
    if (nextIndex === current.selectedFileIndex) return {};

    const currentFile = visibleFiles[current.selectedFileIndex];
    const newScrollStates = { ...current.fileScrollStates };
    if (currentFile) {
      newScrollStates[`${pr.id}:${currentFile.path}`] = {
        offset: current.diffScrollOffset,
        row: current.diffSelectedRow,
      };
    }
    const nextFile = visibleFiles[nextIndex];
    let nextOffset = 0;
    let nextRow = 0;
    if (nextFile) {
      const saved = newScrollStates[`${pr.id}:${nextFile.path}`];
      if (saved) { nextOffset = saved.offset; nextRow = saved.row; }
    }
    return {
      selectedFileIndex: nextIndex,
      diffScrollOffset: nextOffset,
      diffSelectedRow: nextRow,
      fileScrollStates: newScrollStates,
    };
  });
};
