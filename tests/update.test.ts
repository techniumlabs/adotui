import { afterEach, expect, test } from "bun:test";
import { fetchInstallScript, installScriptUrl } from "../src/update";

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

test("the installer is pinned to the release tag, not main", () => {
  expect(installScriptUrl("v1.2.3")).toBe("https://raw.githubusercontent.com/techniumlabs/adotui/v1.2.3/install.sh");
});

test("returns the script text", async () => {
  let requested = "";
  globalThis.fetch = (async (url: string) => {
    requested = url;
    return new Response("#!/usr/bin/env bash\necho hi\n");
  }) as unknown as typeof fetch;
  expect(await fetchInstallScript("v1.2.3")).toBe("#!/usr/bin/env bash\necho hi\n");
  expect(requested).toContain("/v1.2.3/install.sh");
});

test("a failed download is an error, not an empty script that 'succeeds'", async () => {
  globalThis.fetch = (async () => new Response("404: Not Found", { status: 404 })) as unknown as typeof fetch;
  await expect(fetchInstallScript("v9.9.9")).rejects.toThrow("v9.9.9 (HTTP 404)");
});

test("refuses a 200 that is not a script", async () => {
  globalThis.fetch = (async () => new Response("<html>Sign in to continue</html>")) as unknown as typeof fetch;
  await expect(fetchInstallScript("v1.2.3")).rejects.toThrow("not a shell script");
});
