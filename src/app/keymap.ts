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
      { keys: "Tab/Shift+Tab", description: "Cycle pane focus fwd / back" },
      { keys: "1-3", description: "PR tabs: Overview · Diff · Comments" },
      { keys: "4", description: "PR tab: Pipelines", debugOnly: true },
      { keys: "h", description: "Back to the PR list" },
      { keys: "v", description: "Tree filter: me → with-prs → all" },
      { keys: "/", description: "Filter current view (live)" },
      { keys: ":", description: "Command mode" },
      { keys: "r", description: "Refresh from Azure DevOps" },
      { keys: "? / q", description: "This help / quit" },
    ],
  },
  {
    title: "PR Actions (confirm with y)",
    bindings: [
      { keys: "a", description: "Approve PR" },
      { keys: "x", description: "Reject (request changes)" },
      { keys: "b", description: "Abandon PR" },
      { keys: "c", description: "Complete & merge (options)" },
      { keys: "o", description: "Open PR in browser" },
    ],
  },
  {
    title: "Tree / PR List",
    bindings: [
      { keys: "j/k ↑/↓", description: "Move selection" },
      { keys: "h/l ←/→", description: "Tree: org · List: tree/detail" },
      { keys: "Enter", description: "Tree: to list · List: overview" },
      { keys: "m", description: "Comments (same as 3)" },
      { keys: "p", description: "Pipelines", debugOnly: true },
    ],
  },
  {
    title: "Diff (2)",
    bindings: [
      { keys: "←/→", description: "Prev / next file" },
      { keys: "j/k ↑/↓", description: "Move row selection" },
      { keys: "g / G", description: "Top / bottom" },
      { keys: "PgUp/PgDn", description: "Scroll a viewport" },
      { keys: "n", description: "Comment on selected line" },
    ],
  },
  {
    title: "Comments (3)",
    bindings: [
      { keys: "j/k ↑/↓", description: "Move between threads" },
      { keys: "←/→", description: "Select root / replies" },
      { keys: "n / r / e", description: "New / reply / edit" },
      { keys: "d", description: "Delete own comment (y/n)" },
      { keys: "s", description: "Toggle resolved" },
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
      { keys: "filter <q>", description: "Filter: author: title: merge: tag:" },
      { keys: "find <q>", description: "Wildcard file filter (bare = clear)" },
      { keys: "actions", description: "approve · reject · abandon · complete" },
      { keys: "misc", description: "refresh · toggle-auto · reset · open" },
      { keys: "Esc", description: "Back to previous view" },
    ],
  },
];

export type FooterHint = { keys: string; label: string };

/** Curated subset of the keymap for the persistent footer hint bar. */
export const footerHints = (hasSelectedPr: boolean): FooterHint[] => {
  const tabRange = process.env.NODE_ENV === "debug" ? "1-4" : "1-3";
  const base: FooterHint[] = [
    { keys: "/", label: "filter" },
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
