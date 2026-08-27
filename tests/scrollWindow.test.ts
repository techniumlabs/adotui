import { describe, expect, test } from "bun:test";
import { computeScrollWindow, followSelection } from "../src/app/utils/scrollWindow";

describe("computeScrollWindow", () => {
  test("keeps a valid offset and reports both indicators", () => {
    expect(computeScrollWindow(20, 5, 3)).toEqual({ offset: 3, canScrollUp: true, canScrollDown: true });
  });

  test("clamps an offset beyond the end", () => {
    expect(computeScrollWindow(10, 4, 999)).toEqual({ offset: 6, canScrollUp: true, canScrollDown: false });
  });

  test("short lists never scroll", () => {
    expect(computeScrollWindow(3, 10, 2)).toEqual({ offset: 0, canScrollUp: false, canScrollDown: false });
  });

  test("negative offsets clamp to zero", () => {
    expect(computeScrollWindow(10, 4, -3)).toEqual({ offset: 0, canScrollUp: false, canScrollDown: true });
  });
});

describe("followSelection", () => {
  test("keeps the offset when the selection stays inside the window", () => {
    expect(followSelection(5, 3, 5)).toBe(3);
  });

  test("scrolls down just enough when the selection passes the bottom", () => {
    expect(followSelection(8, 3, 5)).toBe(4);
  });

  test("scrolls up to the selection when it moves above the window", () => {
    expect(followSelection(1, 3, 5)).toBe(1);
  });
});
