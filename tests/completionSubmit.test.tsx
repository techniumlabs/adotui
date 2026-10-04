import { expect, test, describe, beforeEach } from "bun:test";
import { render } from "ink-testing-library";
import { App } from "../src/app/App";
import { useAppStore } from "../src/app/store";
import { INITIAL_STATE } from "../src/app/constants";
import { pressUntil, until } from "./helpers/wait";

process.env.ADOTUI_MOCK = "1";
process.env.NODE_ENV = "test";


describe("completion editor submit", () => {
  beforeEach(() => {
    useAppStore.setState({ ...INITIAL_STATE });
  });

  test("Enter on 'Complete PR' arms the y/n confirmation", async () => {
    const { stdin } = render(<App />);
    // Keys pressed before the data has loaded (and the input handlers attached) are ignored.
    await until(() => useAppStore.getState().loadState === "ready", "the mock data to load");

    // Open the completion editor for the selected PR.
    await pressUntil(stdin, "c", () => useAppStore.getState().focus === "completion", "the completion editor to open");

    // Cursor starts on field 0; Enter advances one field per press until the
    // final "complete PR" row (index 8), where Enter submits.
    for (let i = 0; i < 8; i++) {
      const before = useAppStore.getState().completionCursor;
      await pressUntil(stdin, "\r", () => useAppStore.getState().completionCursor !== before, `Enter to advance from field ${i}`);
    }
    await pressUntil(stdin, "\r", () => useAppStore.getState().pendingConfirm !== null, "Enter on 'complete PR' to arm the confirmation");

    const pending = useAppStore.getState().pendingConfirm;
    expect(pending).not.toBeNull();
    expect(pending?.kind).toBe("complete");
  });
});
