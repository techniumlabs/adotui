import type { NewPullRequest } from "../domain/types";
import type { BranchPick, CreatePrForm } from "./types";

/** Branches containing the typed filter (case-insensitive); all of them when it is empty. */
export const branchMatches = (branches: string[], query: string): string[] => {
  const needle = query.trim().toLowerCase();
  return needle ? branches.filter((branch) => branch.toLowerCase().includes(needle)) : branches;
};

/** The branch a field currently stands for, if any matches. */
export const pickedBranch = (branches: string[] | null, field: BranchPick): string | undefined =>
  branches ? branchMatches(branches, field.query)[field.pick] : undefined;

/** "feature/add-login_page" -> "add login page": the title used when none is typed. */
export const defaultTitle = (branch: string): string =>
  (branch.split("/").pop() ?? branch).replace(/[-_]+/g, " ").trim();

/** The pull request the form describes, or why it cannot be sent yet. */
export const buildNewPr = (form: CreatePrForm): { pr: NewPullRequest } | { error: string } => {
  if (!form.branches) return { error: "Branches are still loading." };
  const source = pickedBranch(form.branches, form.source);
  const target = pickedBranch(form.branches, form.target);
  if (!source) return { error: "Choose a source branch (type to filter, ←/→ to pick)." };
  if (!target) return { error: "Choose a target branch." };
  if (source === target) return { error: "Source and target must be different branches." };
  return {
    pr: {
      sourceBranch: source,
      targetBranch: target,
      title: form.title.trim() || defaultTitle(source),
      description: form.description.trim(),
      draft: form.draft,
    },
  };
};
