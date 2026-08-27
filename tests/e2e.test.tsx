import { expect, test, describe, beforeEach } from "bun:test";
import { render } from "ink-testing-library";
import { App } from "../src/app/App";
import { useAppStore } from "../src/app/store";
import { INITIAL_STATE } from "../src/app/constants";

process.env.ADOTUI_MOCK = "1";
process.env.NODE_ENV = "test";

const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

describe("Adotui E2E Navigation", () => {
  // The zustand store is module-global, so state (tree scroll, active view)
  // would otherwise leak from one test into the next render of <App />.
  beforeEach(() => {
    useAppStore.setState({ ...INITIAL_STATE });
  });

  test("renders correctly in mock mode", async () => {
    const { lastFrame } = render(<App />);
    await delay(100);
    const frame = lastFrame();
    expect(frame).toInclude("Organizations");
    expect(frame).toInclude("contoso-platform");
    // Right pane: view tab bar and the overview/details panel.
    expect(frame).toInclude("1 overview");
    expect(frame).toInclude("Details");
  });

  test("tree navigation: jumping across organizations using j/k", async () => {
    const { stdin, lastFrame } = render(<App />);
    await delay(100);

    let frame = lastFrame();
    expect(frame).toInclude("contoso-platform");

    // Under the default "My PRs" filter, navigation skips repos without the
    // login user's PRs: adotui-core → enrollment-service → ui-observability.
    stdin.write("j");
    stdin.write("j");

    await delay(50);
    frame = lastFrame();
    expect(frame).toInclude("fabrikam-engineering");
    expect(frame).toInclude("ui-observability (1)");
    expect(frame).not.toInclude("services-gateway");

    // Two more presses cross into megacorp-holdings and land on repo-3,
    // skipping hidden repo-2.
    stdin.write("j");
    stdin.write("j");

    await delay(50);
    frame = lastFrame();
    expect(frame).toInclude("megacorp-holdings");
    expect(frame).toInclude("project-1-repo-3 (1)");
    expect(frame).not.toInclude("project-1-repo-2");
  });

  // Focus moves (tab/l/h) only change border colors and the banner row, which
  // are not observable in the test viewport, so we assert on the view tabs
  // (1/2/3) whose panes visibly swap content instead.
  test("view switching: 2 diff, 3 comments, 1 overview", async () => {
    const { stdin, lastFrame } = render(<App />);
    await delay(100);

    stdin.write("2");
    await delay(50);
    let frame = lastFrame();
    expect(frame).toInclude("Files");

    stdin.write("3");
    await delay(50);
    frame = lastFrame();
    expect(frame).toInclude("Comments");
    expect(frame).toInclude("threads");

    stdin.write("1");
    await delay(50);
    frame = lastFrame();
    expect(frame).toInclude("Details");
  });

  test("focus cycling with tab/l/h does not break rendering", async () => {
    const { stdin, lastFrame } = render(<App />);
    await delay(100);

    for (const key of ["\t", "l", "h", "h"]) {
      stdin.write(key);
      await delay(50);
      expect(lastFrame()).toInclude("Organizations");
    }
  });
});
