/**
 * Builds the full AppData tree across every configured organization and
 * project, with bounded concurrency and streamed partials. Listing lives in
 * azureDiscovery.ts and per-PR details in azurePrDetails.ts; the names the rest
 * of the app imports from here are re-exported so call sites do not change.
 */
import type { AppData, OrganizationNode, RepositoryNode } from "../domain/types";
import type { AdoConfig, AdoProjectConfig } from "./config";
import type { AzurePullRequest } from "./azureTypes";
import { orgLabel } from "./azureNormalize";
import { AdoHttpError } from "./adoFetch";
import { PROJECT_FETCH_CONCURRENCY } from "./constants";
import { listProjects, listRepositories, listAllProjectPullRequests, toPullRequest, groupPrsByRepository } from "./azureDiscovery";
export { fetchPrDetails } from "./azurePrDetails";
export { groupPrsByRepository };

/** Structured fetch progress: how many projects are done out of the total. */
export interface LoadProgress {
  current: number;
  total: number;
}

/**
 * A slice of the tree that is ready before the whole load finishes. One is
 * emitted per organization as soon as its projects are known (with no
 * repositories yet), then one per project as its repos land.
 */
export interface LoadPartial {
  /** Echoes LoadOptions.requestId so stale loads can be discarded. */
  requestId: number;
  organizationUrl: string;
  organizationName: string;
  /** null for the org placeholder emitted right after discovery. */
  project: string | null;
  /** This project's repositories, ready to append (empty when it failed). */
  repositories: RepositoryNode[];
  /** Warnings raised by this project's task. */
  warnings: string[];
  progress: LoadProgress;
  /** Filled in downstream by dataController; the loader does not know it. */
  currentUserEmail?: string;
}

export interface LoadOptions {
  /** Callback fired to report current loading progress. */
  onProgress?: (msg: string, progress?: LoadProgress) => void;
  /**
   * Streaming callback: fired as each slice of the tree becomes available so
   * the UI can render progressively instead of waiting for the whole load.
   * The resolved return value is unchanged and still config-ordered.
   */
  onPartial?: (partial: LoadPartial) => void;
  /** Identifies this load; echoed back on every partial. */
  requestId?: number;
}

const describeError = (cause: unknown): string => {
  if (cause instanceof AdoHttpError) return cause.detail;
  return cause instanceof Error ? cause.message : String(cause);
};

/**
 * Runs `fn` over `items` with at most `limit` tasks in flight, preserving
 * input order in the returned array.
 */
export const mapWithConcurrency = async <T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> => {
  const results = new Array<R>(items.length);
  let next = 0;
  const worker = async (): Promise<void> => {
    for (let i = next++; i < items.length; i = next++) {
      results[i] = await fn(items[i]!, i);
    }
  };
  await Promise.all(
    Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, worker),
  );
  return results;
};

/**
 * Loads the full AppData tree across every configured org/project, discovering
 * repositories when not explicitly listed. Projects are fetched with bounded
 * concurrency, and each project pages through one project-wide PR listing
 * (grouped client-side by repository, capped at `top` per repo) instead of
 * one request per repo. A failure in one repo/project is captured and
 * surfaced as an empty node rather than aborting the whole load.
 */
