# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- `--version`, `--help`, and `--diagnostic` CLI flags
- Homebrew formula auto-generation on release
- Cross-platform binary builds (linux/macOS/Windows × x64/arm64)
- Curl-based install script with ARM64 support
- Gitleaks secret scanning in PR pipeline
- ESLint configuration
- Comprehensive unit tests for command parsing, config loading, and Azure normalization
- CHANGELOG, CONTRIBUTING guide, and example config

### Changed
- GitHub Actions pinned to immutable commit SHAs
- `bun install --frozen-lockfile` enforced in CI
- PR workflow runs with `permissions: { contents: read }` (least privilege)

### Fixed
- `install.sh` now correctly detects Linux ARM64 architecture

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
