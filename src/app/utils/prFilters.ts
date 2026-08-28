import type { AppData, PullRequest, PullRequestFileChange } from "../../domain/types";

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

/** Name fragments (>2 chars) from the email's local part, used for fuzzy identity matching. */
const emailNameParts = (currentUserEmail?: string): string[] =>
  (currentUserEmail?.split("@")[0]?.toLowerCase().split(/[.\-_]/) ?? []).filter(
    (part) => part.length > 2,
  );

/** True when a display-name/email string looks like the logged-in user. */
export const isCurrentUser = (name: string, currentUserEmail?: string): boolean => {
  const lower = name.toLowerCase();
  return emailNameParts(currentUserEmail).some((part) => lower.includes(part));
};

/** True when the PR's author looks like the logged-in user. */
export const isMyPr = (pr: PullRequest, currentUserEmail?: string): boolean =>
  isCurrentUser(pr.author, currentUserEmail);

/** True when the logged-in user is one of the PR's assigned reviewers. */
export const isAssignedReviewer = (pr: PullRequest, currentUserEmail?: string): boolean =>
  (pr.reviewers ?? []).some((r) =>
    isCurrentUser(r.displayName + " " + r.uniqueName, currentUserEmail),
  );

export const matchesTreeFilter = (pr: PullRequest, filterStr: string, currentUserEmail?: string): boolean => {
  if (!filterStr || filterStr === "all" || filterStr === "with-prs") return true;

  if (filterStr === "me") {
    // Can't identify the user — show everything rather than nothing.
    if (emailNameParts(currentUserEmail).length === 0) return true;
    return isMyPr(pr, currentUserEmail) || isAssignedReviewer(pr, currentUserEmail);
  }

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
  currentUserEmail?: string,
): PullRequest[] => {
  if (!repo) return [];
  let prs = repo.pullRequests;
  if (treeFilter !== "all" && treeFilter !== "with-prs") {
    prs = prs.filter((pr) => matchesTreeFilter(pr, treeFilter, currentUserEmail));
  }
  return prs;
};

export const getVisibleFiles = (
  pr: PullRequest | undefined,
  fileFilter: string,
): PullRequestFileChange[] => {
  if (!pr) return [];
  if (!fileFilter) return pr.changedFiles;

  try {
    const filterRegex = new RegExp(fileFilter.replace(/\*/g, '.*'), 'i');
    return pr.changedFiles.filter((f) => filterRegex.test(f.path));
  } catch {
    return pr.changedFiles.filter((f) => f.path.toLowerCase().includes(fileFilter.toLowerCase()));
  }
};
