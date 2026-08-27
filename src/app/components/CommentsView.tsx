import React, { useEffect, useRef, useState } from "react";
import { Box, Text, useInput } from "ink";
import type { PrCommentThread, PullRequest } from "../../domain/types";
import type { FocusArea } from "../types";
import { glyph, palette } from "../theme";
import { usePasteHandler } from "../hooks/usePasteHandler";
import {
  usePrComments,
  resolveTargetComment,
  type CommentInputMode,
  type PrComment,
} from "../hooks/usePrComments";
import { ThreadCard } from "./comments/ThreadCard";
import { computeScrollWindow, followSelection, moveSelection } from "../utils";

type CommentsViewProps = {
  selectedPr?: PullRequest;
  focus: FocusArea;
  currentUserEmail?: string;
  onInputModeChange: (active: boolean) => void;
};

/** Max visible threads for the current terminal height. */
const maxVisibleThreads = (): number => {
  const termH = process.stdout.rows ?? 40;
  return Math.max(4, Math.floor((Math.max(5, termH - 22)) / 5));
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
  const [pendingDelete, setPendingDelete] = useState<{ thread: PrCommentThread; comment: PrComment } | null>(null);

  const {
    threads,
    loading,
    error,
    submitting,
    statusMsg,
    loadComments,
    submitComment,
    deleteComment,
    toggleThreadStatus,
    canModifyComment,
  } = usePrComments(selectedPr, currentUserEmail, () => setSelectedThread(0));

  usePasteHandler((pastedText) => {
    if (inputMode !== "none" && !submitting) {
      setInputText((t) => t + pastedText);
    }
  });

  useEffect(() => {
    onInputModeChange(inputMode !== "none");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputMode]);

  // ── Keyboard ───────────────────────────────────────────────────────────────

  const stateRef = useRef({ threads, selectedThread, selectedCommentIndex, threadScrollOffset });
  useEffect(() => {
    stateRef.current = { threads, selectedThread, selectedCommentIndex, threadScrollOffset };
  }, [threads, selectedThread, selectedCommentIndex, threadScrollOffset]);

  useInput(
    (input, key) => {
      if (!active) return;

      // Text-input mode
      if (inputMode !== "none") {
        if (key.escape) {
          setInputMode("none");
          setInputText("");
          return;
        }
        if (key.return) {
          void submitComment(
            inputMode,
            inputText,
            stateRef.current.selectedThread,
            stateRef.current.selectedCommentIndex,
            () => {
              setInputMode("none");
              setInputText("");
            },
          );
          return;
        }
        if (key.backspace || key.delete) {
          setInputText((t) => t.slice(0, -1));
          return;
        }
        if (!key.ctrl && !key.meta && input) {
          setInputText((t) => t + input);
        }
        return;
      }

      // Pending comment-delete confirmation gate
      if (pendingDelete) {
        if (input === "y" || input === "Y") {
          deleteComment(pendingDelete.thread, pendingDelete.comment);
        }
        setPendingDelete(null);
        return;
      }

      // Navigation mode
      if (key.downArrow) {
        setSelectedThread((i) => {
          const next = moveSelection(i, 1, stateRef.current.threads.length);
          if (next !== i) setSelectedCommentIndex(-1);
          setThreadScrollOffset(followSelection(next, stateRef.current.threadScrollOffset, maxVisibleThreads()));
          return next;
        });
      } else if (key.upArrow) {
        setSelectedThread((i) => {
          const next = moveSelection(i, -1, stateRef.current.threads.length);
          if (next !== i) setSelectedCommentIndex(-1);
          setThreadScrollOffset(followSelection(next, stateRef.current.threadScrollOffset, maxVisibleThreads()));
          return next;
        });
      } else if (key.pageDown) {
        setSelectedThread((i) => {
          const maxVis = maxVisibleThreads();
          const next = moveSelection(i, maxVis, stateRef.current.threads.length);
          setSelectedCommentIndex(-1);
          if (next >= stateRef.current.threadScrollOffset + maxVis) {
            setThreadScrollOffset(Math.min(next - maxVis + 1, stateRef.current.threads.length - maxVis));
          }
          return next;
        });
      } else if (key.pageUp) {
        setSelectedThread((i) => {
          const maxVis = maxVisibleThreads();
          const next = moveSelection(i, -maxVis, stateRef.current.threads.length);
          setSelectedCommentIndex(-1);
          setThreadScrollOffset(followSelection(next, stateRef.current.threadScrollOffset, maxVis));
          return next;
        });
      } else if (input === "g") {
        setSelectedThread(0);
        setSelectedCommentIndex(-1);
        setThreadScrollOffset(0);
      } else if (input === "G") {
        const last = Math.max(0, stateRef.current.threads.length - 1);
        const maxVis = maxVisibleThreads();
        setSelectedThread(last);
        setSelectedCommentIndex(-1);
        setThreadScrollOffset(Math.max(0, last - maxVis + 1));
      } else if (key.leftArrow) {
        setSelectedCommentIndex((i) => Math.max(i - 1, -1));
      } else if (key.rightArrow) {
        const thread = stateRef.current.threads[stateRef.current.selectedThread];
        if (thread) {
          // -1 is root comment, 0 is 1st reply, etc.
          // max index is thread.comments.length - 2
          setSelectedCommentIndex((i) => Math.min(i + 1, thread.comments.length - 2));
        }
      } else if (input === "e" && !key.ctrl && stateRef.current.threads[stateRef.current.selectedThread]) {
        const thread = stateRef.current.threads[stateRef.current.selectedThread];
        const commentToEdit = resolveTargetComment(thread, stateRef.current.selectedCommentIndex);
        if (commentToEdit) {
          if (!canModifyComment(commentToEdit, "edit")) return;
          setInputMode("edit");
          setInputText(commentToEdit.content.trim());
        }
      } else if (input === "d" && !key.ctrl && stateRef.current.threads[stateRef.current.selectedThread]) {
        const thread = stateRef.current.threads[stateRef.current.selectedThread]!;
        const commentToDelete = resolveTargetComment(thread, stateRef.current.selectedCommentIndex);
        if (commentToDelete) {
          if (!canModifyComment(commentToDelete, "delete")) return;
          setPendingDelete({ thread, comment: commentToDelete });
        }
      } else if (input === "n" && !key.ctrl) {
        setInputMode("new");
        setInputText("");
      } else if (input === "r" && !key.ctrl && stateRef.current.threads[stateRef.current.selectedThread]) {
        setInputMode("reply");
        setInputText("");
      } else if (input === "R") {
        void loadComments(true);
      } else if (input === "s" && !key.ctrl && stateRef.current.threads[stateRef.current.selectedThread]) {
        const thread = stateRef.current.threads[stateRef.current.selectedThread]!;
        toggleThreadStatus(thread);
      }
    },
    { isActive: active },
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  const terminalHeight = process.stdout.rows ?? 40;
  const viewportH = Math.max(5, terminalHeight - 20);

  return (
    <Box
      borderStyle="single"
      borderTop={true}
      borderBottom={false}
      borderLeft={false}
      borderRight={false}
      borderColor={palette.border}
      paddingX={1}
      flexDirection="column"
    >
      {/* Header */}
      <Box justifyContent="space-between">
        <Text color={active ? palette.accent : palette.muted} bold>
          {glyph.dot} Comments
        </Text>
        <Box>
          {loading ? (
            <Text color={palette.muted}>
              {glyph.clock} loading…
            </Text>
          ) : (
            <Text color={palette.muted}>
              {threads.length > 0 ? selectedThread + 1 : 0}/{threads.length} thread{threads.length !== 1 ? "s" : ""} ({threads.reduce((acc, t) => acc + t.comments.length, 0)} comment{threads.reduce((acc, t) => acc + t.comments.length, 0) !== 1 ? "s" : ""})
            </Text>
          )}
        </Box>
      </Box>

      {/* Status / error */}
      <Box height={1}>
        {pendingDelete ? (
          <Text color={palette.warn}>
            Delete comment by {pendingDelete.comment.author}? (y/n)
          </Text>
        ) : (statusMsg ?? error) ? (
          <Text color={error ? palette.danger : palette.warn}>
            {statusMsg ?? error}
          </Text>
        ) : submitting ? (
          <Text color={palette.accent}>
            {glyph.clock} processing...
          </Text>
        ) : null}
      </Box>

      {/* No PR selected */}
      {!selectedPr && (
        <Box height={viewportH} justifyContent="center" alignItems="center" flexDirection="column">
          <Text color={palette.muted}>Select a PR to view comments.</Text>
        </Box>
      )}

      {/* Loading state when empty */}
      {selectedPr && loading && threads.length === 0 && (
        <Box height={viewportH} justifyContent="center" alignItems="center" flexDirection="column">
          <Text color={palette.accent}>
            {glyph.clock} Loading comments...
          </Text>
        </Box>
      )}

      {/* Empty state */}
      {selectedPr && !loading && threads.length === 0 && !error && (
        <Box height={viewportH} justifyContent="center" alignItems="center" flexDirection="column">
          <Text color={palette.muted}>No comments yet.</Text>
        </Box>
      )}

      {(() => {
        const maxVis = Math.max(4, Math.floor(viewportH / 5));

        const total = threads.length;
        const { offset: clampedOffset, canScrollUp, canScrollDown } = computeScrollWindow(total, maxVis, threadScrollOffset);
        const visibleThreads = threads.slice(clampedOffset, clampedOffset + maxVis);

        if (total === 0) return null;

        return (
          <Box flexDirection="column">
            <Box flexDirection="column" height={inputMode !== "none" ? viewportH - 6 : viewportH} overflow="hidden">
              {visibleThreads.map((thread) => {
                const idx = threads.findIndex(t => t.id === thread.id);
                return (
                  <ThreadCard
                    key={thread.id}
                    thread={thread}
                    isSelected={idx === selectedThread && active}
                    selectedCommentIndex={selectedCommentIndex}
                  />
                );
              })}
            </Box>

            {/* Scroll indicators at bottom edge */}
            {(canScrollUp || canScrollDown) && (
              <Box justifyContent="flex-end" marginTop={0}>
                <Text color={palette.muted}>
                  {canScrollUp ? "↑ more above " : ""}
                  {canScrollUp && canScrollDown ? "· " : ""}
                  {canScrollDown ? "↓ more below" : ""}
                </Text>
              </Box>
            )}
          </Box>
        );
      })()}

      {/* Comment input box */}
      {inputMode !== "none" && (
        <Box
          marginTop={1}
          borderStyle="single"
          borderColor={palette.accent}
          paddingX={1}
          flexDirection="column"
        >
          <Text color={palette.accent} bold>
            {inputMode === "new" ? `${glyph.added} New comment` : inputMode === "edit" ? `${glyph.pointer} Edit comment` : `↳ Reply to thread #${threads[selectedThread]?.id ?? ""}`}
            {"  "}
            <Text color={palette.muted}>(Enter to send · Esc to cancel)</Text>
          </Text>
          <Text color={submitting ? palette.muted : palette.textBright}>
            {inputText || " "}
            {!submitting && <Text color={palette.accent}>▌</Text>}
          </Text>
        </Box>
      )}

      {/* Keyboard hint */}
      <Box height={1} marginTop={1} flexShrink={0}>
        {active && inputMode === "none" && (
          <Text color={palette.muted}>
            <Text color={palette.accentDim}>↑/↓</Text> navigate{"  "}
            <Text color={palette.accentDim}>←/→</Text> select comment{"  "}
            <Text color={palette.accentDim}>n</Text> new{"  "}
            <Text color={palette.accentDim}>r</Text> reply{"  "}
            <Text color={palette.accentDim}>e</Text> edit{"  "}
            <Text color={palette.accentDim}>d</Text> delete{"  "}
            <Text color={palette.accentDim}>s</Text> resolve{"  "}
            <Text color={palette.accentDim}>R</Text> refresh{"  "}
            <Text color={palette.accentDim}>h</Text> back
          </Text>
        )}
      </Box>

    </Box>
  );
};
