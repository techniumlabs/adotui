import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { Text } from "ink";
import { render } from "ink-testing-library";
import { useAppStore } from "../src/app/store";
import { INITIAL_STATE } from "../src/app/constants";
import { setFileLoading, updateFileDiff, updatePr } from "../src/app/actions/prDataActions";
import { useLazyFileDiff } from "../src/app/hooks/useLazyFileDiff";
import type { AppData, PullRequest, PullRequestFileChange } from "../src/domain/types";

const ORG = "https://dev.azure.com/acme";

const file = (path: string, extra: Partial<PullRequestFileChange> = {}): PullRequestFileChange => ({
  path,
  status: "modified",
  additions: 0,
  deletions: 0,
  diff: [],
  ...extra,
});

const makePr = (id: number, project: string, extra: Partial<PullRequest> = {}): PullRequest => ({
  id,
  title: `PR ${id}`,
  author: "maya",
  draft: false,
  status: "active",
  reviewState: "pending",
  sourceBranch: "feature/x",
  targetBranch: "main",
  updatedAt: "2026-07-02T10:30:00.000Z",
  comments: 0,
  activeComments: 0,
  checksPassed: 0,
  checksTotal: 0,
  url: "",
  changedFiles: [file("package.json")],
  mergeStatus: "succeeded",
  organizationUrl: ORG,
  project,
  repository: "shared",
  iterSourceCommit: "src1",
  iterTargetCommit: "tgt1",
  ...extra,
});

// Same repo name in two projects (legal in Azure DevOps), same PR id in both.
const seed = (core: PullRequest, edge: PullRequest): void => {
  const data: AppData = {
    organizations: [{
      name: "acme",
      organizationUrl: ORG,
      repositories: [
        { name: "shared", project: "core", pullRequests: [core] },
        { name: "shared", project: "edge", pullRequests: [edge] },
      ],
    }],
  };
  useAppStore.setState({ ...INITIAL_STATE, data });
};

const prIn = (project: string): PullRequest =>
  useAppStore.getState().data.organizations[0]!.repositories.find((r) => r.project === project)!.pullRequests[0]!;

const diff = { rawDiff: "@@ -1 +1 @@\n-a\n+b", additions: 1, deletions: 1 };

beforeEach(() => seed(makePr(1, "core"), makePr(1, "edge")));

describe("PR data actions target the PR they were fetched for", () => {
  test("a diff lands on its own PR, not a same-named repo in another project", () => {
    setFileLoading(makePr(1, "edge"), "package.json");
    updateFileDiff(makePr(1, "edge"), "package.json", diff);
    expect(prIn("edge").changedFiles[0]).toMatchObject({ rawDiff: diff.rawDiff, loadingDiff: false });
    expect(prIn("core").changedFiles[0]!.rawDiff).toBeUndefined();
  });

  test("a diff fetched for an older iteration is dropped", () => {
    updateFileDiff(makePr(1, "core", { iterSourceCommit: "old" }), "package.json", diff);
    expect(prIn("core").changedFiles[0]!.rawDiff).toBeUndefined();
  });

  test("updatePr matches the project too", () => {
    updatePr(makePr(1, "edge"), { title: "edited" });
    expect(prIn("edge").title).toBe("edited");
    expect(prIn("core").title).toBe("PR 1");
  });
});

describe("updatePr revalidation", () => {
  beforeEach(() => updateFileDiff(makePr(1, "core"), "package.json", diff));

  test("same iteration: loaded diffs survive, other details update", () => {
    updatePr(makePr(1, "core"), {
      changedFiles: [file("package.json")],
      iterSourceCommit: "src1",
      iterTargetCommit: "tgt1",
      checksPassed: 3,
      detailsLoaded: true,
    });
    expect(prIn("core").changedFiles[0]!.rawDiff).toBe(diff.rawDiff);
    expect(prIn("core").checksPassed).toBe(3);
  });

  test("a failed file fetch (no commits) keeps the files shown", () => {
    updatePr(makePr(1, "core"), { changedFiles: [], detailsLoaded: true });
    expect(prIn("core").changedFiles).toHaveLength(1);
  });

  test("a new iteration replaces the file list", () => {
    updatePr(makePr(1, "core"), {
      changedFiles: [file("package.json"), file("new.ts")],
      iterSourceCommit: "src2",
      iterTargetCommit: "tgt1",
    });
    expect(prIn("core").changedFiles.map((f) => f.path)).toEqual(["package.json", "new.ts"]);
    expect(prIn("core").changedFiles[0]!.rawDiff).toBeUndefined();
  });
});

describe("useLazyFileDiff", () => {
  const realFetch = globalThis.fetch;
  const savedPat = process.env.AZURE_DEVOPS_EXT_PAT;
  beforeEach(() => {
    process.env.AZURE_DEVOPS_EXT_PAT = "test-pat";
    globalThis.fetch = (async () => new Response("", { status: 404 })) as unknown as typeof fetch;
  });
  afterEach(() => {
    globalThis.fetch = realFetch;
    if (savedPat === undefined) delete process.env.AZURE_DEVOPS_EXT_PAT;
    else process.env.AZURE_DEVOPS_EXT_PAT = savedPat;
  });

  const Probe = (props: { pr: PullRequest; update: () => void; loading: () => void }) => {
    useLazyFileDiff(props.pr, props.pr.changedFiles[0], props.update, props.loading);
    return <Text>probe</Text>;
  };

  test("an empty diff counts as loaded (no refetch loop)", async () => {
    const loading = mock(() => {});
    const pr = makePr(1, "core", { changedFiles: [file(".gitkeep", { status: "added", rawDiff: "" })] });
    render(<Probe pr={pr} update={() => {}} loading={loading} />);
    await Bun.sleep(30);
    expect(loading).not.toHaveBeenCalled();
  });

  test("a file without a diff is fetched once", async () => {
    const loading = mock(() => {});
    const update = mock(() => {});
    render(<Probe pr={makePr(1, "core")} update={update} loading={loading} />);
    await Bun.sleep(100);
    expect(loading).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledTimes(1);
  });
});
