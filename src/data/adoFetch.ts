/**
 * Thin Azure DevOps REST client — the single place adotui talks HTTP.
 *
 * Reads go through here instead of spawning `az` (a python process per call
 * costs ~400-1200ms before any request is made). Auth still comes from the
 * CLI (or a PAT) via azureAuth, cached between calls.
 */
import { getAdoAuthHeader, clearAuthHeaderCache } from "./azureAuth";

/** Standard Azure DevOps list envelope. */
export interface AdoList<T> {
  count?: number;
  value?: T[];
}

export class AdoHttpError extends Error {
  readonly status: number;
  readonly url: string;
  readonly detail: string;

  constructor(status: number, url: string, detail: string) {
    super(`Azure DevOps request failed (${status}): ${detail}`);
    this.name = "AdoHttpError";
    this.status = status;
    this.url = url;
    this.detail = detail;
  }
}

/** Escapes a single URL path segment (project/repo names may contain spaces). */
export const seg = (value: string): string => encodeURIComponent(value);

const DEFAULT_API_VERSION = "7.1";
const DEFAULT_TIMEOUT_MS = 20_000;
const MAX_ATTEMPTS = 3;

export interface AdoRequestOptions {
  query?: Record<string, string | number | undefined>;
  apiVersion?: string;
  timeoutMs?: number;
}

const buildUrl = (
  baseUrl: string,
  path: string,
  query: Record<string, string | number | undefined> = {},
  apiVersion = DEFAULT_API_VERSION,
): string => {
  const base = baseUrl.replace(/\/+$/, "");
  const url = new URL(`${base}/${path.replace(/^\/+/, "")}`);
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }
  url.searchParams.set("api-version", apiVersion);
  return url.toString();
};

/** Turns an error response body into a short, human-readable reason. */
const describeFailure = async (resp: Response): Promise<string> => {
  let body = "";
  try {
    body = await resp.text();
  } catch {
    /* ignore */
  }
  try {
    const parsed = JSON.parse(body) as { message?: string };
    if (parsed.message) return parsed.message;
  } catch {
    /* not JSON */
  }
  if (resp.status === 401) {
    return "not authenticated — run `az login` or set AZURE_DEVOPS_EXT_PAT";
  }
  if (resp.status === 403) {
    return "access denied — the signed-in identity lacks permission for this resource";
  }
  if (resp.status === 404) {
    return "not found — check the organization, project and repository names";
  }
  return body.trim().split("\n")[0]?.slice(0, 200) || resp.statusText || "unknown error";
};

const retryDelayMs = (resp: Response, attempt: number): number => {
  const retryAfter = Number(resp.headers.get("retry-after"));
  if (Number.isFinite(retryAfter) && retryAfter > 0) return retryAfter * 1000;
  return 500 * attempt;
};

const requestUrl = async <T>(
  baseUrl: string,
  method: "GET" | "POST" | "PATCH" | "DELETE",
  path: string,
  options: AdoRequestOptions & { body?: unknown } = {},
): Promise<T> => {
  const url = buildUrl(baseUrl, path, options.query, options.apiVersion);

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const authHeader = await getAdoAuthHeader();
    if (!authHeader) {
      throw new AdoHttpError(401, url, "no Azure DevOps credentials (az login or AZURE_DEVOPS_EXT_PAT)");
    }

    const headers: Record<string, string> = { Authorization: authHeader, Accept: "application/json" };
    if (options.body !== undefined) headers["Content-Type"] = "application/json";

    let resp: Response;
    try {
      resp = await fetch(url, {
        method,
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: AbortSignal.timeout(options.timeoutMs ?? DEFAULT_TIMEOUT_MS),
      });
    } catch (cause) {
      if (attempt === MAX_ATTEMPTS) {
        throw new AdoHttpError(0, url, cause instanceof Error ? cause.message : String(cause));
      }
      await Bun.sleep(500 * attempt);
      continue;
    }

    // An expired cached token: drop it and let the next attempt re-acquire.
    if (resp.status === 401 && attempt < MAX_ATTEMPTS) {
      clearAuthHeaderCache();
      continue;
    }
    // Throttled or a transient server fault: honour Retry-After when given.
    if ((resp.status === 429 || resp.status >= 500) && attempt < MAX_ATTEMPTS) {
      await Bun.sleep(retryDelayMs(resp, attempt));
      continue;
    }
    if (!resp.ok) {
      throw new AdoHttpError(resp.status, url, await describeFailure(resp));
    }

    if (resp.status === 204) return {} as T;
    const text = await resp.text();
    if (!text.trim()) return {} as T;
    return JSON.parse(text) as T;
  }

  throw new AdoHttpError(0, url, "exhausted retries");
};

export const adoGet = <T>(organization: string, path: string, options?: AdoRequestOptions): Promise<T> =>
  requestUrl<T>(organization, "GET", path, options);

export const adoPost = <T>(organization: string, path: string, body: unknown, options?: AdoRequestOptions): Promise<T> =>
  requestUrl<T>(organization, "POST", path, { ...options, body });

export const adoPatch = <T>(organization: string, path: string, body: unknown, options?: AdoRequestOptions): Promise<T> =>
  requestUrl<T>(organization, "PATCH", path, { ...options, body });

export const adoDelete = <T>(organization: string, path: string, options?: AdoRequestOptions): Promise<T> =>
  requestUrl<T>(organization, "DELETE", path, options);

/** For endpoints on a different host (e.g. the vssps identity service). */
export const adoGetFrom = <T>(baseUrl: string, path: string, options?: AdoRequestOptions): Promise<T> =>
  requestUrl<T>(baseUrl, "GET", path, options);

/** Exposed for tests. */
export const __buildUrl = buildUrl;
