import { describe, expect, test } from "bun:test";
import { Box } from "ink";
import { render } from "ink-testing-library";
import { buildDiffRows, parseDiff } from "../src/app/components/diff/diffRender";
import type { PullRequestFileChange } from "../src/domain/types";

// What buildUnifiedDiff produces for old "keep\n---\n" -> new "keep\n++x\n":
// a removed line whose CONTENT is "---" is written "----"; an added "++x" is "+++x".
const RULE_DIFF = ["--- a/notes.md", "+++ b/notes.md", "@@ -1,2 +1,2 @@", " keep", "----", "+++x", ""].join("\n");

const kinds = (raw: string) => parseDiff(raw).map((line) => `${line.kind}:${line.text}`);

describe("parseDiff: --- and +++ are headers only before the first hunk", () => {
  test("the file headers still parse as headers", () => {
    expect(kinds(RULE_DIFF).slice(0, 3)).toEqual(["header:--- a/notes.md", "header:+++ b/notes.md", "hunk:@@ -1,2 +1,2 @@"]);
  });

  test("a removed '---' line and an added '++x' line inside a hunk are content", () => {
    expect(kinds(RULE_DIFF).slice(3)).toEqual(["ctx:keep", "del:---", "add:++x"]);
  });

  test("they keep their line numbers", () => {
    const [, , , ctx, del, add] = parseDiff(RULE_DIFF);
    expect(ctx).toMatchObject({ oldNo: 1, newNo: 1 });
    expect(del).toMatchObject({ kind: "del", oldNo: 2, newNo: null });
    expect(add).toMatchObject({ kind: "add", oldNo: null, newNo: 2 });
  });

  test("a second hunk is still recognised after content lines that look like headers", () => {
    const raw = ["--- a/f", "+++ b/f", "@@ -1 +1 @@", "----", "+++x", "@@ -10 +10 @@", " ctx", ""].join("\n");
    expect(kinds(raw).slice(2)).toEqual(["hunk:@@ -1 +1 @@", "del:---", "add:++x", "hunk:@@ -10 +10 @@", "ctx:ctx"]);
  });

  test("a diff with no hunk at all (the legacy mock format) is unchanged", () => {
    expect(kinds("- old line\n+ new line\n")).toEqual(["del: old line", "add: new line"]);
  });
});

describe("buildDiffRows: what the user sees", () => {
  const file: PullRequestFileChange = {
    path: "notes.md",
    status: "modified",
    additions: 1,
    deletions: 1,
    diff: [],
    rawDiff: RULE_DIFF,
  };

  test("the removed '---' line and the added '++x' line are rendered", () => {
    const rows = buildDiffRows(file, 0, 80);
    const { lastFrame } = render(<Box flexDirection="column">{rows.map((row) => row.element)}</Box>);
    const frame = lastFrame() ?? "";
    expect(frame).toContain("keep");
    expect(frame).toContain("---");
    expect(frame).toContain("++x");
  });

  test("the file header lines are still not rendered as rows", () => {
    const rows = buildDiffRows(file, 0, 80);
    const { lastFrame } = render(<Box flexDirection="column">{rows.map((row) => row.element)}</Box>);
    expect(lastFrame() ?? "").not.toContain("a/notes.md");
  });
});
