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
  diffScrollOffset: 0,
  diffSelectedRow: 0,
  treeFilter: "me" satisfies TreeFilter,
  fileFilter: "",
  filterTarget: "tree",
  filterRestore: "",
  commentInputActive: false,
  loadState: "loading",
  loadProgress: null,
  pendingConfirm: null,
  fileScrollStates: {},
  toasts: [],
};

export const REFRESH_INTERVAL_MS = 60_000;

/**
 * Streamed partials are buffered and committed at most this often. Ink rewrites
 * the whole frame on every render, so committing per API response would
 * reintroduce the flicker that removing the spinners fixed; this matches the
 * progress throttle, giving a hard ceiling of 4 frames/second.
 */
export const PARTIAL_COMMIT_MS = 250;
/** Load-progress banner updates are throttled to this (final ones always pass). */
export const PROGRESS_THROTTLE_MS = 250;
/** After showing cached data, the background re-sync starts this much later. */
export const CACHE_REVALIDATE_DELAY_MS = 50;

/**
 * How long streamed partials wait for the identity before being released
 * anyway. The default "me" tree filter needs `currentUserEmail`: releasing
 * partials without it shows every repo and then visibly drops rows when it
 * lands, so a brief wait buys a stable first paint.
 */
export const IDENTITY_WAIT_MS = 500;

/** With nothing to show after a load (empty config, error), the splash leaves this much later. */
export const SPLASH_EMPTY_DISMISS_MS = 600;

export const TOAST_DURATION_MS = 3_000;
/** A transient status line in a view (e.g. "Comment posted."). */
export const STATUS_FLASH_MS = 3_000;
/** The "Reloaded — N threads." confirmation after R in the comments view. */
export const RELOAD_STATUS_MS = 2_000;

/** Used until the terminal reports its size. */
export const DEFAULT_TERMINAL_COLUMNS = 80;
export const DEFAULT_TERMINAL_ROWS = 24;

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
