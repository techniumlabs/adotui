import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";

// ─── Code standards (see "Code Standards" in CLAUDE.md) ──────────────────────
// Size limits count code lines only (blank lines and comments are skipped).
// Applied to src/ — tests are exempt.
const LIMITS = {
  "max-lines": 300,
  "max-lines-per-function": 150,
  complexity: 25,
  "max-params": 5,
  "max-depth": 4,
};

const limitRule = (rule, max) => [
  "error",
  rule === "max-lines" || rule === "max-lines-per-function"
    ? { max, skipBlankLines: true, skipComments: true }
    : max,
];

/**
 * STANDARDS DEBT: files that already exceed a limit, pinned at today's value
 * so they cannot get worse. Fix the file, then delete its entry. Never add a
 * file and never raise a number — split the code instead (PLAN.md, Phase 6).
 */
const DEBT = {
  "src/app/App.tsx": { "max-lines-per-function": 232 },
  "src/app/components/CommentsView.tsx": { "max-lines": 320, "max-lines-per-function": 296, complexity: 41 },
  "src/app/components/FilesView.tsx": { "max-lines-per-function": 249, complexity: 32 },
  "src/app/components/OrganizationTree.tsx": { "max-lines-per-function": 159 },
  "src/app/components/PrDetails.tsx": { "max-lines-per-function": 218 },
  "src/app/components/SetupScreen.tsx": { "max-lines-per-function": 240 },
  "src/app/hooks/keyboard/completionKeyboard.ts": { complexity: 45 },
  "src/app/hooks/keyboard/globals.ts": { complexity: 28 },
  "src/app/hooks/usePasteHandler.ts": { "max-depth": 5 },
  "src/app/hooks/usePrComments.ts": { "max-lines-per-function": 207 },
  "src/data/azureDiff.ts": { "max-params": 6 },
  // 560: headroom for the PLAN.md 2.7 change; the file is to be split in Phase 6.
  "src/data/azureLoad.ts": { "max-lines": 560, "max-params": 6 },
  "src/data/azureRest.ts": { "max-params": 7 },
  "src/data/config.ts": { complexity: 29 },
};

/** Files that import upward across layers today (debt, PLAN.md 6.6). */
const LAYERING_DEBT = [
  "src/data/azureActions.ts",
  "src/data/azureDiff.ts",
  "src/data/azureLoad.ts",
  "src/data/azureRest.ts",
];

const layering = (group, message) => ({
  "no-restricted-imports": ["error", { patterns: [{ group, message }] }],
});

export default [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    plugins: {
      "react-hooks": reactHooks,
    },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
  {
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_",
      }],
      "@typescript-eslint/no-explicit-any": "off",
      "no-console": "off",
    },
  },
  {
    files: ["src/**/*.ts", "src/**/*.tsx"],
    rules: {
      ...Object.fromEntries(Object.entries(LIMITS).map(([rule, max]) => [rule, limitRule(rule, max)])),
      "@typescript-eslint/no-explicit-any": "error",
      // Ink owns the terminal: stray console output paints over the frame. Use debugLog.
      "no-console": "error",
    },
  },
  // Layering: domain <- data <- app. Imports only point downward.
  {
    files: ["src/domain/**/*.ts"],
    rules: layering(["../data/**", "../app/**"], "domain is the lowest layer and must not import data/ or app/."),
  },
  {
    files: ["src/data/**/*.ts"],
    rules: layering(["../app/**"], "data/ must not import from app/ (layering: domain <- data <- app)."),
  },
  ...Object.entries(DEBT).map(([file, limits]) => ({
    files: [file],
    rules: Object.fromEntries(Object.entries(limits).map(([rule, max]) => [rule, limitRule(rule, max)])),
  })),
  { files: LAYERING_DEBT, rules: { "no-restricted-imports": "off" } },
  // Permanent exemptions: a fixture is data, not logic; main.tsx is the CLI and prints to stdout.
  { files: ["src/data/mock.ts"], rules: { "max-lines": "off" } },
  { files: ["src/main.tsx"], rules: { "no-console": "off" } },
  {
    ignores: [
      "dist/**",
      "out/**",
      "node_modules/**",
      "dev/**",
      "website/**",
      "test-*.ts",
      // Local agent tooling (may hold whole worktree copies of the repo).
      ".claude/**",
      ".kilo/**",
      ".serena/**",
    ],
  },
];
