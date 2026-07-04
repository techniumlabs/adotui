import React, { useEffect, useState } from "react";
import { Box, Text } from "ink";
import Spinner from "ink-spinner";
import { palette } from "../theme";

const ASCII_LOGO = [
  "█▀▀█ █▀▀▄ █▀▀█ ▀▀█▀▀ █  █ ▀█▀",
  "█▄▄█ █  █ █  █   █   █  █  █ ",
  "▀  ▀ ▀▀▀  ▀▀▀▀   ▀   ▀▀▀▀ ▀▀▀",
];

const LOGO_ROWS = ASCII_LOGO.map((line) => Array.from(line));
const LOGO_WIDTH = Math.max(...LOGO_ROWS.map((row) => row.length));

// A highlight glints across the mark column by column, then rests briefly
// before sweeping again — a quiet, continuous "scanning" cue rather than a
// static two-tone fill.
const SWEEP_SPEED_MS = 90;
const SWEEP_PAUSE_FRAMES = 8;
const SWEEP_CYCLE = LOGO_WIDTH + SWEEP_PAUSE_FRAMES;

interface SplashProps {
  /** Status line shown beneath the mark while the app boots. */
  label?: string;
}

export const Splash: React.FC<SplashProps> = ({
  label = "Initializing Azure DevOps TUI...",
}) => {
  const [sweep, setSweep] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setSweep((s) => (s + 1) % SWEEP_CYCLE);
    }, SWEEP_SPEED_MS);
    return () => clearInterval(id);
  }, []);

  const charStyle = (charIdx: number): { color: string; bold: boolean } => {
    const distance = sweep < LOGO_WIDTH ? Math.abs(charIdx - sweep) : Infinity;
    if (distance === 0) return { color: palette.textBright, bold: true };
    if (distance === 1) return { color: palette.textBright, bold: false };
    return { color: palette.accent, bold: true };
  };

  return (
    <Box
      flexDirection="column"
      flexGrow={1}
      justifyContent="center"
      alignItems="center"
      minHeight={20}
    >
      <Box
        flexDirection="column"
        alignItems="center"
        borderStyle="round"
        borderColor={palette.muted}
        paddingX={3}
        paddingY={1}
      >
        {LOGO_ROWS.map((row, lineIdx) => (
          <Box key={lineIdx} flexDirection="row">
            {row.map((char, charIdx) => {
              const { color, bold } = charStyle(charIdx);
              return (
                <Text key={charIdx} color={color} bold={bold}>
                  {char}
                </Text>
              );
            })}
          </Box>
        ))}
        <Box marginTop={1}>
          <Text color={palette.muted}>
            <Spinner type="dots" /> {label}
          </Text>
        </Box>
      </Box>
    </Box>
  );
};