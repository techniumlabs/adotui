import { beforeEach, expect, test } from "bun:test";
import type { Key } from "ink";
import { handleCompletion } from "../src/app/hooks/keyboard/completionKeyboard";
import { useAppStore } from "../src/app/store";
import { COMPLETION_CURSOR, DEFAULT_COMPLETION_OPTIONS, INITIAL_STATE } from "../src/app/constants";
import type { AppHandle } from "../src/app/hooks/useAppState";

const NO_KEY: Key = {
  upArrow: false, downArrow: false, leftArrow: false, rightArrow: false, pageDown: false, pageUp: false,
  home: false, end: false, return: false, escape: false, ctrl: false, shift: false, tab: false,
  backspace: false, delete: false, meta: false, super: false, hyper: false, capsLock: false, numLock: false,
} as Key;

let submitted = 0;
const press = (input: string, key: Partial<Key> = {}) => {
  const app = { state: useAppStore.getState(), actions: { submitCompletion: () => { submitted += 1; } } } as unknown as AppHandle;
  handleCompletion(input, { ...NO_KEY, ...key }, app, () => {});
};
const at = (cursor: number) => useAppStore.setState({ completionCursor: cursor });
const opts = () => useAppStore.getState().completionOptions;

beforeEach(() => {
  submitted = 0;
  useAppStore.setState({ ...INITIAL_STATE, focus: "completion", completionOptions: { ...DEFAULT_COMPLETION_OPTIONS } });
});

test("merge strategy cycles with left/right and h/l, keeping squashMerge in step", () => {
  at(COMPLETION_CURSOR.MERGE_STRATEGY);
  press("", { rightArrow: true });
  expect(opts()).toMatchObject({ mergeStrategy: "squash", squashMerge: true });
  press("l");
  expect(opts()).toMatchObject({ mergeStrategy: "rebase", squashMerge: false });
  press("h");
  press("", { leftArrow: true });
  expect(opts().mergeStrategy).toBe("noFastForward");
});

test("toggles flip on left, right and space; other keys do nothing", () => {
  at(COMPLETION_CURSOR.DELETE_BRANCH);
  press(" ");
  expect(opts().deleteSourceBranch).toBe(false);
  press("x");
  expect(opts().deleteSourceBranch).toBe(false);
  at(COMPLETION_CURSOR.TRANSITION_WI);
  press("", { leftArrow: true });
  expect(opts().transitionWorkItems).toBe(false);
  at(COMPLETION_CURSOR.BYPASS_POLICY);
  press("", { rightArrow: true });
  expect(opts().bypassPolicy).toBe(true);
});

test("text fields take typed characters, spaces included, and backspace", () => {
  at(COMPLETION_CURSOR.COMMIT_MSG);
  for (const ch of ["a", "b", " ", "c"]) press(ch);
  expect(opts().mergeCommitMessage).toBe("ab c");
  press("", { backspace: true });
  expect(opts().mergeCommitMessage).toBe("ab ");
  press("z", { ctrl: true });
  expect(opts().mergeCommitMessage).toBe("ab ");
  at(COMPLETION_CURSOR.BYPASS_REASON);
  press("r");
  expect(opts().bypassReason).toBe("r");
});

test("ignore ids parse digits and commas", () => {
  at(COMPLETION_CURSOR.IGNORE_IDS);
  for (const ch of ["1", "2", ",", "7", "x"]) press(ch);
  expect(opts().autoCompleteIgnoreConfigIds).toEqual([12, 7]);
  press("", { delete: true });
  expect(opts().autoCompleteIgnoreConfigIds).toEqual([12]);
});

test("squash toggle switches the strategy to squash and back", () => {
  at(COMPLETION_CURSOR.SQUASH);
  press(" ");
  expect(opts()).toMatchObject({ squashMerge: true, mergeStrategy: "squash" });
  press(" ");
  expect(opts()).toMatchObject({ squashMerge: false, mergeStrategy: "noFastForward" });
});

test("navigation, submit and escape", () => {
  at(0);
  press("", { downArrow: true });
  press("", { tab: true });
  expect(useAppStore.getState().completionCursor).toBe(2);
  press("", { upArrow: true });
  expect(useAppStore.getState().completionCursor).toBe(1);
  at(COMPLETION_CURSOR.SUBMIT);
  press("", { return: true });
  expect(submitted).toBe(1);
  press("", { escape: true });
  expect(useAppStore.getState().banner).toBe("Completion cancelled.");
});

test("a key that changes nothing does not write to the store", () => {
  at(COMPLETION_CURSOR.SUBMIT);
  let writes = 0;
  const unsubscribe = useAppStore.subscribe(() => { writes += 1; });
  press("q");
  unsubscribe();
  expect(writes).toBe(0);
});
