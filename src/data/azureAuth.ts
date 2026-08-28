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

/** Azure DevOps resource id — constant across tenants. */
const ADO_RESOURCE = "499b84ac-1321-427f-aa17-267ca6975798";

/** Refresh this long before the token actually expires. */
const EXPIRY_MARGIN_MS = 60_000;
/** Used when the CLI reports no usable expiry. */
const FALLBACK_TTL_MS = 45 * 60_000;

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
    return result.expires_on * 1000;
  }
  if (result.expiresOn) {
    const parsed = Date.parse(result.expiresOn);
    if (Number.isFinite(parsed)) return parsed;
  }
  return Date.now() + FALLBACK_TTL_MS;
};

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

  try {
    const result = await runJson<AccessTokenResult>(AZ, [
      "account",
      "get-access-token",
      "--resource",
      ADO_RESOURCE,
      ...jsonOutput,
    ], { timeoutMs: 10_000 });
    const header = `Bearer ${result.accessToken}`;
    cached = { header, expiresAt: expiryFrom(result) - EXPIRY_MARGIN_MS };
    return header;
  } catch {
    cached = null;
    return null;
  }
};

/** Drops the cached token (called after a 401 so the next call re-acquires). */
export const clearAuthHeaderCache = (): void => {
  cached = null;
};
