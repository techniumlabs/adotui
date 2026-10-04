import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { AdoHttpError } from "../src/data/adoFetch";
import { abandonPr, approvePr, completePr, rejectPr, type PrRef } from "../src/data/azureActions";
import { clearIdentityCache, getCurrentIdentity } from "../src/data/azureIdentity";
import type { CompletionOptions } from "../src/domain/types";

const ORG = "https://dev.azure.com/acme";
const PR_PATH = "/acme/core/_apis/git/repositories/repo/pullrequests/7";

const realFetch = globalThis.fetch;
let savedPat: string | undefined;
let calls: { method: string; url: URL; body: unknown }[] = [];

beforeEach(() => {
  savedPat = process.env.AZURE_DEVOPS_EXT_PAT;
  process.env.AZURE_DEVOPS_EXT_PAT = "test-pat"; // never shell out to az
  clearIdentityCache();
  calls = [];
});
afterEach(() => {
  globalThis.fetch = realFetch;
  if (savedPat === undefined) delete process.env.AZURE_DEVOPS_EXT_PAT;
  else process.env.AZURE_DEVOPS_EXT_PAT = savedPat;
});

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

type Handler = (call: { method: string; url: URL }) => Response | undefined;

/** Records every request; `override` can answer first, the rest get sensible defaults. */
const serve = (override: Handler = () => undefined) => {
  globalThis.fetch = (async (input: string | URL, init: RequestInit = {}) => {
    const url = new URL(String(input));
    const method = init.method ?? "GET";
    calls.push({ method, url, body: init.body ? JSON.parse(String(init.body)) : undefined });
    const custom = override({ method, url });
    if (custom) return custom;
    if (url.pathname.endsWith("/_apis/connectionData")) {
      return json({ authenticatedUser: { id: "me-guid", properties: { Account: { $value: "me@example.com" } } } });
    }
    if (method === "GET" && url.pathname === PR_PATH) return json({ lastMergeSourceCommit: { commitId: "fresh" } });
    return json({});
  }) as unknown as typeof fetch;
};

const ref: PrRef = { organization: ORG, project: "core", repository: "repo", prId: 7 };

const options = (extra: Partial<CompletionOptions> = {}): CompletionOptions => ({
  autoCompleteIgnoreConfigIds: [],
  bypassPolicy: false,
  bypassReason: "",
  deleteSourceBranch: true,
  mergeCommitMessage: "",
  mergeStrategy: "squash",
  squashMerge: true,
  transitionWorkItems: false,
  ...extra,
});

const mutation = () => calls.filter((c) => c.method !== "GET");

describe("current identity", () => {
  test("reads the id and sign-in address from connectionData, on the preview api-version", async () => {
    serve();
    expect(await getCurrentIdentity(ORG)).toEqual({ id: "me-guid", email: "me@example.com" });
    // Plain 7.1 answers HTTP 400 for this endpoint (checked against a live org).
    expect(calls[0]!.url.searchParams.get("api-version")).toBe("7.1-preview.1");
  });

  test("is looked up once per organization", async () => {
    serve();
    await getCurrentIdentity(ORG);
    await getCurrentIdentity(ORG);
    expect(calls).toHaveLength(1);
  });

  test("a failed lookup is not cached", async () => {
    serve(() => json({ message: "denied" }, 403));
    expect(await getCurrentIdentity(ORG)).toBeNull();
    serve();
    expect(await getCurrentIdentity(ORG)).toMatchObject({ id: "me-guid" });
  });

  test("no email reported is still an identity", async () => {
    serve(() => json({ authenticatedUser: { id: "me-guid" } }));
    expect(await getCurrentIdentity(ORG)).toEqual({ id: "me-guid", email: null });
  });
});

describe("voting", () => {
  test("approve PUTs vote 10 for the signed-in identity", async () => {
    serve();
    await approvePr(ref);
    expect(mutation()).toHaveLength(1);
    expect(mutation()[0]).toMatchObject({ method: "PUT", body: { id: "me-guid", vote: 10 } });
    expect(mutation()[0]!.url.pathname).toBe(`${PR_PATH}/reviewers/me-guid`);
  });

  test("reject PUTs vote -10", async () => {
    serve();
    await rejectPr(ref);
    expect(mutation()[0]!.body).toEqual({ id: "me-guid", vote: -10 });
  });

  test("a vote is not cast when the identity cannot be determined", async () => {
    serve(() => json({ message: "denied" }, 403));
    await expect(approvePr(ref)).rejects.toThrow("Could not determine your Azure DevOps identity");
    expect(mutation()).toHaveLength(0);
  });

  test("project and repository names are escaped in the path", async () => {
    serve();
    await approvePr({ ...ref, project: "My Project", repository: "my repo" });
    expect(mutation()[0]!.url.pathname).toContain("/acme/My%20Project/_apis/git/repositories/my%20repo/pullrequests/7/");
  });
});

