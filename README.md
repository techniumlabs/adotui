# adotui

Terminal UI for monitoring pull requests across multiple Azure DevOps organizations and repositories, backed by the Azure CLI (`az`) — the way `ghui` uses `gh` for GitHub.

## Status

- Bun + Ink + React + TypeScript
- Grouped organization / repository / pull request view with split-pane layout
- Keyboard-first navigation with filter search and dynamic focus
- **Live Azure DevOps backend via the `az` CLI** (multi-org, multi-repo)
- Real PR actions: approve, reject, abandon, complete
- Detailed pull request view with side-by-side metrics and diff/comment tabs
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

The footer permanently lists available shortcuts based on your context.

- `tab`: switch pane focus between Tree (left) and Content (right)
- `j` / `k` or arrows: navigate items in the focused pane
- `enter`: open selected PR or file
- `/`: open filter mode (type to filter list, `esc` to clear)
- `1`-`4`: switch tabs in the PR detail view (Overview, Diff, Comments, Pipelines)
- `r`: manual refresh (re-fetch from Azure DevOps)
- `a`: approve selected PR
- `x`: reject selected PR / request changes
- `c`: complete selected PR (opens completion editor)
- `o`: open selected PR in browser
- `?`: toggle help screen (coming soon)
- `q`: quit

All mutating actions (approve, reject, abandon, complete/merge) require an explicit `y/n` confirmation.

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
