import React from "react";
import { Box, Text } from "ink";
import type { FocusArea } from "../types";
import { palette } from "../theme";

type PrTabsProps = {
  focus: FocusArea;
};

export const PrTabs: React.FC<PrTabsProps> = ({ focus }) => {
  // Determine which pane is currently visible based on App.tsx's routing logic
  const activeTab =
    focus === "files"
      ? "files"
      : focus === "comments"
        ? "comments"
        : focus === "runs"
          ? "runs"
          : "detail";

  const tabs = [
    { id: "detail", label: "Overview", shortcut: "1" },
    { id: "files", label: "Diff", shortcut: "2" },
    { id: "comments", label: "Comments", shortcut: "3" },
    { id: "runs", label: "Pipelines", shortcut: "4" },
  ];

  return (
    <Box marginTop={1} marginLeft={2}>
      {tabs.map((tab, idx) => {
        const isActive = activeTab === tab.id;
        return (
          <Box key={tab.id}>
            {idx > 0 && <Text color={palette.muted}> │ </Text>}
            <Text color={isActive ? palette.accent : palette.muted} bold={isActive}>
              {isActive ? "● " : "○ "}
              {tab.label} <Text color={palette.accentDim}>[{tab.shortcut}]</Text>
            </Text>
          </Box>
        );
      })}
    </Box>
  );
};
