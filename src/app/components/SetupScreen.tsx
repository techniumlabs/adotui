import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import { palette, glyph } from "../theme";
import { writeConfig } from "../../data/config";

interface SetupScreenProps {
  onComplete: () => void;
}

type ActiveField = "org" | "project" | "submit";

export const SetupScreen: React.FC<SetupScreenProps> = ({ onComplete }) => {
  const [org, setOrg] = useState("");
  const [project, setProject] = useState("");
  const [activeField, setActiveField] = useState<ActiveField>("org");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useInput((input, key) => {
    if (isSubmitting) return;

    // Navigation
    if (key.downArrow || key.tab) {
      setError(null);
      setActiveField((current) => {
        if (current === "org") return "project";
        if (current === "project") return "submit";
        return "org";
      });
      return;
    }
    if (key.upArrow || (key.shift && key.tab)) {
      setError(null);
      setActiveField((current) => {
        if (current === "submit") return "project";
        if (current === "project") return "org";
        return "submit";
      });
      return;
    }

    // Submit / Enter handling
    if (key.return) {
      if (activeField === "org") {
        setActiveField("project");
      } else if (activeField === "project") {
        setActiveField("submit");
      } else if (activeField === "submit") {
        void handleSubmit();
      }
      return;
    }

    // Input text handling
    if (activeField === "org") {
      if (key.backspace || key.delete) {
        setOrg((o) => o.slice(0, -1));
      } else if (!key.ctrl && !key.meta && input) {
        setOrg((o) => o + input);
      }
    } else if (activeField === "project") {
      if (key.backspace || key.delete) {
        setProject((p) => p.slice(0, -1));
      } else if (!key.ctrl && !key.meta && input) {
        setProject((p) => p + input);
      }
    }
  });

  const handleSubmit = async () => {
    const trimmedOrg = org.trim();
    const trimmedProject = project.trim();

    if (!trimmedOrg) {
      setError("Organization URL cannot be empty.");
      setActiveField("org");
      return;
    }
    if (!trimmedProject) {
      setError("Project Name cannot be empty.");
      setActiveField("project");
      return;
    }

    // Basic URL validation
    if (!trimmedOrg.startsWith("http://") && !trimmedOrg.startsWith("https://")) {
      setError("Organization URL must start with http:// or https://");
      setActiveField("org");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await writeConfig({
        status: "active",
        top: 50,
        projects: [
          {
            organization: trimmedOrg,
            project: trimmedProject,
          },
        ],
      });
      onComplete();
    } catch (e) {
      setIsSubmitting(false);
      setError(e instanceof Error ? e.message : "Failed to save configuration.");
    }
  };

  return (
    <Box
      flexDirection="column"
      flexGrow={1}
      justifyContent="center"
      alignItems="center"
      minHeight={20}
    >
      <Box
        flexDirection="column"
        borderStyle="round"
        borderColor={palette.accent}
        paddingX={4}
        paddingY={1}
        width={60}
      >
        <Box justifyContent="center" marginBottom={1}>
          <Text color={palette.accent} bold>
            {glyph.dot} ADOTUI INITIAL SETUP
          </Text>
        </Box>

        <Box marginBottom={1} justifyContent="center">
          <Text color={palette.muted}>
            No configuration file found. Let's create one.
          </Text>
        </Box>

        {/* Organization URL Field */}
        <Box flexDirection="column" marginBottom={1}>
          <Text color={activeField === "org" ? palette.accent : palette.text} bold>
            {activeField === "org" ? `${glyph.pointer} ` : "  "}Organization URL:
          </Text>
          <Box
            borderStyle="single"
            borderColor={activeField === "org" ? palette.accent : palette.border}
            paddingX={1}
          >
            <Text color={org ? palette.textBright : palette.muted}>
              {org || "https://dev.azure.com/organization"}
            </Text>
          </Box>
        </Box>

        {/* Project Name Field */}
        <Box flexDirection="column" marginBottom={1}>
          <Text color={activeField === "project" ? palette.accent : palette.text} bold>
            {activeField === "project" ? `${glyph.pointer} ` : "  "}Project Name:
          </Text>
          <Box
            borderStyle="single"
            borderColor={activeField === "project" ? palette.accent : palette.border}
            paddingX={1}
          >
            <Text color={project ? palette.textBright : palette.muted}>
              {project || "MyProject"}
            </Text>
          </Box>
        </Box>

        {/* Submit button */}
        <Box justifyContent="center" marginTop={1} marginBottom={1}>
          <Text
            color={activeField === "submit" ? palette.textBright : palette.muted}
            bold={activeField === "submit"}
            inverse={activeField === "submit"}
          >
            {"  "}[ Save and Load Configuration ]{"  "}
          </Text>
        </Box>

        {/* Error message */}
        {error && (
          <Box justifyContent="center" marginTop={1}>
            <Text color={palette.danger}>{error}</Text>
          </Box>
        )}

        {/* Submitting state */}
        {isSubmitting && (
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
          <Text color={palette.muted}>
            Press Tab/Arrows to navigate · Ctrl+C to quit
          </Text>
        </Box>
      </Box>
    </Box>
  );
};
