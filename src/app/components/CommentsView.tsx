import React, { useCallback, useEffect, useRef, useState } from "react";
import { Box, Text, useInput } from "ink";
import Spinner from "ink-spinner";
import type { PrCommentThread, PullRequest } from "../../domain/types";
import type { FocusArea } from "../types";
import { glyph, palette, truncate } from "../theme";
import { formatRelativeAge } from "../utils";
import {
  fetchPrComments,
  postPrComment,
  replyToPrThread,
  updatePrThreadStatus,
  deletePrComment,
  editPrComment,
} from "../../data/azureRest";
import { usePasteHandler } from "../hooks/usePasteHandler";
import {
  commentCacheKey,
  getCommentCache,
  invalidateCommentCache,
  setCommentCache,
} from "../../data/cache";

type CommentsViewProps = {
  selectedPr?: PullRequest;
  focus: FocusArea;
  currentUserEmail?: string;
  onInputModeChange: (active: boolean) => void;
};

type CommentInputMode = "none" | "new" | "reply" | "edit";

const threadStatusColor = (
  status: PrCommentThread["status"],
): string => {
  switch (status) {
    case "active":
      return palette.warn;
    case "fixed":
    case "byDesign":
      return palette.ok;
    case "wontFix":
    case "closed":
      return palette.muted;
    default:
      return palette.muted;
  }
};

const threadStatusLabel = (status: PrCommentThread["status"]): string => {
  switch (status) {
    case "active": return "open";
    case "fixed": return "fixed";
    case "wontFix": return "wontfix";
    case "closed": return "closed";
    case "byDesign": return "bydesign";
    case "pending": return "pending";
    default: return "unknown";
  }
};

