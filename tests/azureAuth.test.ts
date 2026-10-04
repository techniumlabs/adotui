import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { clearAuthHeaderCache, getAdoAuthHeader } from "../src/data/azureAuth";

// A fake `az` that records each spawn, takes a moment, then prints a token.
const DIR = join(tmpdir(), `adotui-auth-test-${Date.now()}`);
const COUNT_FILE = join(DIR, "spawns");
mkdirSync(DIR, { recursive: true });
writeFileSync(
  join(DIR, "az"),
  `#!/bin/sh
echo x >> "$AZ_COUNT_FILE"
sleep 0.2
[ -n "$AZ_FAIL" ] && exit 1
echo '{"accessToken":"tok","expires_on":9999999999}'
`,
);
chmodSync(join(DIR, "az"), 0o755);

const spawns = (): number => {
  try {
    return readFileSync(COUNT_FILE, "utf-8").split("\n").filter(Boolean).length;
  } catch {
    return 0;
  }
};

const saved = { path: process.env.PATH, pat: process.env.AZURE_DEVOPS_EXT_PAT };

beforeEach(() => {
  writeFileSync(COUNT_FILE, "");
  delete process.env.AZURE_DEVOPS_EXT_PAT;
  delete process.env.AZ_FAIL;
  process.env.AZ_COUNT_FILE = COUNT_FILE;
  process.env.PATH = `${DIR}:${saved.path}`;
  clearAuthHeaderCache();
});

afterEach(() => {
  process.env.PATH = saved.path;
  if (saved.pat === undefined) delete process.env.AZURE_DEVOPS_EXT_PAT;
  else process.env.AZURE_DEVOPS_EXT_PAT = saved.pat;
  delete process.env.AZ_FAIL;
  clearAuthHeaderCache();
});

// The fake is a shell script.
describe.skipIf(process.platform === "win32")("getAdoAuthHeader", () => {
  test("concurrent callers share a single az process", async () => {
    const headers = await Promise.all(Array.from({ length: 8 }, () => getAdoAuthHeader()));
    expect(new Set(headers)).toEqual(new Set(["Bearer tok"]));
    expect(spawns()).toBe(1);
  });

  test("the token is cached after the first call", async () => {
    await getAdoAuthHeader();
    await getAdoAuthHeader();
    expect(spawns()).toBe(1);
  });

  test("a failure is not cached: the next call tries az again", async () => {
    process.env.AZ_FAIL = "1";
    expect(await getAdoAuthHeader()).toBeNull();
    delete process.env.AZ_FAIL;
    expect(await getAdoAuthHeader()).toBe("Bearer tok");
    expect(spawns()).toBe(2);
  });

  test("clearing the cache forces a fresh az call (after a 401)", async () => {
    await getAdoAuthHeader();
    clearAuthHeaderCache();
    await getAdoAuthHeader();
    expect(spawns()).toBe(2);
  });
});
