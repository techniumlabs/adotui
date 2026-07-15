import React, { useState, useEffect } from "react";
import { Box, Text, useInput } from "ink";
import Spinner from "ink-spinner";
import { ProgressBar } from "@inkjs/ui";
import { palette, glyph, truncate } from "../theme";
import { writeConfig, loadConfig } from "../../data/config";
import type { AdoProjectConfig } from "../../data/config";

interface SetupScreenProps {
  onComplete: () => void;
  /** True while the load kicked off by "Save & Load Configuration" is running. */
  loading?: boolean;
  /** Current progress message from the loader (e.g. which project is fetching). */
  loadingMessage?: string;
  /** Projects fetched so far out of the total, once discovery has resolved. */
  progress?: { current: number; total: number } | null;
}

type ScreenMode = "list" | "add" | "pat" | "help";
type AddField = "org" | "project" | "repos" | "submit" | "cancel";
type PatField = "input" | "submit" | "cancel";

interface SetupMenuItem {
  type: "project" | "add" | "pat" | "save" | "exit" | "help";
  projectIndex?: number;
  label: string;
}

const addFields: AddField[] = ["org", "project", "repos", "submit", "cancel"];
const patFields: PatField[] = ["input", "submit", "cancel"];

export const SetupScreen: React.FC<SetupScreenProps> = ({
  onComplete,
  loading = false,
  loadingMessage,
  progress,
}) => {
  const [mode, setMode] = useState<ScreenMode>("list");
  const [projects, setProjects] = useState<AdoProjectConfig[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Form Fields State
  const [org, setOrg] = useState("");
  const [project, setProject] = useState("");
  const [repos, setRepos] = useState("");
  const [addActiveField, setAddActiveField] = useState<AddField>("org");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  // PAT Token State
  const [pat, setPat] = useState("");
  const [patActiveField, setPatActiveField] = useState<PatField>("input");

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const fetchExistingConfig = async () => {
      const res = await loadConfig();
      if (res.ok) {
        if (res.config.projects) {
          setProjects(res.config.projects);
        }
        if (res.config.pat) {
          setPat(res.config.pat);
        }
      }
    };
    void fetchExistingConfig();
  }, []);

  // Build list of menu items dynamically
  const menuItems: SetupMenuItem[] = [];
  projects.forEach((proj, idx) => {
    menuItems.push({
      type: "project",
      projectIndex: idx,
      label: `${proj.project || "All Projects"} (${proj.organization})`,
    });
  });
  menuItems.push({ type: "add", label: "+ Add New Project" });
  menuItems.push({
    type: "pat",
    label: `🔑 Configure PAT Token (optional)${pat ? ` [Set: ...${pat.slice(-4)}]` : ""}`,
  });
  menuItems.push({ type: "help", label: "❓ Keyboard & CLI Help" });
  if (projects.length > 0) {
    menuItems.push({ type: "save", label: "✓ Save & Load Configuration" });
  }
  menuItems.push({ type: "exit", label: "✗ Exit ADOTUI" });

  useInput(
    (input, key) => {
      // Global Ctrl+C handler
      if (key.ctrl && input === "c") {
        process.exit(0);
      }

      if (isSubmitting || loading) return;

      if (mode === "help") {
        setMode("list");
        setError(null);
        return;
      }

      if (mode === "list") {
        // Navigation in the list of items
        if (key.downArrow || key.tab) {
          setSelectedIndex((prev) => (prev + 1) % menuItems.length);
          setError(null);
          return;
        }
        if (key.upArrow || (key.shift && key.tab)) {
          setSelectedIndex((prev) => (prev - 1 + menuItems.length) % menuItems.length);
          setError(null);
          return;
        }

        const currentItem = menuItems[selectedIndex];

        // Selection
        if (key.return) {
          if (!currentItem) return;
          if (currentItem.type === "add") {
            setMode("add");
            setOrg("");
            setProject("");
            setRepos("");
            setEditingIndex(null);
            setAddActiveField("org");
            setError(null);
          } else if (currentItem.type === "project") {
            const idx = currentItem.projectIndex!;
            const proj = projects[idx]!;
            setOrg(proj.organization);
            setProject(proj.project || "");
            setRepos(proj.repositories?.join(", ") || "");
            setEditingIndex(idx);
            setMode("add");
            setAddActiveField("org");
            setError(null);
          } else if (currentItem.type === "pat") {
            setMode("pat");
            setPatActiveField("input");
            setError(null);
          } else if (currentItem.type === "help") {
            setMode("help");
            setError(null);
          } else if (currentItem.type === "save") {
            void handleSubmit();
          } else if (currentItem.type === "exit") {
            process.exit(0);
          }
          return;
        }

        // Delete/remove project
        if (key.backspace || key.delete) {
          if (
            currentItem &&
            currentItem.type === "project" &&
            currentItem.projectIndex !== undefined
          ) {
            const idxToRemove = currentItem.projectIndex;
            setProjects((prev) => {
              const copy = [...prev];
              copy.splice(idxToRemove, 1);
              return copy;
            });
            // Ensure selectedIndex is valid for the smaller list
            setSelectedIndex((prev) => {
              const nextLength = menuItems.length - 1;
              if (nextLength <= 0) return 0;
              return Math.min(prev, nextLength - 1);
            });
            setError(null);
          }
          return;
        }
      }

      if (mode === "add") {
        // Form field navigation
        if (key.downArrow || key.tab) {
          setAddActiveField((current) => {
            const idx = addFields.indexOf(current);
            return addFields[(idx + 1) % addFields.length]!;
          });
          setError(null);
          return;
        }
        if (key.upArrow || (key.shift && key.tab)) {
          setAddActiveField((current) => {
            const idx = addFields.indexOf(current);
            return addFields[(idx - 1 + addFields.length) % addFields.length]!;
          });
          setError(null);
          return;
        }

        // Return / Advance fields
        if (key.return) {
          if (addActiveField === "org") {
            setAddActiveField("project");
          } else if (addActiveField === "project") {
            setAddActiveField("repos");
          } else if (addActiveField === "repos") {
            setAddActiveField("submit");
          } else if (addActiveField === "submit") {
            handleAddProject();
          } else if (addActiveField === "cancel") {
            setMode("list");
            setSelectedIndex(0);
            setEditingIndex(null);
            setError(null);
          }
          return;
        }

        // Keyboard Typing Logic
        if (addActiveField === "org") {
          if (key.backspace || key.delete) {
            setOrg((o) => o.slice(0, -1));
          } else if (!key.ctrl && !key.meta && input) {
            setOrg((o) => o + input);
          }
        } else if (addActiveField === "project") {
          if (key.backspace || key.delete) {
            setProject((p) => p.slice(0, -1));
          } else if (!key.ctrl && !key.meta && input) {
            setProject((p) => p + input);
          }
        } else if (addActiveField === "repos") {
          if (key.backspace || key.delete) {
            setRepos((r) => r.slice(0, -1));
          } else if (!key.ctrl && !key.meta && input) {
            setRepos((r) => r + input);
          }
        }
      }

      if (mode === "pat") {
        // Form field navigation
        if (key.downArrow || key.tab) {
          setPatActiveField((current) => {
            const idx = patFields.indexOf(current);
            return patFields[(idx + 1) % patFields.length]!;
          });
          setError(null);
          return;
        }
        if (key.upArrow || (key.shift && key.tab)) {
          setPatActiveField((current) => {
            const idx = patFields.indexOf(current);
            return patFields[(idx - 1 + patFields.length) % patFields.length]!;
          });
          setError(null);
          return;
        }

        // Return / Advance fields
        if (key.return) {
          if (patActiveField === "input") {
            setPatActiveField("submit");
          } else if (patActiveField === "submit") {
            setMode("list");
            setSelectedIndex(0);
            setError(null);
          } else if (patActiveField === "cancel") {
            setMode("list");
            setSelectedIndex(0);
            setError(null);
          }
          return;
        }

        // Keyboard Typing Logic
        if (patActiveField === "input") {
          if (key.backspace || key.delete) {
            setPat((p) => p.slice(0, -1));
          } else if (!key.ctrl && !key.meta && input) {
            setPat((p) => p + input);
          }
        }
      }
    },
    { isActive: true }
  );

  const handleAddProject = () => {
    const trimmedOrg = org.trim();
    const trimmedProject = project.trim();
    const trimmedRepos = repos.trim();

    if (!trimmedOrg) {
      setError("Organization URL cannot be empty.");
      setAddActiveField("org");
      return;
    }
    if (!trimmedOrg.startsWith("http://") && !trimmedOrg.startsWith("https://")) {
      setError("Organization URL must start with http:// or https://");
      setAddActiveField("org");
      return;
    }

    const reposList = trimmedRepos
      ? trimmedRepos
          .split(",")
          .map((r) => r.trim())
          .filter(Boolean)
      : undefined;

    setProjects((prev) => {
      const updated = {
        organization: trimmedOrg,
        ...(trimmedProject ? { project: trimmedProject } : {}),
        ...(reposList && reposList.length > 0 ? { repositories: reposList } : {}),
      };
      if (editingIndex !== null) {
        const copy = [...prev];
        copy[editingIndex] = updated;
        return copy;
      }
      return [...prev, updated];
    });

    setEditingIndex(null);
    setMode("list");
    setSelectedIndex(0);
    setError(null);
  };

  const handleSubmit = async () => {
    if (projects.length === 0) {
      setError("Please configure at least one project before saving.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await writeConfig({
        status: "active",
        top: 50,
        projects,
        ...(pat.trim() ? { pat: pat.trim() } : {}),
      });
      delete process.env.ADOTUI_FORCE_SETUP;
      onComplete();
    } catch (e) {
      setIsSubmitting(false);
      setError(e instanceof Error ? e.message : "Failed to save configuration.");
    }
  };

  const renderListMode = () => {
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

  const renderAddMode = () => {
    return (
      <Box flexDirection="column" width={60}>
        <Box justifyContent="center" marginBottom={1}>
          <Text color={palette.accent} bold>
            {editingIndex !== null ? "✏ EDIT PROJECT" : `${glyph.added} ADD NEW PROJECT`}
          </Text>
        </Box>

        {/* Organization URL Field */}
        <Box flexDirection="column" marginBottom={1}>
          <Text color={addActiveField === "org" ? palette.accent : palette.text} bold>
            {addActiveField === "org" ? `${glyph.pointer} ` : "  "}Organization URL:
          </Text>
          <Box
            borderStyle="single"
            borderColor={addActiveField === "org" ? palette.accent : palette.border}
            paddingX={1}
          >
            <Text color={org ? palette.textBright : palette.muted}>
              {addActiveField === "org" ? (
                org ? (
                  <>
                    {org}
                    <Text color={palette.accent}>▌</Text>
                  </>
                ) : (
                  <>
                    <Text color={palette.accent}>▌</Text>
                    <Text color={palette.muted}>https://dev.azure.com/organization</Text>
                  </>
                )
              ) : (
                org || "https://dev.azure.com/organization"
              )}
            </Text>
          </Box>
        </Box>

        {/* Project Name Field */}
        <Box flexDirection="column" marginBottom={1}>
          <Text color={addActiveField === "project" ? palette.accent : palette.text} bold>
            {addActiveField === "project" ? `${glyph.pointer} ` : "  "}Project Name (optional):
          </Text>
          <Box
            borderStyle="single"
            borderColor={addActiveField === "project" ? palette.accent : palette.border}
            paddingX={1}
          >
            <Text color={project ? palette.textBright : palette.muted}>
              {addActiveField === "project" ? (
                project ? (
                  <>
                    {project}
                    <Text color={palette.accent}>▌</Text>
                  </>
                ) : (
                  <>
                    <Text color={palette.accent}>▌</Text>
                    <Text color={palette.muted}>All Projects</Text>
                  </>
                )
              ) : (
                project || "All Projects"
              )}
            </Text>
          </Box>
        </Box>

        {/* Repositories Field */}
        <Box flexDirection="column" marginBottom={1}>
          <Text color={addActiveField === "repos" ? palette.accent : palette.text} bold>
            {addActiveField === "repos" ? `${glyph.pointer} ` : "  "}Repositories (Optional, comma-separated):
          </Text>
          <Box
            borderStyle="single"
            borderColor={addActiveField === "repos" ? palette.accent : palette.border}
            paddingX={1}
          >
            <Text color={repos ? palette.textBright : palette.muted}>
              {addActiveField === "repos" ? (
                repos ? (
                  <>
                    {repos}
                    <Text color={palette.accent}>▌</Text>
                  </>
                ) : (
                  <>
                    <Text color={palette.accent}>▌</Text>
                    <Text color={palette.muted}>repo1, repo2 (leave empty for all repos)</Text>
                  </>
                )
              ) : (
                repos || "All repositories"
              )}
            </Text>
          </Box>
        </Box>

        {/* Submit / Cancel Buttons */}
        <Box justifyContent="center" marginTop={1} gap={3}>
          <Box>
            <Text
              color={addActiveField === "submit" ? palette.textBright : palette.muted}
              bold={addActiveField === "submit"}
              inverse={addActiveField === "submit"}
            >
              {"  "}[ {editingIndex !== null ? "Save Changes" : "Add Project"} ]{"  "}
            </Text>
          </Box>
          <Box>
            <Text
              color={addActiveField === "cancel" ? palette.textBright : palette.muted}
              bold={addActiveField === "cancel"}
              inverse={addActiveField === "cancel"}
            >
              {"  "}[ Cancel ]{"  "}
            </Text>
          </Box>
        </Box>
      </Box>
    );
  };

  const renderPatMode = () => {
    return (
      <Box flexDirection="column" width={60}>
        <Box justifyContent="center" marginBottom={1}>
          <Text color={palette.accent} bold>
            🔑 CONFIGURE PAT TOKEN
          </Text>
        </Box>

        <Box marginBottom={1} justifyContent="center">
          <Text color={palette.muted}>
            Optional token used for Azure DevOps authentication.
          </Text>
        </Box>

        {/* PAT Input Field */}
        <Box flexDirection="column" marginBottom={1}>
          <Text color={patActiveField === "input" ? palette.accent : palette.text} bold>
            {patActiveField === "input" ? `${glyph.pointer} ` : "  "}Personal Access Token (PAT):
          </Text>
          <Box
            borderStyle="single"
            borderColor={patActiveField === "input" ? palette.accent : palette.border}
            paddingX={1}
          >
            <Text color={pat ? palette.textBright : palette.muted}>
              {patActiveField === "input" ? (
                pat ? (
                  <>
                    {pat}
                    <Text color={palette.accent}>▌</Text>
                  </>
                ) : (
                  <>
                    <Text color={palette.accent}>▌</Text>
                    <Text color={palette.muted}>Enter token value (leave empty if not needed)</Text>
                  </>
                )
              ) : (
                pat ? "••••••••" + pat.slice(-4) : "Not configured"
              )}
            </Text>
          </Box>
        </Box>

        {/* Save / Cancel Buttons */}
        <Box justifyContent="center" marginTop={1} gap={3}>
          <Box>
            <Text
              color={patActiveField === "submit" ? palette.textBright : palette.muted}
              bold={patActiveField === "submit"}
              inverse={patActiveField === "submit"}
            >
              {"  "}[ Save Token ]{"  "}
            </Text>
          </Box>
          <Box>
            <Text
              color={patActiveField === "cancel" ? palette.textBright : palette.muted}
              bold={patActiveField === "cancel"}
              inverse={patActiveField === "cancel"}
            >
              {"  "}[ Cancel ]{"  "}
            </Text>
          </Box>
        </Box>
      </Box>
    );
  };

  const renderHelpMode = () => {
    return (
      <Box flexDirection="column" width={60}>
        <Box justifyContent="center" marginBottom={1}>
          <Text color={palette.accent} bold>
            ❓ HELP & KEYBOARD SHORTCUTS
          </Text>
        </Box>

        <Box
          flexDirection="column"
          borderStyle="single"
          borderColor={palette.border}
          paddingX={2}
          paddingY={1}
          marginBottom={1}
        >
          <Box flexDirection="row" marginBottom={1}>
            <Text color={palette.accent} bold>Navigation : </Text>
            <Text color={palette.text}>Tab / Shift+Tab or Arrow keys</Text>
          </Box>
          <Box flexDirection="row" marginBottom={1}>
            <Text color={palette.accent} bold>Select/Edit: </Text>
            <Text color={palette.text}>Enter (on menu items or form fields)</Text>
          </Box>
          <Box flexDirection="row" marginBottom={1}>
            <Text color={palette.accent} bold>Delete Proj: </Text>
            <Text color={palette.text}>Delete or Backspace (in List mode)</Text>
          </Box>
          <Box flexDirection="row" marginBottom={1}>
            <Text color={palette.accent} bold>Text Input : </Text>
            <Text color={palette.text}>Type characters directly; Backspace to erase</Text>
          </Box>
          <Box flexDirection="row">
            <Text color={palette.accent} bold>Quit Wizard: </Text>
            <Text color={palette.text}>Ctrl+C (any time)</Text>
          </Box>
        </Box>

        <Box flexDirection="column" alignItems="center" marginTop={1}>
          <Text color={palette.textBright} inverse>  Press any key to return  </Text>
        </Box>
      </Box>
    );
  };

  const renderLoadingMode = () => {
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
            <Spinner type="dots" />{" "}
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

  // Helper to build instructions for footer dynamically
  const getInstructions = () => {
    if (loading) {
      return "Loading project data — please wait";
    }
    if (mode === "help") {
      return "Press any key to return to the menu";
    }
    if (mode === "list") {
      const currentItem = menuItems[selectedIndex];
      if (currentItem && currentItem.type === "project") {
        return "Press Tab/Arrows to navigate · Delete/Backspace to remove project · Enter to edit project · Ctrl+C to quit";
      }
      return "Press Tab/Arrows to navigate · Enter to select · Ctrl+C to quit";
    }
    return "Press Tab/Arrows to navigate · Enter to advance/select · Ctrl+C to quit";
  };

  const renderContent = () => {
    if (loading) return renderLoadingMode();
    if (mode === "list") return renderListMode();
    if (mode === "add") return renderAddMode();
    if (mode === "help") return renderHelpMode();
    return renderPatMode();
  };

  return (
    <Box
      flexDirection="column"
      flexGrow={1}
      justifyContent="center"
      alignItems="center"
      minHeight={26}
    >
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor={palette.accent}
        paddingX={4}
        paddingY={1}
        width={70}
      >
        {/* ADOTUI ASCII Logo */}
        <Box flexDirection="row" justifyContent="center" marginBottom={1}>
          {/* A */}
          <Box flexDirection="column" alignItems="center">
            <Text color={palette.accent} bold>█▀▀█</Text>
            <Text color={palette.accent} bold>█▄▄█</Text>
            <Text color={palette.accent} bold>▀  ▀</Text>
          </Box>
          <Box width={1} />
          {/* D */}
          <Box flexDirection="column" alignItems="center">
            <Text color={palette.accent} bold>█▀▀▄</Text>
            <Text color={palette.accent} bold>█  █</Text>
            <Text color={palette.accent} bold>▀▀▀ </Text>
          </Box>
          <Box width={1} />
          {/* O */}
          <Box flexDirection="column" alignItems="center">
            <Text color={palette.accent} bold>█▀▀█</Text>
            <Text color={palette.accent} bold>█  █</Text>
            <Text color={palette.accent} bold>▀▀▀▀</Text>
          </Box>
          <Box width={1} />
          {/* T */}
          <Box flexDirection="column" alignItems="center">
            <Text color={palette.accent} bold>▀▀█▀▀</Text>
            <Text color={palette.accent} bold>  █  </Text>
            <Text color={palette.accent} bold>  ▀  </Text>
          </Box>
          <Box width={1} />
          {/* U */}
          <Box flexDirection="column" alignItems="center">
            <Text color={palette.accent} bold>█  █</Text>
            <Text color={palette.accent} bold>█  █</Text>
            <Text color={palette.accent} bold>▀▀▀▀</Text>
          </Box>
          <Box width={1} />
          {/* I */}
          <Box flexDirection="column" alignItems="center">
            <Text color={palette.accent} bold>▀█▀</Text>
            <Text color={palette.accent} bold> █ </Text>
            <Text color={palette.accent} bold>▀▀▀</Text>
          </Box>
        </Box>

        {renderContent()}

        {/* Error message */}
        {error && (
          <Box justifyContent="center" marginTop={1}>
            <Text color={palette.danger}>{error}</Text>
          </Box>
        )}

        {/* Submitting state */}
        {isSubmitting && !loading && (
          <Box justifyContent="center" marginTop={1}>
            <Text color={palette.ok}>Creating config file and loading...</Text>
          </Box>
        )}

        {/* Exit footer */}
        <Box
          justifyContent="center"
          marginTop={1}
          borderStyle="single"
          borderTop={true}
          borderBottom={false}
          borderLeft={false}
          borderRight={false}
          borderColor={palette.border}
        >
          <Text color={palette.muted}>{getInstructions()}</Text>
        </Box>
      </Box>
    </Box>
  );
};
