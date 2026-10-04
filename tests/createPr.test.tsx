import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { render } from "ink-testing-library";
import { App } from "../src/app/App";
import { useAppStore } from "../src/app/store";
import { INITIAL_STATE } from "../src/app/constants";
import {
  acceptSuggestion,
  branchMatches,
  buildNewPr,
  defaultTitle,
  listWindowStart,
  parseReviewers,
  pickedBranch,
  reviewerSuggestions,
  validateCreatePr,
} from "../src/app/createPr";
import { submitCreatePr } from "../src/app/actions/createPrActions";
import { CREATE_PR_FIELD } from "../src/app/constants";
import { createPullRequest, listBranches } from "../src/data/azure";
import { AdoHttpError } from "../src/data/adoFetch";
import type { CreatePrForm } from "../src/app/types";
import { pressUntil, until } from "./helpers/wait";

const DOWN = "\x1b[B";
const RIGHT = "\x1b[C";
const TAB = "\t";
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
    reviewers: "",
    reviewerPick: 0,
    people: [
      { name: "Ram Patel", email: "ram@example.com" },
      { name: "Nina Alvarez", email: "nina@example.com" },
    ],
    openPrs: [],
    draft: true,
    cursor: 0,
    submitting: false,
    error: null,
    ...extra,
  });

  test("builds the request, defaulting the title and trimming the description", () => {
    expect(buildNewPr(form())).toEqual({
      pr: { sourceBranch: "feature/x", targetBranch: "main", title: "x", description: "why", draft: true },
      reviewerEmails: [],
    });
    expect(buildNewPr(form({ reviewers: "Ram@Example.com, nina@example.com, " }))).toMatchObject({
      reviewerEmails: ["ram@example.com", "nina@example.com"],
    });
  });

  test("refuses: still loading, no match, same branch twice, naming the field", () => {
    expect(buildNewPr(form({ branches: null }))).toEqual({ error: "Branches are still loading." });
    expect(buildNewPr(form({ source: { query: "nope", pick: 0 } }))).toEqual({ error: 'no branch matches "nope"', field: "source" });
    expect(buildNewPr(form({ source: { query: "", pick: 1 } }))).toEqual({ error: "must differ from the source branch", field: "target" });
  });

  test("validates every field: open duplicate, lengths, reviewer e-mails", () => {
    expect(validateCreatePr(form())).toEqual({});
    expect(validateCreatePr(form({ openPrs: [{ id: 7, source: "feature/x", target: "main" }] })).target).toBe(
      "PR #7 is already open for these branches",
    );
    expect(validateCreatePr(form({ title: "t".repeat(401) })).title).toContain("401/400");
    expect(validateCreatePr(form({ description: "d".repeat(4001) })).description).toContain("4001/4000");
    expect(validateCreatePr(form({ reviewers: "ram@example.com, bob" })).reviewers).toBe('"bob" is not an e-mail address');
    expect(validateCreatePr(form({ reviewers: "a@b.io; A@b.io" })).reviewers).toBe("A@b.io is listed twice");
  });

  test("reviewer suggestions match the entry being typed, by name or e-mail, minus those added", () => {
    expect(parseReviewers(" a@b.io,c@d.io ;e@f.io ")).toEqual(["a@b.io", "c@d.io", "e@f.io"]);
    expect(reviewerSuggestions(form({ reviewers: "nin" })).map((p) => p.email)).toEqual(["nina@example.com"]);
    expect(reviewerSuggestions(form({ reviewers: "ram@example.com, EXAMPLE" })).map((p) => p.email)).toEqual(["nina@example.com"]);
    expect(reviewerSuggestions(form({ reviewers: "ram@example.com, " }))).toEqual([]);
    expect(acceptSuggestion("ram@example.com, ni", "nina@example.com")).toBe("ram@example.com, nina@example.com, ");
  });

  test("the branch list window keeps the pick in view", () => {
    expect(listWindowStart(0, 20, 8)).toBe(0);
    expect(listWindowStart(10, 20, 8)).toBe(6);
    expect(listWindowStart(19, 20, 8)).toBe(12);
    expect(listWindowStart(2, 3, 8)).toBe(0);
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
    const pr = { sourceBranch: "feature/x", targetBranch: "main", title: "Add x", description: "d", draft: true, reviewerIds: [] };
    expect(await createPullRequest(repo, pr)).toEqual({ id: 321 });
    expect(calls).toEqual([{
      method: "POST",
      path: "/acme/My%20Project/_apis/git/repositories/web/pullrequests",
      query: expect.any(String),
      body: { sourceRefName: "refs/heads/feature/x", targetRefName: "refs/heads/main", title: "Add x", description: "d", isDraft: true },
    }]);
  });

  test("createPullRequest: sends reviewers by id", async () => {
    serve(() => json({ pullRequestId: 5 }));
    await createPullRequest(repo, { sourceBranch: "a", targetBranch: "b", title: "t", description: "", draft: false, reviewerIds: ["id-1", "id-2"] });
    expect(calls[0]!.body).toMatchObject({ reviewers: [{ id: "id-1" }, { id: "id-2" }] });
  });

  test("submit: an e-mail no Azure DevOps user has stops it before anything is created", async () => {
    serve((path) => (path.endsWith("/identities") ? json({ value: [] }) : json({ pullRequestId: 1 })));
    useAppStore.setState({
      ...INITIAL_STATE,
      createPr: {
        repo: { organizationUrl: "https://dev.azure.com/acme", project: "core", name: "web" },
        branches: ["feature/x", "main"], defaultBranch: "main",
        source: { query: "", pick: 0 }, target: { query: "", pick: 1 },
        title: "", description: "", reviewers: "ghost-zq7@example.com", reviewerPick: 0, people: [], openPrs: [],
        draft: false, cursor: CREATE_PR_FIELD.SUBMIT, submitting: false, error: null,
      },
    });
    submitCreatePr();
    await until(() => useAppStore.getState().createPr?.submitting === false && useAppStore.getState().createPr?.error != null, "the error");
    expect(useAppStore.getState().createPr?.error).toBe("No Azure DevOps user has the e-mail ghost-zq7@example.com.");
    expect(useAppStore.getState().createPr?.cursor).toBe(CREATE_PR_FIELD.REVIEWERS);
    expect(calls.some((c) => c.method === "POST")).toBe(false);
  });

  test("createPullRequest: Azure DevOps' refusal reaches the caller", async () => {
    serve(() => json({ message: "TF401179: An active pull request for the source and target branch already exists." }, 409));
    const error = await createPullRequest(repo, { sourceBranch: "a", targetBranch: "b", title: "t", description: "", draft: false, reviewerIds: [] }).catch((e: unknown) => e);
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
    await until(() => useAppStore.getState().loadState === "ready", "the mock data to load");
    // Resize once the app is up (its resize listener is attached by then), and wait
    // until the frame really is that tall: at the default 24 rows the form is clipped.
    Object.defineProperty(app.stdout, "rows", { value: 40, configurable: true });
    app.stdout.emit("resize");
    await until(() => (app.lastFrame() ?? "").split("\n").length >= 39, "the 40-row frame");
    return app;
  };
  const form = () => useAppStore.getState().createPr;

  /** Opens the form and waits until it is on screen with its branches (its keys are live from then on). */
  const openForm = async (stdin: { write: (d: string) => void }, lastFrame: () => string | undefined) => {
    // Re-press only until the form OPENS: once it is open, another N is typed into the branch filter.
    await pressUntil(stdin, "N", () => form() !== null, "the form to open");
    await until(() => form()?.branches != null, "the branches to load");
    await until(() => (lastFrame() ?? "").includes("source branch"), "the form on screen");
  };
  /** Types into the active field one key at a time, waiting for each to land. */
  const typeQuery = async (stdin: { write: (d: string) => void }, text: string) => {
    for (const ch of text) {
      const before = form()?.source.query ?? "";
      stdin.write(ch);
      await until(() => form()?.source.query === before + ch, `"${ch}" to be typed`);
    }
  };
  const moveTo = async (stdin: { write: (d: string) => void }, row: number) => {
    while ((form()?.cursor ?? 0) < row) {
      const before = form()?.cursor;
      stdin.write(TAB);
      await until(() => form()?.cursor !== before, "the cursor to move");
    }
  };

  test("N opens it on screen with branches loaded and main as the target", async () => {
    const { stdin, lastFrame } = await start();
    await openForm(stdin, lastFrame);
    const frame = lastFrame() ?? "";
    if (!/target branch\s+main/.test(frame)) throw new Error(`form not rendered as expected:\n${frame}`);
    expect(lastFrame()).toContain("New pull request");
    expect(lastFrame()).toContain("source branch");
    expect(lastFrame()).toMatch(/target branch\s+main/);
  });

  test("filter, create: the form closes and the banner names the new PR", async () => {
    const { stdin, lastFrame } = await start();
    await openForm(stdin, lastFrame);
    await typeQuery(stdin, "typo");
    const f = form()!;
    expect(pickedBranch(f.branches, f.source)).toBe("fix/typo");
    await moveTo(stdin, CREATE_PR_FIELD.SUBMIT);
    stdin.write("\r");
    await until(() => form() === null, "the form to close");
    const toasts = useAppStore.getState().toasts.map((t) => `${t.type}: ${t.message}`);
    expect(toasts).toContain('success: Created PR #9001 "typo" in adotui-core.');
  });

  test("the same branch twice is refused with a message, and Esc cancels", async () => {
    const { stdin, lastFrame } = await start();
    await openForm(stdin, lastFrame);
    await typeQuery(stdin, "main");
    await moveTo(stdin, CREATE_PR_FIELD.SUBMIT);
    stdin.write("\r");
    await until(() => form()?.error === "must differ from the source branch", "the validation message");
    expect(form()?.submitting).toBe(false); // nothing was sent
    expect(form()?.cursor).toBe(CREATE_PR_FIELD.TARGET); // taken to the field to fix
    expect(lastFrame()).toContain("must differ from the source branch");
    stdin.write(ESC);
    await until(() => form() === null && useAppStore.getState().focus !== "createPr", "the form to close");
  });

  test("↓ scrolls the branch list instead of leaving the field", async () => {
    const { stdin, lastFrame } = await start();
    await openForm(stdin, lastFrame);
    const before = form()!.source.pick;
    stdin.write(DOWN);
    await until(() => form()!.source.pick === before + 1, "the pick to move");
    expect(form()!.cursor).toBe(CREATE_PR_FIELD.SOURCE);
  });

  test("a reviewer is suggested from the org's PRs, taken with →, and a bad e-mail blocks create", async () => {
    const { stdin, lastFrame } = await start();
    await openForm(stdin, lastFrame);
    await moveTo(stdin, CREATE_PR_FIELD.REVIEWERS);
    for (const ch of "ram") {
      const before = form()!.reviewers;
      stdin.write(ch);
      await until(() => form()!.reviewers === before + ch, `"${ch}" to be typed`);
    }
    await until(() => (lastFrame() ?? "").includes("Ram Patel <ram@example.com>"), "the suggestion on screen");
    stdin.write(RIGHT);
    await until(() => form()!.reviewers === "ram@example.com, ", "the suggestion taken");
    stdin.write("x");
    await until(() => form()!.reviewers.endsWith("x"), "x typed");
    await moveTo(stdin, CREATE_PR_FIELD.SUBMIT);
    stdin.write("\r");
    await until(() => form()?.error === '"x" is not an e-mail address', "the reviewer error");
    expect(form()?.cursor).toBe(CREATE_PR_FIELD.REVIEWERS);
  });

  test("the completion editor is visible (it used to render outside the frame)", async () => {
    const { stdin, lastFrame } = await start();
    await pressUntil(stdin, "c", () => useAppStore.getState().focus === "completion", "the completion editor");
    await until(() => (lastFrame() ?? "").includes("merge strategy"), "the editor's fields on screen");
  });
});
