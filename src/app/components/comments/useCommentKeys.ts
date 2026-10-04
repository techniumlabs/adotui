import type React from "react";
import { useEffect, useRef } from "react";
import { useInput, type Key } from "ink";
import type { PrCommentThread } from "../../../domain/types";
import { isChord } from "../../hooks/keyboard/keys";
import { resolveTargetComment, type CommentInputMode, type PrComment } from "../../hooks/usePrComments";
import { followSelection, moveSelection } from "../../utils";

type SetState<T> = React.Dispatch<React.SetStateAction<T>>;
export type PendingDelete = { thread: PrCommentThread; comment: PrComment } | null;

/** Everything the comments view's keys read or change. */
export interface CommentKeysContext {
  active: boolean;
  threads: PrCommentThread[];
  selectedThread: number;
  setSelectedThread: SetState<number>;
  selectedCommentIndex: number;
  setSelectedCommentIndex: SetState<number>;
  threadScrollOffset: number;
  setThreadScrollOffset: SetState<number>;
  inputMode: CommentInputMode;
  setInputMode: SetState<CommentInputMode>;
  inputText: string;
  setInputText: SetState<string>;
  pendingDelete: PendingDelete;
  setPendingDelete: SetState<PendingDelete>;
  submitComment: (
    mode: CommentInputMode,
    text: string,
    selectedThreadIndex: number,
    selectedCommentIndex: number,
    onAccepted?: () => void,
  ) => Promise<void>;
  deleteComment: (thread: PrCommentThread, comment: PrComment) => void;
  toggleThreadStatus: (thread: PrCommentThread) => void;
  loadComments: (force?: boolean) => Promise<void>;
  canModifyComment: (comment: PrComment, action: "edit" | "delete") => boolean;
}

/** Max visible threads for the current terminal height. */
const maxVisibleThreads = (): number => {
  const termH = process.stdout.rows ?? 40;
  return Math.max(4, Math.floor((Math.max(5, termH - 22)) / 5));
};

/** Keys of the comments view: text entry, the delete y/n, navigation and the n/r/e/d/s/R actions. */
export function useCommentKeys(ctx: CommentKeysContext): void {
  const { active, inputMode, setInputMode, inputText, setInputText, pendingDelete, setPendingDelete } = ctx;
  const { setSelectedThread, setSelectedCommentIndex, setThreadScrollOffset } = ctx;

  // Handlers read the latest selection through a ref: the closure Ink holds can be a render behind.
  const stateRef = useRef(ctx);
  useEffect(() => {
    stateRef.current = ctx;
  });
  const current = () => stateRef.current;
  const selected = (): PrCommentThread | undefined => current().threads[current().selectedThread];

  const closeInput = () => {
    setInputMode("none");
    setInputText("");
  };

  const onTextInput = (input: string, key: Key): void => {
    if (key.escape) return closeInput();
    if (key.return) {
      void ctx.submitComment(inputMode, inputText, current().selectedThread, current().selectedCommentIndex, closeInput);
      return;
    }
    if (key.backspace || key.delete) return setInputText((t) => t.slice(0, -1));
    if (!key.ctrl && !key.meta && input) setInputText((t) => t + input);
  };

  /** Moves the thread selection by `delta`, keeping it in view. */
  const moveThread = (delta: number, { page }: { page: boolean }): void => {
    setSelectedThread((i) => {
      const { threads, threadScrollOffset } = current();
      const maxVis = maxVisibleThreads();
      const next = moveSelection(i, delta, threads.length);
      if (page || next !== i) setSelectedCommentIndex(-1);
      if (page && delta > 0) {
        if (next >= threadScrollOffset + maxVis) setThreadScrollOffset(Math.min(next - maxVis + 1, threads.length - maxVis));
      } else {
        setThreadScrollOffset(followSelection(next, threadScrollOffset, maxVis));
      }
      return next;
    });
  };

  const jumpTo = (index: number, scroll: number): void => {
    setSelectedThread(index);
    setSelectedCommentIndex(-1);
    setThreadScrollOffset(scroll);
  };

  /** Arrow / page keys; true when the key was one of them. */
  const onNavigate = (key: Key): boolean => {
    if (key.downArrow) moveThread(1, { page: false });
    else if (key.upArrow) moveThread(-1, { page: false });
    else if (key.pageDown) moveThread(maxVisibleThreads(), { page: true });
    else if (key.pageUp) moveThread(-maxVisibleThreads(), { page: true });
    else if (key.leftArrow) setSelectedCommentIndex((i) => Math.max(i - 1, -1));
    else if (key.rightArrow) {
      const thread = selected();
      // -1 is the root comment, 0 the first reply, …: the last index is length - 2.
      if (thread) setSelectedCommentIndex((i) => Math.min(i + 1, thread.comments.length - 2));
    } else return false;
    return true;
  };

  const editSelected = (): void => {
    const thread = selected();
    const comment = thread && resolveTargetComment(thread, current().selectedCommentIndex);
    if (!comment || !ctx.canModifyComment(comment, "edit")) return;
    setInputMode("edit");
    setInputText(comment.content.trim());
  };

  const deleteSelected = (): void => {
    const thread = selected();
    const comment = thread && resolveTargetComment(thread, current().selectedCommentIndex);
    if (!thread || !comment || !ctx.canModifyComment(comment, "delete")) return;
    setPendingDelete({ thread, comment });
  };

  const openInput = (mode: CommentInputMode) => (): void => {
    setInputMode(mode);
    setInputText("");
  };

  /** Single-letter actions. `needsThread` ones do nothing without a selected thread. */
  const ACTIONS: Partial<Record<string, { run: () => void; needsThread?: boolean }>> = {
    g: { run: () => jumpTo(0, 0) },
    G: {
      run: () => {
        const last = Math.max(0, current().threads.length - 1);
        jumpTo(last, Math.max(0, last - maxVisibleThreads() + 1));
      },
    },
    e: { run: editSelected, needsThread: true },
    d: { run: deleteSelected, needsThread: true },
    n: { run: openInput("new") },
    r: { run: openInput("reply"), needsThread: true },
    R: { run: () => void ctx.loadComments(true) },
    s: { run: () => ctx.toggleThreadStatus(selected()!), needsThread: true },
  };

  useInput(
    (input, key) => {
      // Shortcuts (and the delete y/n) are plain keys; text input never takes chords either.
      if (isChord(input, key)) return;
      if (inputMode !== "none") return onTextInput(input, key);

      // Pending comment-delete confirmation gate
      if (pendingDelete) {
        if (input === "y" || input === "Y") ctx.deleteComment(pendingDelete.thread, pendingDelete.comment);
        setPendingDelete(null);
        return;
      }

      if (onNavigate(key)) return;
      const action = ACTIONS[input];
      if (action && (!action.needsThread || selected())) action.run();
    },
    { isActive: active },
  );
}
