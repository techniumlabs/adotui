# ADOTUI Development Guidelines

## Tech Stack
- **Runtime**: Bun (default to using Bun instead of Node.js)
- **UI Framework**: React + Ink (Terminal UI)
- **Language**: TypeScript
- **Backend API**: Azure CLI (`az`) spawned via Bun's `Bun.spawn`

## Bun Conventions
- Use `bun <file>` instead of `node <file>`
- Use `bun test` instead of `jest` or `vitest`
- Use `bun install` instead of `npm/yarn/pnpm install`
- Use `bun run <script>` instead of `npm run <script>`
- Prefer `Bun.file` over `node:fs`'s readFile/writeFile
- Use `Bun.spawn` or `Bun.$` instead of `child_process` or `execa`.
- Documented exceptions: `src/data/command.ts` stays on `node:child_process` (the single subprocess entry point; mature timeout/kill/stream semantics every az call relies on), and `src/app/utils/debugLog.ts` keeps `node:fs` `appendFileSync` (append with strict ordering, which `Bun.file` doesn't cover).

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
