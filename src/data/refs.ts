import type { PullRequest } from "../domain/types";

/**
 * How the data layer addresses things in Azure DevOps. Passed instead of
 * long lists of positional strings, which are easy to transpose (organization,
 * project and repository are all strings) and tripped the parameter-count limit.
 */

/** A repository: the organization URL, the project, and the repository id (or name). */
export interface RepoRef {
  organizationUrl: string;
  project: string;
  repositoryId: string;
}

/** A pull request in a repository. */
export interface PrScope extends RepoRef {
  prId: number;
}

/** The scope of a PR as the app holds it (the repository id falls back to the name, which also resolves). */
export const prScope = (
  pr: Pick<PullRequest, "organizationUrl" | "project" | "repository" | "repositoryId" | "id">,
): PrScope => ({
  organizationUrl: pr.organizationUrl,
  project: pr.project,
  repositoryId: pr.repositoryId ?? pr.repository,
  prId: pr.id,
});
