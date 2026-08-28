import { expect, test, describe, beforeEach } from "bun:test";
import { render } from "ink-testing-library";
import { App } from "../src/app/App";
import { useAppStore } from "../src/app/store";
import { INITIAL_STATE } from "../src/app/constants";

process.env.ADOTUI_MOCK = "1";
process.env.NODE_ENV = "test";

const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));
const ESC = "\u001B";

describe("/ filter prompt", () => {
  beforeEach(() => {
    useAppStore.setState({ ...INITIAL_STATE });
  });

  test("types a live PR filter and applies it with Enter", async () => {
    const { stdin } = render(<App />);
    await delay(100);

    stdin.write("/");
    await delay(50);
    expect(useAppStore.getState().focus).toBe("filter");
    // The "me" preset is replaced by an empty draft.
    expect(useAppStore.getState().treeFilter).toBe("");

    stdin.write("author:maya");
    await delay(50);
    expect(useAppStore.getState().treeFilter).toBe("author:maya");

    stdin.write("\r");
    await delay(50);
    expect(useAppStore.getState().focus).toBe("tree");
    expect(useAppStore.getState().treeFilter).toBe("author:maya");
  });

  test("Esc cancels and restores the previous filter", async () => {
    const { stdin } = render(<App />);
    await delay(100);

    stdin.write("/");
    await delay(50);
    stdin.write("abc");
    await delay(50);
    expect(useAppStore.getState().treeFilter).toBe("abc");

    stdin.write(ESC);
    await delay(150);
    expect(useAppStore.getState().treeFilter).toBe("me");
    expect(useAppStore.getState().focus).toBe("tree");
  });

  test("applying an empty filter clears to all", async () => {
    const { stdin } = render(<App />);
    await delay(100);

    stdin.write("/");
    await delay(50);
    stdin.write("\r");
    await delay(50);
    expect(useAppStore.getState().treeFilter).toBe("all");
  });
});
