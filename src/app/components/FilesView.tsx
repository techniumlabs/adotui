import React from "react";
import { Box, Text } from "ink";
import { DiffModeEnum, DiffView } from "@git-diff-view/cli";
import type { PullRequest } from "../../domain/types";
import type { DiffViewMode, FocusArea } from "../types";
import { buildTerminalDiffData } from "../utils";
import { fileChangeBadge, glyph, palette, truncate } from "../theme";

type FilesViewProps = {
  selectedPr?: PullRequest;
  selectedFileIndex: number;
  focus: FocusArea;
  diffViewMode: DiffViewMode;
};

export const FilesView: React.FC<FilesViewProps> = ({
  selectedPr,
  selectedFileIndex,
  focus,
  diffViewMode,
}) => {
  const active = focus === "files";
  const terminalWidth = process.stdout.columns ?? 120;
  const treePaneWidth = 36;
  const paneGap = 1;
  const rootPadding = 2;
  const rightPaneWidth = Math.max(
    52,
    terminalWidth - treePaneWidth - paneGap - rootPadding,
  );
  const filesInnerWidth = Math.max(44, rightPaneWidth - 4);
  const diffWidth =
    diffViewMode === "split"
      ? Math.max(36, filesInnerWidth - 6)
      : Math.max(44, filesInnerWidth - 2);

  if (!selectedPr || selectedPr.changedFiles.length === 0) {
    return (
      <Box
        width={rightPaneWidth}
        marginTop={1}
        borderStyle="round"
        borderColor={active ? palette.accent : palette.muted}
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

  const flatFiles = selectedPr.changedFiles;
  const selectedFile = flatFiles[selectedFileIndex];
  const hasDiff = !!selectedFile && (selectedFile.diff.length > 0 || !!selectedFile.rawDiff);

  return (
    <Box
      width={rightPaneWidth}
      marginTop={1}
      borderStyle="round"
      borderColor={active ? palette.accent : palette.muted}
      paddingX={1}
      flexDirection="column"
    >
      <Box justifyContent="space-between">
        <Text color={active ? palette.accent : palette.muted} bold>
          {glyph.files} Files
        </Text>
        <Text color={palette.muted}>
          {flatFiles.length} {glyph.bullet} {diffViewMode}
        </Text>
      </Box>

      {/* File list */}
      <Box marginTop={1} flexDirection="column" width={filesInnerWidth}>
        {flatFiles.map((file, idx) => {
          const isSelected = idx === selectedFileIndex;
          const badge = fileChangeBadge(file.status);
          const parts = file.path.split("/");
          const fileName = parts[parts.length - 1] ?? file.path;
          const dir = parts.slice(0, -1).join("/");

          return (
            <Box key={file.path} width={filesInnerWidth}>
              <Text color={isSelected ? palette.accent : palette.muted}>
                {isSelected ? glyph.pointer : glyph.pointerIdle}{" "}
              </Text>
              <Text color={badge.color} bold>
                {badge.symbol}{" "}
              </Text>
              <Box flexGrow={1}>
                <Text
                  color={isSelected ? palette.textBright : palette.text}
                  wrap="truncate-middle"
                >
                  {dir ? (
                    <Text color={palette.muted}>{dir}/</Text>
                  ) : null}
                  {fileName}
                </Text>
              </Box>
              {file.additions > 0 || file.deletions > 0 ? (
                <Text color={palette.muted}>
                  {" "}
                  <Text color={palette.ok}>+{file.additions}</Text>
                  <Text color={palette.danger}> -{file.deletions}</Text>
                </Text>
              ) : null}
            </Box>
          );
        })}
      </Box>

      {/* Diff view for selected file */}
      {selectedFile && (
        <Box marginTop={1} flexDirection="column" width={filesInnerWidth}>
          <Text color={palette.accentDim} wrap="truncate-end">
            {truncate(selectedFile.path, filesInnerWidth - 2)}
          </Text>
          {hasDiff ? (
            <DiffView
              data={buildTerminalDiffData(selectedFile)}
              diffViewMode={
                diffViewMode === "split"
                  ? DiffModeEnum.Split
                  : DiffModeEnum.Unified
              }
              diffViewTheme="dark"
              diffViewHighlight
              diffViewNoBG
              width={diffWidth}
            />
          ) : (
            <Text color={palette.muted}>
              Diff content not loaded (Azure change list is metadata-only).
            </Text>
          )}
        </Box>
      )}
    </Box>
  );
};
