import { describe, expect, test } from "bun:test";
import { mapRunResult, mapRunState, normalizeThreads, type RawThread } from "../src/data/azureRest";

const thread = (overrides: Partial<RawThread> = {}): RawThread => ({
  id: 1,
  status: "active",
  comments: [
    {
      id: 10,
      author: { displayName: "Maya", uniqueName: "maya@example.com" },
      content: "hello",
      commentType: "text",
      publishedDate: "2026-08-01T10:00:00Z",
    },
  ],
  ...overrides,
});

describe("normalizeThreads", () => {
  test("maps thread and comment fields", () => {
    const [t] = normalizeThreads([
      thread({ threadContext: { filePath: "/src/a.ts", rightFileStart: { line: 12 } } }),
    ]);
    expect(t?.filePath).toBe("/src/a.ts");
    expect(t?.lineNumber).toBe(12);
    expect(t?.comments[0]).toMatchObject({
      id: 10,
      threadId: 1,
      author: "Maya",
      authorEmail: "maya@example.com",
      content: "hello",
    });
  });

  test("drops deleted threads and deleted comments", () => {
    expect(normalizeThreads([thread({ isDeleted: true })])).toHaveLength(0);
    expect(normalizeThreads([thread({ comments: [{ id: 1, isDeleted: true }] })])).toHaveLength(0);
  });

  test("drops system comments and the threads they empty out", () => {
    expect(normalizeThreads([thread({ comments: [{ id: 1, commentType: "system" }] })])).toHaveLength(0);
  });

  test("defaults missing status and author fields", () => {
    const [t] = normalizeThreads([thread({ status: undefined, comments: [{ id: 2 }] })]);
    expect(t?.status).toBe("unknown");
    expect(t?.comments[0]?.author).toBe("Unknown");
    expect(t?.comments[0]?.content).toBe("");
  });
});

describe("pipeline run mapping", () => {
  test("maps az run states", () => {
    expect(mapRunState("inProgress")).toBe("inProgress");
    expect(mapRunState("in_progress")).toBe("inProgress");
    expect(mapRunState("cancelling")).toBe("canceling");
    expect(mapRunState("completed")).toBe("completed");
    expect(mapRunState("notStarted")).toBe("none");
    expect(mapRunState(undefined)).toBe("none");
  });

  test("maps az run results", () => {
    expect(mapRunResult("succeeded")).toBe("succeeded");
    expect(mapRunResult("partiallySucceeded")).toBe("succeeded");
    expect(mapRunResult("failed")).toBe("failed");
    expect(mapRunResult("cancelled")).toBe("canceled");
    expect(mapRunResult(undefined)).toBeNull();
    expect(mapRunResult("something-new")).toBe("none");
  });
});
