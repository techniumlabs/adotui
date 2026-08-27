import { useCallback, useEffect, useRef, useState } from "react";
import type { PrCommentThread, PullRequest } from "../../domain/types";
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

export type PrComment = PrCommentThread["comments"][number];
export type CommentInputMode = "none" | "new" | "reply" | "edit";

/**
 * Resolves which comment a thread-level selection points at:
 * -1 is the root comment, 0 is the first reply, and so on.
 */
export const resolveTargetComment = (
  thread: PrCommentThread | undefined,
  selectedCommentIndex: number,
): PrComment | undefined => {
  const comments = thread?.comments ?? [];
  return selectedCommentIndex === -1 ? comments[0] : comments[selectedCommentIndex + 1];
};

/**
 * Data layer for the PR comments view: thread fetching (with cache),
 * new/reply/edit submission, deletion, and thread status toggling.
 * UI state (selection, scroll, input mode) stays in the component.
 */
export function usePrComments(
  selectedPr: PullRequest | undefined,
  currentUserEmail: string | undefined,
  onFreshLoad?: () => void,
) {
  const [threads, setThreads] = useState<PrCommentThread[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const isSubmittingRef = useRef(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const onFreshLoadRef = useRef(onFreshLoad);
  onFreshLoadRef.current = onFreshLoad;

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

      // Cache hit: show it immediately, then revalidate in the background so
      // comments added elsewhere (web UI, another session) appear without
      // waiting out the cache TTL.
      let background = false;
      if (!force) {
        const cached = getCommentCache(key);
        if (cached) {
          setThreads(cached);
          background = true;
        }
      }

      if (!background) setLoading(true);
      setError(null);
      try {
        const data = await fetchPrComments(
          selectedPr.organizationUrl,
          selectedPr.project,
          repoId,
          selectedPr.id,
        );
        if (data === null) {
          // Transient az failure — keep whatever is shown, never cache it,
          // and only surface an error when there is nothing on screen.
          if (!background) setError("Could not load comments — press R to retry.");
          return;
        }
        setCommentCache(key, data);
        setThreads(data);
        onFreshLoadRef.current?.();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load comments.");
      } finally {
        if (!background) setLoading(false);
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

  /** Shows a transient status message that clears after 3 seconds. */
  const flashStatus = (msg: string) => {
    setStatusMsg(msg);
    setTimeout(() => setStatusMsg(null), 3000);
  };

  /** Author guard shared by edit and delete. Flashes a status when denied. */
  const canModifyComment = (comment: PrComment, action: "edit" | "delete"): boolean => {
    if (currentUserEmail && comment.authorEmail && comment.authorEmail !== currentUserEmail) {
      flashStatus(`Cannot ${action} someone else's comment.`);
      return false;
    }
    return true;
  };

  /**
   * Submits a new comment, reply, or edit. Calls `onAccepted` as soon as the
   * API accepts it (so the caller can close its input box), then refreshes.
   */
  const submitComment = useCallback(
    async (
      mode: CommentInputMode,
      text: string,
      selectedThreadIndex: number,
      selectedCommentIndex: number,
      onAccepted?: () => void,
    ): Promise<void> => {
      if (!selectedPr || !text.trim() || isSubmittingRef.current) return;
      const repoId = selectedPr.repositoryId ?? selectedPr.repository;

      isSubmittingRef.current = true;
      setSubmitting(true);

      try {
        let ok = false;
        if (mode === "new") {
          ok = await postPrComment(
            selectedPr.organizationUrl,
            selectedPr.project,
            repoId,
            selectedPr.id,
            text.trim(),
          );
        } else if (mode === "reply") {
          const thread = threads[selectedThreadIndex];
          if (thread) {
            ok = await replyToPrThread(
              selectedPr.organizationUrl,
              selectedPr.project,
              repoId,
              selectedPr.id,
              thread.id,
              thread.comments[0]?.id ?? 1,
              text.trim(),
            );
          }
        } else if (mode === "edit") {
          const thread = threads[selectedThreadIndex];
          const commentToEdit = resolveTargetComment(thread, selectedCommentIndex);
          if (thread && commentToEdit) {
            ok = await editPrComment(
              selectedPr.organizationUrl,
              selectedPr.project,
              repoId,
              selectedPr.id,
              thread.id,
              commentToEdit.id,
              text.trim(),
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
          onAccepted?.();
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
    },
    [selectedPr, threads, loadComments],
  );

  /** Deletes a comment (author guard is the caller's responsibility via canModifyComment). */
  const deleteComment = (thread: PrCommentThread, comment: PrComment): void => {
    if (isSubmittingRef.current) return;
    const repoId = selectedPr?.repositoryId ?? selectedPr?.repository;
    if (!selectedPr || !repoId) return;
    isSubmittingRef.current = true;
    setSubmitting(true);
    deletePrComment(
      selectedPr.organizationUrl,
      selectedPr.project,
      repoId,
      selectedPr.id,
      thread.id,
      comment.id
    ).then((ok) => {
      isSubmittingRef.current = false;
      setSubmitting(false);
      if (ok) void loadComments(true);
    });
  };

  /** Toggles a thread between active and fixed. */
  const toggleThreadStatus = (thread: PrCommentThread): void => {
    if (!selectedPr || isSubmittingRef.current) return;
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
  };

  return {
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
  };
}
