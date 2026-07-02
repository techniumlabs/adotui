# adotui

Terminal UI for monitoring pull requests across multiple Azure DevOps organizations and repositories, backed by the Azure CLI (`az`) — the way `ghui` uses `gh` for GitHub.

## Status

- Bun + Ink + React + TypeScript
- Grouped organization / repository / pull request view
- Keyboard-first navigation and command mode
- **Live Azure DevOps backend via the `az` CLI** (multi-org, multi-repo)
- Real PR actions: approve, reject, abandon, complete
- Auto-discovery of repositories per project
- Initial load + manual/auto refresh against Azure DevOps
- Mock fallback for offline/demo use

## Prerequisites

1. [Azure CLI](https://learn.microsoft.com/cli/azure/install-azure-cli) installed (`az`).
2. The Azure DevOps extension:
   ```bash
   az extension add --name azure-devops
   ```
3. Signed in with access to your organizations:
   ```bash
   az login
   # or, for PAT-based auth:
   # export AZURE_DEVOPS_EXT_PAT=<your-pat>
   ```

## Configuration

adotui reads a JSON config describing which organizations and projects to
monitor. Repositories are auto-discovered per project unless you list them
explicitly. Config is searched in this order:

1. `$ADOTUI_CONFIG`
2. `$XDG_CONFIG_HOME/adotui/config.json`
3. `~/.config/adotui/config.json`
4. `~/.adotui.json`
5. `./adotui.config.json`

Example (`adotui.config.example.json`):

```json
{
  "status": "active",
  "top": 50,
  "projects": [
    { "organization": "https://dev.azure.com/contoso", "project": "Platform" },
    {
      "organization": "https://dev.azure.com/contoso",
      "project": "Payments",
      "repositories": ["payments-api", "payments-web"]
    },
    { "organization": "https://dev.azure.com/fabrikam", "project": "Engineering" }
  ]
}
```

Optional top-level fields: `status` (`active` | `completed` | `abandoned` | `all`,
default `active`), `top` (max PRs per repo, default `50`), `reviewer` and
`creator` (filter by user).

## Run

```bash
bun install
bun run start      # run
bun run dev        # watch mode
bun run typecheck  # tsc
```

### Demo / offline mode

Skip Azure and show sample data:

```bash
ADOTUI_MOCK=1 bun run start
```

## Keybindings

- `tab`: cycle focus panes
- `j` / `k` or arrows: navigate
- `h` / `l`: move between panes
- `/`: open command mode
- `r`: manual refresh (re-fetch from Azure DevOps)
- `a`: approve selected PR (asks `y/n` to confirm)
- `x`: reject selected PR / request changes (asks `y/n` to confirm)
- `c`: complete selected PR (opens completion editor; merge asks `y/n` to confirm)
- `o`: open selected PR in browser
- `u` / `s`: unified / split diff mode
- `q`: quit

All mutating actions (approve, reject, abandon, complete/merge) — whether triggered
by keypress or command mode — require an explicit `y/n` confirmation naming the
target PR, and act on the PR you confirmed even if the list refreshes meanwhile.

## Commands

In command mode (`/`), press enter after typing one of:

- `help`, `refresh`, `toggle-auto`
- `approve`, `reject`, `abandon`
- `complete [--merge-strategy=squash] [--no-delete-source-branch] [--bypass-policy] ...`
- `open`, `quit`

## How it works

- `src/data/config.ts` — loads and validates the multi-org/project config.
- `src/data/command.ts` — CLI-agnostic `Bun.spawn` wrapper (run / runJson).
- `src/data/azure.ts` — the `az repos` command catalog: discovers repos,
  lists PRs, fetches file changes and policy checks, and performs actions
  (`set-vote`, `update --status`).
- `src/data/azureNormalize.ts` — maps Azure DevOps JSON to the domain model.
- `src/app/dataController.ts` — orchestrates loading, refresh, mock fallback,
  and resolving the selected PR back to an org/project/repo reference.

## Azure CLI commands used

- `az repos list` — repository discovery
- `az repos pr list` — pull requests per repo
- `az repos pr policy list` — check/policy rollups
- `az devops invoke` (git iteration changes) — changed files
- `az repos pr set-vote` — approve / reject
- `az repos pr update --status` — abandon / complete
