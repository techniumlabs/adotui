import { describe, expect, test } from "bun:test";
import { mergeLoadPartials } from "../src/app/actions/mergePartial";
import type { LoadPartial } from "../src/data/azure";
import type { AppData, RepositoryNode } from "../src/domain/types";

const ORG = "https://dev.azure.com/acme";

const repo = (project: string, name: string, prCount = 0): RepositoryNode => ({
  name,
  project,
  pullRequests: Array.from({ length: prCount }, (_, i) => ({ id: i + 1 })) as never,
});

const partial = (overrides: Partial<LoadPartial> = {}): LoadPartial => ({
  requestId: 1,
  organizationUrl: ORG,
  organizationName: "acme",
  project: "core",
  repositories: [],
  warnings: [],
  progress: { current: 1, total: 2 },
  ...overrides,
});

const empty: AppData = { organizations: [] };

describe("mergeLoadPartials", () => {
  test("creates the organization on first sight", () => {
    const next = mergeLoadPartials(empty, [partial({ project: null })]);
    expect(next.organizations).toHaveLength(1);
    expect(next.organizations[0]).toMatchObject({ name: "acme", organizationUrl: ORG, repositories: [] });
  });

  test("appends each project batch in arrival order", () => {
    let data = mergeLoadPartials(empty, [partial({ project: null })]);
    data = mergeLoadPartials(data, [partial({ project: "edge", repositories: [repo("edge", "b")] })]);
    data = mergeLoadPartials(data, [partial({ project: "core", repositories: [repo("core", "a")] })]);
    expect(data.organizations[0]!.repositories.map((r) => r.name)).toEqual(["b", "a"]);
  });

  test("a repeated batch replaces in place instead of duplicating", () => {
    // This is what a manual refresh does: the tree already holds these repos.
    let data = mergeLoadPartials(empty, [partial({ repositories: [repo("core", "a", 1)] })]);
    data = mergeLoadPartials(data, [partial({ repositories: [repo("core", "a", 3)] })]);
    expect(data.organizations[0]!.repositories).toHaveLength(1);
    expect(data.organizations[0]!.repositories[0]!.pullRequests).toHaveLength(3);
  });

  test("same repo name in different projects stays distinct", () => {
    let data = mergeLoadPartials(empty, [partial({ repositories: [repo("core", "shared")] })]);
    data = mergeLoadPartials(data, [partial({ project: "edge", repositories: [repo("edge", "shared")] })]);
    expect(data.organizations[0]!.repositories).toHaveLength(2);
  });

  test("a failed project (no repositories) never deletes what is already there", () => {
    const seeded = mergeLoadPartials(empty, [partial({ repositories: [repo("core", "a")] })]);
    const next = mergeLoadPartials(seeded, [partial({ project: "core", repositories: [], warnings: ["boom"] })]);
    expect(next).toBe(seeded);
    expect(next.organizations[0]!.repositories).toHaveLength(1);
  });

  test("returns a NEW object when changed (summary memos key on identity)", () => {
    const seeded = mergeLoadPartials(empty, [partial({ project: null })]);
    const next = mergeLoadPartials(seeded, [partial({ repositories: [repo("core", "a")] })]);
    expect(next).not.toBe(seeded);
  });

  test("returns the SAME object when nothing changed (skips a repaint)", () => {
    const seeded = mergeLoadPartials(empty, [partial({ project: null })]);
    expect(mergeLoadPartials(seeded, [partial({ project: null })])).toBe(seeded);
    expect(mergeLoadPartials(seeded, [])).toBe(seeded);
  });

  test("carries currentUserEmail through", () => {
    const next = mergeLoadPartials(empty, [partial({ currentUserEmail: "maya@example.com" })]);
    expect(next.currentUserEmail).toBe("maya@example.com");
  });
});
