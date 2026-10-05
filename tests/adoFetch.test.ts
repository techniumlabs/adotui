import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { chmodSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { clearAuthHeaderCache } from "../src/data/azureAuth";
import { AdoHttpError, adoGet, adoGetText, adoPatch, adoPost, seg, __buildUrl } from "../src/data/adoFetch";

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

  test("never replays a POST after a 5xx: the server may have saved it already", async () => {
    let calls = 0;
    globalThis.fetch = (async () => { calls += 1; return new Response("boom", { status: 503 }); }) as unknown as typeof fetch;
    const err = await adoPost(ORG, "_apis/x", { content: "hi" }).catch((e: unknown) => e);
    expect((err as AdoHttpError).status).toBe(503);
    expect(calls).toBe(1);
  });

  test("never replays a POST after a connection error or timeout", async () => {
    let calls = 0;
    globalThis.fetch = (async () => { calls += 1; throw new Error("socket hang up"); }) as unknown as typeof fetch;
    const err = await adoPost(ORG, "_apis/x", { content: "hi" }).catch((e: unknown) => e);
    expect((err as AdoHttpError).status).toBe(0);
    expect(calls).toBe(1);
  });

  test("still retries a throttled POST: a 429 is rejected before it runs", async () => {
    let calls = 0;
    globalThis.fetch = (async () => {
      calls += 1;
      if (calls === 1) return new Response("", { status: 429, headers: { "retry-after": "0" } });
      return json({ id: 1 });
    }) as unknown as typeof fetch;
    expect(await adoPost<{ id: number }>(ORG, "_apis/x", { content: "hi" })).toEqual({ id: 1 });
    expect(calls).toBe(2);
  });

  test("an idempotent PATCH is still replayed after a 5xx", async () => {
    let calls = 0;
    globalThis.fetch = (async () => {
      calls += 1;
      return calls === 1 ? new Response("", { status: 503 }) : json({ ok: true });
    }) as unknown as typeof fetch;
    expect(await adoPatch<{ ok: boolean }>(ORG, "_apis/x", { status: 2 })).toEqual({ ok: true });
    expect(calls).toBe(2);
  });

  test("adoGetText returns the body verbatim and asks for text/plain", async () => {
    let accept = "";
    globalThis.fetch = (async (_url: string, init: RequestInit) => {
      accept = (init.headers as Record<string, string>).Accept!;
      return new Response("line 1\n{not json}\n");
    }) as unknown as typeof fetch;
    expect(await adoGetText(ORG, "_apis/x")).toBe("line 1\n{not json}\n");
    expect(accept).toBe("text/plain");
  });

  test("adoGetText returns an empty string for an empty file (not {})", async () => {
    globalThis.fetch = (async () => new Response("")) as unknown as typeof fetch;
    expect(await adoGetText(ORG, "_apis/x")).toBe("");
  });

  test("treats 204 and empty bodies as an empty object", async () => {
    globalThis.fetch = (async () => new Response("", { status: 204 })) as unknown as typeof fetch;
    expect(await adoGet<Record<string, unknown>>(ORG, "_apis/x")).toEqual({});
  });
});

