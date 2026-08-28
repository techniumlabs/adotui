import { describe, expect, test } from "bun:test";
import type { Key } from "ink";
import { handleDiffNavigation, type DiffNavContext } from "../src/app/components/diff/diffKeyboard";

const key = (overrides: Partial<Key> = {}): Key => overrides as Key;
const DOWN = key({ downArrow: true });
const UP = key({ upArrow: true });

const makeCtx = (overrides: Partial<DiffNavContext> = {}) => {
  const calls = { row: [] as number[], offset: [] as number[] };
  const ctx: DiffNavContext = {
    rowCount: 20,
    selectedRow: 5,
    scrollOffset: 0,
    viewportH: 10,
    onSelectedRowChange: (row) => calls.row.push(row),
    onScrollOffsetChange: (offset) => calls.offset.push(offset),
    ...overrides,
  };
  return { ctx, calls };
};

describe("handleDiffNavigation", () => {
  test("down arrow moves without scrolling inside the window", () => {
    const { ctx, calls } = makeCtx();
    expect(handleDiffNavigation("", DOWN, ctx)).toBe(true);
    expect(calls.row).toEqual([6]);
    expect(calls.offset).toEqual([]);
  });

  test("down arrow at the window bottom scrolls one row", () => {
    const { ctx, calls } = makeCtx({ selectedRow: 9 });
    handleDiffNavigation("", DOWN, ctx);
    expect(calls.row).toEqual([10]);
    expect(calls.offset).toEqual([1]);
  });

  test("down arrow clamps at the last row without scrolling past the end", () => {
    const { ctx, calls } = makeCtx({ selectedRow: 19, scrollOffset: 10 });
    handleDiffNavigation("", DOWN, ctx);
    expect(calls.row).toEqual([19]);
    expect(calls.offset).toEqual([]);
  });

  test("up arrow above the window scrolls up", () => {
    const { ctx, calls } = makeCtx({ selectedRow: 3, scrollOffset: 3 });
    handleDiffNavigation("", UP, ctx);
    expect(calls.row).toEqual([2]);
    expect(calls.offset).toEqual([2]);
  });

  test("g jumps home", () => {
    const { ctx, calls } = makeCtx({ selectedRow: 15, scrollOffset: 8 });
    handleDiffNavigation("g", key(), ctx);
    expect(calls.row).toEqual([0]);
    expect(calls.offset).toEqual([0]);
  });

  test("G jumps to the end", () => {
    const { ctx, calls } = makeCtx();
    handleDiffNavigation("G", key(), ctx);
    expect(calls.row).toEqual([19]);
    expect(calls.offset).toEqual([10]);
  });

  test("pageDown advances a full viewport", () => {
    const { ctx, calls } = makeCtx({ selectedRow: 0 });
    handleDiffNavigation("", key({ pageDown: true }), ctx);
    expect(calls.row).toEqual([10]);
    expect(calls.offset).toEqual([10]);
  });

  test("unhandled keys return false and change nothing", () => {
    const { ctx, calls } = makeCtx();
    expect(handleDiffNavigation("z", key(), ctx)).toBe(false);
    expect(calls.row).toEqual([]);
    expect(calls.offset).toEqual([]);
  });
});
