import React from "react";
import { Box, Text } from "ink";
import type { PrCommentThread } from "../../../domain/types";
import type { CommentInputMode } from "../../hooks/usePrComments";
import { glyph, palette } from "../../theme";
import { computeScrollWindow } from "../../utils";
import type { PendingDelete } from "./useCommentKeys";
import { ThreadCard } from "./ThreadCard";

const plural = (n: number, word: string): string => `${n} ${word}${n !== 1 ? "s" : ""}`;

/** "2/5 threads (9 comments)", or a loading note. */
export const CommentsCount: React.FC<{ loading: boolean; threads: PrCommentThread[]; selectedThread: number }> = ({
  loading,
  threads,
  selectedThread,
}) => {
  if (loading) return <Text color={palette.muted}>{glyph.clock} loading…</Text>;
  const position = threads.length > 0 ? selectedThread + 1 : 0;
  const comments = threads.reduce((acc, t) => acc + t.comments.length, 0);
  return (
    <Text color={palette.muted}>
      {`${position}/${threads.length} thread${threads.length !== 1 ? "s" : ""} (${plural(comments, "comment")})`}
    </Text>
  );
};

/** One line: the delete prompt, a status or error message, or "processing…". */
export const CommentsStatus: React.FC<{
  pendingDelete: PendingDelete;
  statusMsg: string | null;
  error: string | null;
  submitting: boolean;
}> = ({ pendingDelete, statusMsg, error, submitting }) => {
  if (pendingDelete) {
    return <Text color={palette.warn}>Delete comment by {pendingDelete.comment.author}? (y/n)</Text>;
  }
  const message = statusMsg ?? error;
  if (message) return <Text color={error ? palette.danger : palette.warn}>{message}</Text>;
  if (submitting) return <Text color={palette.accent}>{glyph.clock} processing...</Text>;
  return null;
};

/** A centred message filling the list area. */
export const CommentsPlaceholder: React.FC<{ height: number; color: string; children: React.ReactNode }> = ({
  height,
  color,
  children,
}) => (
  <Box height={height} justifyContent="center" alignItems="center" flexDirection="column">
    <Text color={color}>{children}</Text>
  </Box>
);

/** The scrolled window of thread cards, with "more above / below" markers. */
export const ThreadList: React.FC<{
  threads: PrCommentThread[];
  selectedThread: number;
  selectedCommentIndex: number;
  threadScrollOffset: number;
  active: boolean;
  height: number;
  inputOpen: boolean;
}> = ({ threads, selectedThread, selectedCommentIndex, threadScrollOffset, active, height, inputOpen }) => {
  const maxVis = Math.max(4, Math.floor(height / 5));
  const total = threads.length;
  const { offset, canScrollUp, canScrollDown } = computeScrollWindow(total, maxVis, threadScrollOffset);
  if (total === 0) return null;
  const visible = threads.slice(offset, offset + maxVis);
  return (
    <Box flexDirection="column">
      <Box flexDirection="column" height={inputOpen ? height - 6 : height} overflow="hidden">
        {visible.map((thread) => (
          <ThreadCard
            key={thread.id}
            thread={thread}
            isSelected={threads.findIndex((t) => t.id === thread.id) === selectedThread && active}
            selectedCommentIndex={selectedCommentIndex}
          />
        ))}
      </Box>
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
};

const INPUT_TITLE: Record<Exclude<CommentInputMode, "none">, (threadId: string) => string> = {
  new: () => `${glyph.added} New comment`,
  edit: () => `${glyph.pointer} Edit comment`,
  reply: (threadId) => `↳ Reply to thread #${threadId}`,
};

/** The new / reply / edit text box. */
export const CommentInput: React.FC<{
  mode: Exclude<CommentInputMode, "none">;
  text: string;
  submitting: boolean;
  threadId: string;
}> = ({ mode, text, submitting, threadId }) => (
  <Box marginTop={1} borderStyle="single" borderColor={palette.accent} paddingX={1} flexDirection="column">
    <Text color={palette.accent} bold>
      {INPUT_TITLE[mode](threadId)}
      {"  "}
      <Text color={palette.muted}>(Enter to send · Esc to cancel)</Text>
    </Text>
    <Text color={submitting ? palette.muted : palette.textBright}>
      {text || " "}
      {!submitting && <Text color={palette.accent}>▌</Text>}
    </Text>
  </Box>
);

const HINTS: [string, string][] = [
  ["↑/↓", "navigate"],
  ["←/→", "select comment"],
  ["n", "new"],
  ["r", "reply"],
  ["e", "edit"],
  ["d", "delete"],
  ["s", "resolve"],
  ["R", "refresh"],
  ["h", "back"],
];

/** The key hint line under the list. */
export const CommentsHint: React.FC = () => (
  <Text color={palette.muted}>
    {HINTS.map(([key, label], i) => (
      <React.Fragment key={key}>
        <Text color={palette.accentDim}>{key}</Text> {label}
        {i < HINTS.length - 1 ? "  " : ""}
      </React.Fragment>
    ))}
  </Text>
);
