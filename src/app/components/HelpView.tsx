import React from "react";
import { Box, Text } from "ink";
import { glyph, palette } from "../theme";

export const HelpView: React.FC = () => {
  return (
    <Box flexDirection="column" paddingX={2} paddingY={1} flexGrow={1} borderStyle="round" borderColor={palette.accent}>
      <Box marginBottom={1}>
        <Text color={palette.accent} bold>
          {glyph.dot} ADOTUI - Help & Keyboard Shortcuts
        </Text>
      </Box>

      <Box flexDirection="row" width="100%">
        {/* Left Column */}
        <Box flexDirection="column" width="50%" paddingRight={2}>
          <Box marginBottom={1}>
            <Text bold color={palette.text}>Global Navigation</Text>
          </Box>
          <Box flexDirection="column" marginBottom={1}>
            <Text><Text color={palette.accent} bold>Tab  </Text> Cycle focus between panes</Text>
            <Text>
              {process.env.NODE_ENV === "debug" ? (
                <>
                  <Text color={palette.accent} bold>1-4  </Text>
                  Switch to Details(1), Diff(2), Comments(3), Runs(4)
                </>
              ) : (
                <>
                  <Text color={palette.accent} bold>1-3  </Text>
                  Switch to Details(1), Diff(2), Comments(3)
                </>
              )}
            </Text>
            <Text><Text color={palette.accent} bold>?    </Text> Toggle this help screen</Text>
            <Text><Text color={palette.accent} bold>q    </Text> Quit application</Text>
            <Text><Text color={palette.accent} bold>r    </Text> Manual refresh</Text>
            <Text><Text color={palette.accent} bold>/    </Text> Enter command mode</Text>
          </Box>

          <Box marginBottom={1}>
            <Text bold color={palette.text}>Pull Request Actions (Global)</Text>
          </Box>
          <Box flexDirection="column" marginBottom={1}>
            <Text><Text color={palette.accent} bold>a    </Text> Approve PR</Text>
            <Text><Text color={palette.accent} bold>x    </Text> Reject PR (request changes)</Text>
            <Text><Text color={palette.accent} bold>b    </Text> Abandon PR</Text>
            <Text><Text color={palette.accent} bold>c    </Text> Complete & Merge PR</Text>
            <Text><Text color={palette.accent} bold>enter</Text> Open PR in default web browser (if in list)</Text>
            <Text><Text color={palette.accent} bold>o    </Text> Open PR in default web browser</Text>
          </Box>

          <Box marginBottom={1}>
            <Text bold color={palette.text}>Command Bar (`/`)</Text>
          </Box>
          <Box flexDirection="column" marginBottom={1}>
            <Text><Text color={palette.accent} bold>filter &lt;query&gt;</Text> Apply tree/list filter</Text>
            <Text><Text color={palette.accent} bold>find &lt;query&gt;  </Text> Apply wildcard filter in Files view</Text>
            <Text><Text color={palette.accent} bold>find          </Text> Clear file filter</Text>
            <Text><Text color={palette.accent} bold>help          </Text> Show command help</Text>
            <Text><Text color={palette.accent} bold>Esc           </Text> Cancel command</Text>
          </Box>
        </Box>

        {/* Right Column */}
        <Box flexDirection="column" width="50%">
          <Box marginBottom={1}>
            <Text bold color={palette.text}>Filtering Syntax (Tree & List)</Text>
          </Box>
          <Box flexDirection="column" marginBottom={1}>
            <Text><Text color={palette.accent} bold>author:&lt;name&gt;   </Text> Filter by PR author</Text>
            <Text><Text color={palette.accent} bold>title:&lt;text&gt;    </Text> Filter by PR title</Text>
            <Text><Text color={palette.accent} bold>merge:&lt;status&gt;  </Text> Filter by merge status (e.g., conflicts)</Text>
            <Text>Filters can be combined: <Text color={palette.warn}>author:john merge:conflict</Text></Text>
            <Text>Press <Text color={palette.accent} bold>v</Text> in Tree to toggle repositories with no PRs.</Text>
          </Box>

          <Box marginBottom={1}>
            <Text bold color={palette.text}>Comments View (`3`)</Text>
          </Box>
          <Box flexDirection="column" marginBottom={1}>
            <Text><Text color={palette.accent} bold>j/k  </Text> Navigate comments</Text>
            <Text><Text color={palette.accent} bold>n    </Text> Add a new thread</Text>
            <Text><Text color={palette.accent} bold>r    </Text> Reply to selected thread</Text>
            <Text><Text color={palette.accent} bold>d    </Text> Delete selected comment</Text>
          </Box>

          <Box marginBottom={1}>
            <Text bold color={palette.text}>Files View (`2`)</Text>
          </Box>
          <Box flexDirection="column" marginBottom={1}>
            <Text><Text color={palette.accent} bold>[ / ]</Text> Prev/Next file</Text>
            <Text><Text color={palette.accent} bold>PgUp/PgDn</Text> Scroll diff up/down</Text>
            <Text><Text color={palette.accent} bold>g / G</Text> Jump to top/bottom of diff</Text>
            <Text><Text color={palette.accent} bold>d    </Text> Toggle diff mode (split/unified) *if supported</Text>
          </Box>
        </Box>
      </Box>

      <Box marginTop={1} justifyContent="center">
        <Text color={palette.muted}>Press <Text color={palette.accent} bold>?</Text> or <Text color={palette.accent} bold>Esc</Text> to return to your previous view.</Text>
      </Box>
    </Box>
  );
};
