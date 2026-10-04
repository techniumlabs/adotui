# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Bottom-line progress loader with star pulse, project counter, and elapsed time
- `dev/testdata.ts` to seed and clean up Azure DevOps load-test data
- `--version`, `--help`, and `--diagnostic` CLI flags
- Homebrew formula auto-generation on release
- Cross-platform binary builds (linux/macOS/Windows × x64/arm64)
- Curl-based install script with ARM64 support
- Gitleaks secret scanning in PR pipeline
- ESLint configuration
- Comprehensive unit tests for command parsing, config loading, and Azure normalization
- CHANGELOG, CONTRIBUTING guide, and example config
- PR actions (approve, reject, abandon, complete) and the current-user lookup use the Azure DevOps
  REST API: the `azure-devops` CLI extension is no longer needed, PAT users can vote and get the
  "me" filter, and all four merge strategies work. Completing sends the commit you reviewed, so a
  branch that moved since is refused with an actionable message
- Each release publishes `SHA256SUMS`, and `install.sh` verifies downloads against it
  (`ADOTUI_INSTALL_DIR` overrides the install directory)
- CI runs lint, typecheck and tests on Windows too; releases are gated on typecheck and tests
- Code-standards lint rules: size limits, `shared <- domain <- data <- app` layering, no `console`
  and no `any` in `src/` (see "Code Standards" in CLAUDE.md)
- `ADOTUI_CACHE_DIR` and `ADOTUI_MOCK_STREAM_BATCH` environment variables

### Changed
- GitHub Actions pinned to immutable commit SHAs
- `bun install --frozen-lockfile` enforced in CI
- PR workflow runs with `permissions: { contents: read }` (least privilege)
- The on-disk data cache is keyed per config (never by the PAT) instead of shared by all configs
- `git` is now required for file diffs (`git diff --no-index` replaces the system `diff`, which does
  not exist on Windows)
- `$ADOTUI_CONFIG`, when set, is the only config file read (no silent fallback to another one)
- The setup wizard saves back to the config file it loaded, keeps `status`/`top`/`reviewer`/`creator`,
  and writes a file containing a PAT with owner-only permissions
- `--update` downloads the installer from the release tag, and on Windows points at the releases page
- Release tooling pinned: `softprops/action-gh-release` to a commit SHA, Bun to 1.3.14

### Fixed
- `install.sh` now correctly detects Linux ARM64 architecture
- A refresh no longer wipes loaded PR details (files, diffs, checks, work items, comment counts);
  auto-refresh updates rows in place like a manual one, and a failed load keeps the tree on screen
- A partly failed details fetch no longer overwrites check, work-item or comment counts with zeros
- Empty added files no longer re-fetch their diff in a loop
- Diffs and details land on the PR they were fetched for (not whatever is selected), and PR lookup
  matches the project as well as the repository name
- Renamed files diff against their original path instead of failing
- PRs with more than 2000 changed files are no longer truncated
- A retried POST (timeout or 5xx) can no longer post a comment twice
- A cold start spawns one `az` process for the token instead of one per concurrent request
- Diff downloads use the shared REST client (retries, token refresh); their errors no longer print
  over the UI
- `install.sh` no longer installs an error page when a download fails, and `--update` no longer
  reports success when the installer download fails

### Changed
- PR loading is 7x faster on large configs: one paged project-wide PR listing
  per project (grouped by repository) with bounded concurrency, replacing one
  `az` call per repository in a serial loop
- `top` is now an optional per-repository cap; all PRs are kept when unset
- Auto refreshes run silently without banner updates

### Fixed
- Screen flicker while loading: frame stays under the terminal height and
  animations are progress-driven instead of timer-driven
- PRs beyond the first `--top` window are no longer silently dropped


## [0.1.0] - 2026-07-01

### Added
- Initial release
- Terminal UI for monitoring Azure DevOps pull requests
- Multi-org, multi-repo support via config file
- Keyboard-first navigation with split-pane layout
- PR actions: approve, reject, abandon, complete (with merge strategy editor)
- Side-by-side diff viewer with syntax highlighting
- Auto-refresh and manual refresh
- Command bar with filtering (by author, title, merge status, tags)
- Mock/demo mode for offline use
