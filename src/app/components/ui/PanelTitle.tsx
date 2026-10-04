import React from "react";
import { Text } from "ink";
import { palette } from "../../theme";

/** A pane's title: accent-coloured while the pane has focus, muted otherwise. */
export const PanelTitle: React.FC<{ active: boolean; children: React.ReactNode }> = ({ active, children }) => (
  <Text color={active ? palette.accent : palette.muted} bold>
    {children}
  </Text>
);
