import React from "react";
import { Box, Text } from "ink";
import type { PullRequestFileChange } from "../../../domain/types";
import { glyph, palette, truncate } from "../../theme";
import { computeScrollWindow } from "../../utils";
import type { DiffRowInfo } from "./diffRender";

const EMPTY_DIFF: Partial<Record<PullRequestFileChange["status"], string>> = {
  added: "Empty file added.",
  deleted: "Empty file deleted.",
};

/** The rows of a loaded diff, scrolled, with a "row n of m" line. */
const DiffRows: React.FC<{
  file: PullRequestFileChange;
  rows: DiffRowInfo[];
  selectedRow: number;
  scrollOffset: number;
  viewportH: number;
  commentMode: boolean;
}> = ({ file, rows, selectedRow, scrollOffset, viewportH, commentMode }) => {
  if (rows.length === 0) {
    return <Text color={palette.muted}>{EMPTY_DIFF[file.status] ?? "No changes to display."}</Text>;
  }
  const { offset, canScrollUp, canScrollDown } = computeScrollWindow(rows.length, viewportH, scrollOffset);
  return (
    <>
      <Box flexDirection="column" height={commentMode ? viewportH - 3.5 : viewportH} overflow="hidden">
        {rows.slice(offset, offset + viewportH).map((r) => r.element)}
      </Box>
      <Text color={palette.muted}>
        {canScrollUp ? "↑ " : "  "}
        {`row ${selectedRow + 1} of ${rows.length}`}
        {canScrollDown ? " ↓" : "  "}
      </Text>
    </>
  );
};

/** The selected file: header, diff (or why there is none), and the key hint. */
export const DiffBody: React.FC<{
  file: PullRequestFileChange;
  rows: DiffRowInfo[];
  selectedRow: number;
  scrollOffset: number;
  viewportH: number;
  innerWidth: number;
  commentMode: boolean;
  isLoading?: boolean;
  showHint: boolean;
}> = ({ file, rows, selectedRow, scrollOffset, viewportH, innerWidth, commentMode, isLoading, showHint }) => {
  const hasDiff = file.diff.length > 0 || typeof file.rawDiff === "string";
  let body: React.ReactNode;
  if (file.loadingDiff) {
    body = (
      <Box marginY={1} marginLeft={2}>
        <Text color={palette.accent}>{glyph.clock} Loading diff...</Text>
      </Box>
    );
  } else if (hasDiff) {
    body = (
      <Box flexDirection="column">
        <DiffRows file={file} rows={rows} selectedRow={selectedRow} scrollOffset={scrollOffset} viewportH={viewportH} commentMode={commentMode} />
      </Box>
    );
  } else if (isLoading) {
    body = <Text color={palette.muted}>{glyph.clock} Loading diff...</Text>;
  } else {
    body = <Text color={palette.muted}>Diff content not loaded (Azure change list is metadata-only).</Text>;
  }

  return (
    <Box marginTop={1} flexDirection="column">
      <Text color={palette.accentDim} wrap="truncate-end">
        {"  "}{truncate(file.path, innerWidth - 16)}
        {"  "}
        <Text color={palette.ok}>+{file.additions ?? 0}</Text>
        <Text color={palette.danger}> -{file.deletions ?? 0}</Text>
      </Text>

      {body}

      {showHint && (
        <Box marginTop={1}>
          <Text color={palette.muted}>

            <Text color={palette.accentDim}>n</Text> comment{"  "}
            <Text color={palette.accentDim}>←/→</Text> switch files{"  "}
            <Text color={palette.accentDim}>↑/↓</Text> navigate{"  "}
            <Text color={palette.accentDim}>g/G</Text> top/end
          </Text>
        </Box>
      )}
    </Box>
  );
};

/** The line-comment text box. */
export const DiffCommentBox: React.FC<{ file?: PullRequestFileChange; text: string; submitting: boolean }> = ({
  file,
  text,
  submitting,
}) => (
  <Box marginTop={1} borderStyle="round" borderColor={palette.accent} paddingX={1} flexDirection="column">
    <Text color={palette.accent} bold>
      {glyph.added} New diff comment on {file ? truncate(file.path, 30) : ""}
      {"  "}
      <Text color={palette.muted}>(Enter to send · Esc to cancel)</Text>
    </Text>
    <Text color={submitting ? palette.muted : palette.textBright}>
      {text || " "}
      {!submitting && <Text color={palette.accent}>▌</Text>}
    </Text>
  </Box>
);
