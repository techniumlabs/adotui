import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { render } from "ink-testing-library";
import { App } from "../src/app/App";
import { useAppStore } from "../src/app/store";
import { INITIAL_STATE } from "../src/app/constants";
import { branchMatches, buildNewPr, defaultTitle } from "../src/app/createPr";
import { createPullRequest, listBranches } from "../src/data/azure";
import { AdoHttpError } from "../src/data/adoFetch";
import type { CreatePrForm } from "../src/app/types";
import { pressUntil, until } from "./helpers/wait";

const DOWN = "\x1b[B";
const ESC = "\x1b";

describe("form logic", () => {
  test("branch filter is a case-insensitive substring match", () => {
    expect(branchMatches(["main", "feature/Login", "fix/login-typo"], "LOGIN")).toEqual(["feature/Login", "fix/login-typo"]);
    expect(branchMatches(["a", "b"], "")).toEqual(["a", "b"]);
  });

  test("default title comes from the branch's last segment", () => {
    expect(defaultTitle("feature/add-login_page")).toBe("add login page");
    expect(defaultTitle("hotfix")).toBe("hotfix");
  });

  const form = (extra: Partial<CreatePrForm> = {}): CreatePrForm => ({
    repo: { organizationUrl: "https://dev.azure.com/acme", project: "core", name: "web" },
    branches: ["feature/x", "main"],
    defaultBranch: "main",
    source: { query: "", pick: 0 },
    target: { query: "", pick: 1 },
    title: "",
    description: "  why  ",
    draft: true,
    cursor: 0,
    submitting: false,
    error: null,
    ...extra,
  });

  test("builds the request, defaulting the title and trimming the description", () => {
    expect(buildNewPr(form())).toEqual({
      pr: { sourceBranch: "feature/x", targetBranch: "main", title: "x", description: "why", draft: true },
    });
  });

  test("refuses: still loading, no match, same branch twice", () => {
    expect(buildNewPr(form({ branches: null }))).toEqual({ error: "Branches are still loading." });
    expect(buildNewPr(form({ source: { query: "nope", pick: 0 } }))).toMatchObject({ error: expect.stringContaining("source branch") });
    expect(buildNewPr(form({ source: { query: "", pick: 1 } }))).toMatchObject({ error: expect.stringContaining("different branches") });
  });
});

describe("REST requests", () => {
  const realFetch = globalThis.fetch;
  const saved = { pat: process.env.AZURE_DEVOPS_EXT_PAT, mock: process.env.ADOTUI_MOCK };
  let calls: { method: string; path: string; query: string; body: unknown }[] = [];
  const repo = { organizationUrl: "https://dev.azure.com/acme", project: "My Project", repositoryId: "web" };
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

  beforeEach(() => {
    process.env.AZURE_DEVOPS_EXT_PAT = "test-pat";
    delete process.env.ADOTUI_MOCK;
    calls = [];
  });
  afterEach(() => {
    globalThis.fetch = realFetch;
    if (saved.pat === undefined) delete process.env.AZURE_DEVOPS_EXT_PAT; else process.env.AZURE_DEVOPS_EXT_PAT = saved.pat;
    if (saved.mock === undefined) delete process.env.ADOTUI_MOCK; else process.env.ADOTUI_MOCK = saved.mock;
  });
  const serve = (answer: (path: string, method: string) => Response) => {
    globalThis.fetch = (async (input: string | URL, init: RequestInit = {}) => {
      const url = new URL(String(input));
      calls.push({ method: init.method ?? "GET", path: url.pathname, query: url.search, body: init.body ? JSON.parse(String(init.body)) : undefined });
      return answer(url.pathname, init.method ?? "GET");
    }) as unknown as typeof fetch;
  };

  test("listBranches: short names, sorted, plus the default branch", async () => {
    serve((path) =>
      path.endsWith("/refs")
        ? json({ value: [{ name: "refs/heads/main" }, { name: "refs/heads/feature/b" }, { name: "refs/heads/a" }] })
        : json({ defaultBranch: "refs/heads/main" }),
    );
    expect(await listBranches(repo)).toEqual({ branches: ["a", "feature/b", "main"], defaultBranch: "main" });
    expect(calls.find((c) => c.path.endsWith("/refs"))!.query).toContain("filter=heads%2F");
    expect(calls[0]!.path).toContain("/acme/My%20Project/_apis/git/repositories/web");
  });

  test("createPullRequest: POSTs full ref names, title, description and draft; returns the id", async () => {
    serve(() => json({ pullRequestId: 321 }));
    const pr = { sourceBranch: "feature/x", targetBranch: "main", title: "Add x", description: "d", draft: true };
    expect(await createPullRequest(repo, pr)).toEqual({ id: 321 });
    expect(calls).toEqual([{
      method: "POST",
      path: "/acme/My%20Project/_apis/git/repositories/web/pullrequests",
      query: expect.any(String),
      body: { sourceRefName: "refs/heads/feature/x", targetRefName: "refs/heads/main", title: "Add x", description: "d", isDraft: true },
    }]);
  });

  test("createPullRequest: Azure DevOps' refusal reaches the caller", async () => {
    serve(() => json({ message: "TF401179: An active pull request for the source and target branch already exists." }, 409));
    const error = await createPullRequest(repo, { sourceBranch: "a", targetBranch: "b", title: "t", description: "", draft: false }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AdoHttpError);
    expect((error as AdoHttpError).message).toContain("already exists");
  });
});

