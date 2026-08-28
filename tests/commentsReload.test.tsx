import { test, expect, describe, mock } from "bun:test";
import { render } from "ink-testing-library";

process.env.ADOTUI_MOCK = "1";
process.env.NODE_ENV = "test";

// Faithful stand-in for the az-backed module: comment fetches return the same
// mock threads the app would show anyway, but we can count the calls.
let fetchCalls = 0;
const { getMockComments } = await import("../src/data/mock");
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

const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

describe("comments view reload", () => {
  test("R refetches the threads and reports the result", async () => {
    useAppStore.setState({ ...INITIAL_STATE });
    const { stdin, lastFrame } = render(<App />);
    await delay(200);

    stdin.write("3");
    await delay(250);
    expect(useAppStore.getState().focus).toBe("comments");
    const afterOpen = fetchCalls;
    expect(afterOpen).toBeGreaterThan(0);

    stdin.write("R");
    await delay(300);
    // The reload happened...
    expect(fetchCalls).toBeGreaterThan(afterOpen);
    // ...and says so, instead of leaving the view looking untouched.
    expect(lastFrame()).toInclude("Reloaded");
  });
});
