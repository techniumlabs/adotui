import React from "react";
import { Box, Text } from "ink";
import { COMPLETION_FIELD_LABELS } from "../constants";
import type { AppState } from "../types";
import { serializeCompletionOptions } from "../utils";

type CompletionEditorProps = {
  state: AppState;
};

export const CompletionEditor: React.FC<CompletionEditorProps> = ({ state }) => {
  if (state.focus !== "completion") {
    return null;
  }

  return (
    <Box
      marginTop={1}
      borderStyle="round"
      borderColor="cyan"
      paddingX={1}
      paddingY={0}
      flexDirection="column"
    >
      <Text color="cyan">Completion Editor</Text>
      <Text color="gray">
        configured: {serializeCompletionOptions(state.completionOptions)}
      </Text>
      {COMPLETION_FIELD_LABELS.map((label, index) => {
        const isActive = index === state.completionCursor;
        const options = state.completionOptions;
        const value =
          index === 0
            ? options.mergeStrategy
            : index === 1
              ? options.deleteSourceBranch
                ? "yes"
                : "no"
              : index === 2
                ? options.transitionWorkItems
                  ? "yes"
                  : "no"
                : index === 3
                  ? options.bypassPolicy
                    ? "yes"
                    : "no"
                  : index === 4
                    ? options.bypassReason || "<type text>"
                    : index === 5
                      ? options.mergeCommitMessage || "<type text>"
                      : index === 6
                        ? options.autoCompleteIgnoreConfigIds.length > 0
                          ? options.autoCompleteIgnoreConfigIds.join(",")
                          : "<type ids>"
                        : index === 7
                          ? options.squashMerge
                            ? "yes"
                            : "no"
                          : "press enter to complete";

        return (
          <Text key={label} color={isActive ? "whiteBright" : "gray"}>
            {isActive ? ">" : " "} {label}: {value}
          </Text>
        );
      })}
      <Text color="gray">
        up/down or tab move | left/right or space toggle | type on text rows |
        enter confirm | esc cancel
      </Text>
    </Box>
  );
};
