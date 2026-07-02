import React from "react";
import { Box, Text } from "ink";
import type { PullRequest } from "../../domain/types";
import type { FocusArea } from "../types";
import { glyph, palette, reviewBadge, statusBadge, truncate } from "../theme";

type PullRequestListProps = {
  pullRequests: PullRequest[];
  repoName?: string;
  selectedPrIndex: number;
  focus: FocusArea;
};

const PrRow: React.FC<{ pr: PullRequest; selected: boolean }> = ({
  pr,
  selected,
}) => {
  const review = reviewBadge(pr.reviewState);
  const status = statusBadge(pr.status);
  const hasConflict = pr.mergeStatus === "conflicts";

  return (
    <Box>
      <Text color={selected ? palette.accent : palette.muted}>
        {selected ? glyph.pointer : glyph.pointerIdle}{" "}
      </Text>
      <Box width={7}>
        <Text color={palette.muted}>#{pr.id}</Text>
      </Box>
      {pr.draft ? (
        <Text color={palette.draft} bold>
          {glyph.draft} draft{" "}
        </Text>
      ) : null}
      {hasConflict ? (
        <Text color={palette.danger} bold>
          {glyph.cross} conflict{" "}
        </Text>
      ) : null}
      <Box flexGrow={1}>
        <Text color={selected ? palette.textBright : palette.text} bold={selected}>
          {truncate(pr.title, 48)}
        </Text>
      </Box>
      <Box marginLeft={1}>
        <Text color={review.color}>
          {review.symbol} {review.label}
        </Text>
      </Box>
      <Box marginLeft={1}>
        <Text color={status.color}>
          {status.symbol} {status.label}
        </Text>
      </Box>
    </Box>
  );
};

export const PullRequestList: React.FC<PullRequestListProps> = ({
  pullRequests,
  repoName,
  selectedPrIndex,
  focus,
}) => {
  const active = focus === "list";

  return (
    <Box
      borderStyle="round"
      borderColor={active ? palette.accent : palette.muted}
      paddingX={1}
      flexDirection="column"
    >
      <Box justifyContent="space-between">
        <Text color={active ? palette.accent : palette.muted} bold>
          {glyph.dot} Pull Requests {glyph.arrow} {repoName ?? "—"}
        </Text>
        <Text color={palette.muted}>{pullRequests.length} total</Text>
      </Box>

      {pullRequests.length > 0 ? (
        pullRequests.map((pr, prIndex) => (
          <PrRow key={pr.id} pr={pr} selected={prIndex === selectedPrIndex} />
        ))
      ) : (
        <Text color={palette.muted}>No pull requests in this repository.</Text>
      )}
    </Box>
  );
};
