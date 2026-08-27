/** PR mutations: voting, abandoning and completing via `az repos pr`. */
import type { CompletionOptions } from "../app/types";
import { run } from "./command";
import { AZ, orgArgs, jsonOutput } from "./azureCommon";

/** Identifies a specific PR for actions. */
export interface PrRef {
  organization: string;
  project: string;
  repository: string;
  prId: number;
}

/**
 * `az repos pr update` only exposes `--squash` for merge control; the other
 * domain strategies (noFastForward / rebase / rebaseMerge) cannot be selected
 * via this CLI and are governed by branch policy / server defaults. Callers
 * should surface `completionStrategyNote` to avoid claiming an unsupported
 * strategy was applied.
 */
export const completionStrategyNote = (
  options: CompletionOptions,
): string | null => {
  if (options.mergeStrategy === "squash" || options.mergeStrategy === "noFastForward") {
    return null;
  }
  return `Note: '${options.mergeStrategy}' is not selectable via az; Azure used its policy/default merge.`;
};

const mergeStrategyToAzFlags = (options: CompletionOptions): string[] => {
  // Azure `pr update` completion only supports --squash; other strategies are
  // governed by branch policy. We pass squash when selected (see
  // completionStrategyNote for how unsupported strategies are surfaced).
  const flags: string[] = [];
  flags.push("--squash", options.mergeStrategy === "squash" ? "true" : "false");
  flags.push(
    "--delete-source-branch",
    options.deleteSourceBranch ? "true" : "false",
  );
  flags.push(
    "--transition-work-items",
    options.transitionWorkItems ? "true" : "false",
  );
  if (options.bypassPolicy) {
    flags.push("--bypass-policy", "true");
    if (options.bypassReason) {
      flags.push("--bypass-policy-reason", options.bypassReason);
    }
  }
  if (options.mergeCommitMessage) {
    flags.push("--merge-commit-message", options.mergeCommitMessage);
  }
  return flags;
};

export const setVote = async (
  ref: PrRef,
  vote: "approve" | "approve-with-suggestions" | "reject" | "reset" | "wait-for-author",
): Promise<void> => {
  await run(AZ, [
    "repos",
    "pr",
    "set-vote",
    "--id",
    String(ref.prId),
    "--vote",
    vote,
    ...orgArgs(ref.organization),
    ...jsonOutput,
  ]);
};

export const approvePr = (ref: PrRef): Promise<void> => setVote(ref, "approve");

export const rejectPr = (ref: PrRef): Promise<void> => setVote(ref, "reject");

export const abandonPr = async (ref: PrRef): Promise<void> => {
  await run(AZ, [
    "repos",
    "pr",
    "update",
    "--id",
    String(ref.prId),
    "--status",
    "abandoned",
    ...orgArgs(ref.organization),
    ...jsonOutput,
  ]);
};

export const completePr = async (
  ref: PrRef,
  options: CompletionOptions,
): Promise<void> => {
  await run(AZ, [
    "repos",
    "pr",
    "update",
    "--id",
    String(ref.prId),
    "--status",
    "completed",
    ...mergeStrategyToAzFlags(options),
    ...orgArgs(ref.organization),
    ...jsonOutput,
  ]);
};
