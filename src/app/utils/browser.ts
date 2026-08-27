export const openInBrowser = (url: string): void => {
  const platform = process.platform;
  const cmd =
    platform === "darwin"
      ? ["open", url]
      : platform === "win32"
        ? ["cmd", "/c", "start", "", url]
        : ["xdg-open", url];

  Bun.spawn(cmd, { stdin: "ignore", stdout: "ignore", stderr: "ignore" });
};
