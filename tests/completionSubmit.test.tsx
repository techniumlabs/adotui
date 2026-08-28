import { expect, test, describe, beforeEach } from "bun:test";
import { render } from "ink-testing-library";
import { App } from "../src/app/App";
import { useAppStore } from "../src/app/store";
import { INITIAL_STATE } from "../src/app/constants";

process.env.ADOTUI_MOCK = "1";
process.env.NODE_ENV = "test";

const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

describe("completion editor submit", () => {
  beforeEach(() => {
    useAppStore.setState({ ...INITIAL_STATE });
  });

  test("Enter on 'Complete PR' arms the y/n confirmation", async () => {
    const { stdin } = render(<App />);
    await delay(100);

    // Open the completion editor for the selected PR.
    stdin.write("c");
    await delay(50);
    expect(useAppStore.getState().focus).toBe("completion");

    // Cursor starts on field 0; Enter advances one field per press until the
    // final "complete PR" row (index 8), where Enter submits.
    for (let i = 0; i < 8; i++) {
      stdin.write("\r");
      await delay(20);
    }
    stdin.write("\r"); // submit on the "complete PR" row
    await delay(50);

    const pending = useAppStore.getState().pendingConfirm;
    expect(pending).not.toBeNull();
    expect(pending?.kind).toBe("complete");
  });
});
