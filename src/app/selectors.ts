import type { AppData, OrganizationNode, PullRequest, RepositoryNode } from "../domain/types";
import type { AppState } from "./types";
import { clamp, getVisiblePrs, matchesTreeFilter } from "./utils";

/**
 * Pure derivation helpers over AppState. Used by module-level actions (via
 * `getState()`) so they always act on the *current* selection — no stale
 * closures — and by `useAppState` for render-time derivation.
 */

export const selectSelectedOrg = (state: AppState): OrganizationNode | undefined =>
  state.data.organizations[state.selectedOrgIndex];

export const selectSelectedRepo = (state: AppState): RepositoryNode | undefined =>
  selectSelectedOrg(state)?.repositories[state.selectedRepoIndex];

export const selectVisiblePrs = (state: AppState): PullRequest[] =>
  getVisiblePrs(selectSelectedRepo(state), state.treeFilter, state.data.currentUserEmail);

export const selectSelectedPr = (state: AppState): PullRequest | undefined =>
  selectVisiblePrs(state)[state.selectedPrIndex];

/**
 * Re-clamps the selection against a changed tree, so streamed commits and the
 * final commit provably agree.
 *
 * Note the deliberate asymmetry: an organization that has not received its
 * repositories yet leaves `selectedRepoIndex` ALONE. Clamping against an empty
 * list would silently reset a valid selection to 0 and never restore it; an
 * out-of-range index is harmless (selectors optional-chain, the tree renders
 * "No repos with PRs." and moveTreeSelection recovers on the next keypress).
 */
/**
 * Mirrors OrganizationTree's row predicate: a repo is drawn only when the
 * active filter leaves it with at least one pull request.
 */
const isRepoVisible = (
  repo: RepositoryNode,
  treeFilter: string,
  currentUserEmail: string | undefined,
): boolean => {
  if (treeFilter === "all") return true;
  const matching =
    treeFilter === "with-prs"
      ? repo.pullRequests
      : repo.pullRequests.filter((pr) => matchesTreeFilter(pr, treeFilter, currentUserEmail));
  return matching.length > 0;
};

export const clampSelection = (
  current: AppState,
  data: AppData,
): Pick<AppState, "selectedOrgIndex" | "selectedRepoIndex" | "selectedPrIndex"> => {
  const orgCount = data.organizations.length;
  const selectedOrgIndex = clamp(current.selectedOrgIndex, 0, Math.max(0, orgCount - 1));
  const org = data.organizations[selectedOrgIndex];
  const repoCount = org?.repositories.length ?? 0;
  let selectedRepoIndex =
    repoCount > 0 ? clamp(current.selectedRepoIndex, 0, repoCount - 1) : current.selectedRepoIndex;

  // Selection indexes the UNFILTERED repo list, so index 0 (the launch
  // default) or a stale index can point at a repo the filter hides - the
  // tree then highlights nothing while the PR pane shows that repo. Snap to
  // the first repo the tree actually draws.
  if (org && repoCount > 0) {
    const selectedRepo = org.repositories[selectedRepoIndex];
    if (!selectedRepo || !isRepoVisible(selectedRepo, current.treeFilter, data.currentUserEmail)) {
      const firstVisible = org.repositories.findIndex((repo) =>
        isRepoVisible(repo, current.treeFilter, data.currentUserEmail),
      );
      if (firstVisible !== -1) selectedRepoIndex = firstVisible;
    }
  }

  const visible = getVisiblePrs(
    org?.repositories[selectedRepoIndex],
    current.treeFilter,
    data.currentUserEmail,
  );
  return {
    selectedOrgIndex,
    selectedRepoIndex,
    selectedPrIndex: clamp(current.selectedPrIndex, 0, Math.max(0, visible.length - 1)),
  };
};
