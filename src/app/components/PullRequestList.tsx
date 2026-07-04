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
  /** Text filter — PRs whose title or author don't contain this string are hidden. */
  prFilter: string;
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
          {truncate(pr.title, 44)}
        </Text>
      </Box>
      <Box marginLeft={1}>
        <Text color={palette.muted}>{truncate(pr.author, 10)}</Text>
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
  prFilter,
}) => {
  const active = focus === "list";
  const query = prFilter.trim().toLowerCase();

  const visible = query
    ? pullRequests.filter(
      (pr) =>
        pr.title.toLowerCase().includes(query) ||
        pr.author.toLowerCase().includes(query),
    )
    : pullRequests;

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
          {query
            ? `${visible.length}/${pullRequests.length} match`
            : `${pullRequests.length} total`}
        </Text>
      </Box>

      {/* Filter bar — shown whenever there's active text */}
      {query ? (
        <Box>
          <Text color={palette.accent}>🔍 </Text>
          <Text color={palette.textBright}>{prFilter}</Text>
          <Text color={palette.muted}>{"  "}(esc to clear)</Text>
        </Box>
      ) : null}

      {visible.length > 0 ? (
        visible.map((pr, prIndex) => (
          <PrRow key={pr.id} pr={pr} selected={prIndex === selectedPrIndex} />
        ))
      ) : pullRequests.length > 0 ? (
        <Text color={palette.muted}>No PRs match "{prFilter}".</Text>
      ) : (
        <Text color={palette.muted}>No pull requests in this repository.</Text>
      )}

      {/* Hints moved to App.tsx */}
    </Box>
  );
};
