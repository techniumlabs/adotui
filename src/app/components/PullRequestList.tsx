import React from "react";
import { Box, Text } from "ink";
import type { PullRequest } from "../../domain/types";
import type { FocusArea } from "../types";
import { glyph, palette, reviewBadge, statusBadge, truncate } from "../theme";

type PullRequestListProps = {
  pullRequests: PullRequest[];
  visiblePrs: PullRequest[];
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
      
      {/* ID */}
      <Box width={6}>
        <Text color={palette.muted}>#{pr.id}</Text>
      </Box>

      {/* Title + Tags */}
      <Box flexGrow={1} marginRight={1}>
        {pr.draft && (
          <Text color={palette.draft} bold>
            {glyph.draft} draft{" "}
          </Text>
        )}
        {hasConflict && (
          <Text color={palette.danger} bold>
            {glyph.cross} conflict{" "}
          </Text>
        )}
        <Text color={selected ? palette.textBright : palette.text} bold={selected}>
          {truncate(pr.title, 50)}
        </Text>
      </Box>

      {/* Author */}
      <Box width={14}>
        <Text color={palette.muted}>{truncate(pr.author, 12)}</Text>
      </Box>

      {/* Review Status */}
      <Box width={18}>
        <Text color={review.color}>
          {review.symbol} {review.label}
        </Text>
      </Box>

      {/* PR Status */}
      <Box width={10}>
        <Text color={status.color}>
          {status.symbol} {status.label}
        </Text>
      </Box>
    </Box>
  );
};

export const PullRequestList: React.FC<PullRequestListProps> = ({
  pullRequests,
  visiblePrs,
  repoName,
  selectedPrIndex,
  focus,
}) => {
  const active = focus === "list";

  return (
    <Box
      paddingX={1}
      flexDirection="column"
      borderStyle="single"
      borderBottom={true}
      borderTop={false}
      borderLeft={false}
      borderRight={false}
      borderColor={palette.border}
    >
      {/* Header */}
      <Box justifyContent="space-between">
        <Text color={active ? palette.accent : palette.muted} bold>
          {glyph.dot} Pull Requests {glyph.arrow} {repoName ?? "—"}
        </Text>
        <Text color={palette.muted}>
          {visiblePrs.length !== pullRequests.length
            ? `${visiblePrs.length}/${pullRequests.length} match`
            : `${pullRequests.length} total`}
        </Text>
      </Box>

      {visiblePrs.length > 0 ? (
        active || focus === "tree" ? (
          visiblePrs.map((pr, prIndex) => (
            <PrRow key={pr.id} pr={pr} selected={prIndex === selectedPrIndex} />
          ))
        ) : (
          visiblePrs[selectedPrIndex] ? (
            <PrRow
              key={visiblePrs[selectedPrIndex].id}
              pr={visiblePrs[selectedPrIndex]}
              selected={true}
            />
          ) : null
        )
      ) : pullRequests.length > 0 ? (
        <Text color={palette.muted}>No PRs match filters.</Text>
      ) : (
        <Text color={palette.muted}>No pull requests in this repository.</Text>
      )}

      {/* Hints moved to App.tsx */}
    </Box>
  );
};
