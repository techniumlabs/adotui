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
import { prScope } from "../../data/refs";
import { RELOAD_STATUS_MS, STATUS_FLASH_MS } from "../constants";
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

const cacheKeyFor = (pr: PullRequest): string =>
  commentCacheKey(pr.organizationUrl, pr.project, pr.repositoryId ?? pr.repository, pr.id);

/** Sends a new comment, reply or edit; false when there is nothing to send to, or the API refuses. */
/** Exported for tests. */
export const sendComment = async (
  pr: PullRequest,
  mode: CommentInputMode,
  text: string,
  thread: PrCommentThread | undefined,
  selectedCommentIndex: number,
): Promise<boolean> => {
  const scope = prScope(pr);
  if (mode === "new") return postPrComment(scope, text);
  if (!thread) return false;
  if (mode === "reply") return replyToPrThread(scope, thread.id, thread.comments[0]?.id ?? 1, text);
  if (mode !== "edit") return false;
  const comment = resolveTargetComment(thread, selectedCommentIndex);
  return comment ? editPrComment(scope, thread.id, comment.id, text) : false;
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
      const key = cacheKeyFor(selectedPr);

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
      // A forced reload (R) is otherwise invisible when nothing changed —
      // say so explicitly instead of flashing the spinner and stopping.
      if (force) setStatusMsg("Reloading comments…");
      try {
        const data = await fetchPrComments(prScope(selectedPr));
        if (data === null) {
          // Transient az failure — keep whatever is shown, never cache it,
          // and only surface an error when there is nothing on screen.
          setStatusMsg(null);
          if (!background) setError("Could not load comments — press R to retry.");
          return;
        }
        setCommentCache(key, data);
        setThreads(data);
        if (force) {
          // Keep the reader where they were; only a first load resets to the
          // top (onFreshLoad).
          setStatusMsg(`Reloaded — ${data.length} thread${data.length === 1 ? "" : "s"}.`);
          setTimeout(() => setStatusMsg(null), RELOAD_STATUS_MS);
        } else {
          onFreshLoadRef.current?.();
        }
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
    setTimeout(() => setStatusMsg(null), STATUS_FLASH_MS);
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

      isSubmittingRef.current = true;
      setSubmitting(true);

      try {
        const ok = await sendComment(selectedPr, mode, text.trim(), threads[selectedThreadIndex], selectedCommentIndex);
        if (ok) {
          invalidateCommentCache(cacheKeyFor(selectedPr));
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

  /** Runs one mutation at a time, and reloads the threads when it succeeds. */
  const mutate = (run: () => Promise<boolean>): void => {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setSubmitting(true);
    void run().then((ok) => {
      isSubmittingRef.current = false;
      setSubmitting(false);
      if (ok) void loadComments(true);
    });
  };

  /** Deletes a comment (author guard is the caller's responsibility via canModifyComment). */
  const deleteComment = (thread: PrCommentThread, comment: PrComment): void => {
    if (!selectedPr) return;
    mutate(() => deletePrComment(prScope(selectedPr), thread.id, comment.id));
  };

  /** Toggles a thread between active and fixed. */
  const toggleThreadStatus = (thread: PrCommentThread): void => {
    if (!selectedPr) return;
    const newStatus = thread.status === "active" ? 2 : 1; // 2=fixed, 1=active
    mutate(() => updatePrThreadStatus(prScope(selectedPr), thread.id!, newStatus));
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
