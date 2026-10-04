import { createPullRequest, listBranches } from "../../data/azure";
import type { RepoRef } from "../../data/refs";
import { buildNewPr } from "../createPr";
import { selectSelectedOrg, selectSelectedRepo } from "../selectors";
import { getState, patchState, updateState } from "../store";
import type { CreatePrForm } from "../types";
import { doRefresh } from "./refreshActions";
import { addToast } from "./toastActions";

/** Bumped on every open/close, so a branch list or reply for an old form never lands in a new one. */
let formToken = 0;

const message = (cause: unknown): string => (cause instanceof Error ? cause.message : String(cause));

const repoRef = (form: CreatePrForm): RepoRef => ({
  organizationUrl: form.repo.organizationUrl,
  project: form.repo.project,
  repositoryId: form.repo.name,
});

/** Merges into the open form; does nothing once it is closed. */
export const patchCreatePr = (partial: Partial<CreatePrForm>): void => {
  const form = getState().createPr;
  if (form) patchState({ createPr: { ...form, ...partial } });
};

/** Opens the form for the repository selected in the tree and loads its branches. */
export const openCreatePr = (): void => {
  const state = getState();
  const org = selectSelectedOrg(state);
  const repo = selectSelectedRepo(state);
  if (!org || !repo) {
    patchState({ banner: "Select a repository in the tree first, then press N." });
    return;
  }
  const token = ++formToken;
  const form: CreatePrForm = {
    repo: { organizationUrl: org.organizationUrl, project: repo.project, name: repo.name },
    branches: null,
    defaultBranch: null,
    source: { query: "", pick: 0 },
    target: { query: "", pick: 0 },
    title: "",
    description: "",
    draft: false,
    cursor: 0,
    submitting: false,
    error: null,
  };
  updateState((current) => ({
    // When opened via a typed command, fall back past "command" itself.
    previousFocus: current.focus === "command" ? (current.previousFocus ?? "list") : current.focus,
    focus: "createPr",
    createPr: form,
    banner: `New pull request in ${repo.name}`,
  }));

  listBranches(repoRef(form))
    .then(({ branches, defaultBranch }) => {
      if (token !== formToken) return;
      // Target defaults to the repo's default branch, source to the first other branch.
      const target = Math.max(0, branches.indexOf(defaultBranch ?? ""));
      const source = Math.max(0, branches.findIndex((_, i) => i !== target));
      patchCreatePr({ branches, defaultBranch, source: { query: "", pick: source }, target: { query: "", pick: target } });
    })
    .catch((cause: unknown) => {
      if (token === formToken) patchCreatePr({ branches: [], error: `Could not list branches: ${message(cause)}` });
    });
};

export const closeCreatePr = (banner = "New pull request cancelled."): void => {
  formToken += 1;
  updateState((current) => ({ focus: current.previousFocus ?? "list", createPr: null, banner }));
};

/** Sends the form; on success closes it and refreshes so the new PR shows up. */
export const submitCreatePr = (): void => {
  const form = getState().createPr;
  if (!form || form.submitting) return;
  const built = buildNewPr(form);
  if ("error" in built) {
    patchCreatePr({ error: built.error });
    return;
  }
  const token = formToken;
  patchCreatePr({ submitting: true, error: null });
  createPullRequest(repoRef(form), built.pr)
    .then(({ id }) => {
      if (token !== formToken) return;
      const created = `Created PR #${id} "${built.pr.title}" in ${form.repo.name}.`;
      closeCreatePr(created);
      // The banner is replaced when the refresh lands; the toast keeps the PR number visible.
      addToast(created, "success");
      doRefresh("auto");
    })
    .catch((cause: unknown) => {
      if (token === formToken) patchCreatePr({ submitting: false, error: message(cause) });
    });
};
