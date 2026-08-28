import React from "react";
import { Box, Text } from "ink";
import { glyph, palette } from "../theme";
import { KEYMAP, type KeyBinding, type KeymapSection } from "../keymap";

const isDebug = () => process.env.NODE_ENV === "debug";

const visibleBindings = (section: KeymapSection): KeyBinding[] =>
  section.bindings.filter((b) => !b.debugOnly || isDebug());

const Section: React.FC<{ section: KeymapSection }> = ({ section }) => {
  const bindings = visibleBindings(section);
  if (bindings.length === 0) return null;
  // Fixed-width key column (capped) + truncated description column keeps the
  // grid aligned — wrapped text previously bled across the column boundary.
  const keyWidth = Math.min(Math.max(...bindings.map((b) => b.keys.length)) + 2, 16);

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text bold color={palette.text}>{section.title}</Text>
      {bindings.map((binding) => (
        <Box key={binding.keys}>
          <Box width={keyWidth} flexShrink={0}>
            <Text color={palette.accent} bold>{binding.keys}</Text>
          </Box>
          <Text color={palette.text} wrap="truncate-end">{binding.description}</Text>
        </Box>
      ))}
    </Box>
  );
};

export const HelpView: React.FC = () => {
  const sections = KEYMAP
    .filter((s) => !s.debugOnly || isDebug())
    .filter((s) => visibleBindings(s).length > 0);

  // Balance the two columns by rendered row count, not section count.
  const heightOf = (s: KeymapSection) => visibleBindings(s).length + 2;
  const totalRows = sections.reduce((acc, s) => acc + heightOf(s), 0);
  const left: KeymapSection[] = [];
  const right: KeymapSection[] = [];
  let acc = 0;
  for (const section of sections) {
    if (acc < totalRows / 2) {
      left.push(section);
      acc += heightOf(section);
    } else {
      right.push(section);
    }
  }

  return (
    <Box flexDirection="column" paddingX={2} paddingY={1} flexGrow={1} borderStyle="round" borderColor={palette.accent}>
      <Box marginBottom={1}>
        <Text color={palette.accent} bold>
          {glyph.dot} ADOTUI - Help & Keyboard Shortcuts
        </Text>
      </Box>

      <Box flexDirection="row" width="100%">
        {[left, right].map((column, index) => (
          <Box key={index} flexDirection="column" width="50%" paddingRight={index === 0 ? 2 : 0}>
            {column.map((section) => (
              <Section key={section.title} section={section} />
            ))}
          </Box>
        ))}
      </Box>

      <Box justifyContent="center">
        <Text color={palette.muted}>
          Press <Text color={palette.accent} bold>?</Text> / <Text color={palette.accent} bold>Esc</Text> / <Text color={palette.accent} bold>h</Text> to return to your previous view.
        </Text>
      </Box>
    </Box>
  );
};
