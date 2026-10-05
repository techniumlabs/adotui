import { createPullRequest, findIdentityId, listBranches } from "../../data/azure";
import type { RepoRef } from "../../data/refs";
import type { OrganizationNode, RepositoryNode } from "../../domain/types";
import { CREATE_PR_FIELD } from "../constants";
import { acceptSuggestion, buildNewPr, FIELD_ROW, reviewerSuggestions } from "../createPr";
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

/** Reviewers seen on the organization's loaded PRs (identity search only matches e-mails, so only those). */
const knownPeople = (org: OrganizationNode): CreatePrForm["people"] => {
  const byEmail = new Map<string, { name: string; email: string }>();
  for (const pr of org.repositories.flatMap((r) => r.pullRequests)) {
    for (const r of pr.reviewers ?? []) {
      if (r.uniqueName.includes("@")) byEmail.set(r.uniqueName.toLowerCase(), { name: r.displayName, email: r.uniqueName });
    }
  }
  return [...byEmail.values()].sort((a, b) => a.name.localeCompare(b.name));
};

const openPrsOf = (repo: RepositoryNode): CreatePrForm["openPrs"] =>
  repo.pullRequests
    .filter((pr) => pr.status === "active")
    .map((pr) => ({ id: pr.id, source: pr.sourceBranch, target: pr.targetBranch }));

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
    reviewers: "",
    reviewerPick: 0,
    people: knownPeople(org),
    openPrs: openPrsOf(repo),
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

/**
 * A click on a form row: focuses it, and acts like its key would. `item` is a clicked entry of the
 * row's list (a branch match, or a reviewer suggestion).
 */
export const clickCreatePr = (row: number, item?: number): void => {
  const form = getState().createPr;
  if (!form || form.submitting) return;
  if (row === CREATE_PR_FIELD.SUBMIT) return submitCreatePr();
  const partial: Partial<CreatePrForm> = { cursor: row, error: null };
  if (row === CREATE_PR_FIELD.DRAFT) partial.draft = !form.draft;
  if (item !== undefined && row === CREATE_PR_FIELD.SOURCE) partial.source = { ...form.source, pick: item };
  if (item !== undefined && row === CREATE_PR_FIELD.TARGET) partial.target = { ...form.target, pick: item };
  const suggestion = item === undefined ? undefined : reviewerSuggestions(form)[item];
  if (row === CREATE_PR_FIELD.REVIEWERS && suggestion) {
    partial.reviewers = acceptSuggestion(form.reviewers, suggestion.email);
    partial.reviewerPick = 0;
  }
  patchCreatePr(partial);
};

/** Azure DevOps ids for the reviewer e-mails; throws naming the first one nobody has. */
const resolveReviewers = async (organizationUrl: string, emails: string[]): Promise<string[]> => {
  const ids = await Promise.all(emails.map((email) => findIdentityId(organizationUrl, email)));
  const unknown = emails.find((_, i) => !ids[i]);
  if (unknown) throw new Error(`No Azure DevOps user has the e-mail ${unknown}.`);
  return ids as string[];
};

/** Sends the form; on success closes it and refreshes so the new PR shows up. */
export const submitCreatePr = (): void => {
  const form = getState().createPr;
  if (!form || form.submitting) return;
  const built = buildNewPr(form);
  if ("error" in built) {
    // Take the user to the field that needs fixing.
    patchCreatePr({ error: built.error, cursor: built.field ? FIELD_ROW[built.field] : form.cursor });
    return;
  }
  void send(form, built);
};

const send = async (form: CreatePrForm, built: Extract<ReturnType<typeof buildNewPr>, { pr: unknown }>): Promise<void> => {
  const token = formToken;
  patchCreatePr({ submitting: true, error: null });
  let reviewerIds: string[];
  try {
    reviewerIds = await resolveReviewers(form.repo.organizationUrl, built.reviewerEmails);
  } catch (cause) {
    if (token === formToken) patchCreatePr({ submitting: false, error: message(cause), cursor: CREATE_PR_FIELD.REVIEWERS });
    return;
  }
  try {
    const { id } = await createPullRequest(repoRef(form), { ...built.pr, reviewerIds });
    if (token !== formToken) return;
    const created = `Created PR #${id} "${built.pr.title}" in ${form.repo.name}.`;
    closeCreatePr(created);
    // The banner is replaced when the refresh lands; the toast keeps the PR number visible.
    addToast(created, "success");
    doRefresh("auto");
  } catch (cause) {
    if (token === formToken) patchCreatePr({ submitting: false, error: message(cause) });
  }
};
