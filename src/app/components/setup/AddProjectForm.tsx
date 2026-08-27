import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import { glyph, palette } from "../../theme";
import type { AdoProjectConfig } from "../../../data/config";
import { applyTextEdit } from "./textInput";

type AddField = "org" | "project" | "repos" | "submit" | "cancel";
const addFields: AddField[] = ["org", "project", "repos", "submit", "cancel"];

type AddProjectFormProps = {
  /** Pre-filled values when editing an existing project. */
  initial?: { organization: string; project: string; repositories: string };
  editing: boolean;
  onSubmit: (project: AdoProjectConfig) => void;
  onCancel: () => void;
  onError: (msg: string | null) => void;
  disabled?: boolean;
};

/** A labelled bordered text field with a block cursor on the active field. */
const FormTextField: React.FC<{
  label: string;
  value: string;
  placeholder: string;
  idleFallback: string;
  isActive: boolean;
}> = ({ label, value, placeholder, idleFallback, isActive }) => (
  <Box flexDirection="column" marginBottom={1}>
    <Text color={isActive ? palette.accent : palette.text} bold>
      {isActive ? `${glyph.pointer} ` : "  "}{label}
    </Text>
    <Box
      borderStyle="single"
      borderColor={isActive ? palette.accent : palette.border}
      paddingX={1}
    >
      <Text color={value ? palette.textBright : palette.muted}>
        {isActive ? (
          value ? (
            <>
              {value}
              <Text color={palette.accent}>▌</Text>
            </>
          ) : (
            <>
              <Text color={palette.accent}>▌</Text>
              <Text color={palette.muted}>{placeholder}</Text>
            </>
          )
        ) : (
          value || idleFallback
        )}
      </Text>
    </Box>
  </Box>
);

/** Add/edit-project form of the setup wizard. */
export const AddProjectForm: React.FC<AddProjectFormProps> = ({
  initial,
  editing,
  onSubmit,
  onCancel,
  onError,
  disabled = false,
}) => {
  const [org, setOrg] = useState(initial?.organization ?? "");
  const [project, setProject] = useState(initial?.project ?? "");
  const [repos, setRepos] = useState(initial?.repositories ?? "");
  const [activeField, setActiveField] = useState<AddField>("org");

  const handleAddProject = () => {
    const trimmedOrg = org.trim();
    const trimmedProject = project.trim();
    const trimmedRepos = repos.trim();

    if (!trimmedOrg) {
      onError("Organization URL cannot be empty.");
      setActiveField("org");
      return;
    }
    if (!trimmedOrg.startsWith("http://") && !trimmedOrg.startsWith("https://")) {
      onError("Organization URL must start with http:// or https://");
      setActiveField("org");
      return;
    }

    const reposList = trimmedRepos
      ? trimmedRepos
          .split(",")
          .map((r) => r.trim())
          .filter(Boolean)
      : undefined;

    onSubmit({
      organization: trimmedOrg,
      ...(trimmedProject ? { project: trimmedProject } : {}),
      ...(reposList && reposList.length > 0 ? { repositories: reposList } : {}),
    });
  };

  useInput(
    (input, key) => {
      // Form field navigation
      if (key.downArrow || key.tab) {
        setActiveField((current) => {
          const idx = addFields.indexOf(current);
          return addFields[(idx + 1) % addFields.length]!;
        });
        onError(null);
        return;
      }
      if (key.upArrow || (key.shift && key.tab)) {
        setActiveField((current) => {
          const idx = addFields.indexOf(current);
          return addFields[(idx - 1 + addFields.length) % addFields.length]!;
        });
        onError(null);
        return;
      }

      // Return / Advance fields
      if (key.return) {
        if (activeField === "org") {
          setActiveField("project");
        } else if (activeField === "project") {
          setActiveField("repos");
        } else if (activeField === "repos") {
          setActiveField("submit");
        } else if (activeField === "submit") {
          handleAddProject();
        } else if (activeField === "cancel") {
          onCancel();
        }
        return;
      }

      // Keyboard Typing Logic
      if (activeField === "org") {
        const next = applyTextEdit(org, input, key);
        if (next !== null) setOrg(next);
      } else if (activeField === "project") {
        const next = applyTextEdit(project, input, key);
        if (next !== null) setProject(next);
      } else if (activeField === "repos") {
        const next = applyTextEdit(repos, input, key);
        if (next !== null) setRepos(next);
      }
    },
    { isActive: !disabled },
  );

  return (
    <Box flexDirection="column" width={60}>
      <Box justifyContent="center" marginBottom={1}>
        <Text color={palette.accent} bold>
          {editing ? "✏ EDIT PROJECT" : `${glyph.added} ADD NEW PROJECT`}
        </Text>
      </Box>

      <FormTextField
        label="Organization URL:"
        value={org}
        placeholder="https://dev.azure.com/organization"
        idleFallback="https://dev.azure.com/organization"
        isActive={activeField === "org"}
      />
      <FormTextField
        label="Project Name (optional):"
        value={project}
        placeholder="All Projects"
        idleFallback="All Projects"
        isActive={activeField === "project"}
      />
      <FormTextField
        label="Repositories (Optional, comma-separated):"
        value={repos}
        placeholder="repo1, repo2 (leave empty for all repos)"
        idleFallback="All repositories"
        isActive={activeField === "repos"}
      />

      {/* Submit / Cancel Buttons */}
      <Box justifyContent="center" marginTop={1} gap={3}>
        <Box>
          <Text
            color={activeField === "submit" ? palette.textBright : palette.muted}
            bold={activeField === "submit"}
            inverse={activeField === "submit"}
          >
            {"  "}[ {editing ? "Save Changes" : "Add Project"} ]{"  "}
          </Text>
        </Box>
        <Box>
          <Text
            color={activeField === "cancel" ? palette.textBright : palette.muted}
            bold={activeField === "cancel"}
            inverse={activeField === "cancel"}
          >
            {"  "}[ Cancel ]{"  "}
          </Text>
        </Box>
      </Box>
    </Box>
  );
};
