import React from "react";
import { Box, Text } from "ink";
import { DiffModeEnum, DiffView } from "@git-diff-view/cli";
import type { PullRequest } from "../../domain/types";
import type { DiffViewMode, FocusArea } from "../types";
import {
  buildTerminalDiffData,
  fileChangeColor,
  formatRelativeAge,
  reviewColor,
} from "../utils";

type PrDetailsProps = {
  selectedPr?: PullRequest;
  focus: FocusArea;
  diffViewMode: DiffViewMode;
};

export const PrDetails: React.FC<PrDetailsProps> = ({
  selectedPr,
  focus,
  diffViewMode,
}) => (
  <Box
    marginTop={1}
    borderStyle="round"
    borderColor={focus === "detail" ? "cyan" : "gray"}
    paddingX={1}
    paddingY={0}
    flexDirection="column"
  >
    <Text color={focus === "detail" ? "cyan" : "gray"}>Details</Text>
    {selectedPr ? (
      <>
        <Text color="whiteBright">
          #{selectedPr.id} {selectedPr.title}
        </Text>
        <Text color="gray">
          author {selectedPr.author} | updated{" "}
          {formatRelativeAge(selectedPr.updatedAt)}
        </Text>
        <Text color="gray">{`${selectedPr.sourceBranch} -> ${selectedPr.targetBranch}`}</Text>
        <Box>
          <Text color={reviewColor(selectedPr.reviewState)}>
            review {selectedPr.reviewState}
          </Text>
          <Text color="white"> comments {selectedPr.comments}</Text>
          <Text color="white">
            {" "}
            checks {selectedPr.checksPassed}/{selectedPr.checksTotal}
          </Text>
        </Box>
        <Text color="gray">url {selectedPr.url}</Text>
        <Box marginTop={1} flexDirection="column">
          <Text color="gray">
            files changed {selectedPr.changedFiles.length} | mode {diffViewMode}
          </Text>
          {selectedPr.changedFiles.length > 0 ? (
            selectedPr.changedFiles.map((fileChange) => (
              <Box key={fileChange.path} marginTop={1} flexDirection="column">
                <Text color={fileChangeColor(fileChange.status)}>
                  {fileChange.status} {fileChange.path} (+{fileChange.additions}{" "}
                  -{fileChange.deletions})
                </Text>
                <DiffView
                  data={buildTerminalDiffData(fileChange)}
                  diffViewMode={
                    diffViewMode === "split"
                      ? DiffModeEnum.Split
                      : DiffModeEnum.Unified
                  }
                  diffViewTheme="dark"
                  diffViewHighlight
                  diffViewNoBG
                  width={Math.max(60, (process.stdout.columns ?? 120) - 48)}
                />
              </Box>
            ))
          ) : (
            <Text color="gray">No files recorded for this PR.</Text>
          )}
        </Box>
      </>
    ) : (
      <Text color="gray">Select a PR to inspect details.</Text>
    )}
  </Box>
);
