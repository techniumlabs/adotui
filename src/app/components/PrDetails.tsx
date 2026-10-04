import React from "react";
import { Box, Text } from "ink";

import type { PullRequest } from "../../domain/types";
import type { FocusArea } from "../types";
import {
  checksBadge,
  glyph,
  palette,
  reviewBadge,
  statusBadge,
  truncate,
} from "../theme";
import {
  formatRelativeAge,
  isAssignedReviewer,
  isCurrentUser,
  isMyPr,
} from "../utils";
import { PanelTitle } from "./ui/PanelTitle";
import { TabPane } from "./ui/TabPane";

type PrDetailsProps = {
  selectedPr?: PullRequest;
  focus: FocusArea;
  currentUserEmail?: string;
};

const Row: React.FC<{ label: string; children: React.ReactNode }> = ({
  label,
  children,
}) => (
  <Box>
    <Box width={10}>
      <Text color={palette.muted}>{label}</Text>
    </Box>
    <Box>{children}</Box>
  </Box>
);

/** How each merge status reads in the "merge" row. */
const MERGE_STATUS: Partial<Record<PullRequest["mergeStatus"], { color: string; text: string }>> = {
  conflicts: { color: palette.danger, text: "✗ conflicts" },
  succeeded: { color: palette.ok, text: "✓ no conflicts" },
  rejectedByPolicy: { color: palette.warn, text: "⚑ rejected by policy" },
  queued: { color: palette.warn, text: "◔ queued" },
  failure: { color: palette.danger, text: "✗ merge failure" },
};
const UNKNOWN_MERGE = { color: palette.muted, text: "— unknown" };

type SectionProps = { pr: PullRequest; currentUserEmail?: string; mine: boolean };

/** "#id title  draft  my pr / to review" */
const Headline: React.FC<SectionProps & { toReview: boolean }> = ({ pr, mine, toReview }) => (
  <Box>
    <Text color={palette.muted}>#{pr.id} </Text>
    <Text color={palette.textBright} bold>
      {truncate(pr.title, 60)}
    </Text>
    {pr.draft ? (
      <Text color={palette.draft} bold>
        {" "}
        {glyph.draft} draft
      </Text>
    ) : null}
    {mine ? (
      <Text color={palette.accent} bold>
        {" "}
        {glyph.mine} my pr
      </Text>
    ) : toReview ? (
      <Text color={palette.warn} bold>
        {" "}
        {glyph.review} to review
      </Text>
    ) : null}
  </Box>
);

/** The label/value rows: author through files. */
const Facts: React.FC<SectionProps> = ({ pr, mine }) => {
  const review = reviewBadge(pr.reviewState);
  const status = statusBadge(pr.status);
  const checks = checksBadge(pr.checksPassed, pr.checksTotal);
  const merge = MERGE_STATUS[pr.mergeStatus] ?? UNKNOWN_MERGE;
  return (
    <Box marginTop={1} flexDirection="row" paddingLeft={2}>
      <Box flexDirection="column" flexBasis="50%">
        <Row label="author">
          <Text color={mine ? palette.accent : palette.text}>
            {pr.author}
            {mine ? " (you)" : ""}
          </Text>
        </Row>
        <Row label="updated">
          <Text color={palette.text}>{formatRelativeAge(pr.updatedAt)}</Text>
        </Row>
        <Row label="branch">
          <Text color={palette.info}>{pr.sourceBranch}</Text>
          <Text color={palette.muted}> {glyph.arrow} </Text>
          <Text color={palette.text}>{pr.targetBranch}</Text>
        </Row>
        <Row label="review">
          <Text color={review.color}>
            {review.symbol} {review.label}
          </Text>
        </Row>
        <Row label="status">
          <Text color={status.color}>
            {status.symbol} {status.label}
          </Text>
        </Row>
        <Row label="merge">
          <Text color={merge.color}>{merge.text}</Text>
        </Row>
        <Row label="checks">
          <Text color={checks.color}>
            {checks.symbol} {checks.label}
          </Text>
        </Row>
        <Row label="comments">
          <Text color={palette.text}>
            {pr.comments}{" "}
            {pr.activeComments > 0 ? (
              <Text color={palette.warn}>({pr.activeComments} active)</Text>
            ) : (
              <Text color={palette.muted}>(all resolved)</Text>
            )}
          </Text>
        </Row>
        <Row label="files">
          <Text color={palette.text}>{pr.changedFiles.length}</Text>
          <Text color={palette.muted}> (press l / files tab)</Text>
        </Row>
      </Box>
    </Box>
  );
};

