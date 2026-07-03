import { useEffect, useMemo, useState } from "react";
import type { OrganizationNode, PullRequest } from "../../domain/types";
import {
  DEFAULT_COMPLETION_OPTIONS,
  INITIAL_STATE,
  REFRESH_INTERVAL_MS,
} from "../constants";
import type {
  AppState,
  CompletionOptions,
  ConfirmKind,
  PrTarget,
} from "../types";
import {
  clamp,
  clampPrIndex,
  countTotalPrs,
  openInBrowser,
  parseCompletionCommand,
  serializeCompletionOptions,
} from "../utils";
import {
  loadInitialData,
  reloadData,
  resolvePrRefFromParts,
} from "../dataController";
import { abandonPr, approvePr, completePr, completionStrategyNote, rejectPr } from "../../data/azure";

export function useAppState(exitApp: () => void) {
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

  const transformPrById = (
    target: { organizationUrl: string; repository: string; prId: number },
    transformer: (pr: PullRequest) => PullRequest,
    successBanner: string,
    newLoadState?: import("../types").LoadState,
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
        data: { ...current.data, organizations },
        banner: successBanner,
        ...(newLoadState ? { loadState: newLoadState } : {}),
      };
    });
  };

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
      "loading"
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

    const action: (r: import("../../data/azure").PrRef) => Promise<void> =
      kind === "approve"
        ? approvePr
        : kind === "reject"
          ? rejectPr
          : kind === "abandon"
            ? abandonPr
            : (r) => completePr(r, completionOptions ?? DEFAULT_COMPLETION_OPTIONS);

    action(ref)
      .then(() => {
        setState((current) => ({ ...current, banner: successBanner, loadState: "ready" }));
        doRefresh("auto");
      })
      .catch((cause: unknown) => {
        setState((current) => ({
          ...current,
          banner: `Action failed: ${
            cause instanceof Error ? cause.message : String(cause)
          }`,
          loadState: "error",
        }));
      });
  };

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
      exitApp();
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
    if (selectedPr) {
      setState((current) => ({
        ...current,
        focus: "files",
        selectedFileIndex: 0,
        diffScrollOffset: 0,
        banner: "Files view. Press 'd' for details, 'h' for PR list.",
      }));
    }
  }, [selectedPr?.id]);

  return {
    state,
    setState,
    selectedOrg,
    selectedRepo,
    selectedPr,
    totalPrs,
    repoCount,
    activePrs,
    actions: {
      moveTreeSelection,
      doRefresh,
      armConfirm,
      runConfirmedAction,
      openCompletionEditor,
      submitCompletion,
      executeCommand,
    },
  };
}
