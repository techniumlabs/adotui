import React from "react";
import { Box, Text } from "ink";
import type { AppState } from "../types";
import { palette } from "../theme";
import { footerHints } from "../keymap";

const bannerColor = (state: Pick<AppState, "loadState" | "pendingConfirm">): string => {
  if (state.loadState === "error") return palette.danger;
  if (state.pendingConfirm || state.loadState === "loading") return palette.warn;
  return palette.text;
};

/** The status line under the header. */
export const BannerLine: React.FC<{ state: AppState }> = ({ state }) => (
  <Box paddingX={1} flexShrink={0} borderStyle="single" borderTop={true} borderBottom={false} borderLeft={false} borderRight={false} borderColor={palette.border}>
    <Text wrap="truncate-end" color={bannerColor(state)}>
      {state.loadState === "loading" ? "Loading pull requests from Azure DevOps..." : state.banner}
    </Text>
  </Box>
);

/** The key hints along the bottom (swapped for the loader while loading). */
export const FooterHints: React.FC<{ hasPr: boolean }> = ({ hasPr }) => (
  <Box
    flexShrink={0}
    borderStyle="single"
    borderTop={true}
    borderLeft={false}
    borderRight={false}
    borderBottom={false}
    borderColor={palette.border}
    paddingX={2}
  >
    <Text color={palette.muted} wrap="truncate-end">
      {footerHints(hasPr).map((hint, index) => (
        <Text key={hint.keys}>
          {index > 0 ? "   " : ""}
          <Text color={palette.accent} bold>{hint.keys}</Text> {hint.label}
        </Text>
      ))}
    </Text>
  </Box>
);
