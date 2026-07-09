import { describe, test, expect } from "bun:test";
import {
  normalizePullRequest,
  normalizeFileChanges,
  summarizeChecks,
  deriveReviewState,
  shortBranch,
  orgLabel,
  buildPrUrl,
} from "../src/data/azureNormalize";
import type { AzurePullRequest, AzurePolicyEvaluation, AzureIterationChange } from "../src/data/azureTypes";

describe("shortBranch", () => {
  test("strips refs/heads/ prefix", () => {
    expect(shortBranch("refs/heads/main")).toBe("main");
  });

  test("strips refs/pull/ prefix", () => {
    expect(shortBranch("refs/pull/123")).toBe("pull/123");
  });

  test("returns empty string for undefined", () => {
    expect(shortBranch(undefined)).toBe("");
  });

  test("returns name unchanged if no prefix", () => {
    expect(shortBranch("feature/foo")).toBe("feature/foo");
  });
});

describe("orgLabel", () => {
  test("extracts last segment from org URL", () => {
    expect(orgLabel("https://dev.azure.com/contoso")).toBe("contoso");
  });

  test("handles trailing slashes", () => {
    expect(orgLabel("https://dev.azure.com/contoso/")).toBe("contoso");
  });
});

describe("deriveReviewState", () => {
  test("returns pending when no reviewers", () => {
    const pr: AzurePullRequest = { reviewers: [] };
    expect(deriveReviewState(pr)).toBe("pending");
  });

  test("returns approved when reviewer has vote >= 5", () => {
    const pr: AzurePullRequest = {
      reviewers: [{ vote: 10, displayName: "Alice" }],
    };
    expect(deriveReviewState(pr)).toBe("approved");
  });

  test("returns changes-requested when reviewer has vote <= -10", () => {
    const pr: AzurePullRequest = {
      reviewers: [{ vote: -10, displayName: "Bob" }],
    };
    expect(deriveReviewState(pr)).toBe("changes-requested");
  });

  test("rejection overrides approval", () => {
    const pr: AzurePullRequest = {
      reviewers: [
        { vote: 10, displayName: "Alice" },
        { vote: -10, displayName: "Bob" },
      ],
    };
    expect(deriveReviewState(pr)).toBe("changes-requested");
  });

  test("returns missing-required when required reviewer has no vote", () => {
    const pr: AzurePullRequest = {
      reviewers: [
        { vote: 0, displayName: "Required", isRequired: true },
        { vote: 10, displayName: "Optional" },
      ],
    };
    expect(deriveReviewState(pr)).toBe("missing-required");
  });

  test("returns approved when all required reviewers approved", () => {
    const pr: AzurePullRequest = {
      reviewers: [
        { vote: 10, displayName: "Required", isRequired: true },
      ],
    };
    expect(deriveReviewState(pr)).toBe("approved");
  });

  test("waiting-for-author (-5) does not block approval", () => {
    const pr: AzurePullRequest = {
      reviewers: [
        { vote: 10, displayName: "Alice" },
        { vote: -5, displayName: "Bob" },
      ],
    };
    expect(deriveReviewState(pr)).toBe("approved");
  });

  test("handles undefined reviewers", () => {
    const pr: AzurePullRequest = {};
    expect(deriveReviewState(pr)).toBe("pending");
  });
});

describe("summarizeChecks", () => {
  test("returns zero for empty policies", () => {
    expect(summarizeChecks([])).toEqual({ passed: 0, total: 0 });
  });

  test("counts only blocking policies", () => {
    const policies: AzurePolicyEvaluation[] = [
      { status: "approved", configuration: { isBlocking: true } },
      { status: "queued", configuration: { isBlocking: true } },
      { status: "approved", configuration: { isBlocking: false } },
    ];
    expect(summarizeChecks(policies)).toEqual({ passed: 1, total: 2 });
  });

  test("treats missing isBlocking as blocking", () => {
    const policies: AzurePolicyEvaluation[] = [
      { status: "approved" },
      { status: "running" },
    ];
    expect(summarizeChecks(policies)).toEqual({ passed: 1, total: 2 });
  });
});

