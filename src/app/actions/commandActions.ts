import { openInBrowser, parseCompletionCommand } from "../utils";
import { getState, patchState, updateState } from "../store";
import { selectSelectedPr } from "../selectors";
import { armConfirm } from "./confirmActions";
import { openCompletionEditor } from "./completionActions";
import { doRefresh } from "./refreshActions";

export const executeCommand = (rawCommand: string, exitApp: () => void): void => {
  const command = rawCommand.trim().toLowerCase();

  if (!command) {
    updateState((c) => ({ focus: c.previousFocus ?? "list", commandText: "", banner: "Command cancelled." }));
    return;
  }
  if (command === "help") {
    updateState((c) => ({ previousFocus: c.focus, focus: "help", commandText: "", banner: "Help view" }));
    return;
  }
  if (command === "refresh") {
    doRefresh("manual");
    patchState({ focus: "list", commandText: "" });
    return;
  }
  if (command === "toggle-auto") {
    updateState((c) => ({
      autoRefresh: !c.autoRefresh,
      focus: "list",
      commandText: "",
      banner: !c.autoRefresh ? "Auto-refresh enabled." : "Auto-refresh disabled.",
    }));
    return;
  }
  if (command === "approve") {
    patchState({ focus: "list", commandText: "" });
    armConfirm("approve");
    return;
  }
  if (command === "reject") {
    patchState({ focus: "list", commandText: "" });
    armConfirm("reject");
    return;
  }
  if (command.startsWith("filter ")) {
    const query = command.slice(7).trim();
    patchState({ focus: "tree", commandText: "", treeFilter: query, banner: `Tree filter applied: ${query}` });
    return;
  }
  if (command === "filter") {
    patchState({ focus: "tree", commandText: "", treeFilter: "all", banner: "Tree filter cleared." });
    return;
  }
  if (command.startsWith("find ")) {
    const query = command.slice(5).trim();
    patchState({ focus: "files", commandText: "", fileFilter: query, selectedFileIndex: 0, banner: `File filter applied: ${query}` });
    return;
  }
  if (command === "find") {
    patchState({ focus: "files", commandText: "", fileFilter: "", banner: "File filter cleared." });
    return;
  }
  if (command === "reset" || command === "clear") {
    patchState({
      focus: "list",
      commandText: "",
      treeFilter: "all",
      fileFilter: "",
      banner: "All filters reset.",
    });
    return;
  }
  if (command.startsWith("complete")) {
    openCompletionEditor(parseCompletionCommand(rawCommand));
    return;
  }
  if (command === "abandon") {
    patchState({ focus: "list", commandText: "" });
    armConfirm("abandon");
    return;
  }
  if (command === "open") {
    const selectedPr = selectSelectedPr(getState());
    if (selectedPr) {
      openInBrowser(selectedPr.url);
      patchState({ focus: "list", commandText: "", banner: "Opened PR in browser." });
    } else {
      patchState({ focus: "list", commandText: "", banner: "No PR selected." });
    }
    return;
  }
  if (command === "quit") {
    exitApp();
    process.exit(0);
    return;
  }
  patchState({ focus: "list", commandText: "", banner: `Unknown command: ${command}` });
};
