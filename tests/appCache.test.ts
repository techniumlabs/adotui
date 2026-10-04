import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readAppCache, writeAppCache } from "../src/data/cache";
import type { AdoConfig } from "../src/data/config";
import type { AppData } from "../src/domain/types";

let dir: string;
let savedDir: string | undefined;

beforeEach(() => {
  dir = join(tmpdir(), `adotui-appcache-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(dir, { recursive: true });
  savedDir = process.env.ADOTUI_CACHE_DIR;
  process.env.ADOTUI_CACHE_DIR = dir;
});
afterEach(() => {
  if (savedDir === undefined) delete process.env.ADOTUI_CACHE_DIR;
  else process.env.ADOTUI_CACHE_DIR = savedDir;
});

const config = (extra: Partial<AdoConfig> = {}): AdoConfig => ({
  projects: [{ organization: "https://dev.azure.com/acme", project: "core" }],
  status: "active",
  ...extra,
});

const data = (name: string): AppData => ({
  organizations: [{ name, organizationUrl: `https://dev.azure.com/${name}`, repositories: [] }],
});

const files = (): string[] => readdirSync(dir).sort();

describe("per-config app cache", () => {
  test("each config reads back only its own data", async () => {
    const a = config();
    const b = config({ projects: [{ organization: "https://dev.azure.com/other" }] });
    await writeAppCache(data("acme"), a);
    await writeAppCache(data("other"), b);

    expect((await readAppCache(a))!.organizations[0]!.name).toBe("acme");
    expect((await readAppCache(b))!.organizations[0]!.name).toBe("other");
    expect(files()).toHaveLength(2);
  });

  test("a config never sees another config's cache", async () => {
    await writeAppCache(data("acme"), config());
    expect(await readAppCache(config({ reviewer: "maya@example.com" }))).toBeNull();
    expect(await readAppCache(config({ creator: "lee@example.com" }))).toBeNull();
    expect(await readAppCache(config({ top: 10 }))).toBeNull();
    expect(await readAppCache(config({ status: "all" }))).toBeNull();
  });

  test("the PAT neither selects the cache nor leaks into a file name", async () => {
    await writeAppCache(data("acme"), config({ pat: "secret-token-123" }));
    expect((await readAppCache(config({ pat: "a-different-pat" })))!.organizations[0]!.name).toBe("acme");
    expect((await readAppCache(config()))!.organizations[0]!.name).toBe("acme");
    expect(files().join()).not.toContain("secret");
    expect(files()).toHaveLength(1);
  });

  test("the legacy shared cache file is removed on the first write", async () => {
    writeFileSync(join(dir, "data_cache.json"), JSON.stringify(data("stale")));
    expect(await readAppCache(config())).toBeNull(); // not read as anyone's cache
    await writeAppCache(data("acme"), config());
    expect(files().some((f) => f === "data_cache.json")).toBe(false);
    expect(files()).toHaveLength(1);
  });

  test("a corrupted cache file reads as a miss, not an error", async () => {
    await writeAppCache(data("acme"), config());
    writeFileSync(join(dir, files()[0]!), "{not json");
    expect(await readAppCache(config())).toBeNull();
  });
});
