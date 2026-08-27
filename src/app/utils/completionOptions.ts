import { DEFAULT_COMPLETION_OPTIONS } from "../constants";
import type { CompletionOptions, MergeStrategy } from "../types";

export const cycleMergeStrategy = (
  current: MergeStrategy,
  delta: 1 | -1,
): MergeStrategy => {
  const values: MergeStrategy[] = [
    "noFastForward",
    "squash",
    "rebase",
    "rebaseMerge",
  ];
  const currentIndex = values.indexOf(current);
  const nextIndex = (currentIndex + delta + values.length) % values.length;
  return values[nextIndex] ?? current;
};

export const serializeCompletionOptions = (options: CompletionOptions): string => {
  const parts = [
    `strategy=${options.mergeStrategy}`,
    `delete-branch=${options.deleteSourceBranch ? "yes" : "no"}`,
    `transition-work-items=${options.transitionWorkItems ? "yes" : "no"}`,
    `bypass-policy=${options.bypassPolicy ? "yes" : "no"}`,
  ];

  if (options.mergeCommitMessage) {
    parts.push(`message=${options.mergeCommitMessage}`);
  }

  if (options.bypassReason) {
    parts.push(`bypass-reason=${options.bypassReason}`);
  }

  if (options.autoCompleteIgnoreConfigIds.length > 0) {
    parts.push(
      `ignore-config-ids=${options.autoCompleteIgnoreConfigIds.join(",")}`,
    );
  }

  if (options.squashMerge) {
    parts.push("squash-merge=deprecated-on");
  }

  return parts.join(" | ");
};

export const parseCompletionCommand = (rawCommand: string): CompletionOptions => {
  const options = { ...DEFAULT_COMPLETION_OPTIONS };
  const tokens = rawCommand.match(/(?:[^\s"]+|"[^"]*")+/g) ?? [];

  for (const token of tokens) {
    if (token === "complete") {
      continue;
    }

    if (token === "--delete-source-branch") {
      options.deleteSourceBranch = true;
      continue;
    }

    if (token === "--no-delete-source-branch") {
      options.deleteSourceBranch = false;
      continue;
    }

    if (token === "--transition-work-items") {
      options.transitionWorkItems = true;
      continue;
    }

    if (token === "--no-transition-work-items") {
      options.transitionWorkItems = false;
      continue;
    }

    if (token === "--bypass-policy") {
      options.bypassPolicy = true;
      continue;
    }

    if (token === "--no-bypass-policy") {
      options.bypassPolicy = false;
      continue;
    }

    if (token === "--squash-merge") {
      options.squashMerge = true;
      options.mergeStrategy = "squash";
      continue;
    }

    const [rawKey, ...rawValueParts] = token.replace(/^--/, "").split("=");
    const value = rawValueParts.join("=").replace(/^"|"$/g, "");

    switch (rawKey) {
      case "merge-strategy":
        if (
          value === "noFastForward" ||
          value === "squash" ||
          value === "rebase" ||
          value === "rebaseMerge"
        ) {
          options.mergeStrategy = value;
          options.squashMerge = value === "squash";
        }
        break;
      case "merge-commit-message":
        options.mergeCommitMessage = value;
        break;
      case "bypass-reason":
        options.bypassReason = value;
        break;
      case "auto-complete-ignore-config-ids":
        options.autoCompleteIgnoreConfigIds = value
          .split(",")
          .map((entry) => Number(entry.trim()))
          .filter((entry) => Number.isFinite(entry));
        break;
    }
  }

  return options;
};