describe("abandon", () => {
  test("PATCHes status abandoned and needs no identity", async () => {
    serve();
    await abandonPr(ref);
    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({ method: "PATCH", body: { status: "abandoned" } });
    expect(calls[0]!.url.pathname).toBe(PR_PATH);
  });
});

describe("complete", () => {
  test("sends the commit the user reviewed plus the completion options", async () => {
    serve();
    await completePr({ ...ref, lastMergeSourceCommit: "reviewed" }, options());
    expect(calls).toHaveLength(1); // no extra GET when the ref carries the commit
    expect(calls[0]).toMatchObject({
      method: "PATCH",
      body: {
        status: "completed",
        lastMergeSourceCommit: { commitId: "reviewed" },
        completionOptions: { mergeStrategy: "squash", deleteSourceBranch: true, transitionWorkItems: false },
      },
    });
  });

  test.each(["noFastForward", "squash", "rebase", "rebaseMerge"] as const)("passes the %s strategy through", async (mergeStrategy) => {
    serve();
    await completePr({ ...ref, lastMergeSourceCommit: "c" }, options({ mergeStrategy }));
    expect((calls[0]!.body as { completionOptions: { mergeStrategy: string } }).completionOptions.mergeStrategy).toBe(mergeStrategy);
  });

  test("bypass fields are sent only when bypassing, and the message only when set", async () => {
    serve();
    const sent = async (extra: Partial<CompletionOptions>) => {
      calls = [];
      await completePr({ ...ref, lastMergeSourceCommit: "c" }, options(extra));
      return (calls[0]!.body as { completionOptions: Record<string, unknown> }).completionOptions;
    };
    expect(await sent({ bypassPolicy: true, bypassReason: "hotfix" })).toMatchObject({ bypassPolicy: true, bypassReason: "hotfix" });
    // A leftover reason with bypass off must not leak through.
    const quiet = await sent({ bypassPolicy: false, bypassReason: "stale" });
    expect(quiet).not.toHaveProperty("bypassPolicy");
    expect(quiet).not.toHaveProperty("bypassReason");
    expect(quiet).not.toHaveProperty("mergeCommitMessage");
    expect(await sent({ mergeCommitMessage: "Merge feature" })).toMatchObject({ mergeCommitMessage: "Merge feature" });
  });

  test("a ref without a commit falls back to the PR's current head", async () => {
    serve();
    await completePr(ref, options());
    expect(calls.map((c) => c.method)).toEqual(["GET", "PATCH"]);
    expect(calls[1]!.body).toMatchObject({ lastMergeSourceCommit: { commitId: "fresh" } });
  });

  test("with no commit anywhere it refuses instead of sending a bad PATCH", async () => {
    serve(({ method }) => (method === "GET" ? json({}) : undefined));
    await expect(completePr(ref, options())).rejects.toThrow("no merge source commit");
    expect(mutation()).toHaveLength(0);
  });
});

describe("Azure DevOps refusing", () => {
  test("a source branch that moved since the review gets an actionable message", async () => {
    // The exact answer Azure DevOps gave live when a commit was pushed after the review.
    serve(({ method }) =>
      method === "PATCH"
        ? json({ message: "TF401192: The source branch has been modified since the last merge attempt." }, 409)
        : undefined,
    );
    await expect(completePr({ ...ref, lastMergeSourceCommit: "stale" }, options())).rejects.toThrow(
      "source branch changed since you last loaded this PR",
    );
  });

  test("any other refusal surfaces Azure DevOps' own message", async () => {
    serve(({ method }) => (method === "PATCH" ? json({ message: "TF401027: You need the Contribute permission." }, 403) : undefined));
    const error = await completePr({ ...ref, lastMergeSourceCommit: "c" }, options()).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AdoHttpError);
    expect((error as AdoHttpError).status).toBe(403);
    expect((error as AdoHttpError).message).toContain("Contribute permission");
  });
});
