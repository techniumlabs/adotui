import { useEffect, useMemo } from "react";
import { produce } from "immer";
import type { OrganizationNode, PullRequest } from "../../domain/types";
import { useAppStore } from "../store";
import {
  countTotalPrs,
  countActivePrs,
  getVisiblePrs,
} from "../utils";
import { useToast } from "./useToast";
import { useRefresh } from "./useRefresh";
import { useSelection } from "./useSelection";
import { useConfirmAction } from "./useConfirmAction";
import { useCompletionEditor } from "./useCompletionEditor";
import { useCommandDispatch } from "./useCommandDispatch";


/** Shared type for the return value of useAppState, used by keyboard handlers. */
export type AppHandle = ReturnType<typeof useAppState>;

export function useAppState(exitApp: () => void) {
  // Bind to the Zustand store instead of local React state
  const state = useAppStore();
  const setState = state.setState;

  const { addToast } = useToast(setState);
  const { doRefresh } = useRefresh(state.autoRefresh, setState, addToast);

  const selectedOrg: OrganizationNode | undefined =
    state.data.organizations[state.selectedOrgIndex];
  const selectedRepo = selectedOrg?.repositories[state.selectedRepoIndex];

  const visiblePrs = useMemo(
    () => getVisiblePrs(selectedRepo, state.treeFilter),
    [selectedRepo, state.treeFilter],
  );

  const selectedPr: PullRequest | undefined = visiblePrs[state.selectedPrIndex];
  const totalPrs = useMemo(() => countTotalPrs(state.data), [state.data]);
  const repoCount = useMemo(
    () => state.data.organizations.reduce((acc, org) => acc + org.repositories.length, 0),
    [state.data],
  );
  const activePrs = useMemo(() => countActivePrs(state.data), [state.data]);

  const selection = useSelection(setState);
  const { armConfirm, runConfirmedAction } = useConfirmAction(setState, selectedPr, doRefresh);
  const { openCompletionEditor, submitCompletion } = useCompletionEditor(setState, armConfirm);
  const { executeCommand } = useCommandDispatch(setState, selectedPr, doRefresh, armConfirm, openCompletionEditor, exitApp);

  // Named setters used by child components (replaces raw setState exposure)
  const setDiffScrollOffset = (offset: number) =>
    setState((c) => ({ ...c, diffScrollOffset: offset }));
  const setDiffSelectedRow = (row: number) =>
    setState((c) => ({ ...c, diffSelectedRow: row }));
  const setCommentInputActive = (active: boolean) =>
    setState((c) => (c.commentInputActive === active ? c : { ...c, commentInputActive: active }));

  const updateFileDiff = (filePath: string, diffData: { rawDiff: string; additions: number; deletions: number } | null) => {
    if (!selectedPr) return;
    setState(produce(draft => {
      const pr = draft.data.organizations[draft.selectedOrgIndex]
        ?.repositories[draft.selectedRepoIndex]
        ?.pullRequests.find(p => p.id === selectedPr.id);
      
      const file = pr?.changedFiles?.find(f => f.path === filePath);
      if (file) {
        file.rawDiff = diffData ? diffData.rawDiff : "Error loading diff";
        file.additions = diffData ? diffData.additions : 0;
        file.deletions = diffData ? diffData.deletions : 0;
        file.loadingDiff = false;
      }
    }));
  };

  const setFileLoading = (filePath: string) => {
    if (!selectedPr) return;
    setState(produce(draft => {
      const pr = draft.data.organizations[draft.selectedOrgIndex]
        ?.repositories[draft.selectedRepoIndex]
        ?.pullRequests.find(p => p.id === selectedPr.id);
      
      const file = pr?.changedFiles?.find(f => f.path === filePath);
      if (file) {
        file.loadingDiff = true;
      }
    }));
  };

  // Initial data load
  useEffect(() => {
    doRefresh("initial");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    state,
    setState, // kept for useAppKeyboard (internal infrastructure)
    selectedOrg,
    selectedRepo,
    visiblePrs,
    selectedPr,
    totalPrs,
    repoCount,
    activePrs,
    actions: {
      ...selection,
      addToast,
      doRefresh,
      armConfirm,
      runConfirmedAction,
      openCompletionEditor,
      submitCompletion,
      executeCommand,
      setDiffScrollOffset,
      setDiffSelectedRow,
      setCommentInputActive,
      updateFileDiff,
      setFileLoading,
    },
  };
}
