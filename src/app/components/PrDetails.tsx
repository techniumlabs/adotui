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
import { formatRelativeAge } from "../utils";

type PrDetailsProps = {
  selectedPr?: PullRequest;
  focus: FocusArea;
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

export const PrDetails: React.FC<PrDetailsProps> = ({ selectedPr, focus }) => {
  const active = focus === "detail";

  return (
    <Box
      marginTop={1}
      borderStyle="round"
      borderColor={active ? palette.accent : palette.muted}
      paddingX={1}
      flexDirection="column"
    >
      <Text color={active ? palette.accent : palette.muted} bold>
        {glyph.dot} Details
      </Text>

      {selectedPr ? (
        (() => {
          const review = reviewBadge(selectedPr.reviewState);
          const status = statusBadge(selectedPr.status);
          const checks = checksBadge(
            selectedPr.checksPassed,
            selectedPr.checksTotal,
          );

          return (
            <Box flexDirection="column" marginTop={1}>
              <Box>
                <Text color={palette.muted}>#{selectedPr.id} </Text>
                <Text color={palette.textBright} bold>
                  {truncate(selectedPr.title, 60)}
                </Text>
                {selectedPr.draft ? (
                  <Text color={palette.draft} bold>
                    {" "}
                    {glyph.draft} draft
                  </Text>
                ) : null}
              </Box>

              <Box marginTop={1} flexDirection="column">
                <Row label="author">
                  <Text color={palette.text}>{selectedPr.author}</Text>
                </Row>
                <Row label="updated">
                  <Text color={palette.text}>
                    {formatRelativeAge(selectedPr.updatedAt)}
                  </Text>
                </Row>
                <Row label="branch">
                  <Text color={palette.info}>{selectedPr.sourceBranch}</Text>
                  <Text color={palette.muted}> {glyph.arrow} </Text>
                  <Text color={palette.text}>{selectedPr.targetBranch}</Text>
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
                  {selectedPr.mergeStatus === "conflicts" ? (
                    <Text color={palette.danger}>✗ conflicts</Text>
                  ) : selectedPr.mergeStatus === "succeeded" ? (
                    <Text color={palette.ok}>✓ no conflicts</Text>
                  ) : selectedPr.mergeStatus === "rejectedByPolicy" ? (
                    <Text color={palette.warn}>⚑ rejected by policy</Text>
                  ) : selectedPr.mergeStatus === "queued" ? (
                    <Text color={palette.warn}>◔ queued</Text>
                  ) : selectedPr.mergeStatus === "failure" ? (
                    <Text color={palette.danger}>✗ merge failure</Text>
                  ) : (
                    <Text color={palette.muted}>— unknown</Text>
                  )}
                </Row>
                <Row label="checks">
                  <Text color={checks.color}>
                    {checks.symbol} {checks.label}
                  </Text>
                  <Text color={palette.muted}>
                    {"   "}
                    {glyph.dot} {selectedPr.comments} comments
                  </Text>
                </Row>
                <Row label="files">
                  <Text color={palette.text}>
                    {selectedPr.changedFiles.length}
                  </Text>
                  <Text color={palette.muted}> (press l / files tab)</Text>
                </Row>
              </Box>

              <Box marginTop={1}>
                <Text color={palette.muted}>{truncate(selectedPr.url, 66)}</Text>
              </Box>
            </Box>
          );
        })()
      ) : (
        <Text color={palette.muted}>Select a PR to inspect details.</Text>
      )}
    </Box>
  );
};
