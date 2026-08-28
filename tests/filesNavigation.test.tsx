import { expect, test, describe, beforeEach } from "bun:test";
import { render } from "ink-testing-library";
import { App } from "../src/app/App";
import { useAppStore } from "../src/app/store";
import { INITIAL_STATE } from "../src/app/constants";
import { selectSelectedPr } from "../src/app/selectors";

process.env.ADOTUI_MOCK = "1";
process.env.NODE_ENV = "test";

const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));
const ARROW_RIGHT = "\u001B[C";
const ARROW_LEFT = "\u001B[D";

describe("diff view file switching", () => {
  beforeEach(() => {
    useAppStore.setState({ ...INITIAL_STATE });
  });

  test("arrows switch files without leaving the view", async () => {
    const { stdin } = render(<App />);
    await delay(100);

    stdin.write("2");
    await delay(50);
    expect(useAppStore.getState().focus).toBe("files");
    const fileCount = selectSelectedPr(useAppStore.getState())?.changedFiles.length ?? 0;
    const second = fileCount > 1 ? 1 : 0;

    stdin.write(ARROW_RIGHT);
    await delay(50);
    expect(useAppStore.getState().selectedFileIndex).toBe(second);

    stdin.write(ARROW_LEFT);
    await delay(50);
    // The regression this guards: left arrow used to kick back to the list.
    expect(useAppStore.getState().focus).toBe("files");
    expect(useAppStore.getState().selectedFileIndex).toBe(0);

    stdin.write(ARROW_RIGHT);
    await delay(50);
    expect(useAppStore.getState().selectedFileIndex).toBe(second);

    stdin.write("h");
    await delay(50);
    expect(useAppStore.getState().focus).toBe("list");
  });
});
