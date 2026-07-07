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

## Terminal UI (Ink) Guidelines
- **Layout Model**: Use standard React `<Box>` flexbox properties. ADOTUI relies on a strict split-pane structure with a fixed-width left column and dynamic-width right column. 
- **Dynamic Resizing**: Use `useTerminalSize` hook instead of hardcoding dimensions. Ensure components flex gracefully when the terminal window is resized.
- **Borders & Dividers**: 
  - Use `<Box borderStyle="round">` for primary layout panes.
  - Track focus dynamically (e.g., `focus === "tree"`) and pass this into the `borderColor` property. Focused panes use the `palette.accent` color, inactive panes use `palette.border`.
- **Colors & Styling**: Do NOT use raw hex codes or basic terminal colors inline. Always import and use the `palette` and `glyph` objects from `src/app/theme.ts`.
- **Tables**: Use fixed-width columns inside flex rows for aligning tabular data (like the Pull Request list). Use the `truncate` utility to cap strings and prevent table explosion on small terminals.

## State Management
- Complex UI state is managed centrally by composing sub-hooks in `useAppState.ts`:
  - `useToast.ts` (toasts with UUID IDs)
  - `useRefresh.ts` (automatic & manual fetching)
  - `useSelection.ts` (flat tree, PR list, & diff select/scroll tracking)
  - `useConfirmAction.ts` (y/n confirmation pipeline for destructive actions)
  - `useCompletionEditor.ts` (merging & autocompletion strategy inputs)
  - `useCommandDispatch.ts` (dispatching console `:` commands)
- Presentational components invoke actions via named helper methods on the `actions` return from `useAppState`. Direct `setState` invocation is hidden.
- Keyboard bindings are decentralized into per-focus files under `src/app/hooks/keyboard/` (e.g. `globals.ts`, `filesKeyboard.ts`, `completionKeyboard.ts`), loaded with a unified state handler table in `useAppKeyboard.ts`. All handlers share the exported type `AppHandle`.

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
