# adotui — plan for the pending items

Branch `fix/p1-refresh-diff-setup` · draft PR [#11](https://github.com/techniumlabs/adotui/pull/11) · P1 already shipped in `3ee31e0`.

**Rules for every item:** one commit per item; run `bun run typecheck`, `bun run lint` and `bun test`
and check each exit code; every behaviour change gets a test that fails on the old code; update
CLAUDE.md / README / CHANGELOG `[Unreleased]` when behaviour changes; push after each phase.

Status: `[x]` done · `[~]` code done, awaiting commit · `[ ]` pending

## Phase 0 — PR
- [x] 0.1 Draft PR #11 opened, so CI checks every push.

- [x] 0.2 Code standards + lint ratchet (CLAUDE.md "Code Standards", `DEBT` in `eslint.config.js`) — added mid-run at the user's request.

## Phase 1 — Cleanup
- [x] 1.1 Delete the dead `fetchDetails` path in `src/data/azureLoad.ts` (`hydratePullRequest` becomes the small
      `toPullRequest`; remove `LoadOptions.fetchDetails` and its uses in `dataController.ts` and tests).
- [x] 1.2 `FilesView.tsx` uses `getVisibleFiles` from `utils/prFilters.ts` instead of its own copy.

## Phase 2 — Data layer
- [x] 2.1 **Token herd** (`azureAuth.ts`): share one in-flight promise. Test: fake `az` on PATH, 8 concurrent calls → 1 spawn.
- [x] 2.2 **No duplicate comments** (`adoFetch.ts`): don't retry POST on network errors / 5xx (429 and 401 still retry).
- [x] 2.3 **`azureDiff.ts` on the shared client:** add `adoGetText`, so diff downloads get retries and 401 token refresh.
      `console.error` → `debugLog` (here and in `usePrDetails.ts`). Fix the stale header comment.
- [x] 2.4 **Windows:** `git diff --no-index` instead of system `diff` (keep the `a/<old>` / `b/<new>` headers);
      `--update` on Windows prints the releases URL instead of `bash -c`; fetch `install.sh` from the release tag, not `main`.
- [x] 2.5 **PRs with >2000 files:** page iteration changes (`$top=2000`, follow `nextSkip`/`nextTop`, cap 10 pages).
- [x] 2.6 **Cache per config** (`cache.ts`): file name includes a hash of projects/status/top/reviewer/creator (never the PAT).
- [x] 2.7 **Details gap:** `fetchPrDetails` returns only the fields whose fetch succeeded, so a partial failure can't zero counts.

## Phase 3 — PR actions over REST (drops the `azure-devops` extension)
- [x] 3.1 Identity from `GET _apis/connectionData` (cached per org); replaces `az account show`. Check the api-version on the live org first.
- [x] 3.2 Vote: `PUT …/pullRequests/{id}/reviewers/{myId}` with `{ vote: 10 }` / `{ vote: -10 }`.
- [x] 3.3 Abandon: `PATCH …/pullRequests/{id}` `{ status: "abandoned" }`.
- [x] 3.4 Complete: `PATCH` with `lastMergeSourceCommit` + `completionOptions` (all 4 merge strategies).
      Carry `lastMergeSourceCommit` on the PR/`PrRef`; delete `completionStrategyNote`.
- [x] 3.5 Delete `checkAzAvailable`, `orgArgs` and the other az-only helpers; README prerequisites no longer need the extension.
- [x] 3.6 Tests with mocked fetch: method, path and body for each mutation; `connectionData` parsing.
- [x] 3.7 **Live check on `techium-labs-test`** (disposable org): approve, reject, abandon, complete (squash and rebase); reseed with `dev/testdata.ts` if needed.

## Phase 4 — CI and release
- [x] 4.1 `release.yml` runs typecheck and tests before building.
- [x] 4.2 Pin `softprops/action-gh-release` to a commit SHA; pin Bun to `1.3.14` in all workflows.
- [x] 4.3 Release publishes `SHA256SUMS`; `install.sh` verifies the download (warn and continue for older releases without it).
- [ ] 4.4 `pr.yml` matrix: `ubuntu-latest` + `windows-latest` for lint/typecheck/test. If more than 5 Windows-only failures remain after one fix pass, stop and report.

## Phase 5 — Finish
- [ ] 5.1 Run the app against `techium-labs-test`: renamed-file diff, one 60 s auto-refresh (details and diff stay), approve flow.
- [ ] 5.2 CHANGELOG `[Unreleased]` entries; mark PR #11 ready for review; update memory.
- [ ] 5.3 Before merge: decide where `PLAN.md` lives. CLAUDE.md and `eslint.config.js` point at its Phase 6 debt list, so move that list
      to a GitHub issue (and update the references) or keep the file.

## Phase 6 — Code standards debt (suggest a separate PR after #11 merges)
Standards and the lint ratchet are in (see CLAUDE.md "Code Standards", `DEBT` in `eslint.config.js`). This phase pays the debt down; each fix deletes its `DEBT` entry.
- [ ] 6.1 **Constants:** create `src/data/constants.ts` and move the tunables (`DEFAULT_TIMEOUT_MS` ×2, `MAX_ATTEMPTS`, `EXPIRY_MARGIN_MS`,
      `FALLBACK_TTL_MS`, `PR_LIST_PAGE_SIZE`, `CHANGES_*`, HTTP status codes); move `PARTIAL_COMMIT_MS`, `TOAST_DURATION_MS`,
      `IDENTITY_WAIT_MS` into `src/app/constants.ts`. Then enable `no-magic-numbers` for `src/data/**` (not `mock.ts`), `src/app/actions/**`, `src/app/hooks/**`.
- [ ] 6.2 **Split `azureLoad.ts`** (521 code lines): discovery/identity/filters → `azureProjects.ts`; per-PR detail fetches → `azurePrDetails.ts`; `azureLoad.ts` keeps orchestration.
- [ ] 6.3 **Shared UI primitives** in `src/app/components/ui/`: `Pane` (25 inline `borderStyle`s), `PanelHeader` (7 copies), `EmptyState` (8 copies).
- [ ] 6.4 **Split the long components** to ≤ 150 lines each: `CommentsView` (296-line component, 320-line file), `FilesView`, `SetupScreen`, `App`, `PrDetails`, `OrganizationTree`, `usePrComments`.
- [ ] 6.5 **Parameter objects:** `azureRest.ts` mutations (7 positional args → a `ThreadRef`), `azureDiff.fetchFileDiff`, `listPrFileChanges`.
- [x] 6.6 **Layering:** `debugLog` → `src/shared/`, `CompletionOptions`/`MergeStrategy` → `domain/`; `LAYERING_DEBT` deleted (done with Phase 3).
- [ ] 6.7 **Complexity:** `completionKeyboard` (45), `CommentsView` (41), `FilesView` (32), `config.ts` (29), `globals.ts` (28) → lookup tables / smaller functions; fix `usePasteHandler` nesting.
- [ ] 6.8 **Tighten the ratchet** once `DEBT` is empty: function 150 → 100, complexity 25 → 20; enable `no-nested-ternary` (44 today).

## Found along the way (not in the plan)
- `parseDiff` (`diffRender.tsx`) treats any line starting with `---`/`+++` as a header, so a removed markdown `---` rule
  or an added `++x` line is hidden in the diff view. Fix: treat them as headers only before the first hunk.
- The Kilo Code extension created `.kilo/worktrees/believed-skate/` (a full repo copy) mid-session and broke `bun run lint`;
  agent-tooling dirs (`.claude`, `.kilo`, `.serena`) are now ESLint-ignored. The worktree itself was left alone.
- `adotui --update`'s old `curl -f … | bash` reported success when the download failed (fixed in 2.4).

- Live check (techium-labs-test, 2026-10-04): identity needs `api-version=7.1-preview.1` (plain 7.1 → HTTP 400); approve/reject/abandon,
  squash and rebase completion all verified. A real stale `lastMergeSourceCommit` is refused with 409 TF401192 (guard works);
  an all-zero commit is treated as "none" and merges anyway. Test PRs consumed: 216 active (vote -10), 217 abandoned, 218 and 221 active
  with conflicts, 219 and 220 completed — reseed with `bun dev/testdata.ts` when needed.
- Completion is asynchronous: PATCH returning 200 does not mean merged (PR 218 was accepted but stayed active on conflicts), yet the
  banner says "PR completed and merged." Pre-existing with `az`; fix = poll the PR after completing, or word the banner "Completion requested".

## Not fixing (noted)
- With a PAT, a 401 is retried twice for nothing.
- `Retry-After` waits are not capped.
