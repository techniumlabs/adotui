import { afterEach, beforeEach, expect, test } from "bun:test";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fetchFileDiff } from "../src/data/azureDiff";
import type { PullRequestFileChange } from "../src/domain/types";

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

const FILE: PullRequestFileChange = { path: "src/a.ts", status: "modified", additions: 0, deletions: 0, diff: [] };

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

// Serves `oldText` at the target commit and `newText` at the source commit.
const diffOf = (oldText: string, newText: string, file = FILE) => {
  globalThis.fetch = (async (input: string | URL) => {
    const version = new URL(String(input)).searchParams.get("versionDescriptor.version");
    return new Response(version === "target" ? oldText : newText);
  }) as unknown as typeof fetch;
  return fetchFileDiff("https://dev.azure.com/acme", "core", "repo", file, "source", "target");
};

test("identical content yields an empty diff, not an error", async () => {
  expect(await diffOf("same\n", "same\n")).toEqual({ rawDiff: "", additions: 0, deletions: 0 });
});

test("an added file diffs against nothing", async () => {
  const result = await diffOf("", "one\ntwo\n", { ...FILE, status: "added" });
  expect(result).toMatchObject({ additions: 2, deletions: 0 });
  expect(result!.rawDiff).toContain("@@ -0,0 +1,2 @@");
});

test("content lines that look like diff headers are counted as changes", async () => {
  // A removed markdown rule ("---") and an added "++x" start with the same
  // characters as the header lines git emits above the first hunk.
  const result = await diffOf("keep\n---\n", "keep\n++x\n");
  expect(result).toMatchObject({ additions: 1, deletions: 1 });
  expect(result!.rawDiff.startsWith("--- a/src/a.ts\n+++ b/src/a.ts\n@@")).toBe(true);
});

test("binary content is reported, not dumped", async () => {
  const result = await diffOf("\u0000\u0001old", "\u0000\u0001new");
  expect(result).toEqual({
    rawDiff: "Binary files a/src/a.ts and b/src/a.ts differ\n",
    additions: 0,
    deletions: 0,
  });
});

test("the user's git config cannot change the output", async () => {
  const config = join(tmpdir(), `adotui-gitconfig-${Date.now()}`);
  await Bun.write(config, "[color]\n\tui = always\n[diff]\n\tnoprefix = true\n\tcontext = 0\n\tmnemonicPrefix = true\n");
  const saved = process.env.GIT_CONFIG_GLOBAL;
  process.env.GIT_CONFIG_GLOBAL = config;
  try {
    const result = await diffOf("1\n2\n3\n4\n5\n6\n7\n", "1\n2\n3\nX\n5\n6\n7\n");
    expect(result!.rawDiff).not.toContain("\u001b[");
    expect(result!.rawDiff.startsWith("--- a/src/a.ts\n+++ b/src/a.ts\n")).toBe(true);
    // -U3 wins over diff.context = 0: three lines of context each side.
    expect(result!.rawDiff).toContain(" 1\n 2\n 3\n-4\n+X\n 5\n 6\n 7\n");
  } finally {
    if (saved === undefined) delete process.env.GIT_CONFIG_GLOBAL;
    else process.env.GIT_CONFIG_GLOBAL = saved;
  }
});

test("a failing git (exit > 1) yields null instead of a bogus diff", async () => {
  const config = join(tmpdir(), `adotui-badgitconfig-${Date.now()}`);
  await Bun.write(config, "[this is not valid\n");
  const saved = process.env.GIT_CONFIG_GLOBAL;
  process.env.GIT_CONFIG_GLOBAL = config; // git refuses to run: exit 128
  try {
    expect(await diffOf("a\n", "b\n")).toBeNull();
  } finally {
    if (saved === undefined) delete process.env.GIT_CONFIG_GLOBAL;
    else process.env.GIT_CONFIG_GLOBAL = saved;
  }
});
