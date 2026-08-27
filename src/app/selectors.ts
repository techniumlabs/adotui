import type { OrganizationNode, PullRequest, RepositoryNode } from "../domain/types";
import type { AppState } from "./types";
import { getVisiblePrs } from "./utils";

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
