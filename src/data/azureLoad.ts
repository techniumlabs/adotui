/**
 * Project/repo/PR discovery and hydration over the Azure DevOps REST API
 * (see adoFetch.ts): builds the full AppData tree with bounded concurrency
 * and per-project PR paging.
 */
import type {
  AppData,
  OrganizationNode,
  PullRequest,
  PullRequestFileChange,
  PullRequestWorkItem,
  RepositoryNode,
} from "../domain/types";
import type { AdoConfig, AdoProjectConfig } from "./config";
import type {
  AzureIdentityRef,
  AzureIteration,
  AzureIterationChanges,
  AzureIterationList,
  AzurePolicyEvaluation,
  AzurePullRequest,
  AzureRepository,
} from "./azureTypes";
import {
  normalizeFileChanges,
  normalizePullRequest,
  orgLabel,
  summarizeChecks,
} from "./azureNormalize";
import { fetchPrComments } from "./azureRest";
import { adoGet, adoGetFrom, AdoHttpError, seg, type AdoList } from "./adoFetch";
import { debugLog } from "../app/utils";

interface AzureProject {
  id: string;
  name: string;
  state: string;
}

/** Lists all projects in an organization. */
const listProjects = async (
  organization: string,
): Promise<AzureProject[]> => {
  const result = await adoGet<AdoList<AzureProject>>(organization, "_apis/projects", {
    query: { "$top": 1000 },
  });
  return (result.value ?? []).filter((proj) => proj.state === "wellFormed" && !!proj.name);
};

/** Lists repositories in a project (auto-discovery). */
const listRepositories = async (
  project: AdoProjectConfig,
): Promise<AzureRepository[]> => {
  const repos = await adoGet<AdoList<AzureRepository>>(
    project.organization,
    `${seg(project.project!)}/_apis/git/repositories`,
  );
  return (repos.value ?? []).filter((repo) => repo.isDisabled !== true && !!repo.name);
};

// ─── reviewer/creator filters ────────────────────────────────────────────────

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const identityCache = new Map<string, string | null>();

/**
 * Resolves an email/UPN to an Azure DevOps identity id so reviewer/creator
 * filters can be applied server-side. Returns null when it cannot be
 * resolved; callers then fall back to client-side matching.
 */
const resolveIdentityId = async (
  organization: string,
  value: string,
): Promise<string | null> => {
  if (GUID.test(value)) return value;
  const cacheKey = `${organization}|${value.toLowerCase()}`;
  const cached = identityCache.get(cacheKey);
  if (cached !== undefined) return cached;

  let resolved: string | null = null;
  try {
    const result = await adoGetFrom<AdoList<{ id?: string }>>(
      `https://vssps.dev.azure.com/${seg(orgLabel(organization))}`,
      "_apis/identities",
      { query: { searchFilter: "General", filterValue: value }, apiVersion: "7.1-preview.1" },
    );
    resolved = result.value?.[0]?.id ?? null;
  } catch (cause) {
    debugLog("identity resolution failed for", value, cause);
  }
  identityCache.set(cacheKey, resolved);
  return resolved;
};

const identityMatches = (identity: AzureIdentityRef | undefined, value: string): boolean => {
  const needle = value.toLowerCase();
  return (
    (identity?.uniqueName ?? "").toLowerCase().includes(needle) ||
    (identity?.displayName ?? "").toLowerCase().includes(needle)
  );
};

interface PrFilters {
  reviewerId?: string;
  creatorId?: string;
  /** Set when the identity could not be resolved and must be matched locally. */
  clientReviewer?: string;
  clientCreator?: string;
}

const resolveFilters = async (config: AdoConfig, organization: string): Promise<PrFilters> => {
  const filters: PrFilters = {};
  if (config.reviewer) {
    const id = await resolveIdentityId(organization, config.reviewer);
    if (id) filters.reviewerId = id;
    else filters.clientReviewer = config.reviewer;
  }
  if (config.creator) {
    const id = await resolveIdentityId(organization, config.creator);
    if (id) filters.creatorId = id;
    else filters.clientCreator = config.creator;
  }
  return filters;
};

interface PrListPage {
  top: number;
  skip: number;
}

