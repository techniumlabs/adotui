import { render } from "ink";
import { App } from "./app/App";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";

/** Read the version from the nearest package.json. */
const getVersion = (): string => {
  try {
    // In compiled binaries, __dirname points to the bundle root.
    // Walk up from this file's directory to find package.json.
    let dir = dirname(new URL(import.meta.url).pathname);
    for (let i = 0; i < 5; i++) {
      try {
        const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf-8"));
        if (pkg.version) return pkg.version;
      } catch { /* not found at this level, keep walking */ }
      dir = dirname(dir);
    }
    return "0.0.0-unknown";
  } catch {
    return "0.0.0-unknown";
  }
};

const HELP_TEXT = `
adotui — Terminal UI for managing Azure DevOps pull requests

USAGE:
  adotui [OPTIONS]

OPTIONS:
  --help, -h       Show this help message and exit
  --version, -v    Print version number and exit
  --diagnostic     Print diagnostic information (OS, arch, bun, az versions)
  --update         Update adotui to the latest version

ENVIRONMENT:
  ADOTUI_CONFIG            Path to config file
  ADOTUI_MOCK=1            Use mock data (offline/demo mode)
  AZURE_DEVOPS_EXT_PAT     Azure DevOps personal access token

For configuration details and keybindings, see:
  https://github.com/techniumlabs/adotui#readme
`.trim();

const printDiagnostic = async () => {
  const os = await import("node:os");
  console.log("adotui diagnostic info:");
  console.log(`  Version:  ${getVersion()}`);
  console.log(`  OS:       ${os.platform()} ${os.release()}`);
  console.log(`  Arch:     ${os.arch()}`);
  console.log(`  Node:     ${process.version}`);
  console.log(`  Bun:      ${typeof Bun !== "undefined" ? Bun.version : "N/A"}`);
  console.log(`  CWD:      ${process.cwd()}`);
  console.log(`  HOME:     ${os.homedir()}`);

  // Check az CLI
  try {
    const proc = Bun.spawn(["az", "--version"], { stdout: "pipe", stderr: "pipe" });
    const text = await new Response(proc.stdout).text();
    const firstLine = text.split("\n")[0]?.trim() ?? "unknown";
    console.log(`  Azure CLI: ${firstLine}`);
  } catch {
    console.log("  Azure CLI: not found");
  }
};

const updateCli = async () => {
  console.log("Checking for updates...");
  try {
    const res = await fetch("https://api.github.com/repos/techniumlabs/adotui/releases/latest", {
      headers: { "User-Agent": "adotui-cli" }
    });
    if (!res.ok) {
      throw new Error(`Failed to fetch latest release: ${res.statusText}`);
    }
    const release = (await res.json()) as { tag_name: string };
    const latestVersion = release.tag_name.replace(/^v/, "");
    const currentVersion = getVersion();

    if (currentVersion === "0.0.0-unknown" || currentVersion === "0.1.0-dev") {
      console.log(`Running in development/local build mode. Current: ${currentVersion}, Latest: ${latestVersion}`);
    } else if (currentVersion === latestVersion) {
      console.log(`adotui is already up-to-date (version ${currentVersion}).`);
      return;
    }

    console.log(`Updating adotui from version ${currentVersion} to ${latestVersion}...`);
    
    const installUrl = "https://raw.githubusercontent.com/techniumlabs/adotui/main/install.sh";
    console.log(`Running installation script from ${installUrl}...`);
    
    const { spawn } = await import("node:child_process");
    const child = spawn("bash", ["-c", `curl -fsSL ${installUrl} | bash`], {
      stdio: "inherit"
    });
    
    child.on("close", (code) => {
      if (code === 0) {
        console.log("Update completed successfully!");
        process.exit(0);
      } else {
        console.error(`Update script failed with exit code ${code}.`);
        process.exit(code ?? 1);
      }
    });
  } catch (err) {
    console.error(`Failed to update: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
};

const args = process.argv.slice(2);

if (args.includes("--help") || args.includes("-h")) {
  console.log(HELP_TEXT);
  process.exit(0);
}

if (args.includes("--version") || args.includes("-v")) {
  console.log(getVersion());
  process.exit(0);
}

if (args.includes("--diagnostic")) {
  await printDiagnostic();
  process.exit(0);
}

if (args.includes("--update")) {
  await updateCli();
  // Wait for asynchronous update process to complete and exit
  await new Promise(() => {});
}

render(<App />);
