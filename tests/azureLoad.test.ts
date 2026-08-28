import { expect, test, describe } from "bun:test";
import { groupPrsByRepository, mapWithConcurrency } from "../src/data/azure";
import type { AzurePullRequest } from "../src/data/azureTypes";

const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

describe("mapWithConcurrency", () => {
  test("preserves input order in results", async () => {
    const items = [5, 1, 4, 2, 3];
    const results = await mapWithConcurrency(items, 2, async (n) => {
      await delay(n);
      return n * 10;
    });
    expect(results).toEqual([50, 10, 40, 20, 30]);
  });

  test("never exceeds the concurrency limit", async () => {
    let active = 0;
    let maxActive = 0;
    const items = Array.from({ length: 20 }, (_, i) => i);
    await mapWithConcurrency(items, 4, async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await delay(5);
      active -= 1;
    });
    expect(maxActive).toBeLessThanOrEqual(4);
    expect(maxActive).toBeGreaterThan(1);
  });

  test("handles empty input and limits larger than the input", async () => {
    expect(await mapWithConcurrency([], 4, async (n: number) => n)).toEqual([]);
    expect(await mapWithConcurrency([1, 2], 10, async (n) => n + 1)).toEqual([2, 3]);
  });
});

describe("groupPrsByRepository", () => {
  const pr = (id: number, repoName?: string): AzurePullRequest => ({
    pullRequestId: id,
    ...(repoName ? { repository: { name: repoName } } : {}),
  });

  test("groups PRs by lower-cased repository name", () => {
    const groups = groupPrsByRepository([pr(1, "Api"), pr(2, "api"), pr(3, "web")]);
    expect(groups.get("api")?.map((p) => p.pullRequestId)).toEqual([1, 2]);
    expect(groups.get("web")?.map((p) => p.pullRequestId)).toEqual([3]);
  });

  test("drops PRs without a repository name", () => {
    const groups = groupPrsByRepository([pr(1), pr(2, "core")]);
    expect(groups.size).toBe(1);
    expect(groups.get("core")).toHaveLength(1);
  });
});
