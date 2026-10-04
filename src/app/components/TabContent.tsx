import React from "react";
import type { AppHandle } from "../hooks/useAppState";
import { CommentsView } from "./CommentsView";
import { FilesView } from "./FilesView";
import { PipelineRunsView } from "./PipelineRunsView";
import { PrDetails } from "./PrDetails";

/** The pane under the PR tabs. Modal prompts (command, completion, filter) keep the tab they opened over. */
export const TabContent: React.FC<{ app: AppHandle }> = ({ app }) => {
  const { state, selectedPr, actions } = app;
  const overlay = state.focus === "command" || state.focus === "completion" || state.focus === "filter";
  const renderFocus = overlay ? (state.previousFocus ?? "detail") : state.focus;

  if (renderFocus === "files") {
    return (
      <FilesView
        selectedPr={selectedPr}
        selectedFileIndex={state.selectedFileIndex}
        diffScrollOffset={state.diffScrollOffset}
        onScrollOffsetChange={actions.setDiffScrollOffset}
        diffSelectedRow={state.diffSelectedRow}
        onSelectedRowChange={actions.setDiffSelectedRow}
        focus={state.focus}
        onInputModeChange={actions.setCommentInputActive}
        isLoading={state.loadState === "loading"}
        fileFilter={state.fileFilter}
        updateFileDiff={actions.updateFileDiff}
        setFileLoading={actions.setFileLoading}
        onSelectFile={actions.selectFile}
      />
    );
  }
  if (renderFocus === "comments") {
    return (
      <CommentsView
        selectedPr={selectedPr}
        focus={state.focus}
        currentUserEmail={state.data.currentUserEmail}
        onInputModeChange={actions.setCommentInputActive}
      />
    );
  }
  if (renderFocus === "runs" && process.env.NODE_ENV === "debug") {
    return <PipelineRunsView selectedPr={selectedPr} focus={state.focus} />;
  }
  return <PrDetails selectedPr={selectedPr} focus={state.focus} currentUserEmail={state.data.currentUserEmail} />;
};
