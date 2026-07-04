import { expect, test, describe, mock } from "bun:test";

// Mock the command module before importing anything that uses it
mock.module("../src/data/command", () => {
  return {
    run: mock(async () => ({ stdout: "", stderr: "", exitCode: 0 })),
    runJson: mock(async (cmd: string, args: string[]) => {
      // Mock `az repos pr list`
      if (args.includes("pr") && args.includes("list")) {
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
});
