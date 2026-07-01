import React from "react";
import { Box, Text } from "ink";

import type { PullRequest } from "../../domain/types";
import type { FocusArea } from "../types";
import {
  formatRelativeAge,
  reviewColor,
} from "../utils";

type PrDetailsProps = {
  selectedPr?: PullRequest;
  focus: FocusArea;
};

export const PrDetails: React.FC<PrDetailsProps> = ({
  selectedPr,
  focus,
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
        <Box marginTop={1}>
          <Text color="gray">
            files changed {selectedPr.changedFiles.length} (view in files tab)
          </Text>
        </Box>
      </>
    ) : (
      <Text color="gray">Select a PR to inspect details.</Text>
    )}
  </Box>
);
