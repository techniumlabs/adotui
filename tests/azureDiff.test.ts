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
