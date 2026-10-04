# adotui

Terminal UI for monitoring pull requests across multiple Azure DevOps organizations and repositories, talking to the Azure DevOps REST API directly (the Azure CLI is only an optional way to sign in) — the way `ghui` is a terminal UI for GitHub.

## Status

- Bun + Ink + React + TypeScript
- Grouped organization / repository / pull request view with split-pane layout
- Keyboard-first navigation with filter search and dynamic focus
- **Live Azure DevOps backend over REST** (multi-org, multi-repo; sign in with `az login` or a PAT)
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

1. Credentials for your Azure DevOps organizations — either:
   - the [Azure CLI](https://learn.microsoft.com/cli/azure/install-azure-cli) signed in with `az login` (adotui only asks it for a token; the `azure-devops` extension is **not** needed), or
   - a personal access token, via `export AZURE_DEVOPS_EXT_PAT=<your-pat>` or `pat` in the config. Approving, rejecting, abandoning and completing PRs need the **Code (Read & write)** scope.

   A PAT, when set, is used **instead of** `az login`. If you see "Azure DevOps rejected your personal access token", fix or remove it (also from the config's `pat`) and `az login` is used again — no restart needed.
2. [Git](https://git-scm.com/downloads) on your `PATH` (adotui uses `git diff` to compute file diffs; this is what makes diffs work on Windows).

## Configuration

adotui reads a JSON config describing which organizations and projects to
monitor. Repositories are auto-discovered per project unless you list them
explicitly. If `$ADOTUI_CONFIG` is set, that file is the only one read.
Otherwise config is searched in this order:

1. `$XDG_CONFIG_HOME/adotui/config.json`
2. `~/.config/adotui/config.json`
3. `~/.adotui.json`
4. `./adotui.config.json` (in the current directory or any parent)

### Interactive Configuration Wizard

If no configuration file is found, `adotui` automatically launches the interactive setup configuration wizard.

You can also force open the configuration wizard at any time to add, edit, or delete projects and configure a Personal Access Token (PAT) by running:

```bash
adotui setup
# or
adotui init
```

Within the configuration wizard:
- Navigate menu items and form inputs using **Tab** / **Shift+Tab** or **Arrow keys**.
- Select a menu option or advance fields by pressing **Enter**.
- Press **Enter** on an existing project item to edit it.
- Press **Backspace** or **Delete** on an existing project item in the list to remove it.
- View keyboard instructions or general CLI tips by selecting **❓ Keyboard & CLI Help**.
- Save and load the configuration by selecting **✓ Save & Load Configuration**. Edits are written back to the config file that was loaded, keeping settings the wizard doesn't edit (`status`, `top`, `reviewer`, `creator`). A new config goes to `$ADOTUI_CONFIG` if set, otherwise `./adotui.config.json`. A file holding a PAT is saved with owner-only permissions.

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
default `active`), `top` (optional cap on PRs kept per repo; all PRs are kept when unset), `reviewer` and
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

The footer lists the shortcuts for your current context; press `?` in the app
for the full reference. The canonical table lives in `src/app/keymap.ts`.

- `tab` / `shift+tab`: cycle pane focus forward / backward
- `↑` / `↓`: navigate items in the focused pane
- `1`-`3`: PR tabs — Overview, Diff, Comments (`4` Pipelines in debug builds)
- `h` / `←`: back to the PR list from a PR tab
- `enter`: tree → focus the PR list · list → open the PR overview
- `v`: cycle the tree filter (me → with-prs → all)
- `/`: live filter for the current view (PRs; files when in Diff)
- `:`: command mode (`filter <query>`, `find <query>`, `refresh`, `help`…)
- `r`: refresh · `R` inside Comments/Pipelines: reload that view
- `a` / `x` / `b` / `c`: approve / reject / abandon / complete the selected PR
- `o`: open the selected PR in the browser
- Diff: `←`/`→` switch files · `g`/`G` top/bottom · `n` comment on a line
- Comments: `n` new · `r` reply · `e` edit · `d` delete · `s` resolve
- `?`: help view · `q`: quit

All mutating actions (approve, reject, abandon, complete/merge, comment
delete) require an explicit `y` confirmation — Enter does not confirm.

## How it works

- `src/data/config.ts` — loads and validates the multi-org/project config.
- `src/data/command.ts` — CLI-agnostic process runner on `node:child_process` (run / runJson).
- `src/data/azureCommon.ts` — constants for the `az` CLI (used only to obtain a token).
- `src/data/azureIdentity.ts` — the signed-in identity (`connectionData`), used by votes and the "me" filter.
- `src/data/adoFetch.ts` — REST client (cached auth, 429/401 retries, readable errors).
- `src/data/azure.ts` — barrel over `azureLoad` (tree orchestration) / `azureDiscovery` (projects, repos, PR listing) / `azurePrDetails` (lazy per-PR details) / `azureRest` / `azureDiff` / `azureActions`.
- `src/data/constants.ts` — data-layer tunables (timeouts, retries, page sizes, HTTP statuses); `src/data/refs.ts` — `PrScope` / `RepoRef` addressing.
- `src/data/azureNormalize.ts` — maps Azure DevOps JSON to the domain model.
- `src/app/dataController.ts` — orchestrates loading, refresh, and mock fallback.
- `src/app/store.ts` + `src/app/actions/` — module-global Zustand store with stable, module-level action functions (toasts, refresh, selection, confirm pipeline, completion editor, command dispatch).
- `src/app/hooks/useAppState.ts` — subscribes to the store, derives the current selection, and owns the lifecycle effects.
- `src/app/hooks/useAppKeyboard.ts` — routes keyboard events to dedicated handlers under `src/app/hooks/keyboard/` (`globals.ts`, `filesKeyboard.ts`, etc.) using a central dispatch table.

## Azure DevOps API usage

Reads go straight to the REST API (`api-version=7.1`) through
`src/data/adoFetch.ts`, which handles auth, throttling retries and error
mapping:

- `GET _apis/projects` — project discovery
- `GET {project}/_apis/git/repositories` — repository discovery
- `GET {project}/_apis/git/pullrequests` — pull requests (paged)
- `GET {project}/_apis/policy/evaluations` — check/policy rollups
- `GET .../pullRequests/{id}/iterations[/{n}/changes]` — changed files
- `GET .../pullRequests/{id}/threads` (+ POST/PATCH/DELETE) — comments
- `GET .../pullRequests/{id}/workitems` + `_apis/wit/workitems` — work items
- `GET {project}/_apis/build/builds` — pipeline runs
- `GET .../items` — file contents for diffs

PR actions are REST calls too:

- `GET _apis/connectionData` — the signed-in identity (id and sign-in address)
- `PUT .../pullrequests/{id}/reviewers/{me}` — approve (`10`) / reject (`-10`)
- `PATCH .../pullrequests/{id}` — abandon, or complete with the chosen merge
  strategy (all four are supported). Completion sends the source commit you
  reviewed, so Azure DevOps refuses it if the branch has moved since.

The `az` CLI is only used for one thing: `az account get-access-token` — a
bearer token, cached until it expires (`AZURE_DEVOPS_EXT_PAT` is used instead
when set).
