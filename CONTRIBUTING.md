# Contributing to adotui

Thanks for your interest in contributing! Here's how to get started.

## Development Setup

1. **Prerequisites**: [Bun](https://bun.sh/) (latest), [Azure CLI](https://learn.microsoft.com/cli/azure/install-azure-cli) with the `azure-devops` extension.
2. Clone the repo and install dependencies:
   ```bash
   git clone https://github.com/techniumlabs/adotui.git
   cd adotui
   bun install
   ```
3. Run in dev mode:
   ```bash
   bun run dev           # watch mode with debug logging
   ADOTUI_MOCK=1 bun start  # offline demo mode
   ```

## Project Structure

```
src/
├── main.tsx              # Entry point (CLI flags, render)
├── domain/types.ts       # Domain model (PullRequest, AppData, etc.)
├── data/                 # Azure DevOps API layer
│   ├── config.ts         # Config loading and validation
│   ├── azure.ts          # az CLI command catalog
│   ├── azureRest.ts      # REST API calls
│   ├── azureNormalize.ts # Raw → domain type mapping
│   └── azureTypes.ts     # Azure wire types
├── app/                  # UI layer (Ink + React)
│   ├── App.tsx           # Root component
│   ├── store.ts          # Zustand state store
│   ├── components/       # UI components
│   └── hooks/            # React hooks + keyboard handlers
tests/                    # Bun test files
```

## Scripts

| Command | Purpose |
|---------|---------|
| `bun run dev` | Watch mode with debug logging |
| `bun run start` | Run the TUI |
| `bun run test` | Run all tests |
| `bun run lint` | Lint with ESLint |
| `bun run typecheck` | Type check with tsc |
| `bun run build:all-binaries` | Build all 6 platform binaries |

## Workflow

1. Create a feature branch from `main`:
   ```bash
   git checkout -b feature/my-change
   ```
2. Make your changes.
3. Ensure quality:
   ```bash
   bun run lint
   bun run typecheck
   bun test
   ```
4. Open a pull request against `main`.

## Code Style

- TypeScript strict mode — no `any` unless absolutely necessary.
- Pure functions over side effects. Keep data transformations testable.
- Use `const` over `let`. No `var`.
- Prefer explicit types on function signatures.

## Commit Messages

Use [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` new feature
- `fix:` bug fix
- `docs:` documentation only
- `chore:` maintenance (CI, deps, config)
- `refactor:` code change that neither fixes a bug nor adds a feature
- `test:` adding or updating tests

## Reporting Issues

Please include:
- Output of `adotui --diagnostic`
- Steps to reproduce
- Expected vs actual behavior
