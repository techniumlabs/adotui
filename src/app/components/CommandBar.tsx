import React from "react";
import { Box, Text } from "ink";
import type { FocusArea, PendingConfirm } from "../types";
import { glyph, palette } from "../theme";

type CommandBarProps = {
  focus: FocusArea;
  commandText: string;
  pendingConfirm: PendingConfirm;
  filterPrompt?: { target: "tree" | "files"; text: string };
};

export const CommandBar: React.FC<CommandBarProps> = ({
  focus,
  commandText,
  pendingConfirm,
  filterPrompt,
}) => {
  if (pendingConfirm) {
    return (
      <Box
        flexShrink={0}
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

  if (focus === "filter" && filterPrompt) {
    return (
      <Box
        flexShrink={0}
        borderStyle="single"
        borderTop={true}
        borderLeft={false}
        borderRight={false}
        borderBottom={false}
        borderColor={palette.accent}
        paddingX={2}
      >
        <Text color={palette.accent} bold>/ </Text>
        <Text color={palette.textBright}>
          {filterPrompt.text}
          <Text color={palette.accent}>{"\u258C"}</Text>
        </Text>
        <Text color={palette.muted}>
          {"  "}filtering {filterPrompt.target === "files" ? "files" : "PRs"} · Enter apply · Esc cancel
        </Text>
      </Box>
    );
  }

  const commandMode = focus === "command";

  return (
    <Box
      flexShrink={0}
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
        {commandMode ? (
          commandText ? (
            <>
              {commandText}
              <Text color={palette.accent}>▌</Text>
            </>
          ) : (
            <>
              <Text color={palette.accent}>▌</Text>
              <Text color={palette.muted}>type a command (filter, help, refresh, approve, abandon, complete…)</Text>
            </>
          )
        ) : (
          "Press / to filter · : for commands"
        )}
      </Text>
    </Box>
  );
};
