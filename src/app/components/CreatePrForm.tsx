import React from "react";
import { Box, Text } from "ink";
import { BRANCH_LIST_ROWS, CREATE_PR_FIELD } from "../constants";
import { branchMatches, defaultTitle, listWindowStart, pickedBranch, reviewerSuggestions, validateCreatePr } from "../createPr";
import { glyph, palette } from "../theme";
import type { BranchPick, CreatePrForm as CreatePrFormState } from "../types";
import { ClickableBox } from "./ui/ClickableBox";

const LABEL_WIDTH = 16;

type OnClick = (row: number, item?: number) => void;

const Row: React.FC<{ label: string; row: number; active: boolean; onClick: OnClick; children: React.ReactNode }> = ({
  label,
  row,
  active,
  onClick,
  children,
}) => (
  <ClickableBox onClick={() => onClick(row)}>
    <Text color={active ? palette.accent : palette.muted}>{active ? glyph.pointer : glyph.pointerIdle} </Text>
    <Box width={LABEL_WIDTH} flexShrink={0}>
      <Text color={active ? palette.textBright : palette.text}>{label}</Text>
    </Box>
    {children}
  </ClickableBox>
);

/** A field's problem, under it. */
const FieldError: React.FC<{ error?: string }> = ({ error }) =>
  error ? (
    <Box marginLeft={LABEL_WIDTH + 2}>
      <Text color={palette.danger}>
        {glyph.cross} {error}
      </Text>
    </Box>
  ) : null;

/** The scrolled list under an active branch field; each branch is clickable. */
const BranchList: React.FC<{ matches: string[]; pick: number; row: number; onClick: OnClick }> = ({ matches, pick, row, onClick }) => {
  const start = listWindowStart(pick, matches.length);
  const end = Math.min(matches.length, start + BRANCH_LIST_ROWS);
  return (
    <Box marginLeft={LABEL_WIDTH + 2} flexDirection="column">
      {start > 0 && <Text color={palette.muted}>{`  ${glyph.up} ${start} more`}</Text>}
      {matches.slice(start, end).map((branch, i) => (
        <ClickableBox key={branch} onClick={() => onClick(row, start + i)}>
          <Text color={start + i === pick ? palette.accent : palette.muted}>
            {start + i === pick ? glyph.pointer : " "} {branch}
          </Text>
        </ClickableBox>
      ))}
      {end < matches.length && <Text color={palette.muted}>{`  ${glyph.down} ${matches.length - end} more`}</Text>}
    </Box>
  );
};

/** A branch field: the chosen branch, and while active the filter and the scrollable matches. */
const BranchRow: React.FC<{
  label: string;
  row: number;
  field: BranchPick;
  branches: string[] | null;
  active: boolean;
  onClick: OnClick;
}> = ({ label, row, field, branches, active, onClick }) => {
  const matches = branches ? branchMatches(branches, field.query) : [];
  const chosen = pickedBranch(branches, field);
  let value: React.ReactNode = <Text color={palette.muted}>—</Text>;
  if (!branches) value = <Text color={palette.muted}>{glyph.clock} loading branches…</Text>;
  else if (chosen) value = <Text color={active ? palette.accent : palette.info}>{chosen}</Text>;
  return (
    <Box flexDirection="column">
      <Row label={label} row={row} active={active} onClick={onClick}>
        {value}
        {active && field.query ? <Text color={palette.muted}>{`  filter: "${field.query}" (${matches.length})`}</Text> : null}
      </Row>
      {active && matches.length > 1 && <BranchList matches={matches} pick={field.pick} row={row} onClick={onClick} />}
    </Box>
  );
};

/** A text field, with a muted placeholder while empty. */
const TextRow: React.FC<{ label: string; row: number; value: string; placeholder: string; active: boolean; onClick: OnClick }> = ({
  label,
  row,
  value,
  placeholder,
  active,
  onClick,
}) => (
  <Row label={label} row={row} active={active} onClick={onClick}>
    {/* Long values keep their end, where typing happens, on one line. */}
    {value ? <Text color={palette.textBright} wrap="truncate-start">{value}</Text> : <Text color={palette.muted}>{placeholder}</Text>}
    {active ? <Text color={palette.accent}>▌</Text> : null}
  </Row>
);

