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
      // Press Down Arrow (Tab) four times to select "✓ Save & Load Configuration" (index 4)
      stdin.write("\t");
      await delay(50);
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

  test("allows editing and deleting projects in setup wizard", async () => {
    const { tmpdir } = await import("node:os");
    const { mkdirSync } = await import("node:fs");
    const testDir = join(tmpdir(), `adotui-setup-edit-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });

    const originalCwd = process.cwd();
    process.chdir(testDir);

    try {
      const { stdin, lastFrame } = render(
        <SetupScreen onComplete={() => { }} />
      );

      await delay(50);

      // 1. Go to Add mode
      stdin.write("\r");
      await delay(50);

      // 2. Type Org URL
      stdin.write("https://dev.azure.com/edit-org");
      await delay(50);

      // Advance to Project
      stdin.write("\r");
      await delay(50);

      // 3. Type Project Name
      stdin.write("edit-project");
      await delay(50);

      // Advance to Repos
      stdin.write("\r");
      await delay(50);

      // 4. Advance to Submit button
      stdin.write("\r");
      await delay(50);

      // Submit
      stdin.write("\r");
      await delay(50);

      let frame = lastFrame();
      expect(frame).toInclude("edit-project (https://dev.azure.com/edit-org)");

      // 5. Select the project item (currently index 0) and press Enter to Edit
      stdin.write("\r");
      await delay(50);
      frame = lastFrame();
      expect(frame).toInclude("EDIT PROJECT");

      // 6. Advance to Project Name
      stdin.write("\r");
      await delay(50);

      // Clear project name with backspaces
      for (let i = 0; i < 20; i++) {
        stdin.write("\u007F"); // Backspace key
        await delay(10);
      }
      await delay(50);

      // Type new project name
      stdin.write("new-edited-project");
      await delay(50);

      // Advance to Repos
      stdin.write("\r");
      await delay(50);

      // Advance to Submit button
      stdin.write("\r");
      await delay(50);

      // Submit edit
      stdin.write("\r");
      await delay(50);

      frame = lastFrame();
      expect(frame).toInclude("new-edited-project (https://dev.azure.com/edit-org)");

      // 7. Test deletion - select the project (index 0) and press Delete/Backspace
      stdin.write("\u007F");
      await delay(50);
      frame = lastFrame();
      expect(frame).not.toInclude("new-edited-project (https://dev.azure.com/edit-org)");

    } finally {
      process.chdir(originalCwd);
    }
  });

  test("validates empty organization URL and displays error", async () => {
    let completed = false;
    const { tmpdir } = await import("node:os");
    const { mkdirSync } = await import("node:fs");
    const testDir = join(tmpdir(), `adotui-setup-validation-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });

    const originalCwd = process.cwd();
    process.chdir(testDir);

    try {
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
    } finally {
      process.chdir(originalCwd);
    }
  });

  test("allows opening and returning from the setup help screen", async () => {
    let completed = false;
    const { tmpdir } = await import("node:os");
    const { mkdirSync } = await import("node:fs");
    const testDir = join(tmpdir(), `adotui-setup-help-test-${Date.now()}`);
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

      // Press Down Arrow (Tab) twice to select "❓ Keyboard & CLI Help"
      stdin.write("\t");
      await delay(50);
      stdin.write("\t");
      await delay(50);

      // Press Enter to open Help
      stdin.write("\r");
      await delay(50);
      frame = lastFrame();
      expect(frame).toInclude("❓ HELP & KEYBOARD SHORTCUTS");
      expect(frame).toInclude("Quit Wizard:");

      // Press any key to return
      stdin.write("x");
      await delay(50);
      frame = lastFrame();
      expect(frame).toInclude("ADOTUI INITIAL SETUP");
      expect(frame).toInclude("❓ Keyboard & CLI Help");
      expect(completed).toBe(false);
    } finally {
      process.chdir(originalCwd);
    }
  });
});
