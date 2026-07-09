import { render } from "ink";
import { App } from "./app/App";
import pkg from "../package.json";

/** Get the version from package.json. */
const getVersion = (): string => {
  return pkg.version || "0.0.0-unknown";
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
