import { addToast } from "./toastActions";
import { doRefresh } from "./refreshActions";
import { moveTreeSelection, changePrSelection, changeFileSelection, selectTreeNode, selectPr, selectFile } from "./selectionActions";
import { armConfirm, runConfirmedAction } from "./confirmActions";
import { openCompletionEditor, submitCompletion } from "./completionActions";
import { openCreatePr, closeCreatePr, submitCreatePr } from "./createPrActions";
import { executeCommand } from "./commandActions";
import { setDiffScrollOffset, setDiffSelectedRow, setCommentInputActive, openPrTab } from "./uiActions";
import { openFilterPrompt, editFilterText, applyFilter, cancelFilter } from "./filterActions";
import { updateFileDiff, setFileLoading, updatePr } from "./prDataActions";

/**
 * All app actions as one stable, module-level object. Handed to components as
 * `actions` from useAppState — identity never changes, so memoized children
 * and effect deps stay quiet.
 */
export const appActions = {
  addToast,
  doRefresh,
  moveTreeSelection,
  changePrSelection,
  changeFileSelection,
  selectTreeNode,
  selectPr,
  selectFile,
  openPrTab,
  armConfirm,
  runConfirmedAction,
  openCompletionEditor,
  submitCompletion,
  openCreatePr,
  closeCreatePr,
  submitCreatePr,
  executeCommand,
  openFilterPrompt,
  editFilterText,
  applyFilter,
  cancelFilter,
  setDiffScrollOffset,
  setDiffSelectedRow,
  setCommentInputActive,
  updateFileDiff,
  setFileLoading,
  updatePr,
} as const;