export const CommentsView: React.FC<CommentsViewProps> = ({
  selectedPr,
  focus,
  currentUserEmail,
  onInputModeChange,
}) => {
  const active = focus === "comments";

  const [threads, setThreads] = useState<PrCommentThread[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedThread, setSelectedThread] = useState(0);
  const [selectedCommentIndex, setSelectedCommentIndex] = useState(-1);
  const [threadScrollOffset, setThreadScrollOffset] = useState(0);
  const [inputMode, setInputMode] = useState<CommentInputMode>("none");
  const [inputText, setInputText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const isSubmittingRef = React.useRef(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  usePasteHandler((pastedText) => {
    if (inputMode !== "none" && !submitting) {
      setInputText((t) => t + pastedText);
    }
  });

  useEffect(() => {
    onInputModeChange(inputMode !== "none");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputMode]);

  // ── Data loading ───────────────────────────────────────────────────────────

  const loadComments = useCallback(
    async (force = false) => {
      if (!selectedPr) return;
      const repoId = selectedPr.repositoryId ?? selectedPr.repository;
      const key = commentCacheKey(
        selectedPr.organizationUrl,
        selectedPr.project,
        repoId,
        selectedPr.id,
      );

      if (!force) {
        const cached = getCommentCache(key);
        if (cached) {
          setThreads(cached);
          return;
        }
      }

      setLoading(true);
      setError(null);
      try {

        const data = await fetchPrComments(
          selectedPr.organizationUrl,
          selectedPr.project,
          repoId,
          selectedPr.id,
        );
        setCommentCache(key, data);
        setThreads(data);
        setSelectedThread(0);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load comments.");
      } finally {
        setLoading(false);
      }
    },
    [selectedPr],
  );

  useEffect(() => {

    if (selectedPr) {
      void loadComments();

    } else {
      setThreads([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPr?.id]);

  // ── Actions ────────────────────────────────────────────────────────────────

  const submitComment = useCallback(async () => {
    if (!selectedPr || !inputText.trim() || isSubmittingRef.current) return;
    const repoId = selectedPr.repositoryId ?? selectedPr.repository;

    isSubmittingRef.current = true;
    setSubmitting(true);

    try {
      let ok = false;
      if (inputMode === "new") {
        ok = await postPrComment(
          selectedPr.organizationUrl,
          selectedPr.project,
          repoId,
          selectedPr.id,
          inputText.trim(),
        );
      } else if (inputMode === "reply") {
        const thread = threads[selectedThread];
        if (thread) {
          ok = await replyToPrThread(
            selectedPr.organizationUrl,
            selectedPr.project,
            repoId,
            selectedPr.id,
            thread.id,
            thread.comments[0]?.id ?? 1,
            inputText.trim(),
          );
        }
      } else if (inputMode === "edit") {
        const thread = threads[selectedThread];
        const comments = thread?.comments ?? [];
        const commentToEdit = selectedCommentIndex === -1 ? comments[0] : comments[selectedCommentIndex + 1];
        if (thread && commentToEdit) {
          ok = await editPrComment(
            selectedPr.organizationUrl,
            selectedPr.project,
            repoId,
            selectedPr.id,
            thread.id,
            commentToEdit.id,
            inputText.trim(),
          );
        }
      }

      if (ok) {
        const key = commentCacheKey(
          selectedPr.organizationUrl,
          selectedPr.project,
          repoId,
          selectedPr.id,
        );
        invalidateCommentCache(key);
        setStatusMsg("Comment posted. Refreshing…");
        setInputMode("none");
        setInputText("");
        await loadComments(true);
        setStatusMsg(null);
      } else {
        setStatusMsg("Failed to post comment (check auth/permissions).");
      }
    } catch (e) {
      setStatusMsg(e instanceof Error ? e.message : "Error posting comment.");
    } finally {
      isSubmittingRef.current = false;
      setSubmitting(false);
    }
  }, [selectedPr, inputMode, inputText, selectedThread, selectedCommentIndex, threads, loadComments]);

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
          void submitComment();
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

      // Navigation mode
      if (input === "j" || key.downArrow) {
        setSelectedThread((i) => {
          const next = Math.min(i + 1, stateRef.current.threads.length - 1);
          if (next !== i) setSelectedCommentIndex(-1);
          const termH = process.stdout.rows ?? 40;
          const maxVis = Math.max(4, Math.floor((Math.max(5, termH - 22)) / 5));
          if (next >= stateRef.current.threadScrollOffset + maxVis) {
            setThreadScrollOffset(next - maxVis + 1);
          }
          return next;
        });
      } else if (input === "k" || key.upArrow) {
        setSelectedThread((i) => {
          const next = Math.max(i - 1, 0);
          if (next !== i) setSelectedCommentIndex(-1);
          if (next < stateRef.current.threadScrollOffset) {
            setThreadScrollOffset(next);
          }
          return next;
        });
      } else if (key.pageDown) {
        setSelectedThread((i) => {
          const termH = process.stdout.rows ?? 40;
          const maxVis = Math.max(4, Math.floor((Math.max(5, termH - 22)) / 5));
          const next = Math.min(i + maxVis, stateRef.current.threads.length - 1);
          setSelectedCommentIndex(-1);
          if (next >= stateRef.current.threadScrollOffset + maxVis) {
            setThreadScrollOffset(Math.min(next - maxVis + 1, stateRef.current.threads.length - maxVis));
          }
          return next;
        });
      } else if (key.pageUp) {
        setSelectedThread((i) => {
          const termH = process.stdout.rows ?? 40;
          const maxVis = Math.max(4, Math.floor((Math.max(5, termH - 22)) / 5));
          const next = Math.max(i - maxVis, 0);
          setSelectedCommentIndex(-1);
          if (next < stateRef.current.threadScrollOffset) {
            setThreadScrollOffset(Math.max(next, 0));
          }
          return next;
        });
      } else if (input === "g") {
        setSelectedThread(0);
        setSelectedCommentIndex(-1);
        setThreadScrollOffset(0);
      } else if (input === "G") {
        const last = Math.max(0, stateRef.current.threads.length - 1);
        const termH = process.stdout.rows ?? 40;
        const maxVis = Math.max(4, Math.floor((Math.max(5, termH - 22)) / 5));
        setSelectedThread(last);
        setSelectedCommentIndex(-1);
        setThreadScrollOffset(Math.max(0, last - maxVis + 1));
      } else if (input === "[" || key.leftArrow) {
        setSelectedCommentIndex((i) => Math.max(i - 1, -1));
      } else if (input === "]" || key.rightArrow) {
        const thread = stateRef.current.threads[stateRef.current.selectedThread];
        if (thread) {
          // -1 is root comment, 0 is 1st reply, etc.
          // max index is thread.comments.length - 2
          setSelectedCommentIndex((i) => Math.min(i + 1, thread.comments.length - 2));
        }
      } else if (input === "e" && !key.ctrl && stateRef.current.threads[stateRef.current.selectedThread]) {
        const thread = stateRef.current.threads[stateRef.current.selectedThread];
        const comments = thread?.comments ?? [];
        const commentToEdit = stateRef.current.selectedCommentIndex === -1 ? comments[0] : comments[stateRef.current.selectedCommentIndex + 1];
        if (commentToEdit) {
          if (currentUserEmail && commentToEdit.authorEmail && commentToEdit.authorEmail !== currentUserEmail) {
            setStatusMsg("Cannot edit someone else's comment.");
            setTimeout(() => setStatusMsg(null), 3000);
            return;
          }
          setInputMode("edit");
          setInputText(commentToEdit.content.trim());
        }
      } else if (input === "d" && !key.ctrl && stateRef.current.threads[stateRef.current.selectedThread]) {
        const thread = stateRef.current.threads[stateRef.current.selectedThread];
        const comments = thread?.comments ?? [];
        const commentToDelete = stateRef.current.selectedCommentIndex === -1 ? comments[0] : comments[stateRef.current.selectedCommentIndex + 1];
        if (thread && commentToDelete && !isSubmittingRef.current) {
          if (currentUserEmail && commentToDelete.authorEmail && commentToDelete.authorEmail !== currentUserEmail) {
            setStatusMsg("Cannot delete someone else's comment.");
            setTimeout(() => setStatusMsg(null), 3000);
            return;
          }
          isSubmittingRef.current = true;
          setSubmitting(true);
          const repoId = selectedPr?.repositoryId ?? selectedPr?.repository;
          if (selectedPr && repoId) {
            deletePrComment(
              selectedPr.organizationUrl,
              selectedPr.project,
              repoId,
              selectedPr.id,
              thread.id,
              commentToDelete.id
            ).then((ok) => {
              isSubmittingRef.current = false;
              setSubmitting(false);
              if (ok) void loadComments(true);
            });
          }
        }
      } else if (input === "n" && !key.ctrl) {
        setInputMode("new");
        setInputText("");
      } else if (input === "r" && !key.ctrl && threads[selectedThread]) {
        setInputMode("reply");
        setInputText("");
      } else if (input === "r" && key.ctrl) {
        void loadComments(true);
      } else if (input === "s" && !key.ctrl && stateRef.current.threads[stateRef.current.selectedThread]) {
        const thread = stateRef.current.threads[stateRef.current.selectedThread];
        if (!thread || !selectedPr || isSubmittingRef.current) return;
        isSubmittingRef.current = true;
        setSubmitting(true);
        const repoId = selectedPr.repositoryId ?? selectedPr.repository;
        const newStatus = thread.status === "active" ? 2 : 1; // 2=fixed, 1=active
        updatePrThreadStatus(
          selectedPr.organizationUrl,
          selectedPr.project,
          repoId,
          selectedPr.id,
          thread.id!,
          newStatus
        ).then((ok) => {
          isSubmittingRef.current = false;
          setSubmitting(false);
          if (ok) {
            void loadComments(true);
          }
        });
      }
    },
    { isActive: active },
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  const terminalHeight = process.stdout.rows ?? 40;
  const viewportH = Math.max(5, terminalHeight - 22);

  return (
    <Box
      marginTop={1}
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
              <Spinner type="dots" /> loading…
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
        {(statusMsg ?? error) ? (
          <Text color={error ? palette.danger : palette.warn}>
            {statusMsg ?? error}
          </Text>
        ) : submitting ? (
          <Text color={palette.accent}>
            <Spinner type="dots" /> processing...
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
            <Spinner type="dots" /> Loading comments...
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
        const clampedOffset = Math.max(0, Math.min(threadScrollOffset, total - maxVis));
        const visibleThreads = threads.slice(clampedOffset, clampedOffset + maxVis);

        if (total === 0) return null;

        const canScrollUp = clampedOffset > 0;
        const canScrollDown = clampedOffset + maxVis < total;

        return (
          <Box flexDirection="column">
            <Box flexDirection="column" height={viewportH} overflow="hidden">
              {visibleThreads.map((thread) => {
                const idx = threads.findIndex(t => t.id === thread.id);
                const isSelected = idx === selectedThread && active;
                const firstComment = thread.comments[0];
                const replyCount = thread.comments.length - 1;

                return (
                  <Box
                    key={thread.id}
                    flexDirection="column"
                    flexShrink={0}
                    marginTop={1}
                    borderStyle={isSelected ? "round" : undefined}
                    borderColor={isSelected ? palette.accent : undefined}
                    paddingX={isSelected ? 1 : 0}
                  >
                    {/* Thread header */}
                    <Box>
                      <Text color={isSelected ? palette.accent : palette.muted}>
                        {isSelected ? glyph.pointer : glyph.pointerIdle}{" "}
                      </Text>
                      <Text color={threadStatusColor(thread.status)}>
                        [{threadStatusLabel(thread.status)}]{"  "}
                      </Text>
                      {thread.filePath && (
                        <Text color={palette.info}>
                          {truncate(thread.filePath, 35)}
                          {thread.lineNumber ? `:${thread.lineNumber}` : ""}
                          {"  "}
                        </Text>
                      )}
                      <Text color={palette.muted}>
                        {thread.comments.length} comment{thread.comments.length !== 1 ? "s" : ""}
                      </Text>
                    </Box>

                    {/* First comment preview */}
                    {firstComment && (
                      <Box marginLeft={2} flexDirection="column">
                        <Box>
                          <Text color={palette.textBright} bold inverse={isSelected && selectedCommentIndex === -1}>
                            {isSelected && selectedCommentIndex === -1 ? "> " : ""}
                            {firstComment.author}
                          </Text>
                          <Text color={palette.muted}>
                            {"  "}{formatRelativeAge(firstComment.publishedDate)}
                          </Text>
                        </Box>
                        <Box flexShrink={0}>
                          <Text color={palette.text} wrap="wrap">
                            {truncate(firstComment.content, 72)}
                          </Text>
                        </Box>
                        {/* Show bordered replies box when thread is selected */}
                        {isSelected && replyCount > 0 && (() => {
                          const visibleRepliesCount = 4;
                          let replyOffset = 0;
                          if (replyCount > visibleRepliesCount) {
                            if (selectedCommentIndex > 1) {
                              replyOffset = Math.min(selectedCommentIndex - 1, replyCount - visibleRepliesCount);
                            }
                          }
                          const visibleReplies = thread.comments.slice(1).slice(replyOffset, replyOffset + visibleRepliesCount);

                          return (
                            <Box
                              marginTop={0.25}
                              borderStyle="single"
                              borderColor={palette.border}
                              borderBottom={false}
                              borderLeft={false}
                              borderRight={false}
                              flexDirection="column"
                              flexShrink={0}
                            // paddingX={1}
                            >
                              <Box justifyContent="space-between">
                                <Text color={palette.muted}>Replies</Text>
                                <Text color={palette.accentDim}>{Math.max(0, selectedCommentIndex + 1)}/{replyCount}</Text>
                              </Box>
                              <Box flexDirection="column" marginTop={1} paddingLeft={1}>
                                {visibleReplies.map((reply, visIndex) => {
                                  const index = replyOffset + visIndex;
                                  const isReplySelected = selectedCommentIndex === index;
                                  return (
                                    <Box key={reply.id} marginTop={visIndex === 0 ? 0 : 1} flexDirection="column" flexShrink={0}>
                                      <Box>
                                        <Text color={palette.accentDim} bold inverse={isReplySelected}>
                                          {isReplySelected ? "> ↳ " : "↳ "}
                                          {reply.author}
                                        </Text>
                                        <Text color={palette.muted}>
                                          {"  "}{formatRelativeAge(reply.publishedDate)}
                                        </Text>
                                      </Box>
                                      <Box flexShrink={0}>
                                        <Text color={palette.text} wrap="wrap">
                                          {truncate(reply.content, 64)}
                                        </Text>
                                      </Box>
                                    </Box>
                                  );
                                })}
                              </Box>
                            </Box>
                          );
                        })()}

                        {/* Show simple reply indicator when thread is not selected */}
                        {!isSelected && replyCount > 0 && (
                          <Box flexShrink={0}>
                            <Text color={palette.muted}>
                              {"  "}↳ {replyCount} repl{replyCount !== 1 ? "ies" : "y"}
                            </Text>
                          </Box>
                        )}
                      </Box>
                    )}
                  </Box>
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
      {active && inputMode === "none" && (
        <Box marginTop={1}>
          <Text color={palette.muted}>
            <Text color={palette.accentDim}>j/k</Text> navigate{"  "}
            <Text color={palette.accentDim}>[/]</Text> select comment{"  "}
            <Text color={palette.accentDim}>n</Text> new{"  "}
            <Text color={palette.accentDim}>r</Text> reply{"  "}
            <Text color={palette.accentDim}>e</Text> edit{"  "}
            <Text color={palette.accentDim}>d</Text> delete{"  "}
            <Text color={palette.accentDim}>s</Text> resolve{"  "}
            <Text color={palette.accentDim}>Ctrl+R</Text> refresh{"  "}
            <Text color={palette.accentDim}>h</Text> back
          </Text>
        </Box>
      )}
    </Box>
  );
};
