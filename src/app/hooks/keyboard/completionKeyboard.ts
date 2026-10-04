import type { Key } from "ink";
import type { AppHandle } from "../useAppState";
import { COMPLETION_FIELD_COUNT, COMPLETION_CURSOR } from "../../constants";
import { clamp, cycleMergeStrategy } from "../../utils";
import { getState, patchState, updateState } from "../../store";
import type { CompletionOptions } from "../../types";

/** Edits one completion field for a key press; null = the key does nothing on this field. */
type FieldEditor = (opts: CompletionOptions, input: string, key: Key) => CompletionOptions | null;

const togglesField = (input: string, key: Key): boolean => key.leftArrow || key.rightArrow || input === " ";
const typesText = (input: string, key: Key): boolean => !key.ctrl && !key.meta && input !== "";

const toggle =
  (field: "deleteSourceBranch" | "transitionWorkItems" | "bypassPolicy"): FieldEditor =>
  (opts, input, key) => (togglesField(input, key) ? { ...opts, [field]: !opts[field] } : null);

const text =
  (field: "bypassReason" | "mergeCommitMessage"): FieldEditor =>
  (opts, input, key) => {
    if (key.backspace || key.delete) return { ...opts, [field]: opts[field].slice(0, -1) };
    if (typesText(input, key) && input !== " ") return { ...opts, [field]: `${opts[field]}${input}` };
    return null;
  };

const mergeStrategy: FieldEditor = (opts, input, key) => {
  const step = key.leftArrow || input === "h" ? -1 : key.rightArrow || input === "l" ? 1 : 0;
  if (step === 0) return null;
  const strategy = cycleMergeStrategy(opts.mergeStrategy, step);
  return { ...opts, mergeStrategy: strategy, squashMerge: strategy === "squash" };
};

const ignoreIds: FieldEditor = (opts, input, key) => {
  if (key.backspace || key.delete) {
    return { ...opts, autoCompleteIgnoreConfigIds: opts.autoCompleteIgnoreConfigIds.slice(0, -1) };
  }
  if (!typesText(input, key) || !/[0-9,\s]/.test(input)) return null;
  const typed = `${opts.autoCompleteIgnoreConfigIds.join(",")}${input}`.replace(/\s+/g, "");
  const ids = typed.split(",").map((e) => Number(e.trim())).filter((e) => Number.isFinite(e));
  return { ...opts, autoCompleteIgnoreConfigIds: ids };
};

const squash: FieldEditor = (opts, input, key) => {
  if (!togglesField(input, key)) return null;
  const squashMerge = !opts.squashMerge;
  const fallback = opts.mergeStrategy === "squash" ? "noFastForward" : opts.mergeStrategy;
  return { ...opts, squashMerge, mergeStrategy: squashMerge ? "squash" : fallback };
};

/** Field under the cursor → how a key edits it (the submit row has none). */
const FIELD_EDITORS: Partial<Record<number, FieldEditor>> = {
  [COMPLETION_CURSOR.MERGE_STRATEGY]: mergeStrategy,
  [COMPLETION_CURSOR.DELETE_BRANCH]: toggle("deleteSourceBranch"),
  [COMPLETION_CURSOR.TRANSITION_WI]: toggle("transitionWorkItems"),
  [COMPLETION_CURSOR.BYPASS_POLICY]: toggle("bypassPolicy"),
  [COMPLETION_CURSOR.BYPASS_REASON]: text("bypassReason"),
  [COMPLETION_CURSOR.COMMIT_MSG]: text("mergeCommitMessage"),
  [COMPLETION_CURSOR.IGNORE_IDS]: ignoreIds,
  [COMPLETION_CURSOR.SQUASH]: squash,
};

export function handleCompletion(input: string, key: Key, app: AppHandle, _exitApp: () => void): void {
  const { state, actions } = app;

  if (key.escape) {
    updateState((c) => ({ focus: c.previousFocus ?? "list", banner: "Completion cancelled." }));
    return;
  }

  if (key.upArrow) {
    updateState((c) => ({ completionCursor: clamp(c.completionCursor - 1, 0, COMPLETION_FIELD_COUNT - 1) }));
    return;
  }
  if (key.downArrow || key.tab) {
    updateState((c) => ({ completionCursor: clamp(c.completionCursor + 1, 0, COMPLETION_FIELD_COUNT - 1) }));
    return;
  }
  if (key.return) {
    if (state.completionCursor === COMPLETION_FIELD_COUNT - 1) {
      actions.submitCompletion();
    } else {
      updateState((c) => ({ completionCursor: clamp(c.completionCursor + 1, 0, COMPLETION_FIELD_COUNT - 1) }));
    }
    return;
  }

  const edit = FIELD_EDITORS[state.completionCursor];
  const next = edit?.(getState().completionOptions, input, key);
  // Keys that change nothing must not touch the store: every set is a full Ink frame.
  if (next) patchState({ completionOptions: next });
}
