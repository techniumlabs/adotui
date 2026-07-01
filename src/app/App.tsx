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
import { OrganizationTree } from "./components/OrganizationTree";
import { PrDetails } from "./components/PrDetails";
import { PullRequestList } from "./components/PullRequestList";
import { SummaryBar } from "./components/SummaryBar";
import type { AppState, CompletionOptions } from "./types";
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

export const App: React.FC = () => {
  const { exit } = useApp();
  const [state, setState] = useState<AppState>(INITIAL_STATE);

  const selectedOrg: OrganizationNode | undefined =
    state.data.organizations[state.selectedOrgIndex];
  const selectedRepo = selectedOrg?.repositories[state.selectedRepoIndex];
  const selectedPr: PullRequest | undefined =
    selectedRepo?.pullRequests[state.selectedPrIndex];

  const totalPrs = useMemo(() => countTotalPrs(state.data), [state.data]);

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
      const nextRepoIndex = clampPrIndex(
        nextOrg?.repositories[current.selectedRepoIndex],
        current.selectedRepoIndex + repoDelta,
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

  const doRefresh = (reason: "manual" | "auto") => {
    setState((current) => ({
      ...current,
      lastRefreshISO: new Date().toISOString(),
      banner:
        reason === "manual"
          ? "Manual refresh complete."
          : "Auto-refresh synced.",
    }));
  };

  const applyPrAction = (
    transformer: (pr: PullRequest) => PullRequest,
    successBanner: string,
  ) => {
    setState((current) => {
      const org = current.data.organizations[current.selectedOrgIndex];
      const repo = org?.repositories[current.selectedRepoIndex];
      const pr = repo?.pullRequests[current.selectedPrIndex];

      if (!org || !repo || !pr) {
        return { ...current, banner: "No PR selected." };
      }

      const organizations = current.data.organizations.map(
        (orgItem, orgIndex) => {
          if (orgIndex !== current.selectedOrgIndex) {
            return orgItem;
          }

          return {
            ...orgItem,
            repositories: orgItem.repositories.map((repoItem, repoIndex) => {
              if (repoIndex !== current.selectedRepoIndex) {
                return repoItem;
              }

              return {
                ...repoItem,
                pullRequests: repoItem.pullRequests.map((prItem, prIndex) =>
                  prIndex === current.selectedPrIndex
                    ? transformer(prItem)
                    : prItem,
                ),
              };
            }),
          };
        },
      );

      return {
        ...current,
        data: { organizations },
        banner: successBanner,
      };
    });
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
    if (selectedPr?.reviewState !== "approved") {
      setState((current) => ({
        ...current,
        banner: "Approve the PR before completing it.",
      }));
      return;
    }

    applyPrAction(
      (pr) => ({ ...pr, status: "completed" }),
      `PR completed and merged. ${serializeCompletionOptions(state.completionOptions)}`,
    );

    setState((current) => ({
      ...current,
      focus: "list",
      commandText: "",
      completionCursor: 0,
    }));
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
          "Commands: help, refresh, toggle-auto, approve, reject, complete, abandon, open, quit",
      }));
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
      applyPrAction(
        (pr) => ({ ...pr, reviewState: "approved" }),
        "PR marked as approved (mock).",
      );
      setState((current) => ({ ...current, focus: "list", commandText: "" }));
      return;
    }

    if (command === "reject") {
      applyPrAction(
        (pr) => ({ ...pr, reviewState: "changes-requested" }),
        "PR marked as rejected (mock).",
      );
      setState((current) => ({ ...current, focus: "list", commandText: "" }));
      return;
    }

    if (command.startsWith("complete")) {
      openCompletionEditor(parseCompletionCommand(rawCommand));
      return;
    }

    if (command === "abandon") {
      applyPrAction(
        (pr) => ({ ...pr, status: "abandoned" }),
        "PR marked as abandoned (mock).",
      );
      setState((current) => ({ ...current, focus: "list", commandText: "" }));
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
    if (!state.autoRefresh) {
      return;
    }

    const timer = setInterval(() => {
      doRefresh("auto");
    }, REFRESH_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [state.autoRefresh]);

  useInput((input, key) => {
    if (key.ctrl && input === "c") {
      exit();
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

      if (key.upArrow || input === "k") {
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

      if (key.downArrow || input === "j") {
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
      applyPrAction(
        (pr) => ({ ...pr, reviewState: "approved" }),
        "PR marked as approved (mock).",
      );
      return;
    }

    if (input === "x") {
      applyPrAction(
        (pr) => ({ ...pr, reviewState: "changes-requested" }),
        "PR marked as rejected (mock).",
      );
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
    }
  });

  return (
    <Box flexDirection="column" padding={1}>
      <Box justifyContent="space-between">
        <Text color="cyanBright">adotui</Text>
        <Text color="gray">
          {process.platform} | bun {Bun.version}
        </Text>
      </Box>

      <Box>
        <Text color="whiteBright">Azure DevOps PR Monitor</Text>
        <Text color="gray"> | grouped by organization and repository</Text>
      </Box>

      <Box marginTop={1}>
        <Text color="yellow">{state.banner}</Text>
      </Box>

      <SummaryBar
        activePrs={activePrs}
        totalPrs={totalPrs}
        orgCount={state.data.organizations.length}
        autoRefresh={state.autoRefresh}
        relativeLastRefresh={formatRelativeAge(state.lastRefreshISO)}
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
          <PrDetails
            selectedPr={selectedPr}
            focus={state.focus}
            diffViewMode={state.diffViewMode}
          />
        </Box>
      </Box>

      <CommandBar focus={state.focus} commandText={state.commandText} />

      <Box marginTop={1}>
        <Text color="gray">
          keys: tab focus | tree: j/k repos, h/l orgs | list/detail: h/l panes |
          / command | r refresh | a approve | x reject | c complete | o open | u
          unified | s split | q quit
        </Text>
      </Box>

      <CompletionEditor state={state} />
    </Box>
  );
};
