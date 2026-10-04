import { afterEach, beforeEach, expect, test } from "bun:test";
import { fetchFileDiff } from "../src/data/azureDiff";

const realFetch = globalThis.fetch;
let savedPat: string | undefined;

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

test("a renamed file diffs its original path at the target against its new path", async () => {
  // Content exists only where git has it: the old path at the target commit,
  // the new path at the source commit. Anything else 404s, as Azure would.
  globalThis.fetch = (async (input: string | URL) => {
    const url = new URL(String(input));
    const at = `${url.searchParams.get("path")}@${url.searchParams.get("versionDescriptor.version")}`;
    if (at === "/src/old-name.ts@target") return new Response("a\nb\n");
    if (at === "/src/new-name.ts@source") return new Response("a\nc\n");
    return new Response("", { status: 404 });
  }) as unknown as typeof fetch;

  const result = await fetchFileDiff(
    "https://dev.azure.com/acme",
    "core",
    "repo",
    { path: "src/new-name.ts", originalPath: "src/old-name.ts", status: "modified", additions: 0, deletions: 0, diff: [] },
    "source",
    "target",
  );

  expect(result).not.toBeNull();
  expect(result!.rawDiff).toContain("--- a/src/old-name.ts");
  expect(result!.rawDiff).toContain("+++ b/src/new-name.ts");
  expect(result).toMatchObject({ additions: 1, deletions: 1 });
});

const FILE = { path: "src/a.ts", status: "modified" as const, additions: 0, deletions: 0, diff: [] };

test("a transient 503 on a content fetch is retried instead of failing the diff", async () => {
  let targetCalls = 0;
  globalThis.fetch = (async (input: string | URL) => {
    const url = new URL(String(input));
    if (url.searchParams.get("versionDescriptor.version") === "target") {
      targetCalls += 1;
      if (targetCalls === 1) return new Response("", { status: 503 });
      return new Response("a\n");
    }
    return new Response("b\n");
  }) as unknown as typeof fetch;

  const result = await fetchFileDiff("https://dev.azure.com/acme", "core", "repo", FILE, "source", "target");
  expect(targetCalls).toBe(2);
  expect(result).toMatchObject({ additions: 1, deletions: 1 });
});

test("a missing file yields null and prints nothing over the UI", async () => {
  globalThis.fetch = (async () => new Response("", { status: 404 })) as unknown as typeof fetch;
  const printed: unknown[][] = [];
  const realError = console.error;
  console.error = (...args: unknown[]) => { printed.push(args); };
  try {
    expect(await fetchFileDiff("https://dev.azure.com/acme", "core", "repo", FILE, "source", "target")).toBeNull();
  } finally {
    console.error = realError;
  }
  expect(printed).toEqual([]);
});

test("a project name with spaces is escaped in the items path", async () => {
  const urls: string[] = [];
  globalThis.fetch = (async (input: string | URL) => {
    urls.push(String(input));
    return new Response("x\n");
  }) as unknown as typeof fetch;
  await fetchFileDiff("https://dev.azure.com/acme", "My Project", "my repo", FILE, "source", "target");
  expect(urls[0]).toContain("/My%20Project/_apis/git/repositories/my%20repo/items?");
});
