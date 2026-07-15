import { expect, test, describe } from "bun:test";
import { render } from "ink-testing-library";
import { OrganizationTree } from "../src/app/components/OrganizationTree";
import type { AppData, PullRequest } from "../src/domain/types";

process.env.NODE_ENV = "test";

const makePr = (overrides: Partial<PullRequest> = {}): PullRequest => ({
  id: 1,
  title: "A change",
  author: "maya",
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
  url: "https://dev.azure.com/acme/edge/_git/svc-dup/pullrequest/1",
  changedFiles: [],
  mergeStatus: "succeeded",
  organizationUrl: "https://dev.azure.com/acme",
  project: "edge",
  repository: "svc-dup",
  ...overrides,
});

// Azure DevOps repo names are unique per project, not per org — the same
// name can appear under several projects in one organization.
const data: AppData = {
  currentUserEmail: "maya@example.com",
  organizations: [
    {
      name: "acme",
      organizationUrl: "https://dev.azure.com/acme",
      repositories: [
        { name: "svc-dup", project: "core", pullRequests: [] },
        { name: "svc-dup", project: "edge", pullRequests: [makePr()] },
      ],
    },
  ],
};

const renderTree = (treeFilter: string) =>
  render(
    <OrganizationTree
      data={data}
      selectedOrgIndex={0}
      selectedRepoIndex={0}
      focus="tree"
      treeFilter={treeFilter}
      maxRows={20}
    />,
  );

const countOccurrences = (frame: string, needle: string) =>
  frame.split(needle).length - 1;

describe("OrganizationTree with duplicate repo names across projects", () => {
  test("'all' filter shows both same-named repos", () => {
    const { lastFrame } = renderTree("all");
    const frame = lastFrame() ?? "";
    expect(countOccurrences(frame, "svc-dup")).toBe(2);
    expect(frame).toInclude("(0)");
    expect(frame).toInclude("(1)");
  });

  test("switching all → with-prs drops the empty repo without stale rows", () => {
    const { rerender, lastFrame } = renderTree("all");
    rerender(
      <OrganizationTree
        data={data}
        selectedOrgIndex={0}
        selectedRepoIndex={1}
        focus="tree"
        treeFilter="with-prs"
        maxRows={20}
      />,
    );
    const frame = lastFrame() ?? "";
    expect(countOccurrences(frame, "svc-dup")).toBe(1);
    expect(frame).not.toInclude("(0)");
  });

  test("switching all → me keeps only repos with the user's PRs", () => {
    const { rerender, lastFrame } = renderTree("all");
    rerender(
      <OrganizationTree
        data={data}
        selectedOrgIndex={0}
        selectedRepoIndex={1}
        focus="tree"
        treeFilter="me"
        maxRows={20}
      />,
    );
    const frame = lastFrame() ?? "";
    expect(countOccurrences(frame, "svc-dup")).toBe(1);
    expect(frame).not.toInclude("(0)");
  });
});
