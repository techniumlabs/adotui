import React, { useMemo } from "react";
import { Box, Text, useInput } from "ink";
import type { PullRequest } from "../../domain/types";
import type { FocusArea } from "../types";
import { fileChangeBadge, glyph, palette, truncate } from "../theme";
import { buildDiffRows } from "./diff/diffRender";
import { handleDiffNavigation } from "./diff/diffKeyboard";
import { useDiffComment } from "../hooks/useDiffComment";
import { useLazyFileDiff } from "../hooks/useLazyFileDiff";
import { computeScrollWindow } from "../utils";

type FilesViewProps = {
  selectedPr?: PullRequest;
  selectedFileIndex: number;
  diffScrollOffset: number;
  onScrollOffsetChange: (offset: number) => void;
  diffSelectedRow: number;
  onSelectedRowChange: (row: number) => void;
  focus: FocusArea;
  onInputModeChange: (active: boolean) => void;
  isLoading?: boolean;
  fileFilter?: string;
  updateFileDiff?: (filePath: string, diffData: { rawDiff: string; additions: number; deletions: number } | null) => void;
  setFileLoading?: (filePath: string) => void;
};

const okStatus = (msg: string | null) => msg === "Comment posted.";

export const FilesView: React.FC<FilesViewProps> = ({
  selectedPr,
  selectedFileIndex,
  diffScrollOffset,
  onScrollOffsetChange,
  diffSelectedRow,
  onSelectedRowChange,
  focus,
  onInputModeChange,
  isLoading,
  fileFilter,
  updateFileDiff,
  setFileLoading,
}) => {
  const active = focus === "files";

  const flatFiles = useMemo(() => {
    if (!selectedPr) return [];
    if (!fileFilter) return selectedPr.changedFiles;
    try {
      const regex = new RegExp(fileFilter.replace(/\*/g, '.*'), 'i');
      return selectedPr.changedFiles.filter(f => regex.test(f.path));
    } catch {
      return selectedPr.changedFiles.filter(f => f.path.toLowerCase().includes(fileFilter.toLowerCase()));
    }
  }, [selectedPr, fileFilter]);
  const selectedFile = flatFiles[selectedFileIndex];

  const {
    commentMode,
    commentText,
    setCommentText,
    submitting,
    statusMsg,
    openComment,
    cancelComment,
    submitComment,
  } = useDiffComment(selectedPr, selectedFile, onInputModeChange);

  useLazyFileDiff(selectedPr, selectedFile, updateFileDiff, setFileLoading);

  const terminalWidth = process.stdout.columns ?? 120;
  const treePaneWidth = 36;
  const paneGap = 1;
  const rootPadding = 2;
  const rightPaneWidth = Math.max(52, terminalWidth - treePaneWidth - paneGap - rootPadding);
  const filesInnerWidth = Math.max(44, rightPaneWidth - 6);

  const diffRows = useMemo(
    () => (selectedFile ? buildDiffRows(selectedFile, diffSelectedRow, filesInnerWidth) : []),
    [selectedFile, diffSelectedRow, filesInnerWidth],
  );

  useInput(
    (input, key) => {
      if (!active) return;

      if (commentMode) {
        if (key.escape) { cancelComment(); return; }
        if (key.return) {
          submitComment(diffRows[diffSelectedRow]);
          return;
        }
        if (key.backspace || key.delete) {
          setCommentText((t) => t.slice(0, -1));
          return;
        }
        if (!key.ctrl && !key.meta && input) {
          setCommentText((t) => t + input);
        }
        return;
      }

      // Row-level diff navigation (j/k, g/G, PageUp/PageDown)
      if (diffRows.length > 0) {
        const terminalHeight = process.stdout.rows ?? 40;
        const viewportH = Math.max(5, terminalHeight - 27);
        const handled = handleDiffNavigation(input, key, {
          rowCount: diffRows.length,
          selectedRow: diffSelectedRow,
          scrollOffset: diffScrollOffset,
          viewportH,
          onSelectedRowChange,
          onScrollOffsetChange,
        });
        if (handled) return;
      }

      if (input === "n" && selectedFile && !submitting) {
        openComment();
      }
    },
    { isActive: active }
  );

  if (!selectedPr || selectedPr.changedFiles.length === 0) {
    return (
      <Box
        marginTop={1}
        borderStyle="single"
        borderColor={palette.border}
        paddingX={1}
        flexDirection="column"
      >
        <Text color={active ? palette.accent : palette.muted} bold>
          {glyph.files} Files
        </Text>
        <Text color={palette.muted}>No changed files for this PR.</Text>
      </Box>
    );
  }

  const hasDiff = !!selectedFile && (selectedFile.diff.length > 0 || typeof selectedFile.rawDiff === "string");

  const terminalHeight = process.stdout.rows ?? 40;
  const viewportH = Math.max(5, terminalHeight - 27);
  const total = diffRows.length;
  const { offset: clampedOffset, canScrollUp, canScrollDown } = computeScrollWindow(total, viewportH, diffScrollOffset);
  const visibleRows = diffRows.slice(clampedOffset, clampedOffset + viewportH).map(r => r.element);

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
      <Box justifyContent="space-between">
        <Text color={active ? palette.accent : palette.muted} bold>
          {glyph.files} Files
        </Text>
        <Text color={palette.muted}>
          {fileFilter && (
            <Text color={palette.accentDim}> Filtered: "{fileFilter}" </Text>
          )}
          {selectedFileIndex + 1}/{flatFiles.length}
        </Text>
      </Box>

      {/* File list */}
      <Box marginTop={1} flexDirection="column">
        {flatFiles.length === 0 ? (
          <Text color={palette.danger}>No files match the filter "{fileFilter}".</Text>
        ) : (
          flatFiles.map((file, idx) => {
            const show =
              flatFiles.length <= 5
                ? true
                : selectedFileIndex < 2
                  ? idx < 5
                  : selectedFileIndex >= flatFiles.length - 2
                    ? idx >= flatFiles.length - 5
                    : Math.abs(idx - selectedFileIndex) <= 2;
            if (!show) return null;

            const isSelected = idx === selectedFileIndex;
            const badge = fileChangeBadge(file.status);
            const parts = file.path.split("/");
            const fileName = parts[parts.length - 1] ?? file.path;
            const dir = parts.slice(0, -1).join("/");

            return (
              <Text key={file.path} wrap="truncate-end">
                <Text color={isSelected ? palette.accent : palette.muted}>
                  {isSelected ? glyph.pointer : glyph.pointerIdle}{" "}
                </Text>
                <Text color={badge.color} bold>
                  {badge.symbol}{" "}
                </Text>
                <Text color={isSelected ? palette.textBright : palette.text}>
                  {dir ? (
                    <Text color={palette.muted}>{dir}/</Text>
                  ) : null}
                  {fileName}
                </Text>
                {file.additions > 0 || file.deletions > 0 ? (
                  <Text>
                    {" "}
                    <Text color={palette.ok}>+{file.additions}</Text>
                    <Text color={palette.danger}> -{file.deletions}</Text>
                  </Text>
                ) : null}
              </Text>
            );
          })
        )}
      </Box>

      {/* Diff view for selected file */}
      {selectedFile && (
        <Box marginTop={1} flexDirection="column">
          {/* File header */}
          <Text color={palette.accentDim} wrap="truncate-end">
            {"  "}{truncate(selectedFile.path, filesInnerWidth - 16)}
            {"  "}
            <Text color={palette.ok}>+{selectedFile.additions ?? 0}</Text>
            <Text color={palette.danger}> -{selectedFile.deletions ?? 0}</Text>
          </Text>

          {selectedFile.loadingDiff ? (
            <Box marginY={1} marginLeft={2}>
              <Text color={palette.accent}>{glyph.clock} Loading diff...</Text>
            </Box>
          ) : hasDiff ? (
            <Box flexDirection="column">
              {diffRows.length > 0 ? (
                <>
                  <Box flexDirection="column" height={commentMode ? viewportH - 3.5 : viewportH} overflow="hidden">{visibleRows}</Box>
                  <Text color={palette.muted}>
                    {canScrollUp ? "↑ " : "  "}
                    {`row ${diffSelectedRow + 1} of ${total}`}
                    {canScrollDown ? " ↓" : "  "}
                  </Text>
                </>
              ) : (
                <Text color={palette.muted}>
                  {selectedFile.status === "added" ? "Empty file added." : selectedFile.status === "deleted" ? "Empty file deleted." : "No changes to display."}
                </Text>
              )}
            </Box>
          ) : isLoading ? (
            <Text color={palette.muted}>
              {glyph.clock} Loading diff...
            </Text>
          ) : (
            <Text color={palette.muted}>
              Diff content not loaded (Azure change list is metadata-only).
            </Text>
          )}

          {active && !commentMode && (
            <Box marginTop={1}>
              <Text color={palette.muted}>

                <Text color={palette.accentDim}>n</Text> comment{"  "}
                <Text color={palette.accentDim}>[/]</Text> switch files{"  "}
                <Text color={palette.accentDim}>j/k, ↑/↓</Text> navigate{"  "}
                <Text color={palette.accentDim}>g/G</Text> top/end
              </Text>
            </Box>
          )}
        </Box>
      )}

      {/* Comment input box */}
      {commentMode && (
        <Box
          marginTop={1}
          borderStyle="round"
          borderColor={palette.accent}
          paddingX={1}
          flexDirection="column"
        >
          <Text color={palette.accent} bold>
            {glyph.added} New diff comment on {selectedFile ? truncate(selectedFile.path, 30) : ""}
            {"  "}
            <Text color={palette.muted}>(Enter to send · Esc to cancel)</Text>
          </Text>
          <Text color={submitting ? palette.muted : palette.textBright}>
            {commentText || " "}
            {!submitting && <Text color={palette.accent}>▌</Text>}
          </Text>
        </Box>
      )}

      {/* Status Msg */}
      {statusMsg && (
        <Box marginTop={1}>
          <Text color={okStatus(statusMsg) ? palette.ok : palette.danger}>{statusMsg}</Text>
        </Box>
      )}

    </Box>
  );
};
