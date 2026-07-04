
console.log("Building adotui CLI...");

const result = await Bun.build({
  entrypoints: ["src/main.tsx"],
  external: ["ink", "react", "ink-spinner", "@git-diff-view/react", "@git-diff-view/cli", "git-diff-view"],
  format: "esm",
  outdir: "dist",
  target: "node", // Targeting Node for maximum cross-platform compatibility
});

if (!result.success) {
  for (const log of result.logs) console.error(log);
  process.exit(1);
}

console.log("Build completed successfully.");
