import { expect, test, describe } from "bun:test";
import { render } from "ink-testing-library";
import { App } from "../src/app/App";

process.env.ADOTUI_MOCK = "1";
process.env.NODE_ENV = "test";

const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

describe("Adotui E2E Navigation", () => {
  test("renders correctly in mock mode", async () => {
    const { lastFrame } = render(<App />);
    await delay(100);
    const frame = lastFrame();
    expect(frame).toInclude("Organizations");
    expect(frame).toInclude("Pull Requests");
    expect(frame).toInclude("contoso-platform");
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

  test("pane switching: l, h, and tab", async () => {
    const { stdin, lastFrame } = render(<App />);
    await delay(100);

    // In our updated App, if the banner isn't explicitly set to Focus: tree on load,
    // we can just check it switches to Focus: list when tab is pressed.
    
    stdin.write("\t");
    await delay(50);
    let frame = lastFrame();
    expect(frame).toInclude("Focus: list");

    stdin.write("l");
    await delay(50);
    frame = lastFrame();
    expect(frame).toInclude("Focus: detail");

    stdin.write("h");
    await delay(50);
    frame = lastFrame();
    expect(frame).toInclude("Focus: list");
    
    stdin.write("h");
    await delay(50);
    frame = lastFrame();
    expect(frame).toInclude("Focus: tree");
  });
});
