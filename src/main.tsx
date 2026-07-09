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

render(<App />);
