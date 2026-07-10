import { expect, test, describe } from "bun:test";
import { render } from "ink-testing-library";
import { SetupScreen } from "../src/app/components/SetupScreen";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

describe("SetupScreen UI & Submission", () => {
  test("renders list mode, allows project addition, PAT configuration, and save", async () => {
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
      expect(frame).toInclude("+ Add New Project");

      // 1. Press Enter on "+ Add New Project" to go to add mode
      stdin.write("\r");
      await delay(50);
      frame = lastFrame();
      expect(frame).toInclude("ADD NEW PROJECT");
      expect(frame).toInclude("Organization URL:");

      // 2. Type Organization URL
      stdin.write("https://dev.azure.com/my-test-org");
      await delay(50);
      frame = lastFrame();
      expect(frame).toInclude("https://dev.azure.com/my-test-org");

      // 3. Press Enter to move to Project Name
      stdin.write("\r");
      await delay(50);

      // 4. Type Project Name
      stdin.write("my-test-project");
      await delay(50);
      frame = lastFrame();
      expect(frame).toInclude("my-test-project");

      // 5. Press Enter to move to Repositories
      stdin.write("\r");
      await delay(50);

      // 6. Type Repositories (Optional)
      stdin.write("repo-a, repo-b");
      await delay(50);
      frame = lastFrame();
      expect(frame).toInclude("repo-a, repo-b");

      // 7. Press Enter to move to "[ Add Project ]" button
      stdin.write("\r");
      await delay(50);

      // 8. Press Enter on "[ Add Project ]" to save project and go back to list mode
      stdin.write("\r");
      await delay(50);
      frame = lastFrame();
      expect(frame).toInclude("my-test-project (https://dev.azure.com/my-test-org)");
      expect(frame).toInclude("Repos: repo-a, repo-b");

      // 9. Currently selected index is 0 (the project).
      // We want to navigate to "🔑 Configure PAT Token".
      // Menu Items:
      // Index 0: project entry
      // Index 1: + Add New Project
      // Index 2: 🔑 Configure PAT Token
      // Index 3: ✓ Save & Load Configuration
      // Index 4: ✗ Exit ADOTUI
      // Press Down Arrow (Tab) twice to select "🔑 Configure PAT Token"
      stdin.write("\t");
      await delay(50);
      stdin.write("\t");
      await delay(50);

      // 10. Press Enter to go to PAT configuration screen
      stdin.write("\r");
      await delay(50);
      frame = lastFrame();
      expect(frame).toInclude("CONFIGURE PAT TOKEN");

      // 11. Type PAT token value
      stdin.write("my-test-pat-token");
      await delay(50);
      frame = lastFrame();
      expect(frame).toInclude("my-test-pat-token");

      // 12. Press Enter to move to "[ Save Token ]"
      stdin.write("\r");
      await delay(50);

      // 13. Press Enter on "[ Save Token ]" to save token and go back to list mode
      stdin.write("\r");
      await delay(50);
      frame = lastFrame();
      expect(frame).toInclude("Configure PAT Token (optional) [Set: ...oken]");

      // 14. Currently selected index is 0 (the project).
      // Press Down Arrow (Tab) three times to select "✓ Save & Load Configuration" (index 3)
      stdin.write("\t");
      await delay(50);
      stdin.write("\t");
      await delay(50);
      stdin.write("\t");
      await delay(50);

      // 15. Press Enter to Save and Complete Configuration
      stdin.write("\r");
      await delay(100);

      expect(completed).toBe(true);

      // Verify config was written
      const createdConfigPath = join(testDir, "adotui.config.json");
      expect(existsSync(createdConfigPath)).toBe(true);
      const content = JSON.parse(readFileSync(createdConfigPath, "utf-8"));
      expect(content.projects[0].organization).toBe("https://dev.azure.com/my-test-org");
      expect(content.projects[0].project).toBe("my-test-project");
      expect(content.projects[0].repositories).toEqual(["repo-a", "repo-b"]);
      expect(content.pat).toBe("my-test-pat-token");

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
    // Press Enter to go to add mode
    stdin.write("\r");
    await delay(50);
    
    // Press Enter on Organization URL to advance (moves to project)
    stdin.write("\r");
    await delay(50);
    
    // Press Enter on Project to advance (moves to repos)
    stdin.write("\r");
    await delay(50);
    
    // Press Enter on Repos to advance (moves to submit/Add Project)
    stdin.write("\r");
    await delay(50);
    
    // Press Enter on submit
    stdin.write("\r");
    await delay(50);

    const frame = lastFrame();
    expect(frame).toInclude("Organization URL cannot be empty.");
    expect(completed).toBe(false);
  });
});
