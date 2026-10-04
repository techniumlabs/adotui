import React from "react";
import { Box } from "ink";
import { palette } from "../../theme";

/**
 * The content pane under the PR tab bar (Overview, Diff, Comments, Pipelines):
 * a top rule only, padded, stacked vertically.
 */
export const TabPane: React.FC<{ children: React.ReactNode; marginTop?: number }> = ({ children, marginTop }) => (
  <Box
    borderStyle="single"
    borderTop
    borderBottom={false}
    borderLeft={false}
    borderRight={false}
    borderColor={palette.border}
    paddingX={1}
    flexDirection="column"
    marginTop={marginTop}
  >
    {children}
  </Box>
);
