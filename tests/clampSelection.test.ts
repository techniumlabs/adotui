import { describe, expect, test } from "bun:test";
import { clampSelection } from "../src/app/selectors";
import { INITIAL_STATE } from "../src/app/constants";
import type { AppState } from "../src/app/types";
import type { AppData, PullRequest } from "../src/domain/types";

const pr = (id: number): PullRequest => ({ id, pullRequests: [] }) as unknown as PullRequest;

const tree = (repoCount: number, prCount: number): AppData => ({
  organizations: [
    {
      name: "acme",
      organizationUrl: "https://dev.azure.com/acme",
      repositories: Array.from({ length: repoCount }, (_, i) => ({
        name: `repo-${i}`,
        project: "core",
        pullRequests: Array.from({ length: prCount }, (_, p) => pr(p + 1)),
      })),
    },
  ],
});

const state = (overrides: Partial<AppState> = {}): AppState =>
  ({ ...INITIAL_STATE, treeFilter: "all", ...overrides }) as AppState;

describe("clampSelection", () => {
  test("growth leaves an in-range selection untouched", () => {
    const current = state({ selectedOrgIndex: 0, selectedRepoIndex: 3, selectedPrIndex: 1 });
    expect(clampSelection(current, tree(8, 4))).toEqual({
      selectedOrgIndex: 0,
      selectedRepoIndex: 3,
      selectedPrIndex: 1,
    });
  });

  test("an org still awaiting its repos does NOT reset the cursor", () => {
    // The regression this guards: clamping against an empty list would drop a
    // valid selection to 0 mid-load and never restore it.
    const current = state({ selectedRepoIndex: 7, selectedPrIndex: 2 });
    const result = clampSelection(current, {
      organizations: [{ name: "acme", organizationUrl: "https://dev.azure.com/acme", repositories: [] }],
    });
    expect(result.selectedRepoIndex).toBe(7);
  });

  test("clamps a repo index that overshoots a populated org", () => {
    const current = state({ selectedRepoIndex: 9 });
    expect(clampSelection(current, tree(3, 1)).selectedRepoIndex).toBe(2);
  });

  test("clamps the PR index when the visible list shrinks", () => {
    const current = state({ selectedRepoIndex: 0, selectedPrIndex: 5 });
    expect(clampSelection(current, tree(2, 2)).selectedPrIndex).toBe(1);
  });

  test("empty tree collapses to zero without throwing", () => {
    const current = state({ selectedOrgIndex: 4, selectedPrIndex: 3 });
    const result = clampSelection(current, { organizations: [] });
    expect(result.selectedOrgIndex).toBe(0);
    expect(result.selectedPrIndex).toBe(0);
  });
});

describe("clampSelection snaps onto a visible repository", () => {
  const mine = (author: string): PullRequest =>
    ({ id: 1, author, reviewers: [], title: "t", status: "active" }) as unknown as PullRequest;

  const mixed: AppData = {
    currentUserEmail: "maya@example.com",
    organizations: [
      {
        name: "acme",
        organizationUrl: "https://dev.azure.com/acme",
        repositories: [
          { name: "hidden", project: "core", pullRequests: [mine("ram")] },
          { name: "visible", project: "core", pullRequests: [mine("maya")] },
        ],
      },
    ],
  };

  test("the launch default (index 0) moves off a filtered-out repo", () => {
    // Under "me" the first repo has no PRs of the user, so the tree draws
    // nothing for it and the highlight would be invisible.
    const result = clampSelection(state({ treeFilter: "me", selectedRepoIndex: 0 }), mixed);
    expect(result.selectedRepoIndex).toBe(1);
  });

  test("a repo the filter shows is left alone", () => {
    const result = clampSelection(state({ treeFilter: "me", selectedRepoIndex: 1 }), mixed);
    expect(result.selectedRepoIndex).toBe(1);
  });

  test("with no visible repos at all the index is untouched", () => {
    const result = clampSelection(state({ treeFilter: "author:nobody", selectedRepoIndex: 0 }), mixed);
    expect(result.selectedRepoIndex).toBe(0);
  });
});
