import { updateState } from "../store";

const TREE_PRESETS = ["me", "with-prs", "all"];

/**
 * Opens the live "/" filter prompt for the current view: the diff file list
 * when the files pane has focus, otherwise the PR tree/list filter.
 * The existing value is kept editable (tree presets start a fresh draft) and
 * remembered for Esc-restore.
 */
export const openFilterPrompt = (): void => {
  updateState((c) => {
    const target = c.focus === "files" ? ("files" as const) : ("tree" as const);
    const current = target === "files" ? c.fileFilter : c.treeFilter;
    const draft = target === "tree" && TREE_PRESETS.includes(current) ? "" : current;
    return {
      previousFocus: c.focus,
      focus: "filter",
      filterTarget: target,
      filterRestore: current,
      ...(target === "files"
        ? { fileFilter: draft, selectedFileIndex: 0 }
        : { treeFilter: draft, selectedPrIndex: 0 }),
      banner:
        target === "files"
          ? "Filter files — type to filter, Enter apply, Esc cancel"
          : "Filter PRs — free text or author:, title:, merge:, tag: · Enter apply, Esc cancel",
    };
  });
};

/** Applies a text edit to the active filter — filtering is live while typing. */
export const editFilterText = (edit: (current: string) => string): void => {
  updateState((c) => {
    const current = c.filterTarget === "files" ? c.fileFilter : c.treeFilter;
    const next = edit(current);
    return c.filterTarget === "files"
      ? { fileFilter: next, selectedFileIndex: 0 }
      : { treeFilter: next, selectedPrIndex: 0 };
  });
};

/** Keeps the typed filter and closes the prompt (empty tree filter = all). */
export const applyFilter = (): void => {
  updateState((c) => {
    const text = (c.filterTarget === "files" ? c.fileFilter : c.treeFilter).trim();
    const cleared = text.length === 0;
    return {
      focus: c.previousFocus ?? "tree",
      ...(c.filterTarget === "files"
        ? { fileFilter: text }
        : { treeFilter: cleared ? "all" : text }),
      banner: cleared
        ? c.filterTarget === "files"
          ? "File filter cleared."
          : "Filter cleared (showing all)."
        : `Filter applied: ${text}`,
    };
  });
};

/** Discards the draft and restores the filter that was active before "/". */
export const cancelFilter = (): void => {
  updateState((c) => ({
    focus: c.previousFocus ?? "tree",
    ...(c.filterTarget === "files"
      ? { fileFilter: c.filterRestore }
      : { treeFilter: c.filterRestore }),
    banner: "Filter cancelled.",
  }));
};
