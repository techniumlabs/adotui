import type { NewPullRequest } from "../domain/types";
import { BRANCH_LIST_ROWS, CREATE_PR_FIELD, PR_DESCRIPTION_MAX_CHARS, PR_TITLE_MAX_CHARS, REVIEWER_SUGGESTIONS } from "./constants";
import type { BranchPick, CreatePrForm } from "./types";

/** Branches containing the typed filter (case-insensitive); all of them when it is empty. */
export const branchMatches = (branches: string[], query: string): string[] => {
  const needle = query.trim().toLowerCase();
  return needle ? branches.filter((branch) => branch.toLowerCase().includes(needle)) : branches;
};

/** The branch a field currently stands for, if any matches. */
export const pickedBranch = (branches: string[] | null, field: BranchPick): string | undefined =>
  branches ? branchMatches(branches, field.query)[field.pick] : undefined;

/** The first row of a scrolled list of `count` rows that keeps `pick` in view (roughly centred). */
export const listWindowStart = (pick: number, count: number, rows = BRANCH_LIST_ROWS): number =>
  Math.max(0, Math.min(pick - Math.floor(rows / 2), count - rows));

/** "feature/add-login_page" -> "add login page": the title used when none is typed. */
export const defaultTitle = (branch: string): string =>
  (branch.split("/").pop() ?? branch).replace(/[-_]+/g, " ").trim();

const EMAIL = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;

/** The reviewer e-mails typed so far (comma, semicolon or space separated). */
export const parseReviewers = (text: string): string[] => text.split(/[,;\s]+/).filter((entry) => entry !== "");

/** The entry being typed: whatever follows the last separator. */
const currentToken = (text: string): string => /[^,;\s]*$/.exec(text)?.[0] ?? "";

/** Known people matching the entry being typed, minus those already added. */
export const reviewerSuggestions = (form: Pick<CreatePrForm, "reviewers" | "people">): { name: string; email: string }[] => {
  const token = currentToken(form.reviewers).toLowerCase();
  if (!token) return [];
  // The entry being typed counts as added too, so a complete e-mail stops suggesting itself.
  const added = new Set(parseReviewers(form.reviewers).map((e) => e.toLowerCase()));
  return form.people
    .filter((p) => !added.has(p.email.toLowerCase()))
    .filter((p) => p.email.toLowerCase().includes(token) || p.name.toLowerCase().includes(token))
    .slice(0, REVIEWER_SUGGESTIONS);
};

/** Replaces the entry being typed with `email`, ready for the next one. */
export const acceptSuggestion = (text: string, email: string): string =>
  `${text.slice(0, text.length - currentToken(text).length)}${email}, `;

export type CreatePrField = "source" | "target" | "title" | "description" | "reviewers";

/** The cursor row of each validated field. */
export const FIELD_ROW: Record<CreatePrField, number> = {
  source: CREATE_PR_FIELD.SOURCE,
  target: CREATE_PR_FIELD.TARGET,
  title: CREATE_PR_FIELD.TITLE,
  description: CREATE_PR_FIELD.DESCRIPTION,
  reviewers: CREATE_PR_FIELD.REVIEWERS,
};
export type FieldErrors = Partial<Record<CreatePrField, string>>;

const reviewerError = (text: string): string | undefined => {
  const entries = parseReviewers(text);
  const invalid = entries.find((entry) => !EMAIL.test(entry));
  if (invalid) return `"${invalid}" is not an e-mail address`;
  const seen = new Set<string>();
  const duplicate = entries.find((entry) => (seen.has(entry.toLowerCase()) ? true : (seen.add(entry.toLowerCase()), false)));
  return duplicate ? `${duplicate} is listed twice` : undefined;
};

/** Every problem the form has right now, by field (empty = ready to send). */
export const validateCreatePr = (form: CreatePrForm): FieldErrors => {
  const errors: FieldErrors = {};
  const source = pickedBranch(form.branches, form.source);
  const target = pickedBranch(form.branches, form.target);
  if (form.branches) {
    if (!source) errors.source = form.branches.length === 0 ? "this repository has no branches" : `no branch matches "${form.source.query}"`;
    if (!target) errors.target = `no branch matches "${form.target.query}"`;
    else if (source === target) errors.target = "must differ from the source branch";
    const open = form.openPrs.find((pr) => pr.source === source && pr.target === target);
    if (source && target && open && !errors.target) errors.target = `PR #${open.id} is already open for these branches`;
  }
  if (form.title.length > PR_TITLE_MAX_CHARS) errors.title = `${form.title.length}/${PR_TITLE_MAX_CHARS} characters: too long`;
  if (form.description.length > PR_DESCRIPTION_MAX_CHARS) {
    errors.description = `${form.description.length}/${PR_DESCRIPTION_MAX_CHARS} characters: too long`;
  }
  const reviewers = reviewerError(form.reviewers);
  if (reviewers) errors.reviewers = reviewers;
  return errors;
};

/** The pull request the form describes (reviewers still as e-mails), or the first problem. */
export const buildNewPr = (
  form: CreatePrForm,
): { pr: Omit<NewPullRequest, "reviewerIds">; reviewerEmails: string[] } | { error: string; field?: CreatePrField } => {
  if (!form.branches) return { error: "Branches are still loading." };
  const errors = validateCreatePr(form);
  const field = (Object.keys(errors) as CreatePrField[])[0];
  if (field) return { error: errors[field]!, field };
  const source = pickedBranch(form.branches, form.source)!;
  return {
    pr: {
      sourceBranch: source,
      targetBranch: pickedBranch(form.branches, form.target)!,
      title: form.title.trim() || defaultTitle(source),
      description: form.description.trim(),
      draft: form.draft,
    },
    reviewerEmails: [...new Set(parseReviewers(form.reviewers).map((e) => e.toLowerCase()))],
  };
};
