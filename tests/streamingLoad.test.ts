import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { loadAppData, type LoadPartial } from "../src/data/azure";
import type { AdoConfig } from "../src/data/config";

process.env.NODE_ENV = "test";

const ORG = "https://dev.azure.com/test-org";
const realFetch = globalThis.fetch;
let savedPat: string | undefined;

const config: AdoConfig = {
  projects: [
    { organization: ORG, project: "core" },
    { organization: ORG, project: "edge" },
  ],
};

const json = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });

/** Project name out of ".../{project}/_apis/..." */
const projectOf = (url: string): string => url.split("/_apis/")[0]!.split("/").pop()!;

beforeEach(() => {
  savedPat = process.env.AZURE_DEVOPS_EXT_PAT;
  process.env.AZURE_DEVOPS_EXT_PAT = "test-pat";

  globalThis.fetch = (async (input: string | URL) => {
    const url = String(input);
    if (url.includes("/_apis/git/pullrequests")) {
      const project = projectOf(url);
      return json({
        value: [
          {
            pullRequestId: project === "core" ? 1 : 2,
            title: `PR in ${project}`,
            status: "active",
            createdBy: { displayName: "Alice" },
            creationDate: "2026-07-04T10:00:00Z",
            repository: {
              id: `${project}-repo-id`,
              name: `${project}-repo`,
              project: { id: `${project}-id`, name: project },
            },
            reviewers: [],
            sourceRefName: "refs/heads/f",
            targetRefName: "refs/heads/main",
          },
        ],
      });
    }
    if (url.includes("/_apis/git/repositories")) {
      const project = projectOf(url);
      return json({
        value: [{ id: `${project}-repo-id`, name: `${project}-repo`, project: { name: project } }],
      });
    }
    return json({ value: [] });
  }) as unknown as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = realFetch;
  if (savedPat === undefined) delete process.env.AZURE_DEVOPS_EXT_PAT;
  else process.env.AZURE_DEVOPS_EXT_PAT = savedPat;
});

describe("loadAppData streaming", () => {
  test("emits the organization first, then one partial per project, before resolving", async () => {
    const partials: LoadPartial[] = [];
    let resolved = false;

    const { data } = await loadAppData(config, {
      fetchDetails: false,
      requestId: 42,
      onPartial: (partial) => {
        // Everything must arrive while the load is still running - that is
        // the entire point of streaming.
        expect(resolved).toBe(false);
        partials.push(partial);
      },
    });
    resolved = true;

    // 1 org placeholder + 2 projects
    expect(partials).toHaveLength(3);
    expect(partials[0]).toMatchObject({ requestId: 42, organizationUrl: ORG, project: null });
    expect(partials[0]!.repositories).toHaveLength(0);

    const projectPartials = partials.slice(1);
    expect(projectPartials.map((p) => p.project).sort()).toEqual(["core", "edge"]);
    for (const partial of projectPartials) {
      expect(partial.requestId).toBe(42);
      expect(partial.organizationUrl).toBe(ORG);
      expect(partial.repositories).toHaveLength(1);
      expect(partial.repositories[0]!.project).toBe(partial.project!);
      expect(partial.progress.total).toBe(2);
    }

    // Everything streamed also appears in the resolved tree.
    const streamed = projectPartials.flatMap((p) => p.repositories.map((r) => r.name)).sort();
    const finalRepos = data.organizations[0]!.repositories.map((r) => r.name).sort();
    expect(streamed).toEqual(finalRepos);
    expect(finalRepos).toEqual(["core-repo", "edge-repo"]);
  });

  test("the resolved value is identical whether or not anything streams", async () => {
    const withStream = await loadAppData(config, { fetchDetails: false, onPartial: () => {} });
    const withoutStream = await loadAppData(config, { fetchDetails: false });
    expect(withStream.data).toEqual(withoutStream.data);
    expect(withStream.warnings).toEqual(withoutStream.warnings);
    // Config order, not arrival order, is what callers still receive.
    expect(withoutStream.data.organizations[0]!.repositories.map((r) => r.project)).toEqual([
      "core",
      "edge",
    ]);
  });

  test("a project whose repo listing fails still reports a partial and a warning", async () => {
    const failing = globalThis.fetch;
    globalThis.fetch = (async (input: string | URL) => {
      const url = String(input);
      if (url.includes("/_apis/git/repositories") && projectOf(url) === "edge") {
        return new Response(JSON.stringify({ message: "nope" }), { status: 403 });
      }
      return failing(input as string);
    }) as unknown as typeof fetch;

    const partials: LoadPartial[] = [];
    const { warnings } = await loadAppData(config, { fetchDetails: false, onPartial: (p) => partials.push(p) });

    const edge = partials.find((p) => p.project === "edge")!;
    expect(edge.repositories).toHaveLength(0);
    expect(edge.warnings.length).toBeGreaterThan(0);
    expect(warnings.length).toBeGreaterThan(0);
    // The healthy project is unaffected.
    expect(partials.find((p) => p.project === "core")!.repositories).toHaveLength(1);
  });
});
