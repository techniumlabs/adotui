import type { Key } from "ink";
import { followSelection } from "../../utils";

export type DiffNavContext = {
  rowCount: number;
  selectedRow: number;
  scrollOffset: number;
  viewportH: number;
  onSelectedRowChange: (row: number) => void;
  onScrollOffsetChange: (offset: number) => void;
};

/**
 * Row-level diff navigation (j/k, g/G, PageUp/PageDown) with
 * scroll-follows-selection. Owned by the diff view — the central
 * `filesKeyboard.ts` deliberately does NOT bind these keys, so exactly one
 * handler reacts per keypress.
 *
 * Returns true when the input was handled.
 */
export function handleDiffNavigation(input: string, key: Key, ctx: DiffNavContext): boolean {
  const { rowCount, selectedRow, scrollOffset, viewportH, onSelectedRowChange, onScrollOffsetChange } = ctx;

  if (input === "j" || key.downArrow) {
    const nextRow = Math.min(selectedRow + 1, rowCount - 1);
    onSelectedRowChange(nextRow);
    const nextOffset = followSelection(nextRow, scrollOffset, viewportH);
    if (nextOffset !== scrollOffset) onScrollOffsetChange(nextOffset);
    return true;
  }
  if (input === "k" || key.upArrow) {
    const nextRow = Math.max(selectedRow - 1, 0);
    onSelectedRowChange(nextRow);
    const nextOffset = followSelection(nextRow, scrollOffset, viewportH);
    if (nextOffset !== scrollOffset) onScrollOffsetChange(nextOffset);
    return true;
  }
  if (input === "g") {
    onSelectedRowChange(0);
    onScrollOffsetChange(0);
    return true;
  }
  if (input === "G") {
    const nextRow = rowCount - 1;
    onSelectedRowChange(nextRow);
    onScrollOffsetChange(Math.max(0, nextRow - viewportH + 1));
    return true;
  }
  if (key.pageDown) {
    const nextRow = Math.min(selectedRow + viewportH, rowCount - 1);
    onSelectedRowChange(nextRow);
    if (nextRow >= scrollOffset + viewportH) {
      onScrollOffsetChange(Math.min(rowCount - viewportH, scrollOffset + viewportH));
    }
    return true;
  }
  if (key.pageUp) {
    const nextRow = Math.max(selectedRow - viewportH, 0);
    onSelectedRowChange(nextRow);
    if (nextRow < scrollOffset) {
      onScrollOffsetChange(Math.max(0, scrollOffset - viewportH));
    }
    return true;
  }
  return false;
}
