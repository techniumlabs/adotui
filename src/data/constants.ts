/**
 * Tunables for the data layer: REST client, az CLI, paging, caches, config.
 * One place to find and change them (see "Constants" in CLAUDE.md).
 */

export const MS_PER_SECOND = 1_000;

// ─── REST client (adoFetch.ts) ────────────────────────────────────────────────

export const ADO_API_VERSION = "7.1";
/** connectionData is preview-only: plain 7.1 answers HTTP 400 (checked against a live org). */
export const CONNECTION_DATA_API_VERSION = "7.1-preview.1";
export const ADO_REQUEST_TIMEOUT_MS = 20_000;
export const ADO_MAX_ATTEMPTS = 3;
/** A sign-in page gets one token refresh; a second one will not change for a third token. */
export const ADO_SIGN_IN_MAX_ATTEMPTS = 2;
/** Backoff unit: attempt n waits n times this (unless Retry-After says otherwise). */
export const ADO_RETRY_BASE_DELAY_MS = 500;
/** How much of an unexpected body is quoted in an error message. */
export const ERROR_SNIPPET_CHARS = 200;
export const FILE_CONTENT_TIMEOUT_MS = 15_000;

/** HTTP statuses the client acts on. */
export const HTTP = {
  NON_AUTHORITATIVE: 203,
  NO_CONTENT: 204,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  TOO_MANY_REQUESTS: 429,
  SERVER_ERROR: 500,
} as const;

// ─── az CLI (command.ts, azureAuth.ts) ───────────────────────────────────────

export const COMMAND_TIMEOUT_MS = 20_000;
export const AZ_TOKEN_TIMEOUT_MS = 10_000;
/** Refresh a token this long before it actually expires. */
export const TOKEN_EXPIRY_MARGIN_MS = 60_000;
/** Used when the CLI reports no usable expiry: 45 minutes. */
export const TOKEN_FALLBACK_TTL_MS = 2_700_000;

// ─── Listing and paging ──────────────────────────────────────────────────────

/** Projects fetched at once; each issues two requests in parallel (repo discovery + PR listing). */
export const PROJECT_FETCH_CONCURRENCY = 4;
/** Page size for the project-wide PR listing. */
export const PR_LIST_PAGE_SIZE = 100;
/** Safety valve: at most this many pages (2000 PRs) per project. */
export const PR_LIST_MAX_PAGES = 20;
/** The iteration changes endpoint serves at most 2000 entries per request. */
export const CHANGES_PAGE_SIZE = 2_000;
/** Safety valve: 10 pages = 20000 changed entries. */
export const CHANGES_MAX_PAGES = 10;
export const PIPELINE_RUNS_TOP = 30;
export const PIPELINE_RUNS_TIMEOUT_MS = 25_000;

/** IdentityRefWithVote.vote values. */
export const VOTE = {
  APPROVE: 10,
  APPROVE_WITH_SUGGESTIONS: 5,
  NONE: 0,
  WAIT_FOR_AUTHOR: -5,
  REJECT: -10,
} as const;

// ─── Caches and config ───────────────────────────────────────────────────────

/** Comment and pipeline-run caches: 2 minutes. */
export const VIEW_CACHE_TTL_MS = 120_000;
/** Hex characters of the config hash in the data cache file name. */
export const CACHE_KEY_HASH_CHARS = 16;
/** Walking up from the cwd for a local config stops after this many directories. */
export const CONFIG_SEARCH_MAX_DEPTH = 64;
/** A config file holding a PAT is owner-only. */
export const OWNER_ONLY_FILE_MODE = 0o600;
