import { afterEach, beforeEach, expect, test } from "bun:test";
import { sendComment } from "../src/app/hooks/usePrComments";
import type { PrCommentThread, PullRequest } from "../src/domain/types";

const realFetch = globalThis.fetch;
const saved = { pat: process.env.AZURE_DEVOPS_EXT_PAT, mock: process.env.ADOTUI_MOCK };
let calls: { method: string; path: string; body: unknown }[] = [];

beforeEach(() => {
  process.env.AZURE_DEVOPS_EXT_PAT = "test-pat";
  delete process.env.ADOTUI_MOCK;
  calls = [];
  globalThis.fetch = (async (input: string | URL, init: RequestInit = {}) => {
    calls.push({ method: init.method ?? "GET", path: new URL(String(input)).pathname, body: init.body ? JSON.parse(String(init.body)) : undefined });
    return new Response("{}", { headers: { "content-type": "application/json" } });
  }) as unknown as typeof fetch;
});
afterEach(() => {
  globalThis.fetch = realFetch;
  if (saved.pat === undefined) delete process.env.AZURE_DEVOPS_EXT_PAT; else process.env.AZURE_DEVOPS_EXT_PAT = saved.pat;
  if (saved.mock === undefined) delete process.env.ADOTUI_MOCK; else process.env.ADOTUI_MOCK = saved.mock;
});

const pr = { id: 7, organizationUrl: "https://dev.azure.com/acme", project: "core", repository: "repo", repositoryId: "rid" } as PullRequest;
const thread = {
  id: 40,
  status: "active",
  comments: [{ id: 1, content: "root" }, { id: 2, content: "reply" }],
} as unknown as PrCommentThread;
const THREADS = "/acme/core/_apis/git/repositories/rid/pullRequests/7/threads";

test("new: posts a thread", async () => {
  expect(await sendComment(pr, "new", "hello", undefined, -1)).toBe(true);
  expect(calls).toEqual([{ method: "POST", path: THREADS, body: expect.objectContaining({ comments: [expect.objectContaining({ content: "hello" })] }) }]);
});

test("reply: posts to the thread, parented on its root comment", async () => {
  expect(await sendComment(pr, "reply", "hi", thread, -1)).toBe(true);
  expect(calls[0]).toMatchObject({ method: "POST", path: `${THREADS}/40/comments`, body: { parentCommentId: 1, content: "hi" } });
});

test("edit: patches the selected comment (-1 = root, 0 = first reply)", async () => {
  await sendComment(pr, "edit", "fixed", thread, 0);
  expect(calls[0]).toMatchObject({ method: "PATCH", path: `${THREADS}/40/comments/2`, body: { content: "fixed" } });
});

test("reply or edit without a thread sends nothing", async () => {
  expect(await sendComment(pr, "reply", "x", undefined, -1)).toBe(false);
  expect(await sendComment(pr, "edit", "x", undefined, -1)).toBe(false);
  expect(calls).toEqual([]);
});
