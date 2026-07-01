import React from "react";
import { Box, Text } from "ink";
import { DiffModeEnum, DiffView } from "@git-diff-view/cli";
import type { PullRequest } from "../../domain/types";
import type { DiffViewMode, FocusArea } from "../types";
import { buildTerminalDiffData, fileChangeColor } from "../utils";

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
  const terminalWidth = process.stdout.columns ?? 120;
  const treePaneWidth = 34;
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
        borderColor={focus === "files" ? "cyan" : "gray"}
        paddingX={1}
        paddingY={0}
        flexDirection="column"
      >
        <Text color={focus === "files" ? "cyan" : "gray"}>Files</Text>
        <Text color="gray">No files in this PR.</Text>
      </Box>
    );
  }

  const flatFiles = selectedPr.changedFiles;
  const selectedFile = flatFiles[selectedFileIndex];

  return (
    <Box
      width={rightPaneWidth}
      marginTop={1}
      borderStyle="round"
      borderColor={focus === "files" ? "cyan" : "gray"}
      paddingX={1}
      paddingY={0}
      flexDirection="column"
    >
      <Text color={focus === "files" ? "cyan" : "gray"}>
        Files ({flatFiles.length}) | mode {diffViewMode}
      </Text>

      {/* File list */}
      <Box marginTop={1} flexDirection="column" width={filesInnerWidth}>
        {flatFiles.map((file, idx) => {
          const isSelected = idx === selectedFileIndex;
          const parts = file.path.split("/");
          const indent = Math.max(0, parts.length - 1) * 2;
          const fileName = parts[parts.length - 1];

          return (
            <Box key={file.path} width={filesInnerWidth}>
              <Text
                color={isSelected ? "whiteBright" : "gray"}
                wrap="truncate-end"
              >
                {isSelected ? ">" : " "}
                {" ".repeat(indent)}
                {fileName}
              </Text>
              <Text color={fileChangeColor(file.status)}> {file.status}</Text>
              <Text color="yellow">
                {" "}
                +{file.additions}/-{file.deletions}
              </Text>
            </Box>
          );
        })}
      </Box>

      {/* Diff view for selected file */}
      {selectedFile && (
        <Box marginTop={1} flexDirection="column" width={filesInnerWidth}>
          <Text color="cyan" wrap="truncate-end">
            {selectedFile.path} ({selectedFile.status})
          </Text>
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
        </Box>
      )}
    </Box>
  );
};
