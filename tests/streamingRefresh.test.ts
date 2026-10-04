import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { useAppStore } from "../src/app/store";
import { INITIAL_STATE } from "../src/app/constants";
import { doRefresh, resetRefreshState } from "../src/app/actions/refreshActions";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MOCK_DATA } from "../src/data/mock";
import type { AppData } from "../src/domain/types";

const countRepos = (data: AppData): number =>
  data.organizations.reduce((acc, org) => acc + org.repositories.length, 0);

const saved: Record<string, string | undefined> = {};
const setEnv = (key: string, value: string) => {
  saved[key] = process.env[key];
  process.env[key] = value;
};

const waitFor = async (predicate: () => boolean, timeoutMs = 15_000): Promise<void> => {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await Bun.sleep(20);
  }
  throw new Error("timed out waiting for condition");
};

describe("streaming refresh", () => {
  beforeEach(() => {
    setEnv("ADOTUI_MOCK", "1");
    setEnv("ADOTUI_MOCK_STREAM", "1");
    // Small but non-zero so the replay spans several coalescing windows.
    setEnv("ADOTUI_MOCK_STREAM_MS", "5");
    setEnv("NODE_ENV", "test");
    resetRefreshState();
    useAppStore.setState({ ...INITIAL_STATE });
  });

  afterEach(() => {
    resetRefreshState();
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  test("the tree grows in steps instead of appearing all at once", async () => {
    const repoCounts: number[] = [];
    const unsubscribe = useAppStore.subscribe((state) => repoCounts.push(countRepos(state.data)));

    doRefresh("initial");
    await waitFor(() => useAppStore.getState().loadState === "ready");
    unsubscribe();

    const withData = repoCounts.filter((count) => count > 0);
    // More than one commit carried repositories: the user saw the tree fill in.
    expect(withData.length).toBeGreaterThan(1);
    // ...and it only ever grew - a mid-load commit must never drop rows.
    for (let i = 1; i < withData.length; i += 1) {
      expect(withData[i]!).toBeGreaterThanOrEqual(withData[i - 1]!);
    }
    // The finished tree still holds everything mock mode provides.
    expect(countRepos(useAppStore.getState().data)).toBe(countRepos(MOCK_DATA));
  });

  test("commits stay coalesced, so streaming cannot flood the terminal", async () => {
    let commits = 0;
    const unsubscribe = useAppStore.subscribe(() => { commits += 1; });

    doRefresh("initial");
    await waitFor(() => useAppStore.getState().loadState === "ready");
    unsubscribe();

    // Mock mode emits one partial per project group (100+ of them). Ink
    // rewrites the whole frame per commit, so they must be batched: this is
    // the guard against re-introducing the loading flicker.
    const projectGroups = MOCK_DATA.organizations.reduce(
      (acc, org) => acc + new Set(org.repositories.map((r) => r.project)).size,
      0,
    );
    expect(projectGroups).toBeGreaterThan(20);
    expect(commits).toBeLessThan(20);
  });

  test("a superseded load cannot write into the store", async () => {
    doRefresh("initial");
    // Simulate a newer load taking over while partials are still in flight.
    resetRefreshState();
    useAppStore.setState({ ...INITIAL_STATE });
    const before = useAppStore.getState().data;

    await Bun.sleep(400);
    expect(useAppStore.getState().data).toBe(before);
  });

  test("an auto refresh upserts like a manual one instead of replacing the tree", async () => {
    doRefresh("initial");
    await waitFor(() => useAppStore.getState().loadState === "ready");
    // A row the refresh does not return - what a project failing mid-refresh
    // looks like. Replacing the tree wholesale would drop it.
    const { data } = useAppStore.getState();
    const [org, ...rest] = data.organizations;
    const ghost = { name: "ghost", project: "ghost-project", pullRequests: [] };
    useAppStore.setState({ data: { ...data, organizations: [{ ...org!, repositories: [...org!.repositories, ghost] }, ...rest] } });

    const before = useAppStore.getState().lastRefreshISO;
    await Bun.sleep(5);
    doRefresh("auto");
    await waitFor(() => useAppStore.getState().lastRefreshISO !== before);

    expect(useAppStore.getState().data.organizations[0]!.repositories.map((r) => r.name)).toContain("ghost");
  });

  test("a failed refresh keeps the tree on screen", async () => {
    doRefresh("initial");
    await waitFor(() => useAppStore.getState().loadState === "ready");
    const repos = countRepos(useAppStore.getState().data);

    // Leave mock mode with an unreadable config: the load fails.
    const badConfig = join(tmpdir(), `adotui-bad-config-${Date.now()}.json`);
    await Bun.write(badConfig, "not json");
    process.env.ADOTUI_MOCK = "0";
    setEnv("ADOTUI_CONFIG", badConfig);

    doRefresh("manual");
    await waitFor(() => useAppStore.getState().loadState === "error");
    expect(countRepos(useAppStore.getState().data)).toBe(repos);
  });
});
