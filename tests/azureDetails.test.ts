import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { fetchPrDetails } from "../src/data/azureLoad";
import type { PullRequest } from "../src/domain/types";

const realFetch = globalThis.fetch;
let savedPat: string | undefined;
let savedMock: string | undefined;
let requests: URL[] = [];

beforeEach(() => {
  savedPat = process.env.AZURE_DEVOPS_EXT_PAT;
  process.env.AZURE_DEVOPS_EXT_PAT = "test-pat";
  // Other test files set ADOTUI_MOCK globally, and mock mode answers comment
  // fetches with canned threads instead of going through fetch.
  savedMock = process.env.ADOTUI_MOCK;
  delete process.env.ADOTUI_MOCK;
  requests = [];
});
afterEach(() => {
  globalThis.fetch = realFetch;
  if (savedPat === undefined) delete process.env.AZURE_DEVOPS_EXT_PAT;
  else process.env.AZURE_DEVOPS_EXT_PAT = savedPat;
  if (savedMock === undefined) delete process.env.ADOTUI_MOCK;
  else process.env.ADOTUI_MOCK = savedMock;
});

const pr = {
  id: 7,
  organizationUrl: "https://dev.azure.com/acme",
  project: "core",
  repository: "repo",
  repositoryId: "repo-id",
  projectId: "project-id",
} as PullRequest;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const entries = (from: number, count: number) =>
  Array.from({ length: count }, (_, i) => ({ changeType: "edit", item: { path: `/f${from + i}.ts` } }));

/** Routes the endpoints fetchPrDetails touches; `changes` answers the paged one. */
const serve = (changes: (skip: number) => unknown, failing: string[] = []) => {
  globalThis.fetch = (async (input: string | URL) => {
    const url = new URL(String(input));
    requests.push(url);
    const path = url.pathname;
    // 403 is not retried, so a failing endpoint costs no backoff sleep.
    if (failing.some((suffix) => path.endsWith(suffix))) return json({ message: "denied" }, 403);
    if (path.endsWith("/iterations")) {
      return json({ value: [{ id: 1, sourceRefCommit: { commitId: "src" }, commonRefCommit: { commitId: "tgt" } }] });
    }
    if (path.endsWith("/iterations/1/changes")) return json(changes(Number(url.searchParams.get("$skip") ?? 0)));
    if (path.endsWith("/threads")) return json({ value: [] });
    if (path.endsWith("/workitems")) return json({ value: [] });
    if (path.endsWith("/policy/evaluations")) return json({ value: [] });
    return json({}, 404);
  }) as unknown as typeof fetch;
};

describe("iteration changes paging", () => {
  test("a PR with more than one page of files is not truncated", async () => {
    serve((skip) =>
      skip === 0
        ? { changeEntries: entries(0, 2000), nextSkip: 2000 }
        : { changeEntries: entries(2000, 5), nextSkip: 0 },
    );
    const details = await fetchPrDetails(pr);
    expect(details.changedFiles).toHaveLength(2005);
    expect(details.changedFiles![2004]!.path).toBe("f2004.ts");

    const pages = requests.filter((u) => u.pathname.endsWith("/changes"));
    expect(pages.map((u) => [u.searchParams.get("$top"), u.searchParams.get("$skip")])).toEqual([
      ["2000", null],
      ["2000", "2000"],
    ]);
  });

  test("a full page without a cursor still pages on", async () => {
    serve((skip) => ({ changeEntries: skip === 0 ? entries(0, 2000) : entries(2000, 3) }));
    expect((await fetchPrDetails(pr)).changedFiles).toHaveLength(2003);
  });

  test("a small PR takes exactly one request", async () => {
    serve(() => ({ changeEntries: entries(0, 3) }));
    expect((await fetchPrDetails(pr)).changedFiles).toHaveLength(3);
    expect(requests.filter((u) => u.pathname.endsWith("/changes"))).toHaveLength(1);
  });
});

describe("partial failures keep what the PR already shows", () => {
  const ok = () => ({ changeEntries: entries(0, 2) });
  const keys = async (failing: string[]) => {
    serve(ok, failing);
    return Object.keys(await fetchPrDetails(pr)).sort();
  };
  const ALL = ["activeComments", "changedFiles", "checksPassed", "checksTotal", "comments", "detailsLoaded", "iterSourceCommit", "iterTargetCommit", "workItems"];

  test("everything succeeding reports every field", async () => {
    expect(await keys([])).toEqual(ALL);
  });

  test("failed policies leave the check counts out (not 0/0)", async () => {
    expect(await keys(["/policy/evaluations"])).toEqual(ALL.filter((k) => !k.startsWith("checks")));
  });

  test("failed work items leave workItems out (not [])", async () => {
    expect(await keys(["/workitems"])).toEqual(ALL.filter((k) => k !== "workItems"));
  });

  test("failed comments leave the comment counts out (not 0)", async () => {
    expect(await keys(["/threads"])).toEqual(ALL.filter((k) => k !== "comments" && k !== "activeComments"));
  });

  test("failed file changes leave the files and commits out (not [])", async () => {
    expect(await keys(["/iterations"])).toEqual(
      ALL.filter((k) => k !== "changedFiles" && !k.startsWith("iter")),
    );
  });

  test("a PR with no iterations reports an empty file list (a real result)", async () => {
    globalThis.fetch = (async (input: string | URL) => {
      const path = new URL(String(input)).pathname;
      return json(path.endsWith("/iterations") ? { value: [] } : { value: [] });
    }) as unknown as typeof fetch;
    expect((await fetchPrDetails(pr)).changedFiles).toEqual([]);
  });
});
