import React, { useEffect, useState } from "react";
import { Box, Text, useInput } from "ink";
import { palette } from "../theme";
import { writeConfig, loadConfig } from "../../data/config";
import type { AdoProjectConfig } from "../../data/config";
import { AsciiLogo } from "./setup/AsciiLogo";
import { SetupListMenu, type SetupMenuItem } from "./setup/SetupListMenu";
import { AddProjectForm } from "./setup/AddProjectForm";
import { PatForm } from "./setup/PatForm";
import { SetupHelp } from "./setup/SetupHelp";
import { SetupLoading } from "./setup/SetupLoading";

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

/**
 * Setup wizard orchestrator: owns the shared wizard state (projects, PAT,
 * mode, error) and delegates each mode's rendering and key handling to a
 * dedicated component under ./setup/.
 */
export const SetupScreen: React.FC<SetupScreenProps> = ({
  onComplete,
  loading = false,
  loadingMessage,
  progress,
}) => {
  const [mode, setMode] = useState<ScreenMode>("list");
  const [projects, setProjects] = useState<AdoProjectConfig[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [pat, setPat] = useState("");
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

  // Ctrl+C always exits, even while submitting or loading.
  useInput((input, key) => {
    if (key.ctrl && input === "c") {
      process.exit(0);
    }
  }, { isActive: true });

  const suspended = isSubmitting || loading;

  const returnToList = () => {
    setMode("list");
    setSelectedIndex(0);
    setEditingIndex(null);
    setError(null);
  };

  const handleActivate = (item: SetupMenuItem) => {
    if (item.type === "add") {
      setEditingIndex(null);
      setMode("add");
      setError(null);
    } else if (item.type === "project") {
      setEditingIndex(item.projectIndex!);
      setMode("add");
      setError(null);
    } else if (item.type === "pat") {
      setMode("pat");
      setError(null);
    } else if (item.type === "help") {
      setMode("help");
      setError(null);
    } else if (item.type === "save") {
      void handleSubmit();
    } else if (item.type === "exit") {
      process.exit(0);
    }
  };

  const handleDeleteProject = (idxToRemove: number) => {
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
  };

  const handleAddSubmit = (updated: AdoProjectConfig) => {
    setProjects((prev) => {
      if (editingIndex !== null) {
        const copy = [...prev];
        copy[editingIndex] = updated;
        return copy;
      }
      return [...prev, updated];
    });
    returnToList();
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

  const editingProject = editingIndex !== null ? projects[editingIndex] : undefined;

  const renderContent = () => {
    if (loading) {
      return <SetupLoading loadingMessage={loadingMessage} progress={progress} />;
    }
    if (mode === "list") {
      return (
        <SetupListMenu
          projects={projects}
          menuItems={menuItems}
          selectedIndex={selectedIndex}
          onSelectedIndexChange={setSelectedIndex}
          onActivate={handleActivate}
          onDeleteProject={handleDeleteProject}
          onInteract={() => setError(null)}
          disabled={suspended}
        />
      );
    }
    if (mode === "add") {
      return (
        <AddProjectForm
          key={editingIndex ?? -1}
          initial={
            editingProject
              ? {
                  organization: editingProject.organization,
                  project: editingProject.project ?? "",
                  repositories: editingProject.repositories?.join(", ") ?? "",
                }
              : undefined
          }
          editing={editingIndex !== null}
          onSubmit={handleAddSubmit}
          onCancel={returnToList}
          onError={setError}
          disabled={suspended}
        />
      );
    }
    if (mode === "help") {
      return <SetupHelp onDone={() => { setMode("list"); setError(null); }} disabled={suspended} />;
    }
    return (
      <PatForm
        pat={pat}
        onChangePat={setPat}
        onDone={returnToList}
        onError={setError}
        disabled={suspended}
      />
    );
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
        <AsciiLogo />

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
