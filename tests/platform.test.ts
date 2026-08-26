import { expect, test, describe, mock } from "bun:test";

// Mock the command module before importing anything that uses it
const recordedCalls: string[][] = [];
// When set, `az repos pr list` serves these pages (indexed by --skip / 100)
// instead of the default single-PR response.
let prListPages: Record<string, unknown>[][] | null = null;

mock.module("../src/data/command", () => {
  return {
    run: mock(async () => ({ stdout: "", stderr: "", exitCode: 0 })),
    runJson: mock(async (_cmd: string, args: string[]) => {
      recordedCalls.push(args);
      // Mock `az repos pr list`
      if (args.includes("pr") && args.includes("list")) {
        if (prListPages) {
          const skipIdx = args.indexOf("--skip");
          const skip = skipIdx >= 0 ? Number(args[skipIdx + 1]) : 0;
          return prListPages[Math.floor(skip / 100)] ?? [];
        }
        return [
          {
            pullRequestId: 123,
            title: "Fix bug",
            status: "active",
            createdBy: { displayName: "Alice" },
            creationDate: "2026-07-04T10:00:00Z",
            repository: { name: "services-gateway" },
            reviewers: [],
            mergeStatus: "succeeded",
            sourceRefName: "refs/heads/fix",
            targetRefName: "refs/heads/main",
            url: "https://dev.azure.com/test-org/test-project/_git/services-gateway/pullrequest/123",
          }
        ];
      }

      // Mock `az repos list`
      if (args.includes("repos") && args.includes("list")) {
        return [
          {
            id: "repo-1",
            name: "services-gateway",
            project: { name: "test-project" },
            defaultBranch: "refs/heads/main",
            remoteUrl: "https://dev.azure.com/test-org/test-project/_git/services-gateway",
          }
        ];
      }

      // Mock `az devops project list`
      if (args.includes("project") && args.includes("list")) {
        return {
          value: [
            {
              id: "project-1",
              name: "test-project",
              state: "wellFormed",
            }
          ]
        };
      }

      // Mock `az account get-access-token`
      if (args.includes("account") && args.includes("get-access-token")) {
        return { accessToken: "fake-token" };
      }

      return [];
    }),
    CommandError: class CommandError extends Error {}
  };
});

// Import after mocking
import { loadAppData } from "../src/data/azure";
import { type AdoConfig } from "../src/data/config";

describe("Azure Platform Integration", () => {
  test("loadAppData fetches and normalizes repositories and pull requests", async () => {
    const fakeConfig: AdoConfig = {
      projects: [
        {
          organization: "https://dev.azure.com/test-org",
          project: "test-project",
        }
      ]
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
  });

  test("loadAppData resolves projects when project is omitted/undefined", async () => {
    const fakeConfig: AdoConfig = {
      projects: [
        {
          organization: "https://dev.azure.com/test-org",
        }
      ]
    };

    const { data: appData } = await loadAppData(fakeConfig);
    
    expect(appData.organizations).toHaveLength(1);
    expect(appData.organizations[0]!.name).toBe("test-org");
    expect(appData.organizations[0]!.repositories).toHaveLength(1);
    
    const repo = appData.organizations[0]!.repositories[0]!;
    expect(repo.name).toBe("services-gateway");
    expect(repo.project).toBe("test-project");
    expect(repo.pullRequests).toHaveLength(1);
  });

  test("loadAppData issues a single project-wide PR listing per project", async () => {
    const fakeConfig: AdoConfig = {
      projects: [
        {
          organization: "https://dev.azure.com/test-org",
          project: "test-project",
        }
      ]
    };

    const before = recordedCalls.length;
    const { data: appData } = await loadAppData(fakeConfig, { fetchDetails: false });
    const prListCalls = recordedCalls
      .slice(before)
      .filter(
        (args) =>
          args.includes("pr") &&
          args.includes("list") &&
          !args.includes("policy") &&
          !args.includes("work-item"),
      );

    expect(prListCalls).toHaveLength(1);
    expect(prListCalls[0]).not.toContain("--repository");
    expect(prListCalls[0]).toContain("--project");
    // Grouping still lands the PR in its repository node.
    expect(appData.organizations[0]!.repositories[0]!.pullRequests).toHaveLength(1);
  });

  test("loadAppData pages the project PR listing and caps per repository", async () => {
    const makePr = (id: number): Record<string, unknown> => ({
      pullRequestId: id,
      title: `PR ${id}`,
      status: "active",
      createdBy: { displayName: "Alice" },
      creationDate: "2026-07-04T10:00:00Z",
      repository: { name: "services-gateway" },
      reviewers: [],
      sourceRefName: "refs/heads/fix",
      targetRefName: "refs/heads/main",
      url: `https://dev.azure.com/test-org/test-project/_git/services-gateway/pullrequest/${id}`,
    });
    // Page 1 is full (100 PRs), so the loader must fetch page 2.
    prListPages = [
      Array.from({ length: 100 }, (_, i) => makePr(i + 1)),
      Array.from({ length: 3 }, (_, i) => makePr(101 + i)),
    ];

    const fakeConfig: AdoConfig = {
      top: 5,
      projects: [
        {
          organization: "https://dev.azure.com/test-org",
          project: "test-project",
        }
      ]
    };

    try {
      const before = recordedCalls.length;
      const { data: appData } = await loadAppData(fakeConfig, { fetchDetails: false });
      const prListCalls = recordedCalls
        .slice(before)
        .filter((args) => args.includes("pr") && args.includes("list"));

      expect(prListCalls).toHaveLength(2);
      const skipIdx = prListCalls[1]!.indexOf("--skip");
      expect(skipIdx).toBeGreaterThan(-1);
      expect(prListCalls[1]![skipIdx + 1]).toBe("100");
      // All 103 PRs land in one repo; the per-repo `top` cap (5) applies.
      expect(appData.organizations[0]!.repositories[0]!.pullRequests).toHaveLength(5);
    } finally {
      prListPages = null;
    }
  });
});
