import React from "react";
import { Box, Text } from "ink";
import type { FocusArea } from "../types";

type CommandBarProps = {
  focus: FocusArea;
  commandText: string;
};

export const CommandBar: React.FC<CommandBarProps> = ({ focus, commandText }) => (
  <Box
    marginTop={1}
    borderStyle="single"
    borderColor={focus === "command" ? "cyan" : "gray"}
    paddingX={1}
  >
    <Text color={focus === "command" ? "cyan" : "gray"}>
      {focus === "command" ? `:${commandText}` : "Press / for command mode"}
    </Text>
  </Box>
);