/** Known people matching the reviewer being typed; each is clickable. */
const Suggestions: React.FC<{ form: CreatePrFormState; onClick: OnClick }> = ({ form, onClick }) => (
  <Box marginLeft={LABEL_WIDTH + 2} flexDirection="column">
    {reviewerSuggestions(form).map((person, i) => (
      <ClickableBox key={person.email} onClick={() => onClick(CREATE_PR_FIELD.REVIEWERS, i)}>
        <Text color={i === form.reviewerPick ? palette.accent : palette.muted}>
          {i === form.reviewerPick ? glyph.pointer : " "} {`${person.name} <${person.email}>`}
        </Text>
      </ClickableBox>
    ))}
  </Box>
);

/** The "new pull request" form (N). */
export const CreatePrForm: React.FC<{ form: CreatePrFormState; onClick: OnClick }> = ({ form, onClick }) => {
  const at = (field: number) => form.cursor === field;
  const source = pickedBranch(form.branches, form.source);
  const errors = validateCreatePr(form);
  // Field problems show under their field; repeat a submit error only when it is not one of them.
  const otherError = form.error && !Object.values(errors).includes(form.error) ? form.error : null;
  const branchRow = (label: string, row: number, field: BranchPick) => (
    <BranchRow label={label} row={row} field={field} branches={form.branches} active={at(row)} onClick={onClick} />
  );
  return (
    <Box flexGrow={1} borderStyle="round" borderColor={palette.accent} paddingX={1} flexDirection="column">
      <Text color={palette.accent} bold>
        {glyph.added} New pull request{" "}
        <Text color={palette.muted}>in {form.repo.project}/{form.repo.name}</Text>
      </Text>

      <Box marginTop={1} flexDirection="column">
        {branchRow("source branch", CREATE_PR_FIELD.SOURCE, form.source)}
        <FieldError error={errors.source} />
        {branchRow("target branch", CREATE_PR_FIELD.TARGET, form.target)}
        <FieldError error={errors.target} />
        <TextRow
          label="title"
          row={CREATE_PR_FIELD.TITLE}
          value={form.title}
          placeholder={source ? `<${defaultTitle(source)}>` : "<required>"}
          active={at(CREATE_PR_FIELD.TITLE)}
          onClick={onClick}
        />
        <FieldError error={errors.title} />
        <TextRow
          label="description"
          row={CREATE_PR_FIELD.DESCRIPTION}
          value={form.description}
          placeholder="<optional>"
          active={at(CREATE_PR_FIELD.DESCRIPTION)}
          onClick={onClick}
        />
        <FieldError error={errors.description} />
        <TextRow
          label="reviewers"
          row={CREATE_PR_FIELD.REVIEWERS}
          value={form.reviewers}
          placeholder="<optional: e-mails, comma separated>"
          active={at(CREATE_PR_FIELD.REVIEWERS)}
          onClick={onClick}
        />
        {at(CREATE_PR_FIELD.REVIEWERS) && <Suggestions form={form} onClick={onClick} />}
        {/* Checked once you leave the field (or press create), not while an address is half typed. */}
        <FieldError error={at(CREATE_PR_FIELD.REVIEWERS) && !form.error ? undefined : errors.reviewers} />
        <Row label="draft" row={CREATE_PR_FIELD.DRAFT} active={at(CREATE_PR_FIELD.DRAFT)} onClick={onClick}>
          <Text color={at(CREATE_PR_FIELD.DRAFT) ? palette.accent : palette.muted}>{form.draft ? "yes" : "no"}</Text>
        </Row>
        <Row label="" row={CREATE_PR_FIELD.SUBMIT} active={at(CREATE_PR_FIELD.SUBMIT)} onClick={onClick}>
          <Text color={at(CREATE_PR_FIELD.SUBMIT) ? palette.ok : palette.muted} bold={at(CREATE_PR_FIELD.SUBMIT)}>
            {glyph.check} create pull request
          </Text>
        </Row>
      </Box>

      {otherError && <Text color={palette.danger}>{otherError}</Text>}
      {form.submitting && <Text color={palette.accent}>{glyph.clock} Creating…</Text>}

      <Box marginTop={1}>
        <Text color={palette.muted}>
          tab/shift+tab move {glyph.bullet} type to filter, ↑/↓ scroll branches {glyph.bullet} → takes a suggested reviewer
          {" "}{glyph.bullet} space toggles draft {glyph.bullet} enter on "create" sends {glyph.bullet} esc cancel
        </Text>
      </Box>
    </Box>
  );
};
