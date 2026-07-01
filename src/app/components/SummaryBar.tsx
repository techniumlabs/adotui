import React from "react";
import { Box, Text } from "ink";

type SummaryBarProps = {
  activePrs: number;
  totalPrs: number;
  orgCount: number;
  autoRefresh: boolean;
  relativeLastRefresh: string;
};

export const SummaryBar: React.FC<SummaryBarProps> = ({
  activePrs,
  totalPrs,
  orgCount,
  autoRefresh,
  relativeLastRefresh,
}) => (
  <Box marginTop={1} gap={1}>
    <Text color="green">active {activePrs}</Text>
    <Text color="white">total {totalPrs}</Text>
    <Text color="white">orgs {orgCount}</Text>
    <Text color={autoRefresh ? "green" : "red"}>auto {autoRefresh ? "on" : "off"}</Text>
    <Text color="gray">last sync {relativeLastRefresh}</Text>
  </Box>
);