describe("the form in the app (mock mode)", () => {
  const savedMock = process.env.ADOTUI_MOCK;
  beforeEach(() => {
    process.env.ADOTUI_MOCK = "1";
    process.env.NODE_ENV = "test";
    useAppStore.setState({ ...INITIAL_STATE });
  });
  afterEach(() => {
    if (savedMock === undefined) delete process.env.ADOTUI_MOCK; else process.env.ADOTUI_MOCK = savedMock;
  });

  const start = async () => {
    const app = render(<App />);
    Object.defineProperty(app.stdout, "rows", { value: 40, configurable: true });
    app.stdout.emit("resize");
    await until(() => useAppStore.getState().loadState === "ready", "the mock data to load");
    return app;
  };
  const form = () => useAppStore.getState().createPr;

  test("N opens it on screen with branches loaded and main as the target", async () => {
    const { stdin, lastFrame } = await start();
    await pressUntil(stdin, "N", () => form()?.branches !== null && form() !== null, "the form with branches");
    expect(lastFrame()).toContain("New pull request");
    expect(lastFrame()).toContain("source branch");
    expect(lastFrame()).toMatch(/target branch\s+main/);
  });

  test("filter, create: the form closes and the banner names the new PR", async () => {
    const { stdin, lastFrame } = await start();
    await pressUntil(stdin, "N", () => form()?.branches != null, "the form with branches");
    for (const ch of "typo") stdin.write(ch);
    await until(() => (lastFrame() ?? "").includes("fix/typo"), "the filtered branch");
    for (let i = 0; i < 5; i += 1) stdin.write(DOWN);
    await until(() => form()?.cursor === 5, "the create row");
    stdin.write("\r");
    await until(() => form() === null, "the form to close");
    const toasts = useAppStore.getState().toasts.map((t) => `${t.type}: ${t.message}`);
    expect(toasts).toContain('success: Created PR #9001 "typo" in adotui-core.');
  });

  test("the same branch twice is refused with a message, and Esc cancels", async () => {
    const { stdin, lastFrame } = await start();
    await pressUntil(stdin, "N", () => form()?.branches != null, "the form with branches");
    for (const ch of "main") stdin.write(ch);
    await until(() => form()?.source.query === "main", "the source filter");
    for (let i = 0; i < 5; i += 1) stdin.write(DOWN);
    await until(() => form()?.cursor === 5, "the create row");
    stdin.write("\r");
    await until(() => (lastFrame() ?? "").includes("different branches"), "the validation message");
    stdin.write(ESC);
    await until(() => form() === null && useAppStore.getState().focus !== "createPr", "the form to close");
  });

  test("the completion editor is visible (it used to render outside the frame)", async () => {
    const { stdin, lastFrame } = await start();
    await pressUntil(stdin, "c", () => useAppStore.getState().focus === "completion", "the completion editor");
    await until(() => (lastFrame() ?? "").includes("merge strategy"), "the editor's fields on screen");
  });
});
