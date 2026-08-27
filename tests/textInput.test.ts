import { describe, expect, test } from "bun:test";
import type { Key } from "ink";
import { applyTextEdit } from "../src/app/components/setup/textInput";

const key = (overrides: Partial<Key> = {}): Key => overrides as Key;

describe("applyTextEdit", () => {
  test("appends printable characters", () => {
    expect(applyTextEdit("ab", "c", key())).toBe("abc");
  });

  test("backspace and delete erase the last character", () => {
    expect(applyTextEdit("abc", "", key({ backspace: true }))).toBe("ab");
    expect(applyTextEdit("abc", "", key({ delete: true }))).toBe("ab");
  });

  test("erasing an empty value stays empty", () => {
    expect(applyTextEdit("", "", key({ backspace: true }))).toBe("");
  });

  test("ctrl/meta chords are not text edits", () => {
    expect(applyTextEdit("ab", "c", key({ ctrl: true }))).toBeNull();
    expect(applyTextEdit("ab", "c", key({ meta: true }))).toBeNull();
  });

  test("non-text keys return null", () => {
    expect(applyTextEdit("ab", "", key())).toBeNull();
  });
});
