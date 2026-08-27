export type KeyBinding = {
  /** Display form of the key(s), e.g. "j/k", "Shift+Tab". */
  keys: string;
  description: string;
  /** Only active/shown when NODE_ENV=debug. */
  debugOnly?: boolean;
};

export type KeymapSection = {
  title: string;
  bindings: KeyBinding[];
  /** Whole section only applies to debug builds. */
  debugOnly?: boolean;
};

/**
 * Single source of truth for documented keyboard shortcuts. Handlers live in
 * src/app/hooks/keyboard/ and the self-contained views; when a binding
 * changes there, update this table — HelpView and the footer render from it.
 */
export const KEYMAP: KeymapSection[] = [
  {
    title: "Global Navigation",
    bindings: [
      { keys: "Tab / Shift+Tab", description: "Cycle pane focus forward / backward" },
      { keys: "1-3", description: "PR tab: Overview(1), Diff(2), Comments(3)" },
      { keys: "4", description: "PR tab: Pipelines", debugOnly: true },
      { keys: "h / ←", description: "Back to the PR list from a PR tab" },
      { keys: "v", description: "Cycle tree filter: me → with-prs → all" },
      { keys: ": or /", description: "Open command mode" },
      { keys: "r", description: "Refresh from Azure DevOps" },
      { keys: "?", description: "Toggle this help screen" },
      { keys: "q", description: "Quit" },
    ],
  },
  {
    title: "PR Actions (require a literal y to confirm)",
    bindings: [
      { keys: "a", description: "Approve PR" },
      { keys: "x", description: "Reject PR (request changes)" },
      { keys: "b", description: "Abandon PR" },
      { keys: "c", description: "Complete & merge PR (options editor)" },
      { keys: "o", description: "Open PR in browser" },
    ],
  },
  {
    title: "Tree / PR List",
    bindings: [
      { keys: "j/k or ↑/↓", description: "Move selection" },
      { keys: "h/l or ←/→", description: "Tree: prev/next org · List: tree / overview" },
      { keys: "Enter", description: "Tree: focus PR list · List: open overview" },
      { keys: "m", description: "List: open comments (same as 3)" },
      { keys: "p", description: "List: open pipelines", debugOnly: true },
    ],
  },
  {
    title: "Diff (2)",
    bindings: [
      { keys: "[ / ]", description: "Previous / next file" },
      { keys: "j/k or ↑/↓", description: "Move row selection" },
      { keys: "g / G", description: "Jump to top / bottom" },
      { keys: "PgUp/PgDn", description: "Scroll a viewport" },
      { keys: "n", description: "Comment on the selected line (Enter send · Esc cancel)" },
    ],
  },
  {
    title: "Comments (3)",
    bindings: [
      { keys: "j/k or ↑/↓", description: "Move between threads" },
      { keys: "[ / ] or ←/→", description: "Select root comment / replies" },
      { keys: "n / r / e", description: "New thread / reply / edit own comment" },
      { keys: "d", description: "Delete own comment (asks y/n)" },
      { keys: "s", description: "Toggle thread resolved" },
      { keys: "R", description: "Reload comments" },
    ],
  },
  {
    title: "Pipelines (4)",
    debugOnly: true,
    bindings: [
      { keys: "j/k", description: "Move selection" },
      { keys: "o", description: "Open run in browser" },
      { keys: "R", description: "Reload runs" },
    ],
  },
  {
    title: "Command Mode (:)",
    bindings: [
      { keys: "filter <query>", description: "Filter tree/list (author:, title:, merge:, tag:)" },
      { keys: "find <query>", description: "Wildcard file filter in Diff (bare find clears)" },
      { keys: "approve · reject · abandon · complete", description: "PR actions" },
      { keys: "refresh · toggle-auto · reset · open · help · quit", description: "Utilities" },
      { keys: "Esc", description: "Cancel (returns to the previous view)" },
    ],
  },
];

export type FooterHint = { keys: string; label: string };

/** Curated subset of the keymap for the persistent footer hint bar. */
export const footerHints = (hasSelectedPr: boolean): FooterHint[] => {
  const tabRange = process.env.NODE_ENV === "debug" ? "1-4" : "1-3";
  const base: FooterHint[] = [
    { keys: ":", label: "commands" },
    { keys: "j/k", label: "move" },
    { keys: tabRange, label: "view tab" },
    { keys: "tab", label: "focus" },
  ];
  const actions: FooterHint[] = hasSelectedPr
    ? [
        { keys: "a", label: "approve" },
        { keys: "x", label: "reject" },
        { keys: "b", label: "abandon" },
        { keys: "c", label: "complete" },
      ]
    : [{ keys: "enter", label: "open pr" }];
  return [...base, ...actions, { keys: "?", label: "help" }, { keys: "q", label: "quit" }];
};
