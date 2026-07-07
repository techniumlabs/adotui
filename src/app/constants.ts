import type { AppData } from "../domain/types";
import type { AppState, CompletionOptions, FocusArea, TreeFilter } from "./types";

export const EMPTY_DATA: AppData = { organizations: [] };

export const DEFAULT_COMPLETION_OPTIONS: CompletionOptions = {
  autoCompleteIgnoreConfigIds: [],
  bypassPolicy: false,
  bypassReason: "",
  deleteSourceBranch: true,
  mergeCommitMessage: "",
  mergeStrategy: "noFastForward",
  squashMerge: false,
  transitionWorkItems: true,
};

export const INITIAL_STATE: AppState = {
  data: EMPTY_DATA,
  selectedOrgIndex: 0,
  selectedRepoIndex: 0,
  selectedPrIndex: 0,
  selectedFileIndex: 0,
  focus: "tree",
  previousFocus: "tree",
  commandText: "",
  completionOptions: DEFAULT_COMPLETION_OPTIONS,
  completionCursor: 0,
  banner: "Loading pull requests from Azure DevOps...",
  autoRefresh: true,
  lastRefreshISO: new Date().toISOString(),
  diffViewMode: "unified",
  diffScrollOffset: 0,
  diffSelectedRow: 0,
  treeFilter: "with-prs" satisfies TreeFilter,
  fileFilter: "",
  commentInputActive: false,
  loadState: "loading",
  pendingConfirm: null,
  fileScrollStates: {},
  toasts: [],
};

export const REFRESH_INTERVAL_MS = 60_000;

export const FOCUS_ORDER: FocusArea[] = ["tree", "list", "detail", "files", "comments", "runs", "command"];

export const COMPLETION_FIELD_LABELS = [
  "merge strategy",
  "delete source branch",
  "transition work items",
  "bypass policy",
  "bypass reason",
  "merge commit message",
  "auto-complete ignore config ids",
  "squash merge",
  "complete PR",
] as const;

export const COMPLETION_FIELD_COUNT = 9;

/** Sentinel value for scrolling to the end of a diff. */
export const SCROLL_TO_END = Number.MAX_SAFE_INTEGER;

/** Named indices for the completion editor cursor. Avoids magic numbers in keyboard handlers. */
export const COMPLETION_CURSOR = {
  MERGE_STRATEGY: 0,
  DELETE_BRANCH:  1,
  TRANSITION_WI:  2,
  BYPASS_POLICY:  3,
  BYPASS_REASON:  4,
  COMMIT_MSG:     5,
  IGNORE_IDS:     6,
  SQUASH:         7,
  SUBMIT:         8,
} as const;
