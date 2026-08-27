import React from "react";
import { Box, Text } from "ink";
import { glyph, palette } from "../theme";
import { KEYMAP, type KeymapSection } from "../keymap";

const Section: React.FC<{ section: KeymapSection }> = ({ section }) => {
  const debug = process.env.NODE_ENV === "debug";
  const bindings = section.bindings.filter((b) => !b.debugOnly || debug);
  if (bindings.length === 0) return null;
  const keyWidth = Math.max(...bindings.map((b) => b.keys.length)) + 2;

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text bold color={palette.text}>{section.title}</Text>
      {bindings.map((binding) => (
        <Text key={binding.keys}>
          <Text color={palette.accent} bold>{binding.keys.padEnd(keyWidth)}</Text>
          {binding.description}
        </Text>
      ))}
    </Box>
  );
};

export const HelpView: React.FC = () => {
  const debug = process.env.NODE_ENV === "debug";
  const sections = KEYMAP.filter((s) => !s.debugOnly || debug);
  const half = Math.ceil(sections.length / 2);
  const columns = [sections.slice(0, half), sections.slice(half)];

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1} flexGrow={1} borderStyle="round" borderColor={palette.accent}>
      <Box marginBottom={1}>
        <Text color={palette.accent} bold>
          {glyph.dot} ADOTUI - Help & Keyboard Shortcuts
        </Text>
      </Box>

      <Box flexDirection="row" width="100%">
        {columns.map((column, index) => (
          <Box key={index} flexDirection="column" width="50%" paddingRight={index === 0 ? 2 : 0}>
            {column.map((section) => (
              <Section key={section.title} section={section} />
            ))}
          </Box>
        ))}
      </Box>

      <Box marginTop={1} justifyContent="center">
        <Text color={palette.muted}>
          Press <Text color={palette.accent} bold>?</Text> or <Text color={palette.accent} bold>Esc</Text> to return to your previous view.
        </Text>
      </Box>
    </Box>
  );
};
