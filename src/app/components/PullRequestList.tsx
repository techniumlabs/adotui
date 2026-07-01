import React from "react";
import { Box, Text } from "ink";
import type { PullRequest } from "../../domain/types";
import type { FocusArea } from "../types";
import { reviewColor } from "../utils";

type PullRequestListProps = {
  pullRequests: PullRequest[];
  repoName?: string;
  selectedPrIndex: number;
  focus: FocusArea;
};

export const PullRequestList: React.FC<PullRequestListProps> = ({
  pullRequests,
  repoName,
  selectedPrIndex,
  focus,
}) => (
  <Box
    borderStyle="round"
    borderColor={focus === "list" ? "cyan" : "gray"}
    paddingX={1}
    paddingY={0}
    flexDirection="column"
  >
    <Text color={focus === "list" ? "cyan" : "gray"}>
      Pull Requests in {repoName ?? "-"}
    </Text>
    {pullRequests.length > 0 ? (
      pullRequests.map((pr, prIndex) => (
        <Box key={pr.id}>
          <Text color={prIndex === selectedPrIndex ? "whiteBright" : "white"}>
            {prIndex === selectedPrIndex ? ">" : " "} #{pr.id} {pr.draft ? "[draft] " : ""}
            {pr.title}
          </Text>
          <Text color={reviewColor(pr.reviewState)}> {pr.reviewState}</Text>
          <Text
            color={
              pr.status === "active"
                ? "green"
                : pr.status === "completed"
                  ? "blue"
                  : "red"
            }
          >
            {" "}
            {pr.status}
          </Text>
        </Box>
      ))
    ) : (
      <Text color="gray">No PRs in this repository.</Text>
    )}
  </Box>
);
