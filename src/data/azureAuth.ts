/**
 * Authentication for adotui's Azure DevOps REST calls (adoFetch.ts).
 *
 * Data access is REST; the CLI is still the credential source — either a PAT
 * from AZURE_DEVOPS_EXT_PAT (also populated from the config file's `pat` by
 * dataController) or an AAD token from `az account get-access-token`. The
 * token is cached until shortly before it expires so a single `az` call
 * covers a whole session instead of every request.
 */
import { runJson } from "./command";
import { AZ, jsonOutput } from "./azureCommon";
import { AZ_TOKEN_TIMEOUT_MS, MS_PER_SECOND, TOKEN_EXPIRY_MARGIN_MS, TOKEN_FALLBACK_TTL_MS } from "./constants";

/** Azure DevOps resource id — constant across tenants. */
const ADO_RESOURCE = "499b84ac-1321-427f-aa17-267ca6975798";

let cached: { header: string; expiresAt: number } | null = null;

interface AccessTokenResult {
  accessToken: string;
  /** Local-time string, e.g. "2026-08-27 13:00:00.000000". */
  expiresOn?: string;
  /** Epoch seconds (newer CLI versions). */
  expires_on?: number;
}

const expiryFrom = (result: AccessTokenResult): number => {
  if (typeof result.expires_on === "number" && Number.isFinite(result.expires_on)) {
    return result.expires_on * MS_PER_SECOND;
  }
  if (result.expiresOn) {
    const parsed = Date.parse(result.expiresOn);
    if (Number.isFinite(parsed)) return parsed;
  }
  return Date.now() + TOKEN_FALLBACK_TTL_MS;
};

/** The `az` call currently running, shared by every caller that arrives meanwhile. */
let inflight: Promise<string | null> | null = null;

const acquireToken = async (): Promise<string | null> => {
  try {
    const result = await runJson<AccessTokenResult>(AZ, [
      "account",
      "get-access-token",
      "--resource",
      ADO_RESOURCE,
      ...jsonOutput,
    ], { timeoutMs: AZ_TOKEN_TIMEOUT_MS });
    const header = `Bearer ${result.accessToken}`;
    cached = { header, expiresAt: expiryFrom(result) - TOKEN_EXPIRY_MARGIN_MS };
    return header;
  } catch {
    cached = null;
    return null;
  }
};

/**
 * True when requests authenticate with a PAT (AZURE_DEVOPS_EXT_PAT, which the
 * config's `pat` fills in). A PAT wins over `az login`, so a rejected one is
 * the thing to report — telling the user to log in would be wrong.
 */
export const isUsingPat = (): boolean => !!process.env.AZURE_DEVOPS_EXT_PAT;

/**
 * Returns an Authorization header value, or null when no credentials are
 * available. PATs are used verbatim; AAD tokens are cached until expiry.
 */
export const getAdoAuthHeader = async (): Promise<string | null> => {
  const pat = process.env.AZURE_DEVOPS_EXT_PAT;
  if (pat) {
    return `Basic ${btoa(`:${pat}`)}`;
  }

  if (cached && Date.now() < cached.expiresAt) {
    return cached.header;
  }

  // A cold start fires several requests at once; without sharing, each one
  // would spawn its own `az` process (~400-1200ms of Python apiece).
  if (!inflight) {
    const request = acquireToken().finally(() => {
      if (inflight === request) inflight = null;
    });
    inflight = request;
  }
  return inflight;
};

/** Drops the cached token (called after a 401 so the next call re-acquires). */
export const clearAuthHeaderCache = (): void => {
  cached = null;
  inflight = null;
};
