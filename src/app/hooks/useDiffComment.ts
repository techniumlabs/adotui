import { useEffect, useRef, useState } from "react";
import type { PullRequest, PullRequestFileChange } from "../../domain/types";
import { postPrComment } from "../../data/azureRest";
import { usePasteHandler } from "./usePasteHandler";

export type DiffRowPosition = { oldNo: number | null; newNo: number | null };

/**
 * Comment-input state and submission for inline diff comments in FilesView.
 * When the selected row maps to a file line, the comment is anchored there
 * (right side for added/context lines, left side for deleted lines).
 */
export function useDiffComment(
  selectedPr: PullRequest | undefined,
  selectedFile: PullRequestFileChange | undefined,
  onInputModeChange: (active: boolean) => void,
) {
  const [commentMode, setCommentMode] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const isSubmittingRef = useRef(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  usePasteHandler((pastedText) => {
    if (commentMode && !submitting) {
      setCommentText((t) => t + pastedText);
    }
  });

  useEffect(() => {
    onInputModeChange(commentMode);
  }, [commentMode, onInputModeChange]);

  const openComment = () => {
    setCommentMode(true);
    setStatusMsg(null);
  };

  const cancelComment = () => {
    setCommentMode(false);
    setCommentText("");
  };

  const submitComment = (rowInfo: DiffRowPosition | undefined): void => {
    if (!commentText.trim() || !selectedPr || !selectedFile || isSubmittingRef.current) return;

    isSubmittingRef.current = true;
    setSubmitting(true);
    const repoId = selectedPr.repositoryId ?? selectedPr.repository;

    interface FilePosition { line: number; offset: number }
    let threadContext: {
      filePath: string;
      rightFileStart?: FilePosition;
      rightFileEnd?: FilePosition;
      leftFileStart?: FilePosition;
      leftFileEnd?: FilePosition;
    } = { filePath: selectedFile.path };
    let pullRequestThreadContext:
      | { changeTrackingId: number; iterationContext: { firstComparingIteration: number; secondComparingIteration: number } }
      | undefined = undefined;

    if (rowInfo && rowInfo.newNo !== null) {
      threadContext = {
        filePath: selectedFile.path,
        rightFileStart: { line: rowInfo.newNo, offset: 1 },
        rightFileEnd: { line: rowInfo.newNo, offset: 999 }
      };
      pullRequestThreadContext = { changeTrackingId: 1, iterationContext: { firstComparingIteration: 1, secondComparingIteration: 2 } };
    } else if (rowInfo && rowInfo.oldNo !== null) {
      threadContext = {
        filePath: selectedFile.path,
        leftFileStart: { line: rowInfo.oldNo, offset: 1 },
        leftFileEnd: { line: rowInfo.oldNo, offset: 999 }
      };
      pullRequestThreadContext = { changeTrackingId: 1, iterationContext: { firstComparingIteration: 1, secondComparingIteration: 1 } };
    }

    postPrComment(
      selectedPr.organizationUrl,
      selectedPr.project,
      repoId,
      selectedPr.id,
      commentText.trim(),
      threadContext,
      pullRequestThreadContext
    ).then((ok) => {
      isSubmittingRef.current = false;
      setSubmitting(false);
      if (ok) {
        setStatusMsg("Comment posted.");
        setCommentMode(false);
        setCommentText("");
      } else {
        setStatusMsg("Failed to post comment.");
        // Don't close comment mode on failure so they don't lose their text,
        // but we need to ensure the status message is visible!
      }
      setTimeout(() => setStatusMsg(null), 3000);
    });
  };

  return {
    commentMode,
    commentText,
    setCommentText,
    submitting,
    statusMsg,
    openComment,
    cancelComment,
    submitComment,
  };
}
