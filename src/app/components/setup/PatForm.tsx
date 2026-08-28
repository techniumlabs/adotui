import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import { glyph, palette } from "../../theme";
import { applyTextEdit } from "./textInput";

type PatField = "input" | "submit" | "cancel";
const patFields: PatField[] = ["input", "submit", "cancel"];

type PatFormProps = {
  pat: string;
  onChangePat: (pat: string) => void;
  /** Both Save and Cancel return to the list (the typed value is kept). */
  onDone: () => void;
  onError: (msg: string | null) => void;
  disabled?: boolean;
};

/** PAT token entry form of the setup wizard. */
export const PatForm: React.FC<PatFormProps> = ({
  pat,
  onChangePat,
  onDone,
  onError,
  disabled = false,
}) => {
  const [activeField, setActiveField] = useState<PatField>("input");

  useInput(
    (input, key) => {
      // Form field navigation
      if (key.downArrow || key.tab) {
        setActiveField((current) => {
          const idx = patFields.indexOf(current);
          return patFields[(idx + 1) % patFields.length]!;
        });
        onError(null);
        return;
      }
      if (key.upArrow || (key.shift && key.tab)) {
        setActiveField((current) => {
          const idx = patFields.indexOf(current);
          return patFields[(idx - 1 + patFields.length) % patFields.length]!;
        });
        onError(null);
        return;
      }

      // Return / Advance fields
      if (key.return) {
        if (activeField === "input") {
          setActiveField("submit");
        } else {
          onDone();
        }
        return;
      }

      // Keyboard Typing Logic
      if (activeField === "input") {
        const next = applyTextEdit(pat, input, key);
        if (next !== null) onChangePat(next);
      }
    },
    { isActive: !disabled },
  );

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
        <Text color={activeField === "input" ? palette.accent : palette.text} bold>
          {activeField === "input" ? `${glyph.pointer} ` : "  "}Personal Access Token (PAT):
        </Text>
        <Box
          borderStyle="single"
          borderColor={activeField === "input" ? palette.accent : palette.border}
          paddingX={1}
        >
          <Text color={pat ? palette.textBright : palette.muted}>
            {activeField === "input" ? (
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
            color={activeField === "submit" ? palette.textBright : palette.muted}
            bold={activeField === "submit"}
            inverse={activeField === "submit"}
          >
            {"  "}[ Save Token ]{"  "}
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
