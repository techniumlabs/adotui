import React from "react";
import { Box, Text, useInput } from "ink";
import { glyph, palette } from "../../theme";
import type { AdoProjectConfig } from "../../../data/config";

export interface SetupMenuItem {
  type: "project" | "add" | "pat" | "save" | "exit" | "help";
  projectIndex?: number;
  label: string;
}

type SetupListMenuProps = {
  projects: AdoProjectConfig[];
  menuItems: SetupMenuItem[];
  selectedIndex: number;
  onSelectedIndexChange: (index: number) => void;
  onActivate: (item: SetupMenuItem) => void;
  onDeleteProject: (projectIndex: number) => void;
  /** Called on every navigation step (clears the wizard error banner). */
  onInteract: () => void;
  disabled?: boolean;
};

/** List mode of the setup wizard: configured projects panel + action menu. */
export const SetupListMenu: React.FC<SetupListMenuProps> = ({
  projects,
  menuItems,
  selectedIndex,
  onSelectedIndexChange,
  onActivate,
  onDeleteProject,
  onInteract,
  disabled = false,
}) => {
  useInput(
    (input, key) => {
      if (key.downArrow || key.tab) {
        onSelectedIndexChange((selectedIndex + 1) % menuItems.length);
        onInteract();
        return;
      }
      if (key.upArrow || (key.shift && key.tab)) {
        onSelectedIndexChange((selectedIndex - 1 + menuItems.length) % menuItems.length);
        onInteract();
        return;
      }

      const currentItem = menuItems[selectedIndex];

      if (key.return) {
        if (!currentItem) return;
        onActivate(currentItem);
        return;
      }

      if (key.backspace || key.delete) {
        if (
          currentItem &&
          currentItem.type === "project" &&
          currentItem.projectIndex !== undefined
        ) {
          onDeleteProject(currentItem.projectIndex);
        }
        return;
      }
    },
    { isActive: !disabled },
  );

  return (
    <Box flexDirection="column" width={60}>
      <Box justifyContent="center" marginBottom={1}>
        <Text color={palette.accent} bold>
          {glyph.dot} ADOTUI INITIAL SETUP
        </Text>
      </Box>

      <Box marginBottom={1} justifyContent="center">
        <Text color={palette.muted}>
          Configure Azure DevOps projects to monitor.
        </Text>
      </Box>

      {/* Configured Projects Panel */}
      <Box
        flexDirection="column"
        borderStyle="single"
        borderColor={palette.border}
        paddingX={1}
        marginBottom={1}
      >
        <Text bold color={palette.accentDim}>
          Configured Projects ({projects.length})
        </Text>
        {projects.length === 0 ? (
          <Text color={palette.muted} italic>
            No projects configured. Use '+ Add New Project' below.
          </Text>
        ) : (
          projects.map((proj, idx) => {
            const isSelected = selectedIndex === idx;
            return (
              <Box key={idx} flexDirection="column" marginTop={idx > 0 ? 1 : 0}>
                <Text color={isSelected ? palette.textBright : palette.text}>
                  {isSelected ? `${glyph.pointer} ` : "  "}
                  <Text color={palette.accent} bold>
                    {proj.project || "All Projects"}
                  </Text>{" "}
                  ({proj.organization})
                </Text>
                {proj.repositories && (
                  <Text color={palette.muted}>
                    {"    "}Repos: {proj.repositories.join(", ")}
                  </Text>
                )}
              </Box>
            );
          })
        )}
      </Box>

      {/* Menu Options */}
      <Box flexDirection="column" marginTop={1}>
        {menuItems.map((item, idx) => {
          if (item.type === "project") return null;

          const isSelected = selectedIndex === idx;
          return (
            <Box key={item.type} justifyContent="center" marginBottom={1}>
              <Text
                color={isSelected ? palette.textBright : palette.muted}
                bold={isSelected}
                inverse={isSelected}
              >
                {`  ${item.label}  `}
              </Text>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};
