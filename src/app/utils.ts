import type { AppData, PullRequest, PullRequestFileChange, ReviewState } from "../domain/types";
import { DEFAULT_COMPLETION_OPTIONS } from "./constants";
import type { CompletionOptions, MergeStrategy } from "./types";

export const clamp = (value: number, min: number, max: number): number => {
  if (max < min) {
    return min;
  }

  return Math.max(min, Math.min(max, value));
};

export const countTotalPrs = (data: AppData): number =>
  data.organizations.reduce(
    (orgAcc, org) =>
      orgAcc +
      org.repositories.reduce(
        (repoAcc, repo) => repoAcc + repo.pullRequests.length,
        0,
      ),
    0,
  );

export const countActivePrs = (data: AppData): number =>
  data.organizations.reduce(
    (orgAcc, org) =>
      orgAcc +
      org.repositories.reduce(
        (repoAcc, repo) =>
          repoAcc + repo.pullRequests.filter((pr) => pr.status === "active").length,
        0,
      ),
    0,
  );

export const formatRelativeAge = (isoDate: string): string => {
  const now = Date.now();
  const deltaMs = Math.max(0, now - Date.parse(isoDate));
  const minutes = Math.floor(deltaMs / 60_000);

  if (minutes < 1) {
    return "just now";
  }

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours}h ago`;
  }

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

export const reviewColor = (reviewState: ReviewState): string => {
  if (reviewState === "approved") {
    return "green";
  }

  if (reviewState === "changes-requested") {
    return "red";
  }

  return "yellow";
};

export const fileChangeColor = (status: PullRequestFileChange["status"]): string => {
  if (status === "added") {
    return "green";
  }

  if (status === "deleted") {
    return "red";
  }

  return "cyan";
};

export const clampPrIndex = (
  repo: { pullRequests: PullRequest[] } | undefined,
  index: number,
): number => clamp(index, 0, Math.max(0, (repo?.pullRequests.length ?? 1) - 1));

export const matchesTreeFilter = (pr: PullRequest, filterStr: string): boolean => {
  if (!filterStr || filterStr === "all" || filterStr === "with-prs") return true;

  const parts = filterStr.split(/\s+/);
  for (const part of parts) {
    if (part.includes(":")) {
      const idx = part.indexOf(":");
      const key = part.slice(0, idx).toLowerCase();
      const value = part.slice(idx + 1).toLowerCase();

      switch (key) {
        case "author":
          if (!pr.author.toLowerCase().includes(value)) return false;
          break;
        case "merge":
          if (!pr.mergeStatus.toLowerCase().includes(value)) return false;
          break;
        case "title":
          if (!pr.title.toLowerCase().includes(value)) return false;
          break;
        case "description":
          // Not currently supported — filter returns no match to avoid silent aliasing.
          return false;
        case "tag":
          if (!pr.tags?.some(tag => tag.toLowerCase().includes(value))) return false;
          break;
        default:
          break;
      }
    } else {
      const val = part.toLowerCase();
      if (!pr.title.toLowerCase().includes(val) && !pr.author.toLowerCase().includes(val)) {
        return false;
      }
    }
  }
  return true;
};

export const getVisiblePrs = (
  repo: { pullRequests: PullRequest[] } | undefined,
  treeFilter: string,
): PullRequest[] => {
  if (!repo) return [];
  let prs = repo.pullRequests;
  if (treeFilter !== "all" && treeFilter !== "with-prs") {
    prs = prs.filter((pr) => matchesTreeFilter(pr, treeFilter));
  }
  return prs;
};

export const cycleMergeStrategy = (
  current: MergeStrategy,
  delta: 1 | -1,
): MergeStrategy => {
  const values: MergeStrategy[] = [
    "noFastForward",
    "squash",
    "rebase",
    "rebaseMerge",
  ];
  const currentIndex = values.indexOf(current);
  const nextIndex = (currentIndex + delta + values.length) % values.length;
  return values[nextIndex] ?? current;
};

export const serializeCompletionOptions = (options: CompletionOptions): string => {
  const parts = [
    `strategy=${options.mergeStrategy}`,
    `delete-branch=${options.deleteSourceBranch ? "yes" : "no"}`,
    `transition-work-items=${options.transitionWorkItems ? "yes" : "no"}`,
    `bypass-policy=${options.bypassPolicy ? "yes" : "no"}`,
  ];

  if (options.mergeCommitMessage) {
    parts.push(`message=${options.mergeCommitMessage}`);
  }

  if (options.bypassReason) {
    parts.push(`bypass-reason=${options.bypassReason}`);
  }

  if (options.autoCompleteIgnoreConfigIds.length > 0) {
    parts.push(
      `ignore-config-ids=${options.autoCompleteIgnoreConfigIds.join(",")}`,
    );
  }

  if (options.squashMerge) {
    parts.push("squash-merge=deprecated-on");
  }

  return parts.join(" | ");
};

export const parseCompletionCommand = (rawCommand: string): CompletionOptions => {
  const options = { ...DEFAULT_COMPLETION_OPTIONS };
  const tokens = rawCommand.match(/(?:[^\s"]+|"[^"]*")+/g) ?? [];

  for (const token of tokens) {
    if (token === "complete") {
      continue;
    }

    if (token === "--delete-source-branch") {
      options.deleteSourceBranch = true;
      continue;
    }

    if (token === "--no-delete-source-branch") {
      options.deleteSourceBranch = false;
      continue;
    }

    if (token === "--transition-work-items") {
      options.transitionWorkItems = true;
      continue;
    }

    if (token === "--no-transition-work-items") {
      options.transitionWorkItems = false;
      continue;
    }

    if (token === "--bypass-policy") {
      options.bypassPolicy = true;
      continue;
    }

    if (token === "--no-bypass-policy") {
      options.bypassPolicy = false;
      continue;
    }

    if (token === "--squash-merge") {
      options.squashMerge = true;
      options.mergeStrategy = "squash";
      continue;
    }

    const [rawKey, ...rawValueParts] = token.replace(/^--/, "").split("=");
    const value = rawValueParts.join("=").replace(/^"|"$/g, "");

    switch (rawKey) {
      case "merge-strategy":
        if (
          value === "noFastForward" ||
          value === "squash" ||
          value === "rebase" ||
          value === "rebaseMerge"
        ) {
          options.mergeStrategy = value;
          options.squashMerge = value === "squash";
        }
        break;
      case "merge-commit-message":
        options.mergeCommitMessage = value;
        break;
      case "bypass-reason":
        options.bypassReason = value;
        break;
      case "auto-complete-ignore-config-ids":
        options.autoCompleteIgnoreConfigIds = value
          .split(",")
          .map((entry) => Number(entry.trim()))
          .filter((entry) => Number.isFinite(entry));
        break;
    }
  }

  return options;
};

export const openInBrowser = (url: string): void => {
  const platform = process.platform;
  const cmd =
    platform === "darwin"
      ? ["open", url]
      : platform === "win32"
        ? ["cmd", "/c", "start", "", url]
        : ["xdg-open", url];

  Bun.spawn({ cmd, stdout: "ignore", stderr: "ignore" });
};

const ensureDiffPrefix = (line: string): string => {
  if (line.startsWith("+") || line.startsWith("-") || line.startsWith(" ")) {
    return line;
  }

  return ` ${line}`;
};

export const inferFileLangFromPath = (path: string): string => {
  const extension = path.split(".").pop()?.toLowerCase() ?? "";

  switch (extension) {
    case "ts":
    case "tsx":
      return "typescript";
    case "js":
    case "jsx":
      return "javascript";
    case "json":
      return "json";
    case "md":
      return "markdown";
    case "yml":
    case "yaml":
      return "yaml";
    default:
      return "text";
  }
};

export const buildTerminalDiffData = (fileChange: PullRequestFileChange) => {
  const fileLang = inferFileLangFromPath(fileChange.path);

  // Use the complete unified diff directly when available (fetched from Azure).
  if (fileChange.rawDiff) {
    return {
      oldFile: { fileName: fileChange.path, fileLang, content: "" },
      newFile: { fileName: fileChange.path, fileLang, content: "" },
      hunks: [fileChange.rawDiff],
    };
  }

  const normalizedLines =
    fileChange.diff.length > 0
      ? fileChange.diff.map(ensureDiffPrefix)
      : [" context unavailable"];

  const addedLines = normalizedLines.filter((line) => line.startsWith("+")).length;
  const deletedLines = normalizedLines.filter((line) => line.startsWith("-")).length;
  const oldLength = Math.max(1, normalizedLines.length - addedLines);
  const newLength = Math.max(1, normalizedLines.length - deletedLines);

  const hunk = [
    `--- a/${fileChange.path}`,
    `+++ b/${fileChange.path}`,
    `@@ -1,${oldLength} +1,${newLength} @@`,
    ...normalizedLines,
  ].join("\n");

  return {
    oldFile: {
      fileName: fileChange.path,
      fileLang,
      content: "",
    },
    newFile: {
      fileName: fileChange.path,
      fileLang,
      content: "",
    },
    hunks: [hunk],
  };
};

type FileTreeNode = {
  name: string;
  path: string;
  isDir: boolean;
  children: FileTreeNode[];
};

export const buildFileTree = (
  files: PullRequestFileChange[],
): FileTreeNode => {
  const root: FileTreeNode = { name: "root", path: "", isDir: true, children: [] };

  for (const file of files) {
    const parts = file.path.split("/");
    let current: FileTreeNode = root;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]!;
      const isLast = i === parts.length - 1;
      const fullPath = parts.slice(0, i + 1).join("/");

      let node = current.children.find((n) => n.name === part);

      if (!node) {
        node = {
          name: part,
          path: fullPath,
          isDir: !isLast,
          children: [],
        };
        current.children.push(node);
      }

      current = node;
    }
  }

  return root;
};
