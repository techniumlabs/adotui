import React from "react";
import { Box, Text } from "ink";
import type { PrCommentThread } from "../../../domain/types";
import { glyph, palette, truncate } from "../../theme";
import { formatRelativeAge } from "../../utils";

const threadStatusColor = (status: PrCommentThread["status"]): string => {
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

type ThreadCardProps = {
  thread: PrCommentThread;
  isSelected: boolean;
  /** -1 selects the root comment; 0+ selects a reply. */
  selectedCommentIndex: number;
};

/** One comment thread: header, root-comment preview, and replies box. */
export const ThreadCard: React.FC<ThreadCardProps> = ({
  thread,
  isSelected,
  selectedCommentIndex,
}) => {
  const firstComment = thread.comments[0];
  const replyCount = thread.comments.length - 1;

  return (
    <Box
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
};
