import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadConfig, writeConfig as writeConfigUtil } from "../src/data/config";

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

  test("valid config with optional project name", async () => {
    const configPath = writeConfig("optional-project.json", {
      projects: [
        { organization: "https://dev.azure.com/contoso" },
      ],
    });
    process.env.ADOTUI_CONFIG = configPath;
    const result = await loadConfig();
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.config.projects).toHaveLength(1);
      expect(result.config.projects[0]?.organization).toBe("https://dev.azure.com/contoso");
      expect(result.config.projects[0]?.project).toBeUndefined();
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
    if (!result.ok) {
      expect(result.errorType).toBe("invalid");
    }
  });

  test("writeConfig writes config to process.cwd()", async () => {
    const originalCwd = process.cwd();
    const testDir = join(tmpdir(), `adotui-write-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
    process.chdir(testDir);
    try {
      const sampleConfig = {
        projects: [{ organization: "https://dev.azure.com/test", project: "Proj" }],
        status: "active" as const,
        top: 50,
      };
      await writeConfigUtil(sampleConfig);
      const filePath = join(testDir, "adotui.config.json");
      const fileExists = await Bun.file(filePath).exists();
      expect(fileExists).toBe(true);
      const content = await Bun.file(filePath).json();
      expect(content).toEqual(sampleConfig);
    } finally {
      process.chdir(originalCwd);
    }
  });

  test("returns errorType: 'missing' when no config file exists", async () => {
    const originalCwd = process.cwd();
    const testDir = join(tmpdir(), `adotui-missing-test-${Date.now()}`);
    mkdirSync(testDir, { recursive: true });
    process.chdir(testDir);
    
    const originalEnv = process.env.ADOTUI_CONFIG;
    // Set to a non-existent path
    process.env.ADOTUI_CONFIG = join(testDir, "does-not-exist.json");
    
    try {
      const result = await loadConfig();
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errorType).toBe("missing");
      }
    } finally {
      process.chdir(originalCwd);
      if (originalEnv !== undefined) {
        process.env.ADOTUI_CONFIG = originalEnv;
      } else {
        delete process.env.ADOTUI_CONFIG;
      }
    }
  });
});
