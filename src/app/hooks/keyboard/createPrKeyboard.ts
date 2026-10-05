import type { Key } from "ink";
import type { AppHandle } from "../useAppState";
import { CREATE_PR_FIELD, CREATE_PR_FIELD_COUNT } from "../../constants";
import { acceptSuggestion, branchMatches, reviewerSuggestions } from "../../createPr";
import { getState, patchState } from "../../store";
import type { CreatePrForm } from "../../types";
import { clamp } from "../../utils";

/**
 * Edits one form field for a key press. null = the field ignores the key (it falls through to
 * moving between fields); the same form back = the field used the key but nothing changed.
 */
type FieldEditor = (form: CreatePrForm, input: string, key: Key) => CreatePrForm | null;

const typesText = (input: string, key: Key): boolean => !key.ctrl && !key.meta && input !== "";

/** Steps a list position by ↑/↓ (the mouse wheel too) or ←/→; 0 when the key is not a step. */
const stepOf = (key: Key): number => {
  if (key.upArrow || key.leftArrow) return -1;
  if (key.downArrow || key.rightArrow) return 1;
  return 0;
};

/** Branch fields: type to filter; ↑/↓ (or ←/→) scroll the matches. */
const branchField =
  (field: "source" | "target"): FieldEditor =>
  (form, input, key) => {
    if (!form.branches) return null;
    const current = form[field];
    const step = stepOf(key);
    if (step !== 0) {
      const last = Math.max(0, branchMatches(form.branches, current.query).length - 1);
      const pick = clamp(current.pick + step, 0, last);
      // Scrolling past either end stays put rather than leaving the field mid-wheel.
      return pick === current.pick ? form : { ...form, [field]: { ...current, pick } };
    }
    if (key.backspace || key.delete) return { ...form, [field]: { query: current.query.slice(0, -1), pick: 0 } };
    if (typesText(input, key)) return { ...form, [field]: { query: current.query + input, pick: 0 } };
    return null;
  };

const textField =
  (field: "title" | "description"): FieldEditor =>
  (form, input, key) => {
    if (key.backspace || key.delete) return { ...form, [field]: form[field].slice(0, -1) };
    if (typesText(input, key)) return { ...form, [field]: form[field] + input };
    return null;
  };

/** Reviewers: e-mails typed freely; ↑/↓ highlight a suggestion, → or enter take it. */
const reviewersField: FieldEditor = (form, input, key) => {
  const suggestions = reviewerSuggestions(form);
  if (suggestions.length > 0 && (key.upArrow || key.downArrow)) {
    const reviewerPick = clamp(form.reviewerPick + (key.upArrow ? -1 : 1), 0, suggestions.length - 1);
    return reviewerPick === form.reviewerPick ? form : { ...form, reviewerPick };
  }
  const chosen = suggestions[form.reviewerPick];
  if (chosen && (key.rightArrow || key.return)) return { ...form, reviewers: acceptSuggestion(form.reviewers, chosen.email), reviewerPick: 0 };
  if (key.backspace || key.delete) return { ...form, reviewers: form.reviewers.slice(0, -1), reviewerPick: 0 };
  if (typesText(input, key)) return { ...form, reviewers: form.reviewers + input, reviewerPick: 0 };
  return null;
};

const draftField: FieldEditor = (form, input, key) =>
  key.leftArrow || key.rightArrow || input === " " ? { ...form, draft: !form.draft } : null;

const FIELD_EDITORS: Partial<Record<number, FieldEditor>> = {
  [CREATE_PR_FIELD.SOURCE]: branchField("source"),
  [CREATE_PR_FIELD.TARGET]: branchField("target"),
  [CREATE_PR_FIELD.TITLE]: textField("title"),
  [CREATE_PR_FIELD.DESCRIPTION]: textField("description"),
  [CREATE_PR_FIELD.REVIEWERS]: reviewersField,
  [CREATE_PR_FIELD.DRAFT]: draftField,
};

const moveCursor = (form: CreatePrForm, delta: number): void => {
  const cursor = clamp(form.cursor + delta, 0, CREATE_PR_FIELD_COUNT - 1);
  if (cursor !== form.cursor) patchState({ createPr: { ...form, cursor } });
};

/** Keys of the "new pull request" form (a modal focus, like the completion editor). */
export function handleCreatePr(input: string, key: Key, app: AppHandle, _exitApp: () => void): void {
  const form = getState().createPr;
  if (!form) return;
  if (key.escape) return app.actions.closeCreatePr();
  if (key.tab) return moveCursor(form, key.shift ? -1 : 1);
  if (form.submitting) return;
  const next = FIELD_EDITORS[form.cursor]?.(form, input, key);
  if (next) {
    // A key that changes nothing must not write to the store (every write is a frame).
    if (next !== form) patchState({ createPr: { ...next, error: null } });
    return;
  }
  if (key.upArrow) return moveCursor(form, -1);
  if (key.downArrow) return moveCursor(form, 1);
  if (key.return) {
    if (form.cursor === CREATE_PR_FIELD.SUBMIT) app.actions.submitCreatePr();
    else moveCursor(form, 1);
  }
}
