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
};

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
  // Constants: no bare numbers in the logic layers; tunables live in the
  // constants modules (src/data/constants.ts, src/app/constants.ts).
  {
    files: ["src/data/**/*.ts", "src/app/actions/**/*.ts", "src/app/hooks/**/*.ts"],
    ignores: ["src/data/mock.ts"],
    rules: {
      "no-magic-numbers": ["error", { ignore: [-1, 0, 1, 2], ignoreArrayIndexes: true, ignoreDefaultValues: true, enforceConst: true }],
    },
  },
  // Layering: shared <- domain <- data <- app. Imports only point downward.
  {
    files: ["src/domain/**/*.ts"],
    rules: layering(["../data/**", "../app/**"], "domain is the lowest layer and must not import data/ or app/."),
  },
  {
    files: ["src/data/**/*.ts"],
    rules: layering(["../app/**"], "data/ must not import from app/ (layering: shared <- domain <- data <- app)."),
  },
  {
    files: ["src/shared/**/*.ts"],
    rules: layering(["../domain/**", "../data/**", "../app/**"], "shared/ is the lowest layer and must not import from the others."),
  },
  ...Object.entries(DEBT).map(([file, limits]) => ({
    files: [file],
    rules: Object.fromEntries(Object.entries(limits).map(([rule, max]) => [rule, limitRule(rule, max)])),
  })),
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
