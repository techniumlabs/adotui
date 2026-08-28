import React from "react";
import { Box, Text } from "ink";
import { palette } from "../../theme";

/** The ADOTUI block-letter logo shown on the setup screen. */
export const AsciiLogo: React.FC = () => (
  <Box flexDirection="row" justifyContent="center" marginBottom={1}>
    {/* A */}
    <Box flexDirection="column" alignItems="center">
      <Text color={palette.accent} bold>█▀▀█</Text>
      <Text color={palette.accent} bold>█▄▄█</Text>
      <Text color={palette.accent} bold>▀  ▀</Text>
    </Box>
    <Box width={1} />
    {/* D */}
    <Box flexDirection="column" alignItems="center">
      <Text color={palette.accent} bold>█▀▀▄</Text>
      <Text color={palette.accent} bold>█  █</Text>
      <Text color={palette.accent} bold>▀▀▀ </Text>
    </Box>
    <Box width={1} />
    {/* O */}
    <Box flexDirection="column" alignItems="center">
      <Text color={palette.accent} bold>█▀▀█</Text>
      <Text color={palette.accent} bold>█  █</Text>
      <Text color={palette.accent} bold>▀▀▀▀</Text>
    </Box>
    <Box width={1} />
    {/* T */}
    <Box flexDirection="column" alignItems="center">
      <Text color={palette.accent} bold>▀▀█▀▀</Text>
      <Text color={palette.accent} bold>  █  </Text>
      <Text color={palette.accent} bold>  ▀  </Text>
    </Box>
    <Box width={1} />
    {/* U */}
    <Box flexDirection="column" alignItems="center">
      <Text color={palette.accent} bold>█  █</Text>
      <Text color={palette.accent} bold>█  █</Text>
      <Text color={palette.accent} bold>▀▀▀▀</Text>
    </Box>
    <Box width={1} />
    {/* I */}
    <Box flexDirection="column" alignItems="center">
      <Text color={palette.accent} bold>▀█▀</Text>
      <Text color={palette.accent} bold> █ </Text>
      <Text color={palette.accent} bold>▀▀▀</Text>
    </Box>
  </Box>
);
