import React, { useMemo } from "react";
import { Box, Text, useInput } from "ink";
import type { PullRequest } from "../../domain/types";
import type { FocusArea } from "../types";
import { glyph, palette } from "../theme";
import { buildDiffRows } from "./diff/diffRender";
import { handleDiffNavigation } from "./diff/diffKeyboard";
import { useDiffComment } from "../hooks/useDiffComment";
import { useLazyFileDiff } from "../hooks/useLazyFileDiff";
import { isChord } from "../hooks/keyboard/keys";
import { getVisibleFiles } from "../utils";
import { PanelTitle } from "./ui/PanelTitle";
import { TabPane } from "./ui/TabPane";
import { FileList } from "./diff/FileList";
import { DiffBody, DiffCommentBox } from "./diff/DiffBody";

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
  updateFileDiff?: (target: PullRequest, filePath: string, diffData: { rawDiff: string; additions: number; deletions: number } | null) => void;
  setFileLoading?: (target: PullRequest, filePath: string) => void;
  /** Mouse: a click on a file row selects it. */
  onSelectFile?: (index: number) => void;
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
  onSelectFile,
}) => {
  const active = focus === "files";

  const flatFiles = useMemo(
    () => getVisibleFiles(selectedPr, fileFilter ?? ""),
    [selectedPr, fileFilter],
  );
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
      if (isChord(input, key)) return;

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

      // Row-level diff navigation (arrows, g/G, PageUp/PageDown)
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
        <PanelTitle active={active}>
          {glyph.files} Files
        </PanelTitle>
        <Text color={palette.muted}>No changed files for this PR.</Text>
      </Box>
    );
  }

  const terminalHeight = process.stdout.rows ?? 40;
  const viewportH = Math.max(5, terminalHeight - 27);

  return (
    <TabPane>
      <Box justifyContent="space-between">
        <PanelTitle active={active}>
          {glyph.files} Files
        </PanelTitle>
        <Text color={palette.muted}>
          {fileFilter && (
            <Text color={palette.accentDim}> Filtered: "{fileFilter}" </Text>
          )}
          {selectedFileIndex + 1}/{flatFiles.length}
        </Text>
      </Box>

      <FileList files={flatFiles} selectedIndex={selectedFileIndex} fileFilter={fileFilter} onSelectFile={onSelectFile} />

      {selectedFile && (
        <DiffBody
          file={selectedFile}
          rows={diffRows}
          selectedRow={diffSelectedRow}
          scrollOffset={diffScrollOffset}
          viewportH={viewportH}
          innerWidth={filesInnerWidth}
          commentMode={commentMode}
          isLoading={isLoading}
          showHint={active && !commentMode}
        />
      )}

      {commentMode && <DiffCommentBox file={selectedFile} text={commentText} submitting={submitting} />}

      {statusMsg && (
        <Box marginTop={1}>
          <Text color={okStatus(statusMsg) ? palette.ok : palette.danger}>{statusMsg}</Text>
        </Box>
      )}

    </TabPane>
  );
};
