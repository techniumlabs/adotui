import type { Dispatch, SetStateAction } from "react";
import type { AppState } from "../types";
import { clamp, getVisiblePrs, getVisibleFiles, matchesTreeFilter } from "../utils";

export function useSelection(setState: Dispatch<SetStateAction<AppState>>) {
  const moveTreeSelection = (orgDelta: number, repoDelta: number, banner?: string) => {
    setState((current) => {
      const filter = current.treeFilter;
      const flatList: { orgIndex: number; repoIndex: number }[] = [];

      current.data.organizations.forEach((org, orgIdx) => {
        let added = false;
        org.repositories.forEach((repo, repoIdx) => {
          const matchingPrs =
            filter === "all" || filter === "with-prs"
              ? repo.pullRequests
              : repo.pullRequests.filter((pr) => matchesTreeFilter(pr, filter));
          if (filter === "all" || matchingPrs.length > 0) {
            flatList.push({ orgIndex: orgIdx, repoIndex: repoIdx });
            added = true;
          }
        });
        if (!added) flatList.push({ orgIndex: orgIdx, repoIndex: 0 });
      });

      if (flatList.length === 0) return current;

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

      const { orgIndex: nextOrgIndex, repoIndex: nextRepoIndex } = flatList[nextIndex]!;
      const nextOrg = current.data.organizations[nextOrgIndex];
      const nextRepo = nextOrg?.repositories[nextRepoIndex];
      const nextVisible = getVisiblePrs(nextRepo, current.treeFilter);

      return {
        ...current,
        selectedOrgIndex: nextOrgIndex,
        selectedRepoIndex: nextRepoIndex,
        selectedPrIndex: clamp(current.selectedPrIndex, 0, Math.max(0, nextVisible.length - 1)),
        banner: banner ?? current.banner,
      };
    });
  };

  const changePrSelection = (delta: number) => {
    setState((current) => {
      const org = current.data.organizations[current.selectedOrgIndex];
      const repo = org?.repositories[current.selectedRepoIndex];
      const visible = getVisiblePrs(repo, current.treeFilter);
      if (visible.length === 0) return current;

      const nextIndex = clamp(current.selectedPrIndex + delta, 0, visible.length - 1);
      if (nextIndex === current.selectedPrIndex) return current;

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
        ...current,
        selectedPrIndex: nextIndex,
        selectedFileIndex: 0,
        diffScrollOffset: 0,
        diffSelectedRow: 0,
        fileScrollStates: newScrollStates,
      };
    });
  };

  const changeFileSelection = (delta: number) => {
    setState((current) => {
      const org = current.data.organizations[current.selectedOrgIndex];
      const repo = org?.repositories[current.selectedRepoIndex];
      const pr = repo?.pullRequests[current.selectedPrIndex];
      const visibleFiles = getVisibleFiles(pr, current.fileFilter);
      if (!pr || visibleFiles.length === 0) return current;

      const nextIndex = clamp(current.selectedFileIndex + delta, 0, visibleFiles.length - 1);
      if (nextIndex === current.selectedFileIndex) return current;

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
        ...current,
        selectedFileIndex: nextIndex,
        diffScrollOffset: nextOffset,
        diffSelectedRow: nextRow,
        fileScrollStates: newScrollStates,
      };
    });
  };

  return { moveTreeSelection, changePrSelection, changeFileSelection };
}
