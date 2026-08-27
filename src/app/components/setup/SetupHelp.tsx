import React from "react";
import { Box, Text, useInput } from "ink";
import { palette } from "../../theme";

type SetupHelpProps = {
  onDone: () => void;
  disabled?: boolean;
};

/** Help panel for the setup wizard. Any key returns to the menu. */
export const SetupHelp: React.FC<SetupHelpProps> = ({ onDone, disabled = false }) => {
  useInput(() => { onDone(); }, { isActive: !disabled });

  return (
    <Box flexDirection="column" width={60}>
      <Box justifyContent="center" marginBottom={1}>
        <Text color={palette.accent} bold>
          ❓ HELP & KEYBOARD SHORTCUTS
        </Text>
      </Box>

      <Box
        flexDirection="column"
        borderStyle="single"
        borderColor={palette.border}
        paddingX={2}
        paddingY={1}
        marginBottom={1}
      >
        <Box flexDirection="row" marginBottom={1}>
          <Text color={palette.accent} bold>Navigation : </Text>
          <Text color={palette.text}>Tab / Shift+Tab or Arrow keys</Text>
        </Box>
        <Box flexDirection="row" marginBottom={1}>
          <Text color={palette.accent} bold>Select/Edit: </Text>
          <Text color={palette.text}>Enter (on menu items or form fields)</Text>
        </Box>
        <Box flexDirection="row" marginBottom={1}>
          <Text color={palette.accent} bold>Delete Proj: </Text>
          <Text color={palette.text}>Delete or Backspace (in List mode)</Text>
        </Box>
        <Box flexDirection="row" marginBottom={1}>
          <Text color={palette.accent} bold>Text Input : </Text>
          <Text color={palette.text}>Type characters directly; Backspace to erase</Text>
        </Box>
        <Box flexDirection="row">
          <Text color={palette.accent} bold>Quit Wizard: </Text>
          <Text color={palette.text}>Ctrl+C (any time)</Text>
        </Box>
      </Box>

      <Box flexDirection="column" alignItems="center" marginTop={1}>
        <Text color={palette.textBright} inverse>  Press any key to return  </Text>
      </Box>
    </Box>
  );
};
