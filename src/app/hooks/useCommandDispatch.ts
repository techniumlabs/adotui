import type { Dispatch, SetStateAction } from "react";
import type { PullRequest } from "../../domain/types";
import type { AppState, CompletionOptions, ConfirmKind } from "../types";
import { openInBrowser, parseCompletionCommand } from "../utils";

type ArmConfirm = (kind: ConfirmKind, options?: CompletionOptions) => void;
type DoRefresh = (reason: "manual" | "auto" | "initial") => void;
type OpenCompletionEditor = (prefill: CompletionOptions) => void;

export function useCommandDispatch(
  setState: Dispatch<SetStateAction<AppState>>,
  selectedPr: PullRequest | undefined,
  doRefresh: DoRefresh,
  armConfirm: ArmConfirm,
  openCompletionEditor: OpenCompletionEditor,
  exitApp: () => void,
) {
  const executeCommand = (rawCommand: string) => {
    const command = rawCommand.trim().toLowerCase();

    if (!command) {
      setState((c) => ({ ...c, focus: "list", commandText: "", banner: "Command cancelled." }));
      return;
    }
    if (command === "help") {
      setState((c) => ({ ...c, previousFocus: c.focus, focus: "help", commandText: "", banner: "Help view" }));
      return;
    }
    if (command === "refresh") {
      doRefresh("manual");
      setState((c) => ({ ...c, focus: "list", commandText: "" }));
      return;
    }
    if (command === "toggle-auto") {
      setState((c) => ({
        ...c,
        autoRefresh: !c.autoRefresh,
        focus: "list",
        commandText: "",
        banner: !c.autoRefresh ? "Auto-refresh enabled." : "Auto-refresh disabled.",
      }));
      return;
    }
    if (command === "approve") {
      setState((c) => ({ ...c, focus: "list", commandText: "" }));
      armConfirm("approve");
      return;
    }
    if (command === "reject") {
      setState((c) => ({ ...c, focus: "list", commandText: "" }));
      armConfirm("reject");
      return;
    }
    if (command.startsWith("filter ")) {
      const query = command.slice(7).trim();
      setState((c) => ({ ...c, focus: "tree", commandText: "", treeFilter: query, banner: `Tree filter applied: ${query}` }));
      return;
    }
    if (command === "filter") {
      setState((c) => ({ ...c, focus: "tree", commandText: "", treeFilter: "all", banner: "Tree filter cleared." }));
      return;
    }
    if (command.startsWith("find ")) {
      const query = command.slice(5).trim();
      setState((c) => ({ ...c, focus: "files", commandText: "", fileFilter: query, selectedFileIndex: 0, banner: `File filter applied: ${query}` }));
      return;
    }
    if (command === "find") {
      setState((c) => ({ ...c, focus: "files", commandText: "", fileFilter: "", banner: "File filter cleared." }));
      return;
    }
    if (command.startsWith("complete")) {
      openCompletionEditor(parseCompletionCommand(rawCommand));
      return;
    }
    if (command === "abandon") {
      setState((c) => ({ ...c, focus: "list", commandText: "" }));
      armConfirm("abandon");
      return;
    }
    if (command === "open") {
      if (selectedPr) {
        openInBrowser(selectedPr.url);
        setState((c) => ({ ...c, focus: "list", commandText: "", banner: "Opened PR in browser." }));
      } else {
        setState((c) => ({ ...c, focus: "list", commandText: "", banner: "No PR selected." }));
      }
      return;
    }
    if (command === "quit") {
      exitApp();
      process.exit(0);
      return;
    }
    setState((c) => ({ ...c, focus: "list", commandText: "", banner: `Unknown command: ${command}` }));
  };

  return { executeCommand };
}
