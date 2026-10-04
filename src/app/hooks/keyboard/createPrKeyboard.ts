import type { Key } from "ink";
import type { AppHandle } from "../useAppState";
import { CREATE_PR_FIELD, CREATE_PR_FIELD_COUNT } from "../../constants";
import { branchMatches } from "../../createPr";
import { getState, patchState } from "../../store";
import type { BranchPick, CreatePrForm } from "../../types";
import { clamp } from "../../utils";

/** Edits one form field for a key press; null = the key does nothing there. */
type FieldEditor = (form: CreatePrForm, input: string, key: Key) => CreatePrForm | null;

const typesText = (input: string, key: Key): boolean => !key.ctrl && !key.meta && input !== "";

/** Branch fields: type to filter, ←/→ to step through the matches. */
const branchField =
  (field: "source" | "target"): FieldEditor =>
  (form, input, key) => {
    if (!form.branches) return null;
    const current = form[field];
    let next: BranchPick | null = null;
    if (key.leftArrow || key.rightArrow) {
      const count = branchMatches(form.branches, current.query).length;
      const step = key.leftArrow ? -1 : 1;
      next = { ...current, pick: clamp(current.pick + step, 0, Math.max(0, count - 1)) };
    } else if (key.backspace || key.delete) {
      next = { query: current.query.slice(0, -1), pick: 0 };
    } else if (typesText(input, key)) {
      next = { query: current.query + input, pick: 0 };
    }
    return next ? { ...form, [field]: next } : null;
  };

const textField =
  (field: "title" | "description"): FieldEditor =>
  (form, input, key) => {
    if (key.backspace || key.delete) return { ...form, [field]: form[field].slice(0, -1) };
    if (typesText(input, key)) return { ...form, [field]: form[field] + input };
    return null;
  };

const draftField: FieldEditor = (form, input, key) =>
  key.leftArrow || key.rightArrow || input === " " ? { ...form, draft: !form.draft } : null;

const FIELD_EDITORS: Partial<Record<number, FieldEditor>> = {
  [CREATE_PR_FIELD.SOURCE]: branchField("source"),
  [CREATE_PR_FIELD.TARGET]: branchField("target"),
  [CREATE_PR_FIELD.TITLE]: textField("title"),
  [CREATE_PR_FIELD.DESCRIPTION]: textField("description"),
  [CREATE_PR_FIELD.DRAFT]: draftField,
};

const moveCursor = (form: CreatePrForm, delta: number): void =>
  patchState({ createPr: { ...form, cursor: clamp(form.cursor + delta, 0, CREATE_PR_FIELD_COUNT - 1) } });

/** Keys of the "new pull request" form (a modal focus, like the completion editor). */
export function handleCreatePr(input: string, key: Key, app: AppHandle, _exitApp: () => void): void {
  const form = getState().createPr;
  if (!form) return;
  if (key.escape) return app.actions.closeCreatePr();
  if (key.upArrow || (key.tab && key.shift)) return moveCursor(form, -1);
  if (key.downArrow || key.tab) return moveCursor(form, 1);
  if (key.return) {
    if (form.cursor === CREATE_PR_FIELD.SUBMIT) app.actions.submitCreatePr();
    else moveCursor(form, 1);
    return;
  }
  if (form.submitting) return;
  const next = FIELD_EDITORS[form.cursor]?.(form, input, key);
  // A key that changes nothing must not write to the store (every write is a frame).
  if (next) patchState({ createPr: { ...next, error: null } });
}
