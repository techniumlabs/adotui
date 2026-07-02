import type { AppData } from "../domain/types";

export type FocusArea = "tree" | "list" | "detail" | "command" | "completion" | "files";

export type MergeStrategy = "noFastForward" | "squash" | "rebase" | "rebaseMerge";

export type DiffViewMode = "unified" | "split";

export type LoadState = "loading" | "ready" | "error";

export type ConfirmKind = "approve" | "reject" | "abandon" | "complete";

/** Identifies the exact PR an action targets, captured when the action is armed. */
export type PrTarget = {
  organizationUrl: string;
  project: string;
  repository: string;
  prId: number;
  title: string;
};

/**
 * A pending destructive action awaiting y/n confirmation. Carries the target
 * PR identity captured at arm-time so the action always applies to the PR the
 * user was shown, regardless of later selection/refresh changes.
 */
export type PendingConfirm =
  | {
      kind: ConfirmKind;
      target: PrTarget;
      completionOptions?: CompletionOptions;
    }
  | null;

export type CompletionOptions = {
  autoCompleteIgnoreConfigIds: number[];
  bypassPolicy: boolean;
  bypassReason: string;
  deleteSourceBranch: boolean;
  mergeCommitMessage: string;
  mergeStrategy: MergeStrategy;
  squashMerge: boolean;
  transitionWorkItems: boolean;
};

export type AppState = {
  data: AppData;
  selectedOrgIndex: number;
  selectedRepoIndex: number;
  selectedPrIndex: number;
  selectedFileIndex: number;
  focus: FocusArea;
  commandText: string;
  completionOptions: CompletionOptions;
  completionCursor: number;
  banner: string;
  autoRefresh: boolean;
  lastRefreshISO: string;
  diffViewMode: DiffViewMode;
  loadState: LoadState;
  pendingConfirm: PendingConfirm;
};
