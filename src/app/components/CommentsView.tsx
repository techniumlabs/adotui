import React, { useEffect, useState } from "react";
import { Box } from "ink";
import type { PullRequest } from "../../domain/types";
import type { FocusArea } from "../types";
import { glyph, palette } from "../theme";
import { usePasteHandler } from "../hooks/usePasteHandler";
import { usePrComments, type CommentInputMode } from "../hooks/usePrComments";
import { moveSelection } from "../utils";
import { PanelTitle } from "./ui/PanelTitle";
import { TabPane } from "./ui/TabPane";
import { useCommentKeys, type PendingDelete } from "./comments/useCommentKeys";
import {
  CommentInput,
  CommentsCount,
  CommentsHint,
  CommentsPlaceholder,
  CommentsStatus,
  ThreadList,
} from "./comments/CommentsParts";

type CommentsViewProps = {
  selectedPr?: PullRequest;
  focus: FocusArea;
  currentUserEmail?: string;
  onInputModeChange: (active: boolean) => void;
};

export const CommentsView: React.FC<CommentsViewProps> = ({
  selectedPr,
  focus,
  currentUserEmail,
  onInputModeChange,
}) => {
  const active = focus === "comments";

  // UI state: selection, scroll, input mode. Data lives in usePrComments.
  const [selectedThread, setSelectedThread] = useState(0);
  const [selectedCommentIndex, setSelectedCommentIndex] = useState(-1);
  const [threadScrollOffset, setThreadScrollOffset] = useState(0);
  const [inputMode, setInputMode] = useState<CommentInputMode>("none");
  const [inputText, setInputText] = useState("");
  const [pendingDelete, setPendingDelete] = useState<PendingDelete>(null);

  const comments = usePrComments(selectedPr, currentUserEmail, () => setSelectedThread(0));
  const { threads, loading, error, submitting, statusMsg } = comments;

  usePasteHandler((pastedText) => {
    if (inputMode !== "none" && !submitting) {
      setInputText((t) => t + pastedText);
    }
  });

  useEffect(() => {
    onInputModeChange(inputMode !== "none");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputMode]);

  // A reload can shrink the list under the cursor — keep the selection valid.
  useEffect(() => {
    setSelectedThread((i) => moveSelection(i, 0, threads.length));
  }, [threads.length]);

  useCommentKeys({
    ...comments,
    active,
    selectedThread, setSelectedThread,
    selectedCommentIndex, setSelectedCommentIndex,
    threadScrollOffset, setThreadScrollOffset,
    inputMode, setInputMode,
    inputText, setInputText,
    pendingDelete, setPendingDelete,
  });

  const terminalHeight = process.stdout.rows ?? 40;
  const viewportH = Math.max(5, terminalHeight - 20);
  const empty = threads.length === 0;

  return (
    <TabPane>
      <Box justifyContent="space-between">
        <PanelTitle active={active}>
          {glyph.dot} Comments
        </PanelTitle>
        <Box>
          <CommentsCount loading={loading} threads={threads} selectedThread={selectedThread} />
        </Box>
      </Box>

      <Box height={1}>
        <CommentsStatus pendingDelete={pendingDelete} statusMsg={statusMsg} error={error} submitting={submitting} />
      </Box>

      {!selectedPr && (
        <CommentsPlaceholder height={viewportH} color={palette.muted}>Select a PR to view comments.</CommentsPlaceholder>
      )}
      {selectedPr && loading && empty && (
        <CommentsPlaceholder height={viewportH} color={palette.accent}>{glyph.clock} Loading comments...</CommentsPlaceholder>
      )}
      {selectedPr && !loading && empty && !error && (
        <CommentsPlaceholder height={viewportH} color={palette.muted}>No comments yet.</CommentsPlaceholder>
      )}

      <ThreadList
        threads={threads}
        selectedThread={selectedThread}
        selectedCommentIndex={selectedCommentIndex}
        threadScrollOffset={threadScrollOffset}
        active={active}
        height={viewportH}
        inputOpen={inputMode !== "none"}
      />

      {inputMode !== "none" && (
        <CommentInput
          mode={inputMode}
          text={inputText}
          submitting={submitting}
          threadId={String(threads[selectedThread]?.id ?? "")}
        />
      )}

      <Box height={1} marginTop={1} flexShrink={0}>
        {active && inputMode === "none" && <CommentsHint />}
      </Box>

    </TabPane>
  );
};
