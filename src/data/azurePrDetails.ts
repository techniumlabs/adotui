/**
 * Lazy per-PR details over the Azure DevOps REST API: changed files (paged),
 * policy checks, work items and comment counts for the selected PR. Each fetch
 * reports null on failure so a blip never overwrites what is already shown.
 */
import type { PullRequest, PullRequestFileChange, PullRequestWorkItem } from "../domain/types";
import type { AzureIteration, AzureIterationChange, AzureIterationChanges, AzureIterationList, AzurePolicyEvaluation } from "./azureTypes";
import { normalizeFileChanges, summarizeChecks } from "./azureNormalize";
import { fetchPrComments } from "./azureRest";
import { adoGet, seg, type AdoList } from "./adoFetch";
import { CHANGES_MAX_PAGES, CHANGES_PAGE_SIZE } from "./constants";
import { debugLog } from "../shared/debugLog";
import { prScope, type PrScope } from "./refs";

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

/**
 * Fetches blocking policy evaluations for a PR (check rollup). Returns null
 * when they could not be fetched, which is not the same as "no policies": the
 * caller keeps the counts it already has instead of showing 0 checks.
 */
const listPrPolicies = async (
  organization: string,
  project: string,
  projectId: string | undefined,
  prId: number,
): Promise<AzurePolicyEvaluation[] | null> => {
  if (!projectId) return null;
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
  } catch (cause) {
    // Policies may be unavailable (no permission, no policy service).
    debugLog("listPrPolicies failed", prId, cause);
    return null;
  }
};

/** Fetches work items linked to a PR (refs, then one batch hydration call); null on failure. */
const listPrWorkItems = async (scope: PrScope): Promise<PullRequestWorkItem[] | null> => {
  const { organizationUrl: organization, project, repositoryId, prId } = scope;
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
  } catch (cause) {
    debugLog("listPrWorkItems failed", prId, cause);
    return null;
  }
};

/** Pages through an iteration's change entries so large PRs are not truncated. */
const listIterationChanges = async (
  organization: string,
  changesPath: string,
): Promise<AzureIterationChange[]> => {
  const entries: AzureIterationChange[] = [];
  let skip = 0;
  for (let page = 0; page < CHANGES_MAX_PAGES; page += 1) {
    const result = await adoGet<AzureIterationChanges>(organization, changesPath, {
      query: { "$top": CHANGES_PAGE_SIZE, ...(skip > 0 ? { "$skip": skip } : {}) },
    });
    const batch = result.changeEntries ?? [];
    entries.push(...batch);
    // Trust the server's cursor; failing that, a full page means there may be more.
    const next = result.nextSkip || (batch.length >= CHANGES_PAGE_SIZE ? skip + batch.length : 0);
    if (!next) return entries;
    skip = next;
  }
  debugLog("iteration changes truncated at", entries.length, changesPath);
  return entries;
};

/**
 * Fetches changed files for a PR from the latest iteration, along with the
 * commit pair the diff view needs to fetch file contents lazily. Null when the
 * fetch failed (a PR with no iterations is a real, empty result).
 */
const listPrFileChanges = async (
  scope: PrScope,
): Promise<{ files: PullRequestFileChange[]; iterSourceCommit?: string; iterTargetCommit?: string } | null> => {
  const { organizationUrl: organization, project, repositoryId, prId } = scope;
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

    const iterSourceCommit = latestIter.sourceRefCommit?.commitId;
    const iterTargetCommit = latestIter.commonRefCommit?.commitId ?? latestIter.targetRefCommit?.commitId;

    const files = normalizeFileChanges(
      await listIterationChanges(organization, `${prPath}/iterations/${latest}/changes`),
    );

    return { files, iterSourceCommit, iterTargetCommit };
  } catch (cause) {
    debugLog("listPrFileChanges failed", prId, cause);
    return null;
  }
};

export const fetchPrDetails = async (pr: PullRequest): Promise<Partial<PullRequest>> => {
  const scope = prScope(pr);
  // PRs restored from an older cache may predate the stored project id.
  const projectId = pr.projectId ?? (await resolveProjectId(pr.organizationUrl, pr.project));

  const [fileRes, policies, items, threads] = await Promise.all([
    listPrFileChanges(scope),
    listPrPolicies(pr.organizationUrl, pr.project, projectId, pr.id),
    listPrWorkItems(scope),
    fetchPrComments(scope),
  ]);

  // Each fetch reports null on failure. A failed one is left out of the result,
  // so applying it keeps what the PR already shows instead of overwriting it
  // with zeros (a refresh would otherwise blank the counts on a network blip).
  const details: Partial<PullRequest> = { detailsLoaded: true };
  if (fileRes) {
    details.changedFiles = fileRes.files;
    details.iterSourceCommit = fileRes.iterSourceCommit;
    details.iterTargetCommit = fileRes.iterTargetCommit;
  }
  if (policies) {
    const checks = summarizeChecks(policies);
    details.checksPassed = checks.passed;
    details.checksTotal = checks.total;
  }
  if (items) details.workItems = items;
  if (threads) {
    details.comments = threads.reduce((acc, t) => acc + t.comments.length, 0);
    details.activeComments = threads.reduce(
      (acc, t) => acc + (t.status === "active" || t.status === "pending" ? t.comments.length : 0),
      0,
    );
  }
  return details;
};
