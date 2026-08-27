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

describe("tree view badge and switch hint", () => {
  const frameOf = (treeFilter: string): string[] => {
    const { lastFrame } = render(
      <OrganizationTree
        data={data}
        selectedOrgIndex={0}
        selectedRepoIndex={0}
        focus="tree"
        treeFilter={treeFilter}
        maxRows={20}
      />,
    );
    return (lastFrame() ?? "").split("\n");
  };

  test("names the current view", () => {
    expect(frameOf("me")[1]).toContain("My PRs");
    expect(frameOf("with-prs")[1]).toContain("PRs only");
    expect(frameOf("all")[1]).toContain("All");
  });

  test("labels the key that switches it", () => {
    const hint = frameOf("me").find((line) => line.includes("switch view"));
    expect(hint).toBeDefined();
    expect(hint).toContain("v switch view");
  });

  test("a custom filter keeps the title on its own fixed-width row", () => {
    const header = frameOf("author:maya merge:conflict")[1]!;
    expect(header).toContain("Organizations");
    expect(header).toContain("author:maya");
    // Overflowing this row makes Ink composite it over the tree below.
    expect(header.length).toBe(36);
  });

  test("the hint survives an organization long enough to fill the panel", () => {
    const long = {
      ...data,
      organizations: [
        {
          ...data.organizations[0]!,
          repositories: Array.from({ length: 40 }, (_, i) => ({
            name: `repo-${i}`,
            project: "core",
            pullRequests: data.organizations[0]!.repositories[1]!.pullRequests,
          })),
        },
      ],
    };
    const { lastFrame } = render(
      <OrganizationTree
        data={long}
        selectedOrgIndex={0}
        selectedRepoIndex={0}
        focus="tree"
        treeFilter="all"
        maxRows={12}
      />,
    );
    const lines = (lastFrame() ?? "").split("\n");
    expect(lines.some((l) => l.includes("v switch view"))).toBe(true);
    // Panel must not grow past the height it is given.
    expect(lines.length).toBe(12);
  });
});

describe("selected repository is visibly marked", () => {
  test("the selected repo carries the pointer, unselected ones keep a connector", () => {
    const { lastFrame } = render(
      <OrganizationTree
        data={data}
        selectedOrgIndex={0}
        selectedRepoIndex={1}
        focus="tree"
        treeFilter="all"
        maxRows={20}
      />,
    );
    const lines = (lastFrame() ?? "").split("\n");
    // repositories[1] is the svc-dup under project "edge"
    const selected = lines.find((line) => line.includes("svc-dup") && line.includes("\u25b8"));
    expect(selected).toBeDefined();
    // Exactly one repo row is pointed at.
    expect(lines.filter((line) => line.includes("svc-dup") && line.includes("\u25b8"))).toHaveLength(1);
  });
});