export const loadAppData = async (
  config: AdoConfig,
  options: LoadOptions = {},
): Promise<{ data: AppData; warnings: string[] }> => {
  const warnings: string[] = [];

  // Group projects by organization so the tree top level is per-org.
  const byOrg = new Map<string, AdoProjectConfig[]>();
  for (const project of config.projects) {
    const list = byOrg.get(project.organization) ?? [];
    list.push(project);
    byOrg.set(project.organization, list);
  }

  // Phase 1: resolve the full project list for every org up-front so fetch
  // progress can be reported against a known total.
  const orgProjects = await mapWithConcurrency(
    [...byOrg.entries()],
    PROJECT_FETCH_CONCURRENCY,
    async ([organization, projects]) => {
      const resolvedProjects: AdoProjectConfig[] = [];
      for (const project of projects) {
        if (!project.project) {
          try {
            options.onProgress?.(`Discovering projects in ${orgLabel(organization)}...`);
            const discovered = await listProjects(organization);
            for (const dp of discovered) {
              resolvedProjects.push({
                organization: project.organization,
                project: dp.name,
                repositories: project.repositories,
              });
            }
          } catch (cause) {
            warnings.push(
              `Could not list projects for ${organization}: ${describeError(cause)}`,
            );
          }
        } else {
          resolvedProjects.push(project);
        }
      }
      return { organization, projects: resolvedProjects };
    },
  );

  const totalProjects = orgProjects.reduce((acc, entry) => acc + entry.projects.length, 0);
  let fetchedProjects = 0;
  const progress = (): LoadProgress => ({ current: fetchedProjects, total: totalProjects });

  const requestId = options.requestId ?? 0;
  const emitPartial = (
    organization: string,
    project: string | null,
    repositories: RepositoryNode[],
    partialWarnings: string[],
  ): void => {
    options.onPartial?.({
      requestId,
      organizationUrl: organization,
      organizationName: orgLabel(organization),
      project,
      repositories,
      warnings: partialWarnings,
      progress: progress(),
    });
  };

  // Announce the organizations first so their rows appear immediately, then
  // fill each one in as its projects resolve.
  for (const { organization } of orgProjects) {
    emitPartial(organization, null, [], []);
  }

  // Phase 2: fetch repos and PRs per project, with bounded concurrency across
  // ALL projects. Each project needs only two requests, issued in parallel:
  // repo discovery and one project-wide PR listing grouped by repository.
  const projectTasks = orgProjects.flatMap((entry) =>
    entry.projects.map((project) => project),
  );

  const taskResults = await mapWithConcurrency(
    projectTasks,
    PROJECT_FETCH_CONCURRENCY,
    async (project): Promise<RepositoryNode[]> => {
      options.onProgress?.(`Fetching PRs for ${project.project}...`, progress());

      // Warnings are collected per task as well as globally so a partial can
      // carry the problems that affected exactly its slice.
      const taskWarnings: string[] = [];
      const warn = (message: string): void => {
        taskWarnings.push(message);
        warnings.push(message);
      };

      const explicitRepos = project.repositories ?? [];
      const [repoNamesResult, prListResult] = await Promise.allSettled([
        explicitRepos.length > 0
          ? Promise.resolve(explicitRepos)
          : listRepositories(project).then((repos) =>
              repos
                .map((repo) => repo.name)
                .filter((name): name is string => !!name),
            ),
        listAllProjectPullRequests(config, project),
      ]);

      const done = (label: string): void => {
        fetchedProjects += 1;
        options.onProgress?.(
          `${label} ${project.project} (${fetchedProjects}/${totalProjects} projects)`,
          progress(),
        );
      };

      if (repoNamesResult.status === "rejected") {
        warn(`Could not list repos for ${project.project}: ${describeError(repoNamesResult.reason)}`);
        done("Skipped");
        emitPartial(project.organization, project.project!, [], taskWarnings);
        return [];
      }
      const repoNames = repoNamesResult.value;

      let prGroups = new Map<string, AzurePullRequest[]>();
      if (prListResult.status === "rejected") {
        warn(`Could not list PRs for ${project.project}: ${describeError(prListResult.reason)}`);
      } else {
        prGroups = groupPrsByRepository(prListResult.value);
      }

      const repoNodes = repoNames.map((repository): RepositoryNode => {
        // `top`, when configured, caps PRs per repository. The project
        // listing is paged in full, so no cap means every PR is kept.
        const grouped = prGroups.get(repository.toLowerCase()) ?? [];
        const rawPrs = config.top ? grouped.slice(0, config.top) : grouped;
        return {
          name: repository,
          project: project.project!,
          pullRequests: rawPrs.map((raw) => toPullRequest(project, repository, raw)),
        };
      });

      done("Loaded");
      emitPartial(project.organization, project.project!, repoNodes, taskWarnings);
      return repoNodes;
    },
  );

  // Reassemble per-org nodes preserving configuration order (task results are
  // index-aligned with projectTasks, which was built in org/project order).
  const organizations: OrganizationNode[] = [];
  let taskIndex = 0;
  for (const { organization, projects } of orgProjects) {
    const repositories: RepositoryNode[] = [];
    for (let i = 0; i < projects.length; i += 1) {
      repositories.push(...(taskResults[taskIndex] ?? []));
      taskIndex += 1;
    }
    organizations.push({
      name: orgLabel(organization),
      organizationUrl: organization,
      repositories,
    });
  }

  return { data: { organizations }, warnings };
};
