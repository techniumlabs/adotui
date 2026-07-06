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
        active || focus === "tree" ? (
          visible.map((pr, prIndex) => (
            <PrRow key={pr.id} pr={pr} selected={prIndex === selectedPrIndex} />
          ))
        ) : (
          visible[selectedPrIndex] ? (
            <PrRow
              key={visible[selectedPrIndex].id}
              pr={visible[selectedPrIndex]}
              selected={true}
            />
          ) : null
        )
      ) : pullRequests.length > 0 ? (
        <Text color={palette.muted}>No PRs match "{prFilter}".</Text>
      ) : (
        <Text color={palette.muted}>No pull requests in this repository.</Text>
      )}

      {/* Hints moved to App.tsx */}
    </Box>
  );
};