/**
 * Lists PRs for a project. `page` overrides the fetch window (used by the
 * project-wide pager); without it the window falls back to the configured
 * per-repo `top`.
 */
const listPullRequests = async (
  config: AdoConfig,
  project: AdoProjectConfig,
  filters: PrFilters,
  page?: PrListPage,
): Promise<AzurePullRequest[]> => {
  const top = page?.top ?? config.top;
  const result = await adoGet<AdoList<AzurePullRequest>>(
    project.organization,
    `${seg(project.project!)}/_apis/git/pullrequests`,
    {
      query: {
        "searchCriteria.status": config.status ?? "active",
        ...(top ? { "$top": top } : {}),
        ...(page && page.skip > 0 ? { "$skip": page.skip } : {}),
        ...(filters.reviewerId ? { "searchCriteria.reviewerId": filters.reviewerId } : {}),
        ...(filters.creatorId ? { "searchCriteria.creatorId": filters.creatorId } : {}),
      },
    },
  );
  return result.value ?? [];
};

/** Page size for the project-wide PR listing. */
const PR_LIST_PAGE_SIZE = 100;
/** Safety valve: at most this many pages (2000 PRs) per project. */
const PR_LIST_MAX_PAGES = 20;

/**
 * Fetches every PR in a project by paging, so a project with more PRs than
 * one window is not silently truncated.
 */
const listAllProjectPullRequests = async (
  config: AdoConfig,
  project: AdoProjectConfig,
): Promise<AzurePullRequest[]> => {
  const filters = await resolveFilters(config, project.organization);
  const all: AzurePullRequest[] = [];
  for (let pageIndex = 0; pageIndex < PR_LIST_MAX_PAGES; pageIndex += 1) {
    const batch = await listPullRequests(config, project, filters, {
      top: PR_LIST_PAGE_SIZE,
      skip: pageIndex * PR_LIST_PAGE_SIZE,
    });
    all.push(...batch);
    if (batch.length < PR_LIST_PAGE_SIZE) {
      break;
    }
  }

  // Filters whose identity could not be resolved are applied locally so the
  // configured intent still holds.
  let filtered = all;
  if (filters.clientCreator) {
    filtered = filtered.filter((pr) => identityMatches(pr.createdBy, filters.clientCreator!));
  }
  if (filters.clientReviewer) {
    filtered = filtered.filter((pr) =>
      (pr.reviewers ?? []).some((r) => identityMatches(r, filters.clientReviewer!)),
    );
  }
  return filtered;
};

// ─── per-PR detail fetches ───────────────────────────────────────────────────

const projectIdCache = new Map<string, string>();

/** Resolves a project name to its id (needed for policy artifact ids). */
const resolveProjectId = async (
  organization: string,
  project: string,
): Promise<string | undefined> => {
  const cacheKey = `${organization}|${project}`;
  const cached = projectIdCache.get(cacheKey);
  if (cached) return cached;
  try {
    const result = await adoGet<{ id?: string }>(organization, `_apis/projects/${seg(project)}`);
    if (result.id) {
      projectIdCache.set(cacheKey, result.id);
      return result.id;
    }
  } catch (cause) {
    debugLog("project id resolution failed for", project, cause);
  }
  return undefined;
};

/** Fetches blocking policy evaluations for a PR (check rollup). */
const listPrPolicies = async (
  organization: string,
  project: string,
  projectId: string | undefined,
  prId: number,
): Promise<AzurePolicyEvaluation[]> => {
  if (!projectId) return [];
  try {
    const result = await adoGet<AdoList<AzurePolicyEvaluation>>(
      organization,
      `${seg(project)}/_apis/policy/evaluations`,
      {
        // The evaluations endpoint is preview-only, even under api-version 7.1.
        query: { artifactId: `vstfs:///CodeReview/CodeReviewId/${projectId}/${prId}` },
        apiVersion: "7.1-preview.1",
      },
    );
    return result.value ?? [];
  } catch {
    // Policies may be unavailable; treat as no checks rather than failing.
    return [];
  }
};

