import React from "react";
import { Box, Text } from "ink";
import { COMPLETION_FIELD_LABELS } from "../constants";
import type { AppState } from "../types";
import { glyph, palette } from "../theme";
import { serializeCompletionOptions } from "../utils";

type CompletionEditorProps = {
  state: AppState;
};

export const CompletionEditor: React.FC<CompletionEditorProps> = ({ state }) => {
  if (state.focus !== "completion") {
    return null;
  }

  const options = state.completionOptions;

  const valueFor = (index: number): string => {
    switch (index) {
      case 0:
        return options.mergeStrategy;
      case 1:
        return options.deleteSourceBranch ? "yes" : "no";
      case 2:
        return options.transitionWorkItems ? "yes" : "no";
      case 3:
        return options.bypassPolicy ? "yes" : "no";
      case 4:
        return options.bypassReason || "<type text>";
      case 5:
        return options.mergeCommitMessage || "<type text>";
      case 6:
        return options.autoCompleteIgnoreConfigIds.length > 0
          ? options.autoCompleteIgnoreConfigIds.join(",")
          : "<type ids>";
      case 7:
        return options.squashMerge ? "yes" : "no";
      default:
        return "press enter to complete";
    }
  };

  return (
    <Box
      marginTop={1}
      borderStyle="round"
      borderColor={palette.accent}
      paddingX={1}
      flexDirection="column"
    >
      <Text color={palette.accent} bold>
        {glyph.dot} Completion Editor
      </Text>
      <Text color={palette.muted}>{serializeCompletionOptions(options)}</Text>

      <Box marginTop={1} flexDirection="column">
        {COMPLETION_FIELD_LABELS.map((label, index) => {
          const isActive = index === state.completionCursor;
          const isSubmit = index === COMPLETION_FIELD_LABELS.length - 1;

          return (
            <Box key={label}>
              <Text color={isActive ? palette.accent : palette.muted}>
                {isActive ? glyph.pointer : glyph.pointerIdle}{" "}
              </Text>
              <Box width={30}>
                <Text
                  color={isActive ? palette.textBright : palette.text}
                  bold={isActive && isSubmit}
                >
                  {label}
                </Text>
              </Box>
              {!isSubmit ? (
                <Text color={isActive ? palette.accent : palette.muted}>
                  {valueFor(index)}
                </Text>
              ) : (
                <Text color={isActive ? palette.ok : palette.muted}>
                  {glyph.check} {valueFor(index)}
                </Text>
              )}
            </Box>
          );
        })}
      </Box>

      <Box marginTop={1}>
        <Text color={palette.muted}>
          ↑/↓ or tab move {glyph.bullet} ←/→ or space toggle {glyph.bullet} type
          on text rows {glyph.bullet} enter confirm {glyph.bullet} esc cancel
        </Text>
      </Box>
    </Box>
  );
};
