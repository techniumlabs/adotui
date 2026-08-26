import React from "react";
import { Box, Text } from "ink";
import { palette } from "../theme";
import type { LoadProgress } from "../../data/azure";

/**
 * Bottom-line loader (Claude Code style star pulse). The star advances with
 * REAL progress events rather than a timer: Ink rewrites every line of the
 * frame on each render, so a timer-driven animation would repaint the whole
 * screen at animation speed — which reads as blinking. Progress-driven
 * animation adds zero extra repaints: the frame only redraws when there is
 * genuinely new information, and holds perfectly still otherwise.
 */
const FRAMES = ["\u2722", "\u2733", "\u2736", "\u273b", "\u273d", "\u273b", "\u2736", "\u2733"];

interface StatusLoaderProps {
  message: string;
  progress?: LoadProgress | null;
}

export const StatusLoader: React.FC<StatusLoaderProps> = ({ message, progress }) => {
  const tickRef = React.useRef(0);
  const lastKeyRef = React.useRef("");
  const startedAtRef = React.useRef(Date.now());

  const key = `${message}|${progress?.current ?? 0}`;
  if (key !== lastKeyRef.current) {
    lastKeyRef.current = key;
    tickRef.current += 1;
  }
  const frame = FRAMES[tickRef.current % FRAMES.length];
  const elapsed = Math.floor((Date.now() - startedAtRef.current) / 1000);
  const counter = progress
    ? `${progress.current}/${progress.total} \u00b7 ${elapsed}s`
    : `${elapsed}s`;

  return (
    <Box
      flexShrink={0}
      borderStyle="single"
      borderTop={true}
      borderLeft={false}
      borderRight={false}
      borderBottom={false}
      borderColor={palette.border}
      paddingX={2}
    >
      <Text color={palette.accent} bold>
        {frame}{" "}
      </Text>
      <Text color={palette.text} wrap="truncate-end">
        {message}{" "}
      </Text>
      <Text color={palette.muted}>({counter})</Text>
    </Box>
  );
};