/** Fetches work items linked to a PR (refs, then one batch hydration call). */
const listPrWorkItems = async (
  organization: string,
  project: string,
  repositoryId: string,
  prId: number,
): Promise<PullRequestWorkItem[]> => {
  try {
    const refs = await adoGet<AdoList<{ id?: string | number }>>(
      organization,
      `${seg(project)}/_apis/git/repositories/${seg(repositoryId)}/pullRequests/${prId}/workitems`,
    );
    const ids = (refs.value ?? [])
      .map((ref) => Number(ref.id))
      .filter((id) => Number.isFinite(id) && id > 0);
    if (ids.length === 0) return [];

    const batch = await adoGet<
      AdoList<{ id?: number; fields?: Record<string, string>; url?: string }>
    >(organization, "_apis/wit/workitems", {
      query: { ids: ids.join(","), fields: "System.Title,System.State,System.WorkItemType" },
    });

    return (batch.value ?? [])
      .filter((raw): raw is typeof raw & { id: number } => typeof raw.id === "number")
      .map((raw) => ({
        id: raw.id,
        title: raw.fields?.["System.Title"] ?? "Unknown Work Item",
        state: raw.fields?.["System.State"] ?? "Unknown",
        type: raw.fields?.["System.WorkItemType"] ?? "Unknown",
        url: raw.url ?? "",
      }));
  } catch {
    return [];
  }
};

/**
 * Fetches changed files for a PR from the latest iteration, along with the
 * commit pair the diff view needs to fetch file contents lazily.
 */
const listPrFileChanges = async (
  organization: string,
  project: string,
  repositoryId: string,
  prId: number,
  sourceCommit: string | undefined,
  targetCommit: string | undefined,
): Promise<{ files: PullRequestFileChange[]; iterSourceCommit?: string; iterTargetCommit?: string }> => {
  const prPath = `${seg(project)}/_apis/git/repositories/${seg(repositoryId)}/pullRequests/${prId}`;
  try {
    const iterations = await adoGet<AzureIterationList>(organization, `${prPath}/iterations`);

    const latestIter = (iterations.value ?? []).reduce(
      (max, it) => ((it.id ?? 0) > (max.id ?? 0) ? it : max),
      { id: 0 } as AzureIteration,
    );
    const latest = latestIter.id ?? 0;
    if (latest === 0) {
      return { files: [] };
    }

    const iterSourceCommit = sourceCommit ?? latestIter.sourceRefCommit?.commitId;
    const iterTargetCommit = targetCommit ?? latestIter.commonRefCommit?.commitId ?? latestIter.targetRefCommit?.commitId;

    const changes = await adoGet<AzureIterationChanges>(
      organization,
      `${prPath}/iterations/${latest}/changes`,
      { query: { "$top": 10000 } },
    );

    const files = normalizeFileChanges(changes.changeEntries ?? []);

    return { files, iterSourceCommit, iterTargetCommit };
  } catch (cause) {
    debugLog("listPrFileChanges failed", prId, cause);
    return { files: [] };
  }
};

/** Wraps errors into a synthetic PR entry so one bad repo doesn't break all. */
const hydratePullRequest = async (
  project: AdoProjectConfig,
  repository: string,
  raw: AzurePullRequest,
  options: { fetchDetails: boolean },
): Promise<PullRequest> => {
  const prId = raw.pullRequestId ?? 0;
  const repositoryId = raw.repository?.id ?? repository;
  const sourceCommit = raw.lastMergeSourceCommit?.commitId;
  const targetCommit = raw.lastMergeTargetCommit?.commitId;
  const projectStr = project.project!;

  let changedFiles: PullRequestFileChange[] = [];
  let checksPassed = 0;
  let checksTotal = 0;
  let workItems: PullRequestWorkItem[] = [];
  let commentCount = 0;
  let activeCommentCount = 0;
  let iterSourceCommit: string | undefined;
  let iterTargetCommit: string | undefined;

  if (options.fetchDetails && prId > 0) {
    const [fileRes, policies, items, threads] = await Promise.all([
      listPrFileChanges(
        project.organization,
        projectStr,
        repositoryId,
        prId,
        sourceCommit,
        targetCommit,
      ),
      listPrPolicies(project.organization, projectStr, raw.repository?.project?.id, prId),
      listPrWorkItems(project.organization, projectStr, repositoryId, prId),
      fetchPrComments(project.organization, projectStr, repositoryId, prId),
    ]);
    changedFiles = fileRes.files;
    iterSourceCommit = fileRes.iterSourceCommit;
    iterTargetCommit = fileRes.iterTargetCommit;
    const checks = summarizeChecks(policies);
    checksPassed = checks.passed;
    checksTotal = checks.total;
    workItems = items;
    const threadList = threads ?? [];
    commentCount = threadList.reduce((acc, t) => acc + t.comments.length, 0);
    activeCommentCount = threadList.reduce(
      (acc, t) => acc + (t.status === "active" || t.status === "pending" ? t.comments.length : 0),
      0
    );
  }

  return {
    ...normalizePullRequest(raw, {
      organization: project.organization,
      project: projectStr,
      repository,
      changedFiles,
      checksPassed,
      checksTotal,
      commentCount,
      activeCommentCount,
    }),
    workItems,
    iterSourceCommit,
    iterTargetCommit,
    detailsLoaded: options.fetchDetails,
  };
};

