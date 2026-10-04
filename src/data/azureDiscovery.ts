/**
 * Discovery and listing over the Azure DevOps REST API (see adoFetch.ts):
 * projects, repositories, the signed-in-user filters (reviewer/creator) and the
 * project-wide PR listing, paged and grouped by repository.
 */
import type { PullRequest } from "../domain/types";
import type { AdoConfig, AdoProjectConfig } from "./config";
import type { AzureIdentityRef, AzurePullRequest, AzureRepository } from "./azureTypes";
import { normalizePullRequest, orgLabel } from "./azureNormalize";
import { adoGet, adoGetFrom, seg, type AdoList } from "./adoFetch";
import { PR_LIST_MAX_PAGES, PR_LIST_PAGE_SIZE } from "./constants";
import { debugLog } from "../shared/debugLog";

interface AzureProject {
  id: string;
  name: string;
  state: string;
}

/** Lists all projects in an organization. */
export const listProjects = async (
  organization: string,
): Promise<AzureProject[]> => {
  const result = await adoGet<AdoList<AzureProject>>(organization, "_apis/projects", {
    query: { "$top": 1000 },
  });
  return (result.value ?? []).filter((proj) => proj.state === "wellFormed" && !!proj.name);
};

/** Lists repositories in a project (auto-discovery). */
export const listRepositories = async (
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

/**
 * Fetches every PR in a project by paging, so a project with more PRs than
 * one window is not silently truncated.
 */
export const listAllProjectPullRequests = async (
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

/**
 * Maps a listed PR into the domain type. Listing carries no per-PR details
 * (files, checks, work items, comment counts): those are fetched lazily for
 * the selected PR by fetchPrDetails, so `detailsLoaded` starts false.
 */
export const toPullRequest = (
  project: AdoProjectConfig,
  repository: string,
  raw: AzurePullRequest,
): PullRequest => ({
  ...normalizePullRequest(raw, {
    organization: project.organization,
    project: project.project!,
    repository,
  }),
  detailsLoaded: false,
});

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
