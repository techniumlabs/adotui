import type { AppData } from "../domain/types";

export type FocusArea = "tree" | "list" | "detail" | "command" | "completion";

export type MergeStrategy = "noFastForward" | "squash" | "rebase" | "rebaseMerge";

export type DiffViewMode = "unified" | "split";

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
  focus: FocusArea;
  commandText: string;
  completionOptions: CompletionOptions;
  completionCursor: number;
  banner: string;
  autoRefresh: boolean;
  lastRefreshISO: string;
  diffViewMode: DiffViewMode;
};
