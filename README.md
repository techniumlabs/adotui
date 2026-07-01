# adotui

Terminal UI for monitoring pull requests across multiple Azure DevOps organizations.

Current implementation status:

- Bun + Ink + React + TypeScript scaffold completed
- UI-first shell completed with grouped organization/repository view
- Interactive PR list + detail panel completed
- Keyboard-first navigation and command mode completed
- Action stubs implemented (approve, abandon, open in browser)
- Auto-refresh loop and manual refresh interaction completed

## Run

Install dependencies:

```bash
bun install
```

Start the app:

```bash
bun run start
```

Run in watch mode:

```bash
bun run dev
```

Typecheck:

```bash
bun run typecheck
```

## Keybindings

- `tab`: cycle focus panes
- `j` / `k` or arrows: navigate
- `h` / `l`: move between panes
- `/`: open command mode
- `r`: manual refresh
- `a`: approve selected PR (mock)
- `o`: open selected PR in browser
- `q`: quit

## Commands

In command mode, press enter after typing one of:

- `help`
- `refresh`
- `toggle-auto`
- `approve`
- `abandon`
- `open`
- `quit`

## Next Implementation Steps

1. Replace mock data with Azure DevOps API integration.
2. Add profile-based multi-org authentication (PAT + OAuth).
3. Introduce caching, backoff, and incremental refresh.
4. Add full actionable workflows (comment, complete, abandon with confirmations).
