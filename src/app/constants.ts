import { MOCK_DATA } from "../data/mock";
import type { AppState, CompletionOptions, FocusArea } from "./types";

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
  data: MOCK_DATA,
  selectedOrgIndex: 0,
  selectedRepoIndex: 0,
  selectedPrIndex: 0,
  focus: "tree",
  commandText: "",
  completionOptions: DEFAULT_COMPLETION_OPTIONS,
  completionCursor: 0,
  banner: "UI-first shell ready. Data is currently mocked.",
  autoRefresh: true,
  lastRefreshISO: new Date().toISOString(),
  diffViewMode: "unified",
};

export const REFRESH_INTERVAL_MS = 60_000;

export const FOCUS_ORDER: FocusArea[] = ["tree", "list", "detail", "command"];

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
