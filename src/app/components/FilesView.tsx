import React from "react";
import { Box, Text } from "ink";
import { DiffModeEnum, DiffView } from "@git-diff-view/cli";
import type { PullRequest } from "../../domain/types";
import type { DiffViewMode, FocusArea } from "../types";
import {
  buildTerminalDiffData,
  buildFileTree,
  fileChangeColor,
} from "../utils";

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
  if (!selectedPr || selectedPr.changedFiles.length === 0) {
    return (
      <Box
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

  const fileTree = buildFileTree(selectedPr.changedFiles);
  const flatFiles = selectedPr.changedFiles;
  const selectedFile = flatFiles[selectedFileIndex];

  return (
    <Box
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
      <Box marginTop={1} flexDirection="column">
        {flatFiles.map((file, idx) => {
          const isSelected = idx === selectedFileIndex;
          const parts = file.path.split("/");
          const indent = Math.max(0, parts.length - 1) * 2;
          const fileName = parts[parts.length - 1];

          return (
            <Box key={file.path}>
              <Text color={isSelected ? "whiteBright" : "gray"}>
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
        <Box marginTop={1} flexDirection="column">
          <Text color="cyan">
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
            width={Math.max(60, (process.stdout.columns ?? 120) - 12)}
          />
        </Box>
      )}
    </Box>
  );
};
