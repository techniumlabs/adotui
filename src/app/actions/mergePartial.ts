import type { AppData, RepositoryNode } from "../../domain/types";
import type { LoadPartial } from "../../data/azureLoad";

/**
 * Identity of a repo node. Project-qualified because Azure DevOps repo names
 * are unique per project, not per organization (see
 * tests/organizationTree.test.tsx).
 */
const repoKey = (repo: RepositoryNode): string =>
  `${repo.project.toLowerCase()}/${repo.name.toLowerCase()}`;

/**
 * Folds streamed load partials into the tree.
 *
 * Upsert, not blind append: on the initial load every org starts empty so
 * repos simply append in arrival order (the one growth pattern that keeps the
 * positional selection indices pointing at the same nodes), while a manual
 * refresh replaces existing repos in place instead of duplicating them.
 *
 * Always returns a NEW AppData when something changed - the summary counters
 * in useAppState are memoized on `state.data` identity, so an in-place push
 * would leave them stale - and the SAME object when nothing changed, so the
 * caller can skip the commit entirely (every zustand set is a full Ink frame).
 */
export const mergeLoadPartials = (data: AppData, partials: LoadPartial[]): AppData => {
  if (partials.length === 0) return data;

  let changed = false;
  const organizations = [...data.organizations];
  const indexByUrl = new Map(organizations.map((org, index) => [org.organizationUrl, index]));
  let currentUserEmail = data.currentUserEmail;

  for (const partial of partials) {
    if (partial.currentUserEmail && partial.currentUserEmail !== currentUserEmail) {
      currentUserEmail = partial.currentUserEmail;
      changed = true;
    }

    let index = indexByUrl.get(partial.organizationUrl);
    if (index === undefined) {
      organizations.push({
        name: partial.organizationName,
        organizationUrl: partial.organizationUrl,
        repositories: [],
      });
      index = organizations.length - 1;
      indexByUrl.set(partial.organizationUrl, index);
      changed = true;
    }

    // A failed project reports no repositories; that must never delete the
    // repositories an earlier load already found.
    if (partial.repositories.length === 0) continue;

    const org = organizations[index]!;
    const repositories = [...org.repositories];
    const positionByKey = new Map(repositories.map((repo, i) => [repoKey(repo), i]));
    for (const repo of partial.repositories) {
      const key = repoKey(repo);
      const existing = positionByKey.get(key);
      if (existing === undefined) {
        positionByKey.set(key, repositories.length);
        repositories.push(repo);
      } else {
        repositories[existing] = repo;
      }
    }
    organizations[index] = { ...org, repositories };
    changed = true;
  }

  if (!changed) return data;
  return {
    organizations,
    ...(currentUserEmail ? { currentUserEmail } : {}),
  };
};
