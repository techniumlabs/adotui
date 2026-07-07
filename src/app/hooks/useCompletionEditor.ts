import type { Dispatch, SetStateAction } from "react";
import type { AppState, CompletionOptions, ConfirmKind } from "../types";

type ArmConfirm = (kind: ConfirmKind, options?: CompletionOptions) => void;

export function useCompletionEditor(
  setState: Dispatch<SetStateAction<AppState>>,
  armConfirm: ArmConfirm,
) {
  const openCompletionEditor = (prefill: CompletionOptions) => {
    setState((current) => ({
      ...current,
      focus: "completion",
      completionOptions: prefill,
      completionCursor: 0,
      banner: "Choose completion options, then press Enter on Complete PR.",
    }));
  };

  const submitCompletion = () => {
    setState((current) => {
      // Read options inside the updater to avoid stale closure reads
      armConfirm("complete", current.completionOptions);
      return {
        ...current,
        focus: "list",
        commandText: "",
        completionCursor: 0,
      };
    });
  };

  return { openCompletionEditor, submitCompletion };
}
