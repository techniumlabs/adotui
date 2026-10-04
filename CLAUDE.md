# ADOTUI Development Guidelines

## Tech Stack
- **Runtime**: Bun (default to using Bun instead of Node.js)
- **UI Framework**: React + Ink (Terminal UI)
- **Language**: TypeScript
- **Backend API**: Azure DevOps REST API via `src/data/adoFetch.ts` (auth header cached in `azureAuth.ts`). Reads AND writes (votes, abandon, complete) are REST; the `az` CLI is only the credential source (`az account get-access-token`, when no PAT is set) — never spawn `az` for data, a process costs ~400-1200ms before the request starts. The signed-in identity comes from `azureIdentity.ts` (`connectionData`, preview api-version).

## Bun Conventions
- Use `bun <file>` instead of `node <file>`
- Use `bun test` instead of `jest` or `vitest`
- Use `bun install` instead of `npm/yarn/pnpm install`
- Use `bun run <script>` instead of `npm run <script>`
- Prefer `Bun.file` over `node:fs`'s readFile/writeFile
- Use `Bun.spawn` or `Bun.$` instead of `child_process` or `execa`.
- Documented exceptions: `src/data/command.ts` stays on `node:child_process` (the single subprocess entry point; mature timeout/kill/stream semantics every az call relies on), and `src/shared/debugLog.ts` keeps `node:fs` `appendFileSync` (append with strict ordering, which `Bun.file` doesn't cover).

## Terminal UI (Ink) Guidelines
- **Layout Model**: Use standard React `<Box>` flexbox properties. ADOTUI relies on a strict split-pane structure with a fixed-width left column and dynamic-width right column. 
- **Dynamic Resizing**: Use `useTerminalSize` hook instead of hardcoding dimensions. Ensure components flex gracefully when the terminal window is resized.
- **Borders & Dividers**: 
  - Use `<Box borderStyle="round">` for primary layout panes.
  - Track focus dynamically (e.g., `focus === "tree"`) and pass this into the `borderColor` property. Focused panes use the `palette.accent` color, inactive panes use `palette.border`.
- **Colors & Styling**: Do NOT use raw hex codes or basic terminal colors inline. Always import and use the `palette` and `glyph` objects from `src/app/theme.ts`.
- **Tables**: Use fixed-width columns inside flex rows for aligning tabular data (like the Pull Request list). Use the `truncate` utility to cap strings and prevent table explosion on small terminals.

## State Management
- App state lives in a module-global Zustand store (`src/app/store.ts`). Updates use Zustand's partial merge via `patchState(partial)` / `updateState(fn)` — supply only the keys that change, never spread the whole state.
- Mutations are stable module-level action functions under `src/app/actions/` (toasts, refresh, selection, confirm pipeline, completion editor, command dispatch, PR data patches), assembled into the `appActions` object in `actions/index.ts`. Derivations shared by actions and rendering live in `src/app/selectors.ts`.
- `useAppState.ts` subscribes to the store, derives the current selection, owns lifecycle effects (initial load, auto-refresh interval), and returns `{ state, ..., actions }`; `AppHandle` is its return type.
- Presentational components invoke actions via named helper methods on the `actions` return from `useAppState`. Direct store mutation is hidden from components.
- Loading is progressive: `loadAppData` streams `LoadPartial`s (one per org, then one per project) via `onPartial` while still resolving the **config-ordered** tree for its return value. `refreshActions` folds partials into the store through `mergeLoadPartials` (upsert by project/repo, never blind append; re-attaches PR details already loaded, since loads list PRs without them) behind a 250ms coalescer with a trailing flush, guarded by a `loadEpoch` request id. The silent auto-refresh collects partials too but folds them only in the trailing flush (one commit), so every refresh path shares the same upsert. Invariants: never call `updateState` for a no-op (zustand notifies on every set, and each set is a full Ink frame); a failed load never deletes what is on screen; and async per-PR results (details, diffs) carry the PR they were fetched for (`PrTarget`), never "the current selection".
- View-local data fetching lives in dedicated hooks (`usePrComments`, `usePipelineRuns`, `useDiffComment`, `useLazyFileDiff`); components keep only UI state (selection, scroll, input mode).
- Keyboard bindings are two-tier: app-level focus routing lives in per-focus files under `src/app/hooks/keyboard/` (e.g. `globals.ts`, `filesKeyboard.ts`, `completionKeyboard.ts`), dispatched by `useAppKeyboard.ts`; self-contained views (diff rows, comments, pipeline runs, setup wizard) own their keys via `useInput(..., { isActive })` — every key must be handled by exactly one tier (see `src/app/components/diff/diffKeyboard.ts`). Documented shortcuts render from `src/app/keymap.ts` (HelpView + footer) — update that table whenever a binding changes.

## Testing
Use `bun test` to run tests.

```ts
import { test, expect } from "bun:test";

test("example test", () => {
  expect(1).toBe(1);
});
```

## Running the App
- `bun run dev` (starts the app with watch mode for development)
- `bun run start` (runs the app locally)
- Run in Mock Mode (no Azure credentials needed):
  - **Linux / macOS**: `ADOTUI_MOCK=1 bun run start`
  - **Windows (PowerShell)**: `$env:ADOTUI_MOCK="1"; bun run start`

## Code Standards
Enforced by `bun run lint` (CI fails on a violation) unless marked *guideline*.

- **Size limits** (`src/`, code lines only — blanks and comments don't count): file ≤ 300 · function or component ≤ 150 (guideline: ≤ 80) · cyclomatic complexity ≤ 25 (guideline: ≤ 15) · parameters ≤ 5 (more → a parameter object, like `PrScope`) · nesting depth ≤ 4. Over a limit means split: extract a hook, a sub-component or a module. Files already over are pinned at today's value in `eslint.config.js` under `DEBT` — fix the file, then delete its entry; never add a file or raise a number. `src/data/mock.ts` (a fixture) is exempt.
- **Layering**: `shared/` (`debugLog`) ← `domain/` (pure types) ← `data/` (Azure REST, config; no React) ← `app/` (state, UI). Imports only point downward; lint-enforced with no exceptions.
- **Constants**: no magic numbers or strings for tunables — timeouts, retry counts, page sizes, TTLs, limits, API versions, URLs. Name them `UPPER_SNAKE` with a unit suffix (`_MS`, `_SIZE`) and keep them in the layer's constants module: `src/app/constants.ts` for UI/app, `src/data/constants.ts` for REST/auth/paging/config (HTTP statuses and vote values are named there too). Layout numbers inside a component's JSX are the only exception. Lint-enforced (`no-magic-numbers`) in `src/data`, `src/app/actions` and `src/app/hooks`; components are not covered yet.
- **Reusable components**: shared building blocks live in `src/app/components/ui/`: `PanelTitle` (focus-coloured pane title) and `TabPane` (the pane under the PR tab bar). Rule of three: the third copy of a JSX pattern becomes a shared component. Views compose primitives and take colours and glyphs only from `palette`/`glyph`. One exported component per file, `PascalCase.tsx`; hooks are `useThing.ts`.
- **Design patterns** — use the ones already here; add a new one only for a concrete need:
  - *Gateway*: `data/adoFetch.ts` is the only Azure DevOps HTTP entry point and `data/command.ts` runs every `az` call the data layer makes (`--diagnostic` in `main.tsx` is the one exception; today only for the token).
  - *Adapter*: `data/azureNormalize.ts` maps Azure payloads to `domain/` types; the UI never sees raw Azure shapes.
  - *Parameter object*: a PR or repository is addressed with `PrScope` / `RepoRef` (`data/refs.ts`; build one with `prScope(pr)`), never as loose organization/project/repo/id strings that are easy to transpose.
  - *Command/Action*: every state change is a module-level action (see State Management); components never touch the store directly.
  - *Container/Presentational*: data hooks (`usePrComments`, …) own fetching, components own UI state.
  - *Table over branching*: key→behaviour tables (like `keymap.ts`) instead of long `if`/`switch` chains — the usual fix for a complexity violation.
  - Async results carry the thing they were fetched for (`PrTarget`), never "whatever is selected when they land".
- **Errors and output**: no `console.*` in `src/` — Ink owns the terminal, so stray output paints over the frame; use `debugLog` (`main.tsx`, the CLI, is exempt). No `any`. Within one module, data functions either throw (`AdoHttpError`, `CommandError`) or return `null`/`false`, as its header says — don't mix.
- **Tests**: every behaviour change gets a test that fails on the old code; tests never read or write the real home or config (use `ADOTUI_CONFIG` and temp dirs). Test files mirror module names under `tests/`.
- *Guideline*: avoid nested ternaries in JSX (44 today) — early return or a lookup table. Comments say why, not what.
