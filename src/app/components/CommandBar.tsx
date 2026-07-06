import React from "react";
import { Box, Text } from "ink";
import type { FocusArea, PendingConfirm } from "../types";
import { glyph, palette } from "../theme";

type CommandBarProps = {
  focus: FocusArea;
  commandText: string;
  pendingConfirm: PendingConfirm;
};

export const CommandBar: React.FC<CommandBarProps> = ({
  focus,
  commandText,
  pendingConfirm,
}) => {
  if (pendingConfirm) {
    return (
      <Box
        marginTop={1}
        borderStyle="single"
        borderTop={true}
        borderLeft={false}
        borderRight={false}
        borderBottom={false}
        borderColor={palette.warn}
        paddingX={2}
      >
        <Text color={palette.warn} bold>
          {glyph.clock} Confirm {pendingConfirm.kind} #{pendingConfirm.target.prId}: press{" "}
        </Text>
        <Text color={palette.ok} bold>
          y
        </Text>
        <Text color={palette.warn}> to confirm, </Text>
        <Text color={palette.danger} bold>
          n
        </Text>
        <Text color={palette.warn}> / esc to cancel</Text>
      </Box>
    );
  }

  const commandMode = focus === "command";

  return (
    <Box
      marginTop={1}
      borderStyle="single"
      borderTop={true}
      borderLeft={false}
      borderRight={false}
      borderBottom={false}
      borderColor={commandMode ? palette.accent : palette.border}
      paddingX={2}
    >
      <Text color={commandMode ? palette.accent : palette.muted} bold>
        {commandMode ? ":" : glyph.dot}{" "}
      </Text>
      <Text color={commandMode ? palette.textBright : palette.muted}>
        {commandMode
          ? commandText || "type a command (filter, help, refresh, approve, complete…)"
          : "Press / to filter or run commands"}
      </Text>
    </Box>
  );
};
