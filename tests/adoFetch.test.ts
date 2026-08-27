import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { AdoHttpError, adoGet, seg, __buildUrl } from "../src/data/adoFetch";

const ORG = "https://dev.azure.com/acme";
const realFetch = globalThis.fetch;
let savedPat: string | undefined;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

beforeEach(() => {
  savedPat = process.env.AZURE_DEVOPS_EXT_PAT;
  // Forces the PAT auth path so tests never shell out to az.
  process.env.AZURE_DEVOPS_EXT_PAT = "test-pat";
});
afterEach(() => {
  globalThis.fetch = realFetch;
  if (savedPat === undefined) delete process.env.AZURE_DEVOPS_EXT_PAT;
  else process.env.AZURE_DEVOPS_EXT_PAT = savedPat;
});

describe("URL building", () => {
  test("joins org and path and always sets api-version", () => {
    const url = __buildUrl(ORG, "core/_apis/git/repositories");
    expect(url).toBe("https://dev.azure.com/acme/core/_apis/git/repositories?api-version=7.1");
  });

  test("appends query params and skips undefined ones", () => {
    const url = __buildUrl(ORG, "core/_apis/git/pullrequests", { "$top": 100, "$skip": undefined, "searchCriteria.status": "active" });
    expect(url).toContain("%24top=100");
    expect(url).not.toContain("skip");
    expect(url).toContain("searchCriteria.status=active");
  });

  test("honours a custom api-version and tolerates slashes", () => {
    expect(__buildUrl(ORG + "/", "/_apis/policy/evaluations", {}, "7.1-preview.1"))
      .toBe("https://dev.azure.com/acme/_apis/policy/evaluations?api-version=7.1-preview.1");
  });

  test("seg escapes path segments", () => {
    expect(seg("my project")).toBe("my%20project");
  });
});

describe("requests", () => {
  test("returns parsed JSON and sends the auth header", async () => {
    let seenAuth = "";
    globalThis.fetch = (async (_url: string, init: RequestInit) => {
      seenAuth = (init.headers as Record<string, string>).Authorization ?? "";
      return json({ count: 1, value: [{ id: "r1" }] });
    }) as unknown as typeof fetch;

    const result = await adoGet<{ value: { id: string }[] }>(ORG, "_apis/git/repositories");
    expect(result.value[0]?.id).toBe("r1");
    expect(seenAuth.startsWith("Basic ")).toBe(true);
  });

  test("maps a 403 to a readable error", async () => {
    globalThis.fetch = (async () => json({ message: "TF401027: You need Contribute permission." }, 403)) as unknown as typeof fetch;
    const err = await adoGet(ORG, "_apis/x").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AdoHttpError);
    expect((err as AdoHttpError).status).toBe(403);
    expect((err as AdoHttpError).detail).toContain("Contribute permission");
  });

  test("explains a bare 401 without a body", async () => {
    let calls = 0;
    globalThis.fetch = (async () => { calls++; return new Response("", { status: 401 }); }) as unknown as typeof fetch;
    const err = await adoGet(ORG, "_apis/x").catch((e: unknown) => e);
    expect((err as AdoHttpError).detail).toContain("not authenticated");
    // Retries once with a refreshed token before giving up.
    expect(calls).toBeGreaterThan(1);
  });

  test("retries a 429 and then succeeds", async () => {
    let calls = 0;
    globalThis.fetch = (async () => {
      calls += 1;
      if (calls === 1) return new Response("", { status: 429, headers: { "retry-after": "0" } });
      return json({ value: [] });
    }) as unknown as typeof fetch;

    const result = await adoGet<{ value: unknown[] }>(ORG, "_apis/x");
    expect(result.value).toEqual([]);
    expect(calls).toBe(2);
  });

  test("treats 204 and empty bodies as an empty object", async () => {
    globalThis.fetch = (async () => new Response("", { status: 204 })) as unknown as typeof fetch;
    expect(await adoGet<Record<string, unknown>>(ORG, "_apis/x")).toEqual({});
  });
});
