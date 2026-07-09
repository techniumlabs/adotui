import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadConfig } from "../src/data/config";

const TMP_DIR = join(tmpdir(), `adotui-config-test-${Date.now()}`);
mkdirSync(TMP_DIR, { recursive: true });

const writeConfig = (name: string, content: unknown): string => {
  const path = join(TMP_DIR, name);
  writeFileSync(path, JSON.stringify(content));
  return path;
};

let savedConfig: string | undefined;

beforeEach(() => {
  savedConfig = process.env.ADOTUI_CONFIG;
});

afterEach(() => {
  if (savedConfig !== undefined) {
    process.env.ADOTUI_CONFIG = savedConfig;
  } else {
    delete process.env.ADOTUI_CONFIG;
  }
});

describe("Config validation", () => {
  test("valid config with projects array", async () => {
    const configPath = writeConfig("valid.json", {
      projects: [
        { organization: "https://dev.azure.com/contoso", project: "Platform" },
      ],
    });
    process.env.ADOTUI_CONFIG = configPath;
    const result = await loadConfig();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.config.projects).toHaveLength(1);
      expect(result.config.projects[0]?.organization).toBe("https://dev.azure.com/contoso");
      expect(result.config.projects[0]?.project).toBe("Platform");
    }
  });

  test("valid config with org shorthand", async () => {
    const configPath = writeConfig("shorthand.json", {
      projects: [
        { org: "https://dev.azure.com/fabrikam", project: "Engineering" },
      ],
    });
    process.env.ADOTUI_CONFIG = configPath;
    const result = await loadConfig();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.config.projects[0]?.organization).toBe("https://dev.azure.com/fabrikam");
    }
  });

  test("strips trailing slashes from organization", async () => {
    const configPath = writeConfig("trailing.json", {
      projects: [
        { organization: "https://dev.azure.com/contoso///", project: "Platform" },
      ],
    });
    process.env.ADOTUI_CONFIG = configPath;
    const result = await loadConfig();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.config.projects[0]?.organization).toBe("https://dev.azure.com/contoso");
    }
  });

  test("parses optional fields (status, top, reviewer, creator)", async () => {
    const configPath = writeConfig("optional.json", {
      status: "completed",
      top: 25,
      reviewer: "alice@contoso.com",
      creator: "bob@contoso.com",
      projects: [
        { organization: "https://dev.azure.com/contoso", project: "Platform" },
      ],
    });
    process.env.ADOTUI_CONFIG = configPath;
    const result = await loadConfig();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.config.status).toBe("completed");
      expect(result.config.top).toBe(25);
      expect(result.config.reviewer).toBe("alice@contoso.com");
      expect(result.config.creator).toBe("bob@contoso.com");
    }
  });

  test("defaults status to active", async () => {
    const configPath = writeConfig("defaults.json", {
      projects: [
        { organization: "https://dev.azure.com/contoso", project: "Platform" },
      ],
    });
    process.env.ADOTUI_CONFIG = configPath;
    const result = await loadConfig();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.config.status).toBe("active");
      expect(result.config.top).toBe(50);
    }
  });

  test("rejects config with no projects", async () => {
    const configPath = writeConfig("noprojects.json", {
      status: "active",
    });
    process.env.ADOTUI_CONFIG = configPath;
    const result = await loadConfig();
    expect(result.ok).toBe(false);
  });

  test("rejects config with empty projects array", async () => {
    const configPath = writeConfig("empty.json", {
      projects: [],
    });
    process.env.ADOTUI_CONFIG = configPath;
    const result = await loadConfig();
    expect(result.ok).toBe(false);
  });

  test("config with repositories list", async () => {
    const configPath = writeConfig("repos.json", {
      projects: [
        {
          organization: "https://dev.azure.com/contoso",
          project: "Platform",
          repositories: ["api", "web"],
        },
      ],
    });
    process.env.ADOTUI_CONFIG = configPath;
    const result = await loadConfig();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.config.projects[0]?.repositories).toEqual(["api", "web"]);
    }
  });

  test("rejects invalid JSON config", async () => {
    const configPath = writeConfig("invalid.json", "not-valid-json");
    // Manually write broken JSON since writeConfig calls JSON.stringify
    const { writeFileSync } = await import("node:fs");
    writeFileSync(configPath, "{ broken json }}");
    process.env.ADOTUI_CONFIG = configPath;
    const result = await loadConfig();
    expect(result.ok).toBe(false);
  });
});
