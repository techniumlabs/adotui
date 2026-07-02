import React, { useEffect, useMemo, useState } from "react";
import { Box, Text, useApp, useInput } from "ink";
import type { OrganizationNode, PullRequest } from "../domain/types";
import {
  COMPLETION_FIELD_COUNT,
  DEFAULT_COMPLETION_OPTIONS,
  FOCUS_ORDER,
  INITIAL_STATE,
  REFRESH_INTERVAL_MS,
} from "./constants";
import { CommandBar } from "./components/CommandBar";
import { CompletionEditor } from "./components/CompletionEditor";
import { FilesView } from "./components/FilesView";
import { OrganizationTree } from "./components/OrganizationTree";
import { PrDetails } from "./components/PrDetails";
import { PullRequestList } from "./components/PullRequestList";
import { SummaryBar } from "./components/SummaryBar";
import type {
  AppState,
  CompletionOptions,
  ConfirmKind,
  PrTarget,
} from "./types";
import {
  clamp,
  clampPrIndex,
  countTotalPrs,
  cycleMergeStrategy,
  formatRelativeAge,
  openInBrowser,
  parseCompletionCommand,
  serializeCompletionOptions,
} from "./utils";
import {
  loadInitialData,
  reloadData,
  resolvePrRefFromParts,
} from "./dataController";
import { abandonPr, approvePr, completePr, completionStrategyNote, rejectPr } from "../data/azure";
import { glyph, palette } from "./theme";

