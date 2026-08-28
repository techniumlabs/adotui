import { describe, expect, test } from "bun:test";
import { KEYMAP, footerHints } from "../src/app/keymap";

describe("keymap", () => {
  test("every section has a title and at least one binding", () => {
    expect(KEYMAP.length).toBeGreaterThan(0);
    for (const section of KEYMAP) {
      expect(section.title.length).toBeGreaterThan(0);
      expect(section.bindings.length).toBeGreaterThan(0);
    }
  });

  test("no duplicate key labels within a section", () => {
    for (const section of KEYMAP) {
      const keys = section.bindings.map((b) => b.keys);
      expect(new Set(keys).size).toBe(keys.length);
    }
  });

  test("footer hints end with help and quit in both variants", () => {
    for (const hasPr of [true, false]) {
      const hints = footerHints(hasPr);
      expect(hints.at(-2)?.keys).toBe("?");
      expect(hints.at(-1)?.keys).toBe("q");
    }
  });
});
