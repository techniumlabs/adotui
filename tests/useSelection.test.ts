import { expect, test, describe } from "bun:test";
import { useSelection } from "../src/app/hooks/useSelection";
import type { AppState } from "../src/app/types";
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

const makeState = (): AppState =>
  ({
    data,
    treeFilter: "me",
    selectedOrgIndex: 0,
    selectedRepoIndex: 0,
    selectedPrIndex: 0,
    fileFilter: "",
    banner: "",
  }) as unknown as AppState;

describe("moveTreeSelection under the 'me' tree filter", () => {
  test("skips repos hidden by the filter when moving down", () => {
    let state = makeState();
    const { moveTreeSelection } = useSelection((updater) => {
      state = typeof updater === "function" ? updater(state) : updater;
    });

    moveTreeSelection(0, 1);
    // repo-2 has no PRs of the logged-in user — selection must jump to repo-3.
    expect(state.selectedRepoIndex).toBe(2);
  });

  test("skips hidden repos when moving back up", () => {
    let state = makeState();
    state = { ...state, selectedRepoIndex: 2 };
    const { moveTreeSelection } = useSelection((updater) => {
      state = typeof updater === "function" ? updater(state) : updater;
    });

    moveTreeSelection(0, -1);
    expect(state.selectedRepoIndex).toBe(0);
  });
});
