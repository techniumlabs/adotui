import { expect, test, describe, beforeEach } from "bun:test";
import { changeFileSelection, moveTreeSelection } from "../src/app/actions/selectionActions";
import { useAppStore } from "../src/app/store";
import { INITIAL_STATE } from "../src/app/constants";
import type { AppData, PullRequest } from "../src/domain/types";

const makePr = (author: string): PullRequest => ({
  id: 1,
  title: "A change",
  author,
  draft: false,
  status: "active",
  reviewState: "pending",
  sourceBranch: "feature/x",
  targetBranch: "main",
  updatedAt: "2026-07-02T10:30:00.000Z",
  comments: 0,
  activeComments: 0,
  checksPassed: 1,
  checksTotal: 1,
  url: "https://dev.azure.com/acme/core/_git/r/pullrequest/1",
  changedFiles: [],
  mergeStatus: "succeeded",
  organizationUrl: "https://dev.azure.com/acme",
  project: "core",
  repository: "r",
});

// repo-1 and repo-3 have PRs authored by the logged-in user; repo-2 does not,
// so under the "me" filter it is hidden from the tree.
const data: AppData = {
  currentUserEmail: "maya@example.com",
  organizations: [
    {
      name: "acme",
      organizationUrl: "https://dev.azure.com/acme",
      repositories: [
        { name: "repo-1", project: "core", pullRequests: [makePr("maya")] },
        { name: "repo-2", project: "core", pullRequests: [makePr("ram")] },
        { name: "repo-3", project: "core", pullRequests: [makePr("maya")] },
      ],
    },
  ],
};

describe("moveTreeSelection under the 'me' tree filter", () => {
  beforeEach(() => {
    useAppStore.setState({ ...INITIAL_STATE, data, treeFilter: "me" });
  });

  test("skips repos hidden by the filter when moving down", () => {
    moveTreeSelection(0, 1);
    // repo-2 has no PRs of the logged-in user — selection must jump to repo-3.
    expect(useAppStore.getState().selectedRepoIndex).toBe(2);
  });

  test("skips hidden repos when moving back up", () => {
    useAppStore.setState({ selectedRepoIndex: 2 });
    moveTreeSelection(0, -1);
    expect(useAppStore.getState().selectedRepoIndex).toBe(0);
  });
});

describe("changeFileSelection under a filter", () => {
  test("uses the PR the user sees, not the one at the same index in the unfiltered list", () => {
    const file = (path: string) => ({ path, status: "modified" as const, additions: 0, deletions: 0, diff: [] });
    const theirs = { ...makePr("ram"), id: 1, changedFiles: [file("a"), file("b"), file("c")] };
    const mine = { ...makePr("maya"), id: 2, changedFiles: [file("only.ts")] };
    useAppStore.setState({
      ...INITIAL_STATE,
      treeFilter: "me",
      data: {
        currentUserEmail: "maya@example.com",
        organizations: [{ name: "acme", organizationUrl: "https://dev.azure.com/acme", repositories: [{ name: "r", project: "core", pullRequests: [theirs, mine] }] }],
      },
      selectedPrIndex: 0, // the first VISIBLE PR: mine (theirs is filtered out)
      selectedFileIndex: 0,
    });
    changeFileSelection(1);
    // My PR has one file, so there is nowhere to move; the bug moved into theirs.
    expect(useAppStore.getState().selectedFileIndex).toBe(0);
  });
});
