import React from "react";
import { Box, Text } from "ink";
import type { FocusArea } from "../types";
import { palette } from "../theme";
import { ClickableBox } from "./ui/ClickableBox";

type PrTabsProps = {
  focus: FocusArea;
  /** Mouse: a click on a tab label opens it (same as its number key). */
  onSelectTab?: (key: string) => void;
};

export const PrTabs: React.FC<PrTabsProps> = ({ focus, onSelectTab }) => {
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
    ...(process.env.NODE_ENV === "debug" ? [{ id: "runs", label: "Pipelines", shortcut: "4" }] : []),
  ];

  return (
    <Box marginLeft={2} flexShrink={0}>
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <ClickableBox key={tab.id} marginRight={2} onClick={() => onSelectTab?.(tab.shortcut)}>
            {isActive ? (
              <Text backgroundColor={palette.accent} color="black" bold>
                {" "}{tab.shortcut} {tab.label.toLowerCase()}{" "}
              </Text>
            ) : (
              <Text color={palette.muted}>
                {tab.shortcut} {tab.label.toLowerCase()}
              </Text>
            )}
          </ClickableBox>
        );
      })}
    </Box>
  );
};
