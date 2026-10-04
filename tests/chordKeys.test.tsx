import { beforeEach, describe, expect, test } from "bun:test";
import { render } from "ink-testing-library";
import { App } from "../src/app/App";
import { useAppStore } from "../src/app/store";
import { INITIAL_STATE } from "../src/app/constants";
import { isChord } from "../src/app/hooks/keyboard/keys";
import { pressUntil, until } from "./helpers/wait";

process.env.ADOTUI_MOCK = "1";
process.env.NODE_ENV = "test";

// What a terminal sends for Ctrl+<letter>: the letter's position in the alphabet.
const CTRL = { A: "\x01", B: "\x02", N: "\x0e", X: "\x18", Y: "\x19" } as const;
const ESCAPE = "\x1b";

const settle = () => new Promise((res) => setTimeout(res, 150));
const state = () => useAppStore.getState();

const start = async () => {
  const app = render(<App />);
  await until(() => state().loadState === "ready", "the mock data to load");
  return app;
};

beforeEach(() => {
  useAppStore.setState({ ...INITIAL_STATE });
});

describe("isChord", () => {
  test("Ctrl/Alt with a printable key is a chord", () => {
    expect(isChord("a", { ctrl: true, meta: false })).toBe(true);
    expect(isChord("x", { ctrl: false, meta: true })).toBe(true);
    expect(isChord("?", { ctrl: true, meta: false })).toBe(true);
  });

  test("plain keys, and modifiers on non-printable keys, are not", () => {
    expect(isChord("a", { ctrl: false, meta: false })).toBe(false);
    expect(isChord("", { ctrl: false, meta: true })).toBe(false); // Escape / Alt+arrow
    expect(isChord("\r", { ctrl: true, meta: false })).toBe(false);
    expect(isChord("அ", { ctrl: false, meta: true })).toBe(false); // non-ASCII text input
  });
});

describe("PR action shortcuts are plain keys only", () => {
  test("Ctrl+A / Ctrl+X / Ctrl+B do not open the approve / reject / abandon prompt", async () => {
    const { stdin } = await start();
    for (const chord of [CTRL.A, CTRL.X, CTRL.B]) {
      stdin.write(chord);
      await settle();
      expect(state().pendingConfirm).toBeNull();
    }
  });

  test("plain a still opens the approve prompt", async () => {
    const { stdin } = await start();
    await pressUntil(stdin, "a", () => state().pendingConfirm?.kind === "approve", "the approve prompt");
  });

  test("Ctrl+Y does not confirm a pending action; the prompt stays until y or another key", async () => {
    const { stdin } = await start();
    await pressUntil(stdin, "a", () => state().pendingConfirm?.kind === "approve", "the approve prompt");

    stdin.write(CTRL.Y);
    await settle();
    expect(state().pendingConfirm?.kind).toBe("approve");
    expect(state().banner).not.toContain("Applied locally");

    stdin.write("n");
    await until(() => state().pendingConfirm === null, "the prompt to close");
    expect(state().banner).toContain("cancelled");
  });
});

describe("view-level shortcuts are plain keys only", () => {
  test("Comments: Ctrl+N does not open the new-comment box, plain n does", async () => {
    const { stdin } = await start();
    await pressUntil(stdin, "3", () => state().focus === "comments", "the Comments tab");

    stdin.write(CTRL.N);
    await settle();
    expect(state().commentInputActive).toBe(false);

    await pressUntil(stdin, "n", () => state().commentInputActive, "the new-comment box");
    stdin.write(ESCAPE);
    await until(() => !state().commentInputActive, "the box to close");
  });

  test("Diff: Ctrl+N does not open the line-comment box, plain n does", async () => {
    const { stdin } = await start();
    await pressUntil(stdin, "2", () => state().focus === "files", "the Diff tab");

    stdin.write(CTRL.N);
    await settle();
    expect(state().commentInputActive).toBe(false);

    await pressUntil(stdin, "n", () => state().commentInputActive, "the line-comment box");
    stdin.write(ESCAPE);
    await until(() => !state().commentInputActive, "the box to close");
  });
});
