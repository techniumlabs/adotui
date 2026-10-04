import { beforeEach, describe, expect, test } from "bun:test";
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Runs the real install.sh against a fake curl/uname/sudo: no network, no
// writes outside a temp dir. The script is bash, so Windows runners skip it.
const SCRIPT = join(import.meta.dir, "..", "install.sh");
const BINARY = "#!/bin/sh\necho adotui\n";
const TARGET = "adotui-linux-x64";

const sha256 = (text: string): string => new Bun.CryptoHasher("sha256").update(text).digest("hex");

let root: string;
let fakeBin: string;
let work: string;
let installDir: string;

const fake = (name: string, body: string): void => {
  writeFileSync(join(fakeBin, name), `#!/bin/bash\n${body}\n`);
  chmodSync(join(fakeBin, name), 0o755);
};

beforeEach(() => {
  root = join(tmpdir(), `adotui-install-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  fakeBin = join(root, "bin");
  work = join(root, "work");
  installDir = join(root, "installed");
  for (const dir of [fakeBin, work, installDir]) mkdirSync(dir, { recursive: true });

  fake("uname", 'case "$1" in -m) echo x86_64 ;; *) echo Linux ;; esac');
  fake("sudo", 'exec "$@"');
  // Serves the files named by env vars; exits 22 (like curl -f) when one is absent.
  fake(
    "curl",
    `out=""; hdr=""; url=""
while [ $# -gt 0 ]; do
  case "$1" in
    -o) out="$2"; shift ;;
    -D) hdr="$2"; shift ;;
    -w) printf '200'; shift ;;
    -H) shift ;;
    -*) ;;
    *) url="$1" ;;
  esac
  shift
done
[ -n "$hdr" ] && : > "$hdr"
case "$url" in
  *api.github.com*) src="$FAKE_RELEASE" ;;
  *SHA256SUMS) src="$FAKE_SUMS" ;;
  *${TARGET}) src="$FAKE_BINARY" ;;
  *) exit 22 ;;
esac
[ -f "$src" ] || exit 22
if [ -n "$out" ]; then cp "$src" "$out"; else cat "$src"; fi`,
  );
});

interface Scenario {
  /** Contents of SHA256SUMS; null = the release publishes none. */
  sums: string | null;
  /** The binary the "download" returns; null = the download fails (404). */
  binary?: string | null;
}

const run = async ({ sums, binary = BINARY }: Scenario) => {
  const assets = [`https://example.test/dl/${TARGET}`, ...(sums === null ? [] : ["https://example.test/dl/SHA256SUMS"])];
  // One URL per line, like the real GitHub API response the script greps.
  writeFileSync(join(root, "release.json"), `{\n  "assets": [\n${assets.map((u) => `    {\n      "browser_download_url": "${u}"\n    }`).join(",\n")}\n  ]\n}\n`);
  if (sums !== null) writeFileSync(join(root, "SHA256SUMS"), sums);
  if (binary !== null) writeFileSync(join(root, "binary"), binary);

  const proc = Bun.spawn(["bash", SCRIPT], {
    cwd: work,
    stdout: "pipe",
    stderr: "pipe",
    env: {
      ...process.env,
      PATH: `${fakeBin}:${process.env.PATH}`,
      ADOTUI_INSTALL_DIR: installDir,
      FAKE_RELEASE: join(root, "release.json"),
      FAKE_SUMS: join(root, "SHA256SUMS"),
      FAKE_BINARY: join(root, "binary"),
    },
  });
  const [stdout, stderr, exitCode] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited]);
  return { stdout, stderr, exitCode, installed: existsSync(join(installDir, "adotui")) };
};

describe.skipIf(process.platform === "win32")("install.sh", () => {
  test("installs when the checksum matches", async () => {
    const result = await run({ sums: `${sha256(BINARY)}  ${TARGET}\n` });
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("Checksum OK");
    expect(result.installed).toBe(true);
    expect(readFileSync(join(installDir, "adotui"), "utf-8")).toBe(BINARY);
  });

  test("accepts sha256sum's binary-mode '*' prefix on the file name", async () => {
    const result = await run({ sums: `${sha256(BINARY)} *${TARGET}\n` });
    expect(result.exitCode).toBe(0);
    expect(result.installed).toBe(true);
  });

  test("refuses a tampered download", async () => {
    const result = await run({ sums: `${sha256(BINARY)}  ${TARGET}\n`, binary: "#!/bin/sh\necho evil\n" });
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain("Checksum mismatch");
    expect(result.installed).toBe(false);
    expect(existsSync(join(work, "adotui"))).toBe(false); // and cleans up the bad file
  });

  test("refuses when SHA256SUMS has no entry for this platform", async () => {
    const result = await run({ sums: `${sha256(BINARY)}  adotui-macos-arm64\n` });
    expect(result.exitCode).not.toBe(0);
    expect(result.stderr).toContain("no entry for adotui-linux-x64");
    expect(result.installed).toBe(false);
  });

  test("warns and installs for a release that predates SHA256SUMS", async () => {
    const result = await run({ sums: null });
    expect(result.exitCode).toBe(0);
    expect(result.stderr).toContain("no SHA256SUMS");
    expect(result.installed).toBe(true);
  });

  test("a failed download stops the install instead of installing an error page", async () => {
    const result = await run({ sums: null, binary: null });
    expect(result.exitCode).not.toBe(0);
    expect(result.installed).toBe(false);
  });
});
