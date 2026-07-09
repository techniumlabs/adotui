import { describe, test, expect } from "bun:test";
import { parseCompletionCommand } from "../src/app/utils";
import { DEFAULT_COMPLETION_OPTIONS } from "../src/app/constants";

describe("parseCompletionCommand", () => {
  test("returns defaults for bare 'complete' command", () => {
    const result = parseCompletionCommand("complete");
    expect(result).toEqual(DEFAULT_COMPLETION_OPTIONS);
  });

  test("returns defaults for empty string", () => {
    const result = parseCompletionCommand("");
    expect(result).toEqual(DEFAULT_COMPLETION_OPTIONS);
  });

  test("parses --squash-merge flag", () => {
    const result = parseCompletionCommand("complete --squash-merge");
    expect(result.squashMerge).toBe(true);
    expect(result.mergeStrategy).toBe("squash");
  });

  test("parses --delete-source-branch flag", () => {
    const result = parseCompletionCommand("complete --delete-source-branch");
    expect(result.deleteSourceBranch).toBe(true);
  });

  test("parses --no-delete-source-branch flag", () => {
    const result = parseCompletionCommand("complete --no-delete-source-branch");
    expect(result.deleteSourceBranch).toBe(false);
  });

  test("parses --transition-work-items flag", () => {
    const result = parseCompletionCommand("complete --transition-work-items");
    expect(result.transitionWorkItems).toBe(true);
  });

  test("parses --no-transition-work-items flag", () => {
    const result = parseCompletionCommand("complete --no-transition-work-items");
    expect(result.transitionWorkItems).toBe(false);
  });

  test("parses --bypass-policy flag", () => {
    const result = parseCompletionCommand("complete --bypass-policy");
    expect(result.bypassPolicy).toBe(true);
  });

  test("parses --no-bypass-policy flag", () => {
    const result = parseCompletionCommand("complete --no-bypass-policy");
    expect(result.bypassPolicy).toBe(false);
  });

  test("parses --merge-strategy=squash", () => {
    const result = parseCompletionCommand("complete --merge-strategy=squash");
    expect(result.mergeStrategy).toBe("squash");
    expect(result.squashMerge).toBe(true);
  });

  test("parses --merge-strategy=rebase", () => {
    const result = parseCompletionCommand("complete --merge-strategy=rebase");
    expect(result.mergeStrategy).toBe("rebase");
  });

  test("parses --merge-strategy=rebaseMerge", () => {
    const result = parseCompletionCommand("complete --merge-strategy=rebaseMerge");
    expect(result.mergeStrategy).toBe("rebaseMerge");
  });

  test("parses --merge-strategy=noFastForward", () => {
    const result = parseCompletionCommand("complete --merge-strategy=noFastForward");
    expect(result.mergeStrategy).toBe("noFastForward");
  });

  test("ignores invalid merge strategy", () => {
    const result = parseCompletionCommand("complete --merge-strategy=invalid");
    expect(result.mergeStrategy).toBe("noFastForward"); // default
  });

  test("parses --merge-commit-message with equals sign", () => {
    const result = parseCompletionCommand('complete --merge-commit-message="fix: resolve bug"');
    expect(result.mergeCommitMessage).toBe("fix: resolve bug");
  });

  test("parses --bypass-reason", () => {
    const result = parseCompletionCommand('complete --bypass-policy --bypass-reason="hotfix"');
    expect(result.bypassPolicy).toBe(true);
    expect(result.bypassReason).toBe("hotfix");
  });

  test("parses --auto-complete-ignore-config-ids", () => {
    const result = parseCompletionCommand("complete --auto-complete-ignore-config-ids=1,2,3");
    expect(result.autoCompleteIgnoreConfigIds).toEqual([1, 2, 3]);
  });

  test("handles multiple flags combined", () => {
    const result = parseCompletionCommand(
      "complete --squash-merge --no-delete-source-branch --bypass-policy --no-transition-work-items"
    );
    expect(result.squashMerge).toBe(true);
    expect(result.mergeStrategy).toBe("squash");
    expect(result.deleteSourceBranch).toBe(false);
    expect(result.bypassPolicy).toBe(true);
    expect(result.transitionWorkItems).toBe(false);
  });

  test("later flags override earlier flags", () => {
    const result = parseCompletionCommand(
      "complete --delete-source-branch --no-delete-source-branch"
    );
    expect(result.deleteSourceBranch).toBe(false);
  });
});