describe("normalizeFileChanges", () => {
  test("normalizes add/edit/delete changes", () => {
    const changes: AzureIterationChange[] = [
      { changeType: "add", item: { path: "/src/new.ts" } },
      { changeType: "edit", item: { path: "/src/old.ts" } },
      { changeType: "delete", item: { path: "/src/gone.ts" } },
    ];
    const result = normalizeFileChanges(changes);
    expect(result).toHaveLength(3);
    expect(result[0]).toEqual({ path: "src/new.ts", status: "added", additions: 0, deletions: 0, diff: [] });
    expect(result[1]).toEqual({ path: "src/old.ts", status: "modified", additions: 0, deletions: 0, diff: [] });
    expect(result[2]).toEqual({ path: "src/gone.ts", status: "deleted", additions: 0, deletions: 0, diff: [] });
  });

  test("skips folders", () => {
    const changes: AzureIterationChange[] = [
      { changeType: "add", item: { path: "/src", isFolder: true } },
      { changeType: "add", item: { path: "/src/file.ts" } },
    ];
    const result = normalizeFileChanges(changes);
    expect(result).toHaveLength(1);
  });

  test("skips entries without item", () => {
    const changes: AzureIterationChange[] = [
      { changeType: "add" },
      { changeType: "add", item: { path: "/file.ts" } },
    ];
    const result = normalizeFileChanges(changes);
    expect(result).toHaveLength(1);
  });
});

describe("normalizePullRequest", () => {
  const basePr: AzurePullRequest = {
    pullRequestId: 42,
    title: "Fix login bug",
    createdBy: { displayName: "Alice", uniqueName: "alice@contoso.com" },
    isDraft: false,
    status: "active",
    sourceRefName: "refs/heads/feature/login-fix",
    targetRefName: "refs/heads/main",
    creationDate: "2026-07-01T10:00:00Z",
    reviewers: [{ vote: 10, displayName: "Bob" }],
    mergeStatus: "succeeded",
    labels: [{ name: "bug", active: true }, { name: "archived", active: false }],
  };

  const context = {
    organization: "https://dev.azure.com/contoso",
    project: "Platform",
    repository: "web-app",
  };

  test("maps all fields correctly", () => {
    const result = normalizePullRequest(basePr, context);
    expect(result.id).toBe(42);
    expect(result.title).toBe("Fix login bug");
    expect(result.author).toBe("Alice");
    expect(result.draft).toBe(false);
    expect(result.status).toBe("active");
    expect(result.reviewState).toBe("approved");
    expect(result.sourceBranch).toBe("feature/login-fix");
    expect(result.targetBranch).toBe("main");
    expect(result.mergeStatus).toBe("succeeded");
    expect(result.tags).toEqual(["bug"]); // filtered: archived is active=false
    expect(result.url).toContain("pullrequest/42");
  });

  test("defaults to (untitled) when title is missing", () => {
    const result = normalizePullRequest({}, context);
    expect(result.title).toBe("(untitled)");
  });

  test("defaults to unknown author when createdBy is missing", () => {
    const result = normalizePullRequest({}, context);
    expect(result.author).toBe("unknown");
  });

  test("uses uniqueName as fallback author", () => {
    const result = normalizePullRequest(
      { createdBy: { uniqueName: "alice@contoso.com" } },
      context
    );
    expect(result.author).toBe("alice@contoso.com");
  });

  test("uses provided check counts", () => {
    const result = normalizePullRequest(basePr, { ...context, checksPassed: 3, checksTotal: 5 });
    expect(result.checksPassed).toBe(3);
    expect(result.checksTotal).toBe(5);
  });

  test("defaults check counts to zero", () => {
    const result = normalizePullRequest(basePr, context);
    expect(result.checksPassed).toBe(0);
    expect(result.checksTotal).toBe(0);
  });
});

describe("buildPrUrl", () => {
  test("builds correct URL", () => {
    const url = buildPrUrl("https://dev.azure.com/contoso", "Platform", "web-app", 42);
    expect(url).toBe("https://dev.azure.com/contoso/Platform/_git/web-app/pullrequest/42");
  });

  test("strips trailing slashes from org", () => {
    const url = buildPrUrl("https://dev.azure.com/contoso/", "Platform", "web-app", 42);
    expect(url).toBe("https://dev.azure.com/contoso/Platform/_git/web-app/pullrequest/42");
  });
});