export const fetchPrDetails = async (pr: PullRequest): Promise<Partial<PullRequest>> => {
  const repositoryId = pr.repositoryId ?? pr.repository;
  // PRs restored from an older cache may predate the stored project id.
  const projectId = pr.projectId ?? (await resolveProjectId(pr.organizationUrl, pr.project));

  const [fileRes, policies, items, threads] = await Promise.all([
    listPrFileChanges(
      pr.organizationUrl,
      pr.project,
      repositoryId,
      pr.id,
      undefined,
      undefined,
    ),
    listPrPolicies(pr.organizationUrl, pr.project, projectId, pr.id),
    listPrWorkItems(pr.organizationUrl, pr.project, repositoryId, pr.id),
    fetchPrComments(pr.organizationUrl, pr.project, repositoryId, pr.id),
  ]);

  const checks = summarizeChecks(policies);
  const threadList = threads ?? [];

  return {
    changedFiles: fileRes.files,
    iterSourceCommit: fileRes.iterSourceCommit,
    iterTargetCommit: fileRes.iterTargetCommit,
    checksPassed: checks.passed,
    checksTotal: checks.total,
    workItems: items,
    comments: threadList.reduce((acc, t) => acc + t.comments.length, 0),
    activeComments: threadList.reduce(
      (acc, t) => acc + (t.status === "active" || t.status === "pending" ? t.comments.length : 0),
      0
    ),
    detailsLoaded: true,
  };
};

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
  /** When true, fetch per-PR file changes and policy checks (slower). */
  fetchDetails?: boolean;
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

const describeError = (cause: unknown): string =>
  cause instanceof AdoHttpError
    ? cause.detail
    : cause instanceof Error
      ? cause.message
      : String(cause);

/**
 * Maximum number of projects fetched concurrently. Each project issues two
 * requests in parallel (repo discovery + PR listing).
 */
const PROJECT_FETCH_CONCURRENCY = 4;

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
 * Groups a project-wide PR listing by repository name. Keys are lower-cased
 * so lookups tolerate casing differences between configured repo names and
 * the names Azure DevOps reports on the PR payload.
 */
export const groupPrsByRepository = (
  rawPrs: AzurePullRequest[],
): Map<string, AzurePullRequest[]> => {
  const groups = new Map<string, AzurePullRequest[]>();
  for (const raw of rawPrs) {
    const repoName = raw.repository?.name?.toLowerCase();
    if (!repoName) continue;
    const group = groups.get(repoName);
    if (group) {
      group.push(raw);
    } else {
      groups.set(repoName, [raw]);
    }
  }
  return groups;
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
  const fetchDetails = options.fetchDetails ?? true;

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

      const repoNodes = await Promise.all(
        repoNames.map(async (repository): Promise<RepositoryNode> => {
          // `top`, when configured, caps PRs per repository. The project
          // listing is paged in full, so no cap means every PR is kept.
          const grouped = prGroups.get(repository.toLowerCase()) ?? [];
          const rawPrs = config.top ? grouped.slice(0, config.top) : grouped;
          const pullRequests = await Promise.all(
            rawPrs.map((raw) =>
              hydratePullRequest(project, repository, raw, { fetchDetails }),
            ),
          );
          return { name: repository, project: project.project!, pullRequests };
        }),
      );

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
