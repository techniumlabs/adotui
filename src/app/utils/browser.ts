import { spawn } from "node:child_process";

export const openInBrowser = (url: string): void => {
  const platform = process.platform;
  const cmd =
    platform === "darwin"
      ? ["open", url]
      : platform === "win32"
        ? ["cmd", "/c", "start", "", url]
        : ["xdg-open", url];

  spawn(cmd[0]!, cmd.slice(1), { stdio: "ignore" });
};
