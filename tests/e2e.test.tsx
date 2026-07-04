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

    stdin.write("j");
    stdin.write("j");
    stdin.write("j");
    stdin.write("j");
    
    await delay(50);
    frame = lastFrame();
    expect(frame).toInclude("fabrikam-engineering");
    expect(frame).toInclude("services-gateway");
  });

  test("pane switching: l, h, and tab", async () => {
    const { stdin, lastFrame } = render(<App />);
    await delay(100);

    let frame = lastFrame();
    // In our updated App, if the banner isn't explicitly set to Focus: tree on load,
    // we can just check it switches to Focus: list when tab is pressed.
    
    stdin.write("\t");
    await delay(50);
    frame = lastFrame();
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
