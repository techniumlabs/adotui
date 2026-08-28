import React from "react";
import { Box, Text } from "ink";
import { ProgressBar } from "@inkjs/ui";
import { glyph, palette, truncate } from "../../theme";

type SetupLoadingProps = {
  loadingMessage?: string;
  progress?: { current: number; total: number } | null;
};

/** Progress panel shown while the setup-initiated data load is running. */
export const SetupLoading: React.FC<SetupLoadingProps> = ({ loadingMessage, progress }) => {
  const pct =
    progress && progress.total > 0
      ? Math.round((progress.current / progress.total) * 100)
      : null;
  return (
    <Box flexDirection="column" marginTop={1}>
      <Box justifyContent="center" marginBottom={1}>
        <Text color={palette.accent} bold>
          LOADING PROJECT DATA
        </Text>
      </Box>
      <Box justifyContent="center" marginBottom={1}>
        <Text color={palette.muted}>
          {glyph.clock}{" "}
          {truncate(loadingMessage ?? "Connecting to Azure DevOps...", 56)}
        </Text>
      </Box>
      {pct !== null && progress ? (
        <Box flexDirection="row" gap={1} alignItems="center">
          <Box flexGrow={1}>
            <ProgressBar value={pct} />
          </Box>
          <Text color={palette.text}>
            {progress.current}/{progress.total} projects
          </Text>
        </Box>
      ) : (
        <Box justifyContent="center">
          <Text color={palette.muted}>Discovering projects...</Text>
        </Box>
      )}
    </Box>
  );
};
