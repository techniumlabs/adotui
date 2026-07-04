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
  const [inputMode, setInputMode] = useState<CommentInputMode>("none");
  const [inputText, setInputText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const isSubmittingRef = React.useRef(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

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

  const stateRef = useRef({ threads, selectedThread, selectedCommentIndex });
  useEffect(() => {
    stateRef.current = { threads, selectedThread, selectedCommentIndex };
  }, [threads, selectedThread, selectedCommentIndex]);

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
          return next;
        });
      } else if (input === "k" || key.upArrow) {
        setSelectedThread((i) => {
          const next = Math.max(i - 1, 0);
          if (next !== i) setSelectedCommentIndex(-1);
          return next;
        });
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
        <Text color={palette.muted}>
          {loading ? (
            <Text color={palette.muted}>
              <Spinner type="dots" /> loading…
            </Text>
          ) : (
            `${threads.length} thread${threads.length !== 1 ? "s" : ""} (${threads.reduce((acc, t) => acc + t.comments.length, 0)} comment${threads.reduce((acc, t) => acc + t.comments.length, 0) !== 1 ? "s" : ""})`
          )}
        </Text>
      </Box>

      {/* Status / error */}
      {(statusMsg ?? error) ? (
        <Text color={error ? palette.danger : palette.warn}>
          {statusMsg ?? error}
        </Text>
      ) : submitting ? (
        <Text color={palette.accent}>
          <Spinner type="dots" /> processing...
        </Text>
      ) : null}

      {/* No PR selected */}
      {!selectedPr && (
        <Text color={palette.muted}>Select a PR to view comments.</Text>
      )}

      {/* Thread list */}
      {selectedPr && !loading && threads.length === 0 && !error && (
        <Text color={palette.muted}>No comments yet.</Text>
      )}

      {threads.map((thread, idx) => {
        const isSelected = idx === selectedThread && active;
        const firstComment = thread.comments[0];
        const replyCount = thread.comments.length - 1;

        return (
          <Box
            key={thread.id}
            flexDirection="column"
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
                <Text color={palette.text} wrap="wrap">
                  {truncate(firstComment.content, 72)}
                </Text>
                {/* Show all replies when thread is selected */}
                {isSelected &&
                  thread.comments.slice(1).map((reply, index) => {
                    const isReplySelected = selectedCommentIndex === index;
                    return (
                      <Box key={reply.id} marginTop={1} flexDirection="column">
                        <Box>
                          <Text color={palette.accentDim} bold inverse={isReplySelected}>
                            {isReplySelected ? "> ↳ " : "↳ "}
                            {reply.author}
                          </Text>
                          <Text color={palette.muted}>
                            {"  "}{formatRelativeAge(reply.publishedDate)}
                          </Text>
                        </Box>
                        <Text color={palette.text} wrap="wrap">
                          {truncate(reply.content, 68)}
                        </Text>
                      </Box>
                    );
                  })}
                {!isSelected && replyCount > 0 && (
                  <Text color={palette.muted}>
                    {"  "}↳ {replyCount} repl{replyCount !== 1 ? "ies" : "y"}
                  </Text>
                )}
              </Box>
            )}
          </Box>
        );
      })}

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