export const App: React.FC = () => {
  const { exit } = useApp();
  const [state, setState] = useState<AppState>(INITIAL_STATE);

  const selectedOrg: OrganizationNode | undefined =
    state.data.organizations[state.selectedOrgIndex];
  const selectedRepo = selectedOrg?.repositories[state.selectedRepoIndex];
  const selectedPr: PullRequest | undefined =
    selectedRepo?.pullRequests[state.selectedPrIndex];

  const totalPrs = useMemo(() => countTotalPrs(state.data), [state.data]);

  const repoCount = useMemo(
    () =>
      state.data.organizations.reduce(
        (acc, org) => acc + org.repositories.length,
        0,
      ),
    [state.data],
  );

  const activePrs = useMemo(
    () =>
      state.data.organizations.reduce(
        (orgAcc, org) =>
          orgAcc +
          org.repositories.reduce(
            (repoAcc, repo) =>
              repoAcc +
              repo.pullRequests.filter((pr) => pr.status === "active").length,
            0,
          ),
        0,
      ),
    [state.data],
  );

  const moveTreeSelection = (
    orgDelta: number,
    repoDelta: number,
    banner?: string,
  ) => {
    setState((current) => {
      const nextOrgIndex = clamp(
        current.selectedOrgIndex + orgDelta,
        0,
        current.data.organizations.length - 1,
      );
      const nextOrg = current.data.organizations[nextOrgIndex];
      const nextRepoIndex = clamp(
        current.selectedRepoIndex + repoDelta,
        0,
        Math.max(0, (nextOrg?.repositories.length ?? 1) - 1),
      );
      const nextRepo = nextOrg?.repositories[nextRepoIndex];

      return {
        ...current,
        selectedOrgIndex: nextOrgIndex,
        selectedRepoIndex: nextRepoIndex,
        selectedPrIndex: clampPrIndex(nextRepo, current.selectedPrIndex),
        banner: banner ?? current.banner,
      };
    });
  };

  const doRefresh = (reason: "manual" | "auto" | "initial") => {
    if (reason !== "auto") {
      setState((current) => ({
        ...current,
        loadState: "loading",
        banner:
          reason === "initial"
            ? "Loading pull requests from Azure DevOps..."
            : "Refreshing from Azure DevOps...",
      }));
    }

    const load = reason === "initial" ? loadInitialData : reloadData;

    void load().then((result) => {
      setState((current) => {
        const orgCount = result.data.organizations.length;
        const nextOrgIndex = clamp(current.selectedOrgIndex, 0, Math.max(0, orgCount - 1));
        const nextOrg = result.data.organizations[nextOrgIndex];
        const repoCount = nextOrg?.repositories.length ?? 0;
        const nextRepoIndex = clamp(
          current.selectedRepoIndex,
          0,
          Math.max(0, repoCount - 1),
        );
        const nextRepo = nextOrg?.repositories[nextRepoIndex];

        return {
          ...current,
          data: result.data,
          selectedOrgIndex: nextOrgIndex,
          selectedRepoIndex: nextRepoIndex,
          selectedPrIndex: clampPrIndex(nextRepo, current.selectedPrIndex),
          lastRefreshISO: new Date().toISOString(),
          loadState: result.ok ? "ready" : "error",
          banner:
            reason === "auto" && result.ok
              ? `Auto-refresh synced. ${result.banner}`
              : result.banner,
        };
      });
    });
  };

  /**
   * Applies a transformer to a specific PR (matched by org URL + repo + id),
   * not by current selection, so async actions target the intended PR even if
   * the user moves the cursor before the action completes.
   */
  const transformPrById = (
    target: { organizationUrl: string; repository: string; prId: number },
    transformer: (pr: PullRequest) => PullRequest,
    successBanner: string,
  ) => {
    setState((current) => {
      let matched = false;
      const organizations = current.data.organizations.map((orgItem) => {
        if (orgItem.organizationUrl !== target.organizationUrl) {
          return orgItem;
        }
        return {
          ...orgItem,
          repositories: orgItem.repositories.map((repoItem) => {
            if (repoItem.name !== target.repository) {
              return repoItem;
            }
            return {
              ...repoItem,
              pullRequests: repoItem.pullRequests.map((prItem) => {
                if (prItem.id !== target.prId) {
                  return prItem;
                }
                matched = true;
                return transformer(prItem);
              }),
            };
          }),
        };
      });

      if (!matched) {
        return current;
      }

      return {
        ...current,
        data: { organizations },
        banner: successBanner,
      };
    });
  };

  /**
   * Executes a destructive PR action against an explicitly captured target
   * (not live selection), applying an optimistic update, calling `az`, then
   * refreshing on success. Used by the confirmation gate so the action always
   * hits the PR the user confirmed.
   */
  const runConfirmedAction = (confirm: NonNullable<AppState["pendingConfirm"]>) => {
    const { kind, target, completionOptions } = confirm;

    const optimistic = (pr: PullRequest): PullRequest => {
      switch (kind) {
        case "approve":
          return { ...pr, reviewState: "approved" };
        case "reject":
          return { ...pr, reviewState: "changes-requested" };
        case "abandon":
          return { ...pr, status: "abandoned" };
        case "complete":
          return { ...pr, status: "completed" };
      }
    };

    const pendingBanner =
      kind === "approve"
        ? "Approving PR..."
        : kind === "reject"
          ? "Rejecting PR..."
          : kind === "abandon"
            ? "Abandoning PR..."
            : "Completing PR...";

    const successBanner =
      kind === "approve"
        ? "PR approved."
        : kind === "reject"
          ? "PR rejected (changes requested)."
          : kind === "abandon"
            ? "PR abandoned."
            : `PR completed and merged. ${serializeCompletionOptions(
                completionOptions ?? DEFAULT_COMPLETION_OPTIONS,
              )}${
                completionStrategyNote(
                  completionOptions ?? DEFAULT_COMPLETION_OPTIONS,
                )
                  ? ` ${completionStrategyNote(
                      completionOptions ?? DEFAULT_COMPLETION_OPTIONS,
                    )}`
                  : ""
              }`;

    transformPrById(
      {
        organizationUrl: target.organizationUrl,
        repository: target.repository,
        prId: target.prId,
      },
      optimistic,
      pendingBanner,
    );

    const ref = resolvePrRefFromParts({
      organizationUrl: target.organizationUrl,
      project: target.project,
      repository: target.repository,
      prId: target.prId,
    });

    if (!ref) {
      setState((current) => ({
        ...current,
        banner:
          "Applied locally (no live ref: mock mode or PR missing routing info).",
      }));
      return;
    }

    const action: (r: import("../data/azure").PrRef) => Promise<void> =
      kind === "approve"
        ? approvePr
        : kind === "reject"
          ? rejectPr
          : kind === "abandon"
            ? abandonPr
            : (r) => completePr(r, completionOptions ?? DEFAULT_COMPLETION_OPTIONS);

    action(ref)
      .then(() => {
        setState((current) => ({ ...current, banner: successBanner }));
        doRefresh("auto");
      })
      .catch((cause: unknown) => {
        setState((current) => ({
          ...current,
          banner: `Action failed: ${
            cause instanceof Error ? cause.message : String(cause)
          }`,
        }));
      });
  };

  /**
   * Arms a destructive action for confirmation by capturing the currently
   * selected PR's identity. The action fires only after the user confirms.
   */
  const armConfirm = (
    kind: ConfirmKind,
    completionOptions?: CompletionOptions,
  ) => {
    if (!selectedPr) {
      setState((current) => ({ ...current, banner: "No PR selected." }));
      return;
    }
    const target: PrTarget = {
      organizationUrl: selectedPr.organizationUrl,
      project: selectedPr.project,
      repository: selectedPr.repository,
      prId: selectedPr.id,
      title: selectedPr.title,
    };
    const verb =
      kind === "approve"
        ? "Approve"
        : kind === "reject"
          ? "Reject"
          : kind === "abandon"
            ? "Abandon"
            : "Complete & merge";
    const suffix = kind === "abandon" || kind === "complete" ? " (irreversible)" : "";
    setState((current) => ({
      ...current,
      pendingConfirm: completionOptions
        ? { kind, target, completionOptions }
        : { kind, target },
      focus: kind === "complete" ? "list" : current.focus,
      banner: `${verb} PR #${target.prId} "${target.title}"${suffix}? (y/n)`,
    }));
  };

  const openCompletionEditor = (prefill: CompletionOptions) => {
    setState((current) => ({
      ...current,
      focus: "completion",
      completionOptions: prefill,
      completionCursor: 0,
      banner: "Choose completion options, then press Enter on Complete PR.",
    }));
  };

  const submitCompletion = () => {
    // Arm the irreversible merge for explicit y/n confirmation instead of
    // firing it directly on a single Enter.
    const options = state.completionOptions;
    setState((current) => ({
      ...current,
      focus: "list",
      commandText: "",
      completionCursor: 0,
    }));
    armConfirm("complete", options);
  };

  const executeCommand = (rawCommand: string) => {
    const command = rawCommand.trim().toLowerCase();

    if (!command) {
      setState((current) => ({
        ...current,
        focus: "list",
        commandText: "",
        banner: "Command cancelled.",
      }));
      return;
    }

    if (command === "help") {
      setState((current) => ({
        ...current,
        focus: "list",
        commandText: "",
        banner:
          "Commands: help, refresh, toggle-auto, approve, reject, complete, abandon, open, quit",      }));
      return;
    }

    if (command === "refresh") {
      doRefresh("manual");
      setState((current) => ({ ...current, focus: "list", commandText: "" }));
      return;
    }

    if (command === "toggle-auto") {
      setState((current) => ({
        ...current,
        autoRefresh: !current.autoRefresh,
        focus: "list",
        commandText: "",
        banner: !current.autoRefresh
          ? "Auto-refresh enabled."
          : "Auto-refresh disabled.",
      }));
      return;
    }

    if (command === "approve") {
      setState((current) => ({ ...current, focus: "list", commandText: "" }));
      armConfirm("approve");
      return;
    }

    if (command === "reject") {
      setState((current) => ({ ...current, focus: "list", commandText: "" }));
      armConfirm("reject");
      return;
    }

    if (command.startsWith("complete")) {
      openCompletionEditor(parseCompletionCommand(rawCommand));
      return;
    }

    if (command === "abandon") {
      setState((current) => ({ ...current, focus: "list", commandText: "" }));
      armConfirm("abandon");
      return;
    }

    if (command === "open") {
      if (selectedPr) {
        openInBrowser(selectedPr.url);
        setState((current) => ({
          ...current,
          focus: "list",
          commandText: "",
          banner: "Opened PR in browser.",
        }));
      } else {
        setState((current) => ({
          ...current,
          focus: "list",
          commandText: "",
          banner: "No PR selected.",
        }));
      }
      return;
    }

    if (command === "quit") {
      exit();
      return;
    }

    setState((current) => ({
      ...current,
      focus: "list",
      commandText: "",
      banner: `Unknown command: ${command}`,
    }));
  };

  useEffect(() => {
    // Initial data load from Azure DevOps (or mock) on mount.
    doRefresh("initial");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!state.autoRefresh) {
      return;
    }

    const timer = setInterval(() => {
      doRefresh("auto");
    }, REFRESH_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [state.autoRefresh]);

  useEffect(() => {
    // Auto-show files view when a PR is selected
    if (selectedPr) {
      setState((current) => ({
        ...current,
        focus: "files",
        selectedFileIndex: 0,
        banner: "Files view. Press 'd' for details, 'h' for PR list.",
      }));
    }
  }, [selectedPr?.id]);

  useInput((input, key) => {
    if (key.ctrl && input === "c") {
      exit();
      return;
    }

    // Confirmation gate for destructive vote actions (approve/reject).
    if (state.pendingConfirm) {
      const confirmed = input === "y" || key.return;
      const pending = state.pendingConfirm;
      setState((current) => ({ ...current, pendingConfirm: null }));

      if (!confirmed) {
        setState((current) => ({
          ...current,
          banner: `${pending.kind} cancelled.`,
        }));
        return;
      }

      runConfirmedAction(pending);
      return;
    }

    if (state.focus === "completion") {
      if (key.escape) {
        setState((current) => ({
          ...current,
          focus: "list",
          banner: "Completion cancelled.",
        }));
        return;
      }

      // Cursors 4, 5, 6 are free-text fields — only arrow keys navigate there.
      const isTextField = state.completionCursor >= 4 && state.completionCursor <= 6;

      if (key.upArrow || (!isTextField && input === "k")) {
        setState((current) => ({
          ...current,
          completionCursor: clamp(
            current.completionCursor - 1,
            0,
            COMPLETION_FIELD_COUNT - 1,
          ),
        }));
        return;
      }

      if (key.downArrow || (!isTextField && input === "j")) {
        setState((current) => ({
          ...current,
          completionCursor: clamp(
            current.completionCursor + 1,
            0,
            COMPLETION_FIELD_COUNT - 1,
          ),
        }));
        return;
      }

      if (key.tab) {
        setState((current) => ({
          ...current,
          completionCursor: clamp(
            current.completionCursor + 1,
            0,
            COMPLETION_FIELD_COUNT - 1,
          ),
        }));
        return;
      }

      if (key.return) {
        if (state.completionCursor === COMPLETION_FIELD_COUNT - 1) {
          submitCompletion();
        } else {
          setState((current) => ({
            ...current,
            completionCursor: clamp(
              current.completionCursor + 1,
              0,
              COMPLETION_FIELD_COUNT - 1,
            ),
          }));
        }

        return;
      }

      setState((current) => {
        const cursor = current.completionCursor;
        const options = current.completionOptions;

        if (cursor === 0 && (key.leftArrow || input === "h")) {
          const nextStrategy = cycleMergeStrategy(options.mergeStrategy, -1);
          return {
            ...current,
            completionOptions: {
              ...options,
              mergeStrategy: nextStrategy,
              squashMerge: nextStrategy === "squash",
            },
          };
        }

        if (cursor === 0 && (key.rightArrow || input === "l")) {
          const nextStrategy = cycleMergeStrategy(options.mergeStrategy, 1);
          return {
            ...current,
            completionOptions: {
              ...options,
              mergeStrategy: nextStrategy,
              squashMerge: nextStrategy === "squash",
            },
          };
        }

        if (
          cursor === 1 &&
          (key.leftArrow || key.rightArrow || input === " ")
        ) {
          return {
            ...current,
            completionOptions: {
              ...options,
              deleteSourceBranch: !options.deleteSourceBranch,
            },
          };
        }

        if (
          cursor === 2 &&
          (key.leftArrow || key.rightArrow || input === " ")
        ) {
          return {
            ...current,
            completionOptions: {
              ...options,
              transitionWorkItems: !options.transitionWorkItems,
            },
          };
        }

        if (
          cursor === 3 &&
          (key.leftArrow || key.rightArrow || input === " ")
        ) {
          return {
            ...current,
            completionOptions: {
              ...options,
              bypassPolicy: !options.bypassPolicy,
            },
          };
        }

        if (cursor === 4) {
          if (key.backspace || key.delete) {
            return {
              ...current,
              completionOptions: {
                ...options,
                bypassReason: options.bypassReason.slice(0, -1),
              },
            };
          }

          if (!key.ctrl && !key.meta && input && input !== " ") {
            return {
              ...current,
              completionOptions: {
                ...options,
                bypassReason: `${options.bypassReason}${input}`,
              },
            };
          }
        }

        if (cursor === 5) {
          if (key.backspace || key.delete) {
            return {
              ...current,
              completionOptions: {
                ...options,
                mergeCommitMessage: options.mergeCommitMessage.slice(0, -1),
              },
            };
          }

          if (!key.ctrl && !key.meta && input && input !== " ") {
            return {
              ...current,
              completionOptions: {
                ...options,
                mergeCommitMessage: `${options.mergeCommitMessage}${input}`,
              },
            };
          }
        }

        if (cursor === 6) {
          if (key.backspace || key.delete) {
            return {
              ...current,
              completionOptions: {
                ...options,
                autoCompleteIgnoreConfigIds:
                  options.autoCompleteIgnoreConfigIds.slice(0, -1),
              },
            };
          }

          if (!key.ctrl && !key.meta && input && /[0-9,\s]/.test(input)) {
            const text =
              `${options.autoCompleteIgnoreConfigIds.join(",")}${input}`.replace(
                /\s+/g,
                "",
              );
            return {
              ...current,
              completionOptions: {
                ...options,
                autoCompleteIgnoreConfigIds: text
                  .split(",")
                  .map((entry) => Number(entry.trim()))
                  .filter((entry) => Number.isFinite(entry)),
              },
            };
          }
        }

        if (
          cursor === 7 &&
          (key.leftArrow || key.rightArrow || input === " ")
        ) {
          const nextSquash = !options.squashMerge;
          return {
            ...current,
            completionOptions: {
              ...options,
              squashMerge: nextSquash,
              mergeStrategy: nextSquash
                ? "squash"
                : options.mergeStrategy === "squash"
                  ? "noFastForward"
                  : options.mergeStrategy,
            },
          };
        }

        return current;
      });

      return;
    }

    if (state.focus === "command") {
      if (key.escape) {
        setState((current) => ({
          ...current,
          focus: "list",
          commandText: "",
          banner: "Command cancelled.",
        }));
        return;
      }

      if (key.return) {
        executeCommand(state.commandText);
        return;
      }

      if (key.backspace || key.delete) {
        setState((current) => ({
          ...current,
          commandText: current.commandText.slice(0, -1),
        }));
        return;
      }

      if (!key.ctrl && !key.meta && input) {
        setState((current) => ({
          ...current,
          commandText: `${current.commandText}${input}`,
        }));
      }

      return;
    }

    if (input === "/") {
      setState((current) => ({
        ...current,
        focus: "command",
        commandText: "",
        banner: "Command mode.",
      }));
      return;
    }

    if (input === "q") {
      exit();
      return;
    }

    if (input === "r") {
      doRefresh("manual");
      return;
    }

    if (input === "a") {
      armConfirm("approve");
      return;
    }

    if (input === "x") {
      armConfirm("reject");
      return;
    }

    if (input === "c") {
      openCompletionEditor(DEFAULT_COMPLETION_OPTIONS);
      return;
    }

    if (input === "o" && selectedPr) {
      openInBrowser(selectedPr.url);
      setState((current) => ({ ...current, banner: "Opened PR in browser." }));
      return;
    }

    if (input === "u") {
      setState((current) => ({
        ...current,
        diffViewMode: "unified",
        banner: "Diff mode: unified.",
      }));
      return;
    }

    if (input === "s") {
      setState((current) => ({
        ...current,
        diffViewMode: "split",
        banner: "Diff mode: split.",
      }));
      return;
    }

    if (key.tab) {
      setState((current) => {
        const nextIndex =
          (FOCUS_ORDER.indexOf(current.focus) + 1) % FOCUS_ORDER.length;
        const nextFocus = FOCUS_ORDER[nextIndex] ?? "tree";
        return {
          ...current,
          focus: nextFocus === "command" ? "tree" : nextFocus,
          banner: `Focus: ${nextFocus === "command" ? "tree" : nextFocus}`,
        };
      });
      return;
    }

    if (state.focus === "tree") {
      if (input === "j" || key.downArrow) {
        moveTreeSelection(0, 1);
      }

      if (input === "k" || key.upArrow) {
        moveTreeSelection(0, -1);
      }

      if (input === "l" || key.rightArrow) {
        moveTreeSelection(1, 0, "Organization changed.");
      }

      if (input === "h" || key.leftArrow) {
        moveTreeSelection(-1, 0, "Organization changed.");
      }

      return;
    }

    if (state.focus === "list") {
      const maxPrIndex = Math.max(
        0,
        (selectedRepo?.pullRequests.length ?? 1) - 1,
      );

      if (input === "j" || key.downArrow) {
        setState((current) => ({
          ...current,
          selectedPrIndex: clamp(current.selectedPrIndex + 1, 0, maxPrIndex),
        }));
      }

      if (input === "k" || key.upArrow) {
        setState((current) => ({
          ...current,
          selectedPrIndex: clamp(current.selectedPrIndex - 1, 0, maxPrIndex),
        }));
      }

      if (input === "h" || key.leftArrow) {
        setState((current) => ({
          ...current,
          focus: "tree",
          banner: "Focus: tree",
        }));
      }

      if (input === "l" || key.rightArrow) {
        setState((current) => ({
          ...current,
          focus: "detail",
          banner: "Focus: detail",
        }));
      }
      return;
    }

    if (state.focus === "detail") {
      if (input === "h" || key.leftArrow) {
        setState((current) => ({
          ...current,
          focus: "list",
          banner: "Focus: list",
        }));
      }

      if (input === "l" || key.rightArrow) {
        setState((current) => ({
          ...current,
          focus: "files",
          selectedFileIndex: 0,
          banner: "Focus: files",
        }));
      }
      return;
    }

    if (state.focus === "files") {
      const maxFileIndex = Math.max(
        0,
        (selectedPr?.changedFiles.length ?? 1) - 1,
      );

      if (input === "j" || key.downArrow) {
        setState((current) => ({
          ...current,
          selectedFileIndex: clamp(
            current.selectedFileIndex + 1,
            0,
            maxFileIndex,
          ),
        }));
      }

      if (input === "k" || key.upArrow) {
        setState((current) => ({
          ...current,
          selectedFileIndex: clamp(
            current.selectedFileIndex - 1,
            0,
            maxFileIndex,
          ),
        }));
      }

      if (input === "h" || key.leftArrow) {
        setState((current) => ({
          ...current,
          focus: "list",
          banner: "Focus: list",
        }));
      }

      if (input === "d") {
        setState((current) => ({
          ...current,
          focus: "detail",
          banner: "Focus: detail. Press 'h' for files, 'd' for PR list.",
        }));
      }
      return;
    }
  });

  return (
    <Box flexDirection="column" padding={1}>
      <Box justifyContent="space-between">
        <Box>
          <Text color={palette.accent} bold>
            {glyph.dot} adotui
          </Text>
          <Text color={palette.muted}> Azure DevOps PR Monitor</Text>
        </Box>
        <Text color={palette.muted}>
          {process.platform} {glyph.bullet} bun {Bun.version}
        </Text>
      </Box>

      <Box marginTop={1}>
        <Text
          color={
            state.loadState === "error"
              ? palette.danger
              : state.pendingConfirm
                ? palette.warn
                : state.loadState === "loading"
                  ? palette.warn
                  : palette.text
          }
        >
          {state.loadState === "loading" ? `${glyph.clock} ` : ""}
          {state.banner}
        </Text>
      </Box>

      <SummaryBar
        activePrs={activePrs}
        totalPrs={totalPrs}
        orgCount={state.data.organizations.length}
        repoCount={repoCount}
        autoRefresh={state.autoRefresh}
        relativeLastRefresh={formatRelativeAge(state.lastRefreshISO)}
        loadState={state.loadState}
      />

      <Box marginTop={1}>
        <OrganizationTree
          data={state.data}
          selectedOrgIndex={state.selectedOrgIndex}
          selectedRepoIndex={state.selectedRepoIndex}
          focus={state.focus}
        />

        <Box flexGrow={1} marginLeft={1} flexDirection="column">
          <PullRequestList
            pullRequests={selectedRepo?.pullRequests ?? []}
            repoName={selectedRepo?.name}
            selectedPrIndex={state.selectedPrIndex}
            focus={state.focus}
          />
          {state.focus === "files" ? (
            <FilesView
              selectedPr={selectedPr}
              selectedFileIndex={state.selectedFileIndex}
              focus={state.focus}
              diffViewMode={state.diffViewMode}
            />
          ) : (
            <PrDetails selectedPr={selectedPr} focus={state.focus} />
          )}
        </Box>
      </Box>

      <CommandBar
        focus={state.focus}
        commandText={state.commandText}
        pendingConfirm={state.pendingConfirm}
      />

      <Box marginTop={1} flexWrap="wrap">
        <Text color={palette.muted}>
          <Text color={palette.accentDim}>tab</Text> focus{"   "}
          <Text color={palette.accentDim}>j/k</Text> move{"   "}
          <Text color={palette.accentDim}>h/l</Text> panes{"   "}
          <Text color={palette.accentDim}>/</Text> command{"   "}
          <Text color={palette.accentDim}>r</Text> refresh{"   "}
          <Text color={palette.ok}>a</Text> approve{"   "}
          <Text color={palette.danger}>x</Text> reject{"   "}
          <Text color={palette.info}>c</Text> complete{"   "}
          <Text color={palette.accentDim}>o</Text> open{"   "}
          <Text color={palette.accentDim}>u/s</Text> diff{"   "}
          <Text color={palette.accentDim}>q</Text> quit
        </Text>
      </Box>

      <CompletionEditor state={state} />
    </Box>
  );
};
