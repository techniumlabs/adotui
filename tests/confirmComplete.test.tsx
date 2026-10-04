import { afterAll, afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { until } from "./helpers/wait";

// The real doRefresh reloads from the config and would overwrite the banner under test.
// mock.module is process-global: keep the real module and put it back in afterAll.
const realRefresh = { ...(await import("../src/app/actions/refreshActions")) };
const refreshCalls: string[] = [];
mock.module("../src/app/actions/refreshActions", () => ({
  ...realRefresh,
  doRefresh: (reason: string) => { refreshCalls.push(reason); },
}));

const { describeCompletion, runConfirmedAction } = await import("../src/app/actions/confirmActions");
const { useAppStore } = await import("../src/app/store");
const { INITIAL_STATE, DEFAULT_COMPLETION_OPTIONS } = await import("../src/app/constants");
const { clearIdentityCache } = await import("../src/data/azureIdentity");
import type { PullRequest } from "../src/domain/types";

afterAll(() => {
  mock.module("../src/app/actions/refreshActions", () => realRefresh);
});

const ORG = "https://dev.azure.com/acme";
const PR_PATH = "/acme/core/_apis/git/repositories/repo/pullrequests/7";
const target = { organizationUrl: ORG, project: "core", repository: "repo", prId: 7, title: "Add thing", lastMergeSourceCommit: "reviewed" };

const QUEUED = { status: "active", mergeStatus: "queued", completionQueueTime: "2026-10-04T05:00:00Z" };
const CONFLICTS = { status: "active", mergeStatus: "conflicts" };
const DONE = { status: "completed", mergeStatus: "succeeded", completionQueueTime: "2026-10-04T05:00:00Z" };

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const realFetch = globalThis.fetch;
let saved: Record<string, string | undefined> = {};

beforeEach(() => {
  saved = { mock: process.env.ADOTUI_MOCK, pat: process.env.AZURE_DEVOPS_EXT_PAT };
  delete process.env.ADOTUI_MOCK; // live mode: the action must really call Azure DevOps
  process.env.AZURE_DEVOPS_EXT_PAT = "test-pat";
  clearIdentityCache();
  refreshCalls.length = 0;
  const pr = { id: 7, title: "Add thing", status: "active", reviewState: "pending", organizationUrl: ORG, project: "core", repository: "repo" } as PullRequest;
  useAppStore.setState({
    ...INITIAL_STATE,
    toasts: [],
    data: { organizations: [{ name: "acme", organizationUrl: ORG, repositories: [{ name: "repo", project: "core", pullRequests: [pr] }] }] },
  });
});
afterEach(() => {
  globalThis.fetch = realFetch;
  if (saved.mock === undefined) delete process.env.ADOTUI_MOCK;
  else process.env.ADOTUI_MOCK = saved.mock;
  if (saved.pat === undefined) delete process.env.AZURE_DEVOPS_EXT_PAT;
  else process.env.AZURE_DEVOPS_EXT_PAT = saved.pat;
});

const prInStore = () => useAppStore.getState().data.organizations[0]!.repositories[0]!.pullRequests[0]!;
const settled = () => useAppStore.getState().loadState !== "loading";

/** PATCH is accepted ("queued"); later reads of the PR answer `afterwards`. */
const serveCompletion = (afterwards: object) => {
  globalThis.fetch = (async (input: string | URL, init: RequestInit = {}) => {
    const url = new URL(String(input));
    if (url.pathname !== PR_PATH) return json({});
    return json((init.method ?? "GET") === "PATCH" ? QUEUED : afterwards);
  }) as unknown as typeof fetch;
};

const complete = () => runConfirmedAction({ kind: "complete", target, completionOptions: DEFAULT_COMPLETION_OPTIONS });

describe("completing a PR tells the truth", () => {
  test("merge conflicts: an error banner and toast, and the PR is NOT shown as completed", async () => {
    serveCompletion(CONFLICTS);
    complete();

    // While Azure DevOps works on it: no optimistic "completed".
    expect(useAppStore.getState().banner).toBe("Completing PR...");
    expect(prInStore().status).toBe("active");

    await until(settled, "the completion to settle");
    const { banner, toasts } = useAppStore.getState();
    expect(banner).toContain("Could not complete PR #7");
    expect(banner).toContain("merge conflicts");
    expect(banner).not.toContain("completed and merged");
    expect(prInStore().status).toBe("active");
    expect(toasts.some((t) => t.type === "error" && t.message.includes("merge conflicts"))).toBe(true);
    expect(refreshCalls).toEqual(["auto"]); // re-sync with the server either way
  });

  test("a merge that went through: success banner and the PR shown as completed", async () => {
    serveCompletion(DONE);
    complete();
    await until(settled, "the completion to settle");
    expect(useAppStore.getState().banner).toStartWith("PR completed and merged.");
    expect(prInStore().status).toBe("completed");
    expect(useAppStore.getState().toasts).toEqual([]);
    expect(refreshCalls).toEqual(["auto"]);
  });

  test("a request Azure DevOps refuses outright is still 'Action failed'", async () => {
    globalThis.fetch = (async (_input: string | URL, init: RequestInit = {}) =>
      (init.method ?? "GET") === "PATCH" ? json({ message: "TF401181: cannot be edited" }, 400) : json({})) as unknown as typeof fetch;
    complete();
    await until(() => useAppStore.getState().loadState === "error", "the refusal");
    expect(useAppStore.getState().banner).toContain("Action failed");
    expect(prInStore().status).toBe("active");
  });
});

describe("the other actions keep their immediate feedback", () => {
  test("approve is still applied optimistically and confirmed afterwards", async () => {
    globalThis.fetch = (async (input: string | URL) =>
      new URL(String(input)).pathname.endsWith("/_apis/connectionData")
        ? json({ authenticatedUser: { id: "me-guid" } })
        : json({})) as unknown as typeof fetch;
    runConfirmedAction({ kind: "approve", target });
    expect(prInStore().reviewState).toBe("approved"); // before the request has even returned
    await until(settled, "the vote");
    expect(useAppStore.getState().banner).toBe("PR approved.");
  });
});

describe("describeCompletion", () => {
  const options = DEFAULT_COMPLETION_OPTIONS;

  test("completed keeps the existing wording", () => {
    const { banner, ok } = describeCompletion({ state: "completed" }, target, options);
    expect(banner).toStartWith("PR completed and merged.");
    expect(ok).toBe(true);
  });

  test("failed names the PR and the reason, and is an error", () => {
    expect(describeCompletion({ state: "failed", reason: "the PR has merge conflicts" }, target, options)).toEqual({
      banner: "Could not complete PR #7: the PR has merge conflicts.",
      ok: false,
    });
  });

  test("pending says it was only requested, and how to check", () => {
    const { banner, ok } = describeCompletion({ state: "pending" }, target, options);
    expect(banner).toContain("was requested");
    expect(banner).toContain("refresh (r)");
    expect(banner).not.toContain("completed and merged");
    expect(ok).toBe(true); // not an error: the result is simply unknown
  });
});
