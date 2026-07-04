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
- Complex UI state (focus, navigation, layout data) is managed centrally in `useAppState.ts`.
- Keyboard bindings and command logic are isolated in `useAppKeyboard.ts`.
- Always pass derived state (like `active`, `selected`) as props to pure presentational components.

## Testing
Use `bun test` to run tests.

```ts
import { test, expect } from "bun:test";

test("example test", () => {
  expect(1).toBe(1);
});
```

## Running the App
- `bun run dev` (starts the app with watch mode)
- `ADOTUI_MOCK=1 bun run dev` (starts the app using mock JSON data instead of hitting Azure DevOps)