/** A full-width labelled block below the facts. */
const Section: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <Box marginTop={1} flexDirection="column" paddingLeft={2}>
    <Row label={label}>{children}</Row>
  </Box>
);

const Reviewers: React.FC<SectionProps> = ({ pr, currentUserEmail }) => (
  <Section label="reviewers">
    {pr.reviewers && pr.reviewers.length > 0 ? (
      <Box flexDirection="column">
        {pr.reviewers.map((reviewer) => {
          const isYou = isCurrentUser(reviewer.displayName + " " + reviewer.uniqueName, currentUserEmail);
          return (
            <Text key={reviewer.uniqueName}>
              <Text color={isYou ? palette.warn : palette.text}>{reviewer.displayName}</Text>
              {isYou ? (
                <Text color={palette.warn} bold>
                  {" "}(you)
                </Text>
              ) : null}
              <Text color={palette.muted}>
                {" "}{glyph.bullet} {reviewer.uniqueName}
              </Text>
            </Text>
          );
        })}
      </Box>
    ) : (
      <Text color={palette.muted}>none</Text>
    )}
  </Section>
);

const Tags: React.FC<SectionProps> = ({ pr }) => (
  <Section label="tags">
    {pr.tags && pr.tags.length > 0 ? (
      <Box flexDirection="row" flexWrap="wrap">
        {pr.tags.map((tag) => (
          <Box key={tag} marginRight={1}>
            <Text color={palette.info}>#{tag}</Text>
          </Box>
        ))}
      </Box>
    ) : (
      <Text color={palette.muted}>none</Text>
    )}
  </Section>
);

const WorkItems: React.FC<SectionProps> = ({ pr }) => (
  <Section label="work items">
    {pr.workItems && pr.workItems.length > 0 ? (
      <Box flexDirection="column">
        {pr.workItems.map((wi) => (
          <Text key={wi.id}>
            <Text color={palette.textBright} bold>
              #{wi.id}
            </Text>
            <Text color={palette.text}> {wi.state} </Text>
            <Text color={palette.muted}>
              {glyph.bullet} {wi.title}
            </Text>
          </Text>
        ))}
      </Box>
    ) : (
      <Text color={palette.muted}> none</Text>
    )}
  </Section>
);

export const PrDetails: React.FC<PrDetailsProps> = ({ selectedPr, focus, currentUserEmail }) => {
  const active = focus === "detail";
  const mine = selectedPr ? isMyPr(selectedPr, currentUserEmail) : false;
  const toReview = selectedPr && !mine ? isAssignedReviewer(selectedPr, currentUserEmail) : false;

  return (
    <TabPane>
      <Box>
        <PanelTitle active={active}>
          {glyph.dot} Details
        </PanelTitle>
        {selectedPr && !selectedPr.detailsLoaded && (
          <Text color={palette.muted}>
            {"  "}{glyph.clock} loading details...
          </Text>
        )}
      </Box>

      {selectedPr ? (
        <Box flexDirection="column" marginTop={1}>
          <Headline pr={selectedPr} mine={mine} toReview={toReview} currentUserEmail={currentUserEmail} />
          <Facts pr={selectedPr} mine={mine} currentUserEmail={currentUserEmail} />
          <Reviewers pr={selectedPr} mine={mine} currentUserEmail={currentUserEmail} />
          <Tags pr={selectedPr} mine={mine} />
          <WorkItems pr={selectedPr} mine={mine} />
          <Box marginTop={1} paddingLeft={2}>
            <Text color={palette.muted}>{truncate(selectedPr.url, 66)}</Text>
          </Box>
        </Box>
      ) : (
        <Text color={palette.muted}>Select a PR to inspect details.</Text>
      )}
    </TabPane>
  );
};
