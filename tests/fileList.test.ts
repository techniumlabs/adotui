import { expect, test } from "bun:test";
import { isFileShown } from "../src/app/components/diff/FileList";

const shown = (selected: number, count: number) =>
  Array.from({ length: count }, (_, i) => i).filter((i) => isFileShown(i, selected, count));

test("five or fewer files: all shown", () => {
  expect(shown(0, 5)).toEqual([0, 1, 2, 3, 4]);
});

test("near the top: the first five", () => {
  expect(shown(1, 9)).toEqual([0, 1, 2, 3, 4]);
});

test("near the bottom: the last five", () => {
  expect(shown(8, 9)).toEqual([4, 5, 6, 7, 8]);
  expect(shown(7, 9)).toEqual([4, 5, 6, 7, 8]);
});

test("in the middle: the selection ±2", () => {
  expect(shown(4, 9)).toEqual([2, 3, 4, 5, 6]);
});
