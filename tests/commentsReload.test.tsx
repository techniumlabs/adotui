import { test, expect, describe, mock, afterAll } from "bun:test";
import { render } from "ink-testing-library";

process.env.ADOTUI_MOCK = "1";
process.env.NODE_ENV = "test";

// Faithful stand-in for the az-backed module: comment fetches return the same
// mock threads the app would show anyway, but we can count the calls.
let fetchCalls = 0;
const { getMockComments } = await import("../src/data/mock");
// mock.module is process-global and outlives this file: keep the real module
// to put back in afterAll, or every later test would get the fake azureRest.
const realAzureRest = { ...(await import("../src/data/azureRest")) };
mock.module("../src/data/azureRest", () => ({
  fetchPrComments: async (_org: string, _proj: string, _repo: string, prId: number) => {
    fetchCalls += 1;
    return getMockComments(prId);
  },
  postPrComment: async () => true,
  replyToPrThread: async () => true,
  updatePrThreadStatus: async () => true,
  deletePrComment: async () => true,
  editPrComment: async () => true,
  fetchPipelineRuns: async () => [],
}));

const { App } = await import("../src/app/App");
const { useAppStore } = await import("../src/app/store");
const { INITIAL_STATE } = await import("../src/app/constants");

/** Polls instead of sleeping a fixed time: a loaded CI runner renders late. */
const until = async (predicate: () => boolean, what: string, timeoutMs = 5_000): Promise<void> => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await new Promise((res) => setTimeout(res, 20));
  }
  throw new Error(`timed out waiting for ${what}`);
};

/** Presses `key` until `predicate` holds, so an early press that was ignored is retried. */
const pressUntil = async (
  stdin: { write: (data: string) => void },
  key: string,
  predicate: () => boolean,
  what: string,
): Promise<void> => {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    stdin.write(key);
    try {
      await until(predicate, what, 250);
      return;
    } catch {
      // not yet: press again
    }
  }
  throw new Error(`timed out waiting for ${what}`);
};

afterAll(() => {
  mock.module("../src/data/azureRest", () => realAzureRest);
});

describe("comments view reload", () => {
  test("R refetches the threads and reports the result", async () => {
    useAppStore.setState({ ...INITIAL_STATE });
    const { stdin, lastFrame } = render(<App />);
    // Keys pressed before the data has loaded (and the input handlers attached) are ignored.
    await until(() => useAppStore.getState().loadState === "ready", "the mock data to load");

    await pressUntil(stdin, "3", () => useAppStore.getState().focus === "comments" && fetchCalls > 0, "the comments view to open and load");
    const afterOpen = fetchCalls;

    // The reload happened...
    await pressUntil(stdin, "R", () => fetchCalls > afterOpen, "R to refetch the threads");
    // ...and says so, instead of leaving the view looking untouched.
    await until(() => (lastFrame() ?? "").includes("Reloaded"), "the 'Reloaded' status");
    expect(lastFrame()).toInclude("Reloaded");
  });
});
