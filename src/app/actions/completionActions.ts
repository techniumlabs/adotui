import type { CompletionOptions } from "../types";
import { getState, patchState, updateState } from "../store";
import { armConfirm } from "./confirmActions";

export const openCompletionEditor = (prefill: CompletionOptions): void => {
  updateState((current) => ({
    // When opened via a typed command, fall back past "command" itself.
    previousFocus: current.focus === "command" ? (current.previousFocus ?? "list") : current.focus,
    focus: "completion",
    completionOptions: prefill,
    completionCursor: 0,
    banner: "Choose completion options, then press Enter on Complete PR.",
  }));
};

export const submitCompletion = (): void => {
  // Read options from the store at call time (no stale closure), close the
  // editor, then arm the confirmation LAST so nothing clobbers pendingConfirm.
  const options = getState().completionOptions;
  patchState({ focus: "list", commandText: "", completionCursor: 0 });
  armConfirm("complete", options);
};
