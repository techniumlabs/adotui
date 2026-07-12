import React from "react";
import { Box, Text } from "ink";
import { glyph, palette } from "../theme";
import type { LoadState } from "../types";

type SummaryBarProps = {
  activePrs: number;
  totalPrs: number;
  orgCount: number;
  repoCount: number;
  autoRefresh: boolean;
  relativeLastRefresh: string;
  loadState: LoadState;
};

const Stat: React.FC<{ label: string; value: string; color?: string }> = ({
  label,
  value,
  color = palette.textBright,
}) => (
  <Box marginRight={2}>
    <Text color={palette.muted}>{label} </Text>
    <Text color={color} bold>
      {value}
    </Text>
  </Box>
);

const loadIndicator = (
  loadState: LoadState,
): { symbol: string; label: string; color: string } => {
  switch (loadState) {
    case "loading":
      return { symbol: glyph.clock, label: "loading", color: palette.warn };
    case "error":
      return { symbol: glyph.cross, label: "error", color: palette.danger };
    default:
      return { symbol: glyph.check, label: "ready", color: palette.ok };
  }
};

export const SummaryBar: React.FC<SummaryBarProps> = ({
  activePrs,
  totalPrs,
  orgCount,
  repoCount,
  autoRefresh,
  relativeLastRefresh,
  loadState,
}) => {
  const indicator = loadIndicator(loadState);

  return (
    <Box
      paddingX={1}
      width="100%"
      justifyContent="space-between"
    >
      <Box>
        <Stat label="active" value={String(activePrs)} color={palette.ok} />
        <Stat label="total" value={String(totalPrs)} />
        <Stat label="orgs" value={String(orgCount)} />
        <Stat label="repos" value={String(repoCount)} />
      </Box>
      <Box>
        <Box marginRight={2}>
          <Text color={indicator.color}>
            {indicator.symbol} {indicator.label}
          </Text>
        </Box>
        <Box marginRight={2}>
          <Text color={autoRefresh ? palette.ok : palette.muted}>
            {glyph.auto} auto {autoRefresh ? "on" : "off"}
          </Text>
        </Box>
        <Text color={palette.muted}>synced {relativeLastRefresh}</Text>
      </Box>
    </Box>
  );
};
