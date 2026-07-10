import { expect, test, describe } from "bun:test";
import { render } from "ink-testing-library";
import { SetupScreen } from "../src/app/components/SetupScreen";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

describe("SetupScreen UI & Submission", () => {
  test("renders fields, handles typing, shifts focus, and writes config", async () => {
    let completed = false;
    const { tmpdir } = await import("node:os");
    const { mkdirSync } = await import("node:fs");
    const testDir = join(tmpdir(), `adotui-setup-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
    
    const originalCwd = process.cwd();
    process.chdir(testDir);

    try {
      const { stdin, lastFrame } = render(
        <SetupScreen onComplete={() => { completed = true; }} />
      );

      await delay(50);
      let frame = lastFrame();
      expect(frame).toInclude("ADOTUI INITIAL SETUP");
      expect(frame).toInclude("Organization URL:");
      expect(frame).toInclude("Project Name:");

      // 1. Type Organization URL
      stdin.write("https://dev.azure.com/my-test-org");
      await delay(50);
      frame = lastFrame();
      expect(frame).toInclude("https://dev.azure.com/my-test-org");

      // 2. Press Tab to move to Project Name
      stdin.write("\t");
      await delay(50);

      // 3. Type Project Name
      stdin.write("my-test-project");
      await delay(50);
      frame = lastFrame();
      expect(frame).toInclude("my-test-project");

      // 4. Press Tab to move to Submit button
      stdin.write("\t");
      await delay(50);

      // 5. Press Enter to submit
      stdin.write("\r");
      await delay(100);

      expect(completed).toBe(true);

      // Verify config was written
      const createdConfigPath = join(testDir, "adotui.config.json");
      expect(existsSync(createdConfigPath)).toBe(true);
      const content = JSON.parse(readFileSync(createdConfigPath, "utf-8"));
      expect(content.projects[0].organization).toBe("https://dev.azure.com/my-test-org");
      expect(content.projects[0].project).toBe("my-test-project");

    } finally {
      process.chdir(originalCwd);
    }
  });

  test("validates empty organization URL and displays error", async () => {
    let completed = false;
    const { stdin, lastFrame } = render(
      <SetupScreen onComplete={() => { completed = true; }} />
    );

    await delay(50);
    // Press Tab twice to go to Submit
    stdin.write("\t");
    await delay(50);
    stdin.write("\t");
    await delay(50);
    stdin.write("\r");
    await delay(50);

    const frame = lastFrame();
    expect(frame).toInclude("Organization URL cannot be empty.");
    expect(completed).toBe(false);
  });
});
