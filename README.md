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

## Installation

### Homebrew (macOS / Linux)

```bash
brew tap techniumlabs/adotui https://github.com/techniumlabs/adotui
brew install adotui
```

### Shell Script (macOS / Linux / Windows Git Bash)

```bash
curl -fsSL https://raw.githubusercontent.com/techniumlabs/adotui/main/install.sh | bash
```

> [!NOTE]
> On Windows PowerShell, `curl` is a built-in alias for `Invoke-WebRequest` which does not support the same flags. To bypass the alias, use `curl.exe` instead, or run the command inside Git Bash:
> ```bash
> curl.exe -fsSL https://raw.githubusercontent.com/techniumlabs/adotui/main/install.sh | bash
> ```

### Manual Download

Download the binary for your platform from [Releases](https://github.com/techniumlabs/adotui/releases):

| Platform | Binary |
|----------|--------|
| Linux x64 | `adotui-linux-x64` |
| Linux ARM64 | `adotui-linux-arm64` |
| macOS x64 | `adotui-macos-x64` |
| macOS ARM64 (Apple Silicon) | `adotui-macos-arm64` |
| Windows x64 | `adotui-windows-x64.exe` |
| Windows ARM64 | `adotui-windows-arm64.exe` |

### From Source

```bash
git clone https://github.com/techniumlabs/adotui.git
cd adotui
bun install
bun run start
```

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

- **Linux / macOS**:
  ```bash
  ADOTUI_MOCK=1 bun run start
  ```
- **Windows (PowerShell)**:
  ```powershell
  $env:ADOTUI_MOCK="1"; bun run start
  ```

## Keybindings

The footer permanently lists available shortcuts based on your context.

- `tab`: switch pane focus between Tree (left) and Content (right)
- `j` / `k` or arrows: navigate items in the focused pane
- `enter`: open selected PR or file
- `/`: enter command mode (e.g., `:filter <query>`, `:help`, `:refresh`)
- `1`-`4`: switch tabs in the PR detail view (Overview, Diff, Comments, Pipelines)
- `r`: manual refresh (re-fetch from Azure DevOps)
- `a`: approve selected PR
- `x`: reject selected PR / request changes
- `c`: complete selected PR (opens completion editor)
- `o`: open selected PR in browser
- `?`: toggle full-screen help view (or type `:help`)
- `q`: quit the application

All mutating actions (approve, reject, abandon, complete/merge) require an explicit `y/n` confirmation.

## How it works

- `src/data/config.ts` — loads and validates the multi-org/project config.
- `src/data/command.ts` — CLI-agnostic `Bun.spawn` wrapper (run / runJson).
- `src/data/azureCommon.ts` — shared Azure CLI status, organization, and JSON flags.
- `src/data/azure.ts` / `azureRest.ts` — Azure DevOps command catalogs. Replaces `/tmp` with `os.tmpdir()` for Windows safety.
- `src/data/azureNormalize.ts` — maps Azure DevOps JSON to the domain model.
- `src/app/dataController.ts` — orchestrates loading, refresh, and mock fallback.
- `src/app/hooks/useAppState.ts` — main react state container, composed of modular sub-hooks:
  - `useToast`, `useRefresh`, `useSelection`, `useConfirmAction`, `useCompletionEditor`, and `useCommandDispatch`.
- `src/app/hooks/useAppKeyboard.ts` — routes keyboard events to dedicated handlers under `src/app/hooks/keyboard/` (`globals.ts`, `filesKeyboard.ts`, etc.) using a central dispatch table.

## Azure CLI commands used

- `az repos list` — repository discovery
- `az repos pr list` — pull requests per repo
- `az repos pr policy list` — check/policy rollups
- `az devops invoke` (git iteration changes) — changed files
- `az repos pr set-vote` — approve / reject
- `az repos pr update --status` — abandon / complete
