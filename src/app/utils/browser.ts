/** How each OS opens a URL in the default browser (anything else: xdg-open). */
const OPEN_COMMAND: Partial<Record<NodeJS.Platform, (url: string) => string[]>> = {
  darwin: (url) => ["open", url],
  win32: (url) => ["cmd", "/c", "start", "", url],
  linux: (url) => ["xdg-open", url],
};

export const openInBrowser = (url: string): void => {
  const cmd = (OPEN_COMMAND[process.platform] ?? OPEN_COMMAND.linux!)(url);

  Bun.spawn(cmd, { stdin: "ignore", stdout: "ignore", stderr: "ignore" });
};
