import { afterEach, beforeEach, expect, test, describe } from "bun:test";
import { loadAppData } from "../src/data/azure";
import { type AdoConfig } from "../src/data/config";

// Reads go over REST, so the transport under test is fetch. Every request is
// recorded so we can assert on the call pattern (one project-wide PR listing
// per project, paging, etc.) as well as the normalized result.
const recordedUrls: string[] = [];
// When set, the PR listing serves these pages (indexed by $skip / 100).
let prListPages: Record<string, unknown>[][] | null = null;

const realFetch = globalThis.fetch;
let savedPat: string | undefined;

const defaultPr = {
  pullRequestId: 123,
  title: "Fix bug",
  status: "active",
  createdBy: { displayName: "Alice" },
  creationDate: "2026-07-04T10:00:00Z",
  repository: { id: "repo-1", name: "services-gateway", project: { id: "project-1", name: "test-project" } },
  reviewers: [],
  mergeStatus: "succeeded",
  sourceRefName: "refs/heads/fix",
  targetRefName: "refs/heads/main",
};

const json = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });

beforeEach(() => {
  savedPat = process.env.AZURE_DEVOPS_EXT_PAT;
  // Keeps auth off the az CLI during tests.
  process.env.AZURE_DEVOPS_EXT_PAT = "test-pat";

  globalThis.fetch = (async (input: string | URL) => {
    const url = String(input);
    recordedUrls.push(url);

    if (url.includes("/_apis/git/pullrequests")) {
      if (prListPages) {
        const skip = Number(new URL(url).searchParams.get("$skip") ?? 0);
        return json({ value: prListPages[Math.floor(skip / 100)] ?? [] });
      }
      return json({ value: [defaultPr] });
    }
    if (url.includes("/_apis/git/repositories")) {
      return json({
        value: [
          {
            id: "repo-1",
            name: "services-gateway",
            project: { id: "project-1", name: "test-project" },
          },
        ],
      });
    }
    if (url.includes("/_apis/projects")) {
      return json({ value: [{ id: "project-1", name: "test-project", state: "wellFormed" }] });
    }
    // Iterations, policies, work items, threads: nothing extra for these PRs.
    return json({ value: [] });
  }) as unknown as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = realFetch;
  prListPages = null;
  if (savedPat === undefined) delete process.env.AZURE_DEVOPS_EXT_PAT;
  else process.env.AZURE_DEVOPS_EXT_PAT = savedPat;
});

describe("Azure Platform Integration", () => {
  test("loadAppData fetches and normalizes repositories and pull requests", async () => {
    const fakeConfig: AdoConfig = {
      projects: [{ organization: "https://dev.azure.com/test-org", project: "test-project" }],
    };

    const { data: appData } = await loadAppData(fakeConfig);

    expect(appData.organizations).toHaveLength(1);
    expect(appData.organizations[0]!.name).toBe("test-org");
    expect(appData.organizations[0]!.repositories).toHaveLength(1);

    const repo = appData.organizations[0]!.repositories[0]!;
    expect(repo.name).toBe("services-gateway");
    expect(repo.project).toBe("test-project");
    expect(repo.pullRequests).toHaveLength(1);

    const pr = repo.pullRequests[0]!;
    expect(pr.id).toBe(123);
    expect(pr.title).toBe("Fix bug");
    expect(pr.author).toBe("Alice");
    expect(pr.status).toBe("active");
    // Ids are carried through for later calls (policy artifact ids, threads).
    expect(pr.repositoryId).toBe("repo-1");
    expect(pr.projectId).toBe("project-1");
  });

  test("loadAppData resolves projects when project is omitted/undefined", async () => {
    const fakeConfig: AdoConfig = {
      projects: [{ organization: "https://dev.azure.com/test-org" }],
    };

    const before = recordedUrls.length;
    const { data: appData } = await loadAppData(fakeConfig);

    expect(recordedUrls.slice(before).some((u) => u.includes("/_apis/projects"))).toBe(true);
    expect(appData.organizations).toHaveLength(1);
    expect(appData.organizations[0]!.repositories).toHaveLength(1);

    const repo = appData.organizations[0]!.repositories[0]!;
    expect(repo.name).toBe("services-gateway");
    expect(repo.project).toBe("test-project");
    expect(repo.pullRequests).toHaveLength(1);
  });

  test("loadAppData issues a single project-wide PR listing per project", async () => {
    const fakeConfig: AdoConfig = {
      projects: [{ organization: "https://dev.azure.com/test-org", project: "test-project" }],
    };

    const before = recordedUrls.length;
    const { data: appData } = await loadAppData(fakeConfig, { fetchDetails: false });
    const prListCalls = recordedUrls.slice(before).filter((u) => u.includes("/_apis/git/pullrequests"));

    expect(prListCalls).toHaveLength(1);
    // Project-scoped, not one call per repository.
    expect(prListCalls[0]).not.toContain("/repositories/");
    expect(prListCalls[0]).toContain("/test-project/_apis/git/pullrequests");
    expect(decodeURIComponent(prListCalls[0]!)).toContain("searchCriteria.status=active");
    // Grouping still lands the PR in its repository node.
    expect(appData.organizations[0]!.repositories[0]!.pullRequests).toHaveLength(1);
  });

  const makePr = (id: number): Record<string, unknown> => ({
    ...defaultPr,
    pullRequestId: id,
    title: `PR ${id}`,
  });

  test("loadAppData pages the project PR listing and caps per repository", async () => {
    // Page 1 is full (100 PRs), so the loader must fetch page 2.
    prListPages = [
      Array.from({ length: 100 }, (_, i) => makePr(i + 1)),
      Array.from({ length: 3 }, (_, i) => makePr(101 + i)),
    ];

    const fakeConfig: AdoConfig = {
      top: 5,
      projects: [{ organization: "https://dev.azure.com/test-org", project: "test-project" }],
    };

    const before = recordedUrls.length;
    const { data: appData } = await loadAppData(fakeConfig, { fetchDetails: false });
    const prListCalls = recordedUrls.slice(before).filter((u) => u.includes("/_apis/git/pullrequests"));

    expect(prListCalls).toHaveLength(2);
    expect(decodeURIComponent(prListCalls[1]!)).toContain("$skip=100");
    // All 103 PRs land in one repo; the per-repo `top` cap (5) applies.
    expect(appData.organizations[0]!.repositories[0]!.pullRequests).toHaveLength(5);
  });

  test("loadAppData keeps every PR when top is not configured", async () => {
    prListPages = [
      Array.from({ length: 100 }, (_, i) => makePr(i + 1)),
      Array.from({ length: 3 }, (_, i) => makePr(101 + i)),
    ];

    const fakeConfig: AdoConfig = {
      projects: [{ organization: "https://dev.azure.com/test-org", project: "test-project" }],
    };

    const { data: appData } = await loadAppData(fakeConfig, { fetchDetails: false });
    expect(appData.organizations[0]!.repositories[0]!.pullRequests).toHaveLength(103);
  });
});
