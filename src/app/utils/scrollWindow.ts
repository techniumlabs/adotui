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
