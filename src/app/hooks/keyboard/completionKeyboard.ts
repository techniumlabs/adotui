import type { Key } from "ink";
import type { AppHandle } from "../useAppState";
import { COMPLETION_FIELD_COUNT, COMPLETION_CURSOR } from "../../constants";
import { clamp, cycleMergeStrategy } from "../../utils";

export function handleCompletion(input: string, key: Key, app: AppHandle, _exitApp: () => void): void {
  const { state, setState, actions } = app;

  if (key.escape) {
    setState((c) => ({ ...c, focus: "list", banner: "Completion cancelled." }));
    return;
  }

  const isTextField = state.completionCursor >= COMPLETION_CURSOR.BYPASS_REASON &&
    state.completionCursor <= COMPLETION_CURSOR.IGNORE_IDS;

  if (key.upArrow || (!isTextField && input === "k")) {
    setState((c) => ({ ...c, completionCursor: clamp(c.completionCursor - 1, 0, COMPLETION_FIELD_COUNT - 1) }));
    return;
  }
  if (key.downArrow || key.tab || (!isTextField && input === "j")) {
    setState((c) => ({ ...c, completionCursor: clamp(c.completionCursor + 1, 0, COMPLETION_FIELD_COUNT - 1) }));
    return;
  }
  if (key.return) {
    if (state.completionCursor === COMPLETION_FIELD_COUNT - 1) {
      actions.submitCompletion();
    } else {
      setState((c) => ({ ...c, completionCursor: clamp(c.completionCursor + 1, 0, COMPLETION_FIELD_COUNT - 1) }));
    }
    return;
  }

  setState((current) => {
    const c = current.completionCursor;
    const opts = current.completionOptions;

    if (c === COMPLETION_CURSOR.MERGE_STRATEGY) {
      if (key.leftArrow || input === "h") {
        const s = cycleMergeStrategy(opts.mergeStrategy, -1);
        return { ...current, completionOptions: { ...opts, mergeStrategy: s, squashMerge: s === "squash" } };
      }
      if (key.rightArrow || input === "l") {
        const s = cycleMergeStrategy(opts.mergeStrategy, 1);
        return { ...current, completionOptions: { ...opts, mergeStrategy: s, squashMerge: s === "squash" } };
      }
    }
    if (c === COMPLETION_CURSOR.DELETE_BRANCH && (key.leftArrow || key.rightArrow || input === " "))
      return { ...current, completionOptions: { ...opts, deleteSourceBranch: !opts.deleteSourceBranch } };
    if (c === COMPLETION_CURSOR.TRANSITION_WI && (key.leftArrow || key.rightArrow || input === " "))
      return { ...current, completionOptions: { ...opts, transitionWorkItems: !opts.transitionWorkItems } };
    if (c === COMPLETION_CURSOR.BYPASS_POLICY && (key.leftArrow || key.rightArrow || input === " "))
      return { ...current, completionOptions: { ...opts, bypassPolicy: !opts.bypassPolicy } };

    if (c === COMPLETION_CURSOR.BYPASS_REASON) {
      if (key.backspace || key.delete)
        return { ...current, completionOptions: { ...opts, bypassReason: opts.bypassReason.slice(0, -1) } };
      if (!key.ctrl && !key.meta && input && input !== " ")
        return { ...current, completionOptions: { ...opts, bypassReason: `${opts.bypassReason}${input}` } };
    }
    if (c === COMPLETION_CURSOR.COMMIT_MSG) {
      if (key.backspace || key.delete)
        return { ...current, completionOptions: { ...opts, mergeCommitMessage: opts.mergeCommitMessage.slice(0, -1) } };
      if (!key.ctrl && !key.meta && input && input !== " ")
        return { ...current, completionOptions: { ...opts, mergeCommitMessage: `${opts.mergeCommitMessage}${input}` } };
    }
    if (c === COMPLETION_CURSOR.IGNORE_IDS) {
      if (key.backspace || key.delete)
        return { ...current, completionOptions: { ...opts, autoCompleteIgnoreConfigIds: opts.autoCompleteIgnoreConfigIds.slice(0, -1) } };
      if (!key.ctrl && !key.meta && input && /[0-9,\s]/.test(input)) {
        const text = `${opts.autoCompleteIgnoreConfigIds.join(",")}${input}`.replace(/\s+/g, "");
        return {
          ...current,
          completionOptions: {
            ...opts,
            autoCompleteIgnoreConfigIds: text.split(",").map((e) => Number(e.trim())).filter((e) => Number.isFinite(e)),
          },
        };
      }
    }
    if (c === COMPLETION_CURSOR.SQUASH && (key.leftArrow || key.rightArrow || input === " ")) {
      const nextSquash = !opts.squashMerge;
      return {
        ...current,
        completionOptions: {
          ...opts,
          squashMerge: nextSquash,
          mergeStrategy: nextSquash ? "squash" : opts.mergeStrategy === "squash" ? "noFastForward" : opts.mergeStrategy,
        },
      };
    }
    return current;
  });
}
