import React from "react";
import { Box, Text } from "ink";
import { BRANCH_MATCHES_SHOWN, CREATE_PR_FIELD } from "../constants";
import { branchMatches, defaultTitle, pickedBranch } from "../createPr";
import { glyph, palette } from "../theme";
import type { BranchPick, CreatePrForm as CreatePrFormState } from "../types";

const LABEL_WIDTH = 16;

const Row: React.FC<{ label: string; active: boolean; children: React.ReactNode }> = ({ label, active, children }) => (
  <Box>
    <Text color={active ? palette.accent : palette.muted}>{active ? glyph.pointer : glyph.pointerIdle} </Text>
    <Box width={LABEL_WIDTH}>
      <Text color={active ? palette.textBright : palette.text}>{label}</Text>
    </Box>
    {children}
  </Box>
);

/** A branch field: the chosen branch, and while active the filter and the nearby matches. */
const BranchRow: React.FC<{ label: string; field: BranchPick; branches: string[] | null; active: boolean }> = ({
  label,
  field,
  branches,
  active,
}) => {
  const matches = branches ? branchMatches(branches, field.query) : [];
  const chosen = pickedBranch(branches, field);
  let value: React.ReactNode = <Text color={palette.danger}>no branch matches "{field.query}"</Text>;
  if (!branches) value = <Text color={palette.muted}>{glyph.clock} loading branches…</Text>;
  else if (chosen) value = <Text color={active ? palette.accent : palette.info}>{chosen}</Text>;
  const start = Math.max(0, Math.min(field.pick - Math.floor(BRANCH_MATCHES_SHOWN / 2), matches.length - BRANCH_MATCHES_SHOWN));
  return (
    <Box flexDirection="column">
      <Row label={label} active={active}>
        {value}
        {active && field.query ? <Text color={palette.muted}>{`  filter: "${field.query}" (${matches.length})`}</Text> : null}
      </Row>
      {active && matches.length > 1 && (
        <Box marginLeft={LABEL_WIDTH + 2} flexDirection="column">
          {matches.slice(start, start + BRANCH_MATCHES_SHOWN).map((branch, i) => (
            <Text key={branch} color={start + i === field.pick ? palette.accent : palette.muted}>
              {start + i === field.pick ? glyph.pointer : " "} {branch}
            </Text>
          ))}
        </Box>
      )}
    </Box>
  );
};

/** A text field, with a muted placeholder while empty. */
const TextRow: React.FC<{ label: string; value: string; placeholder: string; active: boolean }> = ({
  label,
  value,
  placeholder,
  active,
}) => (
  <Row label={label} active={active}>
    {value ? <Text color={palette.textBright}>{value}</Text> : <Text color={palette.muted}>{placeholder}</Text>}
    {active ? <Text color={palette.accent}>▌</Text> : null}
  </Row>
);

/** The "new pull request" form (N). */
export const CreatePrForm: React.FC<{ form: CreatePrFormState }> = ({ form }) => {
  const at = (field: number) => form.cursor === field;
  const source = pickedBranch(form.branches, form.source);
  return (
    <Box flexGrow={1} borderStyle="round" borderColor={palette.accent} paddingX={1} flexDirection="column">
      <Text color={palette.accent} bold>
        {glyph.added} New pull request{" "}
        <Text color={palette.muted}>in {form.repo.project}/{form.repo.name}</Text>
      </Text>

      <Box marginTop={1} flexDirection="column">
        <BranchRow label="source branch" field={form.source} branches={form.branches} active={at(CREATE_PR_FIELD.SOURCE)} />
        <BranchRow label="target branch" field={form.target} branches={form.branches} active={at(CREATE_PR_FIELD.TARGET)} />
        <TextRow
          label="title"
          value={form.title}
          placeholder={source ? `<${defaultTitle(source)}>` : "<required>"}
          active={at(CREATE_PR_FIELD.TITLE)}
        />
        <TextRow label="description" value={form.description} placeholder="<optional>" active={at(CREATE_PR_FIELD.DESCRIPTION)} />
        <Row label="draft" active={at(CREATE_PR_FIELD.DRAFT)}>
          <Text color={at(CREATE_PR_FIELD.DRAFT) ? palette.accent : palette.muted}>{form.draft ? "yes" : "no"}</Text>
        </Row>
        <Row label="" active={at(CREATE_PR_FIELD.SUBMIT)}>
          <Text color={at(CREATE_PR_FIELD.SUBMIT) ? palette.ok : palette.muted} bold={at(CREATE_PR_FIELD.SUBMIT)}>
            {glyph.check} create pull request
          </Text>
        </Row>
      </Box>

      {form.error && <Text color={palette.danger}>{form.error}</Text>}
      {form.submitting && <Text color={palette.accent}>{glyph.clock} Creating…</Text>}

      <Box marginTop={1}>
        <Text color={palette.muted}>
          ↑/↓ or tab move {glyph.bullet} type to filter branches, ←/→ pick {glyph.bullet} space toggles draft
          {" "}{glyph.bullet} enter on "create" sends {glyph.bullet} esc cancel
        </Text>
      </Box>
    </Box>
  );
};
