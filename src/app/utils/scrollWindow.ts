/** Shared scroll-window math for list and diff viewports. */

/** Clamps a scroll offset into [0, total - viewport] and derives indicators. */
export const computeScrollWindow = (
  total: number,
  viewport: number,
  offset: number,
): { offset: number; canScrollUp: boolean; canScrollDown: boolean } => {
  const clamped = Math.max(0, Math.min(offset, Math.max(0, total - viewport)));
  return {
    offset: clamped,
    canScrollUp: clamped > 0,
    canScrollDown: clamped + viewport < total,
  };
};

/**
 * Moves a list selection by `delta`, clamped to [0, count - 1].
 * An empty list stays at 0 — the naive `min(i + 1, count - 1)` yields -1,
 * an invalid index that survives until the list fills up.
 */
export const moveSelection = (current: number, delta: number, count: number): number =>
  count <= 0 ? 0 : Math.min(Math.max(current + delta, 0), count - 1);

/**
 * Returns the scroll offset that keeps `selected` visible inside a window of
 * `viewport` rows: scrolls up when the selection moves above the window,
 * down just enough when it passes the bottom, otherwise leaves the offset
 * unchanged.
 */
export const followSelection = (
  selected: number,
  offset: number,
  viewport: number,
): number => {
  if (selected < offset) return selected;
  if (selected >= offset + viewport) return selected - viewport + 1;
  return offset;
};
