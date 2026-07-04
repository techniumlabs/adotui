import React, { useEffect, useState } from "react";
import { Box, Text } from "ink";
import Spinner from "ink-spinner";
import { palette } from "../theme";

const ASCII_LOGO = [
  "█▀▀█ █▀▀▄ █▀▀█ ▀▀█▀▀ █  █ ▀█▀",
  "█▄▄█ █  █ █  █   █   █  █  █ ",
  "▀  ▀ ▀▀▀  ▀▀▀▀   ▀   ▀▀▀▀ ▀▀▀",
];

const getLogoColor = (index: number) => {
  return index < 14 ? palette.accent : palette.textBright;
};

export const Splash: React.FC = () => {

  return (
    <Box
      flexDirection="column"
      flexGrow={1}
      justifyContent="center"
      alignItems="center"
      minHeight={20}
    >
      <Box flexDirection="column" alignItems="center">
        {ASCII_LOGO.map((line, lineIdx) => (
          <Box key={lineIdx} flexDirection="row">
            {Array.from(line).map((char, charIdx) => (
              <Text key={charIdx} color={getLogoColor(charIdx)} bold>
                {char}
              </Text>
            ))}
          </Box>
        ))}
        <Box marginTop={1}>
          <Text color={palette.muted}>
            <Spinner type="dots" /> Initializing Azure DevOps TUI...
          </Text>
        </Box>
      </Box>
    </Box>
  );
};