describe("sign-in pages (unknown organization or bad credentials)", () => {
  // What dev.azure.com/<unknown-org>/_apis/... returns, after fetch follows the redirect.
  const SIGN_IN_HTML = "<html><head><title>Sign in to your account</title></head><body>…</body></html>";
  const html = (status = 200) => new Response(SIGN_IN_HTML, { status, headers: { "content-type": "text/html; charset=utf-8" } });
  // These run with a PAT (the file's beforeEach sets one), which wins over az login.
  const expectSignInError = (error: unknown) => {
    expect(error).toBeInstanceOf(AdoHttpError);
    expect((error as AdoHttpError).status).toBe(401);
    expect((error as AdoHttpError).detail).toContain("rejected your personal access token");
    expect((error as AdoHttpError).detail).toContain('organization "acme"');
    expect((error as AdoHttpError).detail).not.toContain("<html");
  };

  test("an HTML answer with status 200 is a clear auth error, not 'Unrecognized token <'", async () => {
    globalThis.fetch = (async () => html()) as unknown as typeof fetch;
    expectSignInError(await adoGet(ORG, "_apis/projects").catch((e: unknown) => e));
  });

  test("the organization is read from the path only on dev.azure.com itself, not a look-alike host", async () => {
    globalThis.fetch = (async () => html()) as unknown as typeof fetch;
    const lookAlike = await adoGet("https://evil-dev.azure.com/acme", "_apis/projects").catch((e: unknown) => e);
    expect((lookAlike as AdoHttpError).detail).toContain('organization "evil-dev.azure.com"');
    const identities = await adoGet("https://vssps.dev.azure.com/acme", "_apis/identities").catch((e: unknown) => e);
    expect((identities as AdoHttpError).detail).toContain('organization "acme"');
  });

  test("a 203 is a sign-in page too (what a bad token or PAT gets)", async () => {
    globalThis.fetch = (async () => html(203)) as unknown as typeof fetch;
    expectSignInError(await adoGet(ORG, "_apis/projects").catch((e: unknown) => e));
  });

  test("a redirect to _signin is recognised in text mode as well", async () => {
    globalThis.fetch = (async () => {
      const resp = new Response(SIGN_IN_HTML, { status: 200, headers: { "content-type": "text/plain" } });
      Object.defineProperty(resp, "redirected", { value: true });
      Object.defineProperty(resp, "url", { value: "https://spsprodeus27.vssps.visualstudio.com/_signin?realm=dev.azure.com" });
      return resp;
    }) as unknown as typeof fetch;
    expectSignInError(await adoGetText(ORG, "_apis/git/items").catch((e: unknown) => e));
  });

  test("retries once (a refreshed token may fix it), then stops", async () => {
    let calls = 0;
    globalThis.fetch = (async () => { calls += 1; return html(); }) as unknown as typeof fetch;
    await adoGet(ORG, "_apis/projects").catch(() => {});
    expect(calls).toBe(2);
  });

  test("an expired token recovers: the retry gets real data", async () => {
    let calls = 0;
    globalThis.fetch = (async () => (++calls === 1 ? html(203) : json({ value: [1] }))) as unknown as typeof fetch;
    expect(await adoGet<{ value: number[] }>(ORG, "_apis/projects")).toEqual({ value: [1] });
  });

  test("a file whose CONTENT is HTML is not mistaken for a sign-in page", async () => {
    globalThis.fetch = (async () => new Response("<html>my page</html>", { headers: { "content-type": "text/plain" } })) as unknown as typeof fetch;
    expect(await adoGetText(ORG, "_apis/git/items")).toBe("<html>my page</html>");
  });

  test("a non-JSON 200 body is a readable error, not a raw SyntaxError", async () => {
    globalThis.fetch = (async () => new Response("plain text, not json", { headers: { "content-type": "text/plain" } })) as unknown as typeof fetch;
    const error = await adoGet(ORG, "_apis/x").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AdoHttpError);
    expect((error as AdoHttpError).detail).toContain("not JSON");
    expect((error as AdoHttpError).detail).toContain("plain text, not json");
  });

  test("an HTML error page does not become the error message", async () => {
    globalThis.fetch = (async () => new Response("<html><h1>Bad Request</h1></html>", { status: 400, statusText: "Bad Request" })) as unknown as typeof fetch;
    const error = await adoGet(ORG, "_apis/x").catch((e: unknown) => e);
    expect((error as AdoHttpError).detail).toBe("Bad Request");
  });
});

// Without a PAT the token comes from `az`: the advice must be about signing in, not about a PAT.
describe.skipIf(process.platform === "win32")("sign-in page when authenticating with az login", () => {
  const dir = join(tmpdir(), `adotui-fetch-az-${Date.now()}`);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "az"), `#!/bin/sh\necho '{"accessToken":"tok","expires_on":9999999999}'\n`);
  chmodSync(join(dir, "az"), 0o755);

  let savedPath: string | undefined;
  beforeEach(() => {
    savedPath = process.env.PATH;
    delete process.env.AZURE_DEVOPS_EXT_PAT; // the file-level afterEach restores it
    process.env.PATH = `${dir}:${savedPath}`;
    clearAuthHeaderCache();
  });
  afterEach(() => {
    process.env.PATH = savedPath;
    clearAuthHeaderCache();
  });

  test("tells you to check the organization and az login, not to fix a PAT", async () => {
    globalThis.fetch = (async () =>
      new Response("<html>Sign in</html>", { headers: { "content-type": "text/html" } })) as unknown as typeof fetch;
    const error = await adoGet(ORG, "_apis/projects").catch((e: unknown) => e);
    expect((error as AdoHttpError).status).toBe(401);
    expect((error as AdoHttpError).detail).toContain('organization "acme" exists');
    expect((error as AdoHttpError).detail).toContain("az login");
    expect((error as AdoHttpError).detail).not.toContain("personal access token");
  });
});

