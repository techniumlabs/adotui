/**
 * Thin Azure DevOps REST client — the single place adotui talks HTTP.
 *
 * Reads go through here instead of spawning `az` (a python process per call
 * costs ~400-1200ms before any request is made). Auth still comes from the
 * CLI (or a PAT) via azureAuth, cached between calls.
 */
import { getAdoAuthHeader, clearAuthHeaderCache, isUsingPat } from "./azureAuth";
import {
  ADO_API_VERSION,
  ADO_MAX_ATTEMPTS,
  ADO_REQUEST_TIMEOUT_MS,
  ADO_RETRY_BASE_DELAY_MS,
  ADO_SIGN_IN_MAX_ATTEMPTS,
  ERROR_SNIPPET_CHARS,
  HTTP,
  MS_PER_SECOND,
} from "./constants";

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

export interface AdoRequestOptions {
  query?: Record<string, string | number | undefined>;
  apiVersion?: string;
  timeoutMs?: number;
}

const buildUrl = (
  baseUrl: string,
  path: string,
  query: Record<string, string | number | undefined> = {},
  apiVersion = ADO_API_VERSION,
): string => {
  const base = baseUrl.replace(/\/+$/, "");
  const url = new URL(`${base}/${path.replace(/^\/+/, "")}`);
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }
  url.searchParams.set("api-version", apiVersion);
  return url.toString();
};

/**
 * Azure DevOps answers an unauthenticated request — and a request for an
 * organization that does not exist — with a sign-in page, not a 401: either a
 * 203, or a 302 that fetch follows to an HTML page with status 200. Parsing
 * that as JSON used to surface as "Unrecognized token '<'".
 */
const isSignInPage = (resp: Response, asText: boolean): boolean =>
  resp.status === HTTP.NON_AUTHORITATIVE ||
  (resp.ok && resp.redirected && /\/_signin\b/i.test(resp.url)) ||
  (resp.ok && !asText && (resp.headers.get("content-type") ?? "").includes("text/html"));

/** `https://dev.azure.com/acme/...` → `acme` (or the host, for `<org>.visualstudio.com`). */
const organizationOf = (url: string): string => {
  const { hostname, pathname } = new URL(url);
  // Exact host or a real subdomain (vssps.dev.azure.com): a bare suffix match would also take evil-dev.azure.com.
  const isDevAzure = hostname === "dev.azure.com" || hostname.endsWith(".dev.azure.com");
  return isDevAzure ? (pathname.split("/")[1] ?? hostname) : hostname;
};

const signInMessage = (url: string): string => {
  const organization = organizationOf(url);
  if (isUsingPat()) {
    // A PAT is used instead of `az login`, so a bad one fails even when you are logged in.
    return (
      `Azure DevOps rejected your personal access token (AZURE_DEVOPS_EXT_PAT, or "pat" in the config; ` +
      `a PAT is used instead of \`az login\`). It is invalid, expired, or not for the organization ` +
      `"${organization}". Fix it, or remove it to sign in with \`az login\`.`
    );
  }
  return (
    `Azure DevOps answered with a sign-in page instead of data. Check that the organization ` +
    `"${organization}" exists and that you are signed in to it (run \`az login\`, or set AZURE_DEVOPS_EXT_PAT).`
  );
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
  if (resp.status === HTTP.UNAUTHORIZED) {
    return "not authenticated — run `az login` or set AZURE_DEVOPS_EXT_PAT";
  }
  if (resp.status === HTTP.FORBIDDEN) {
    return "access denied — the signed-in identity lacks permission for this resource";
  }
  if (resp.status === HTTP.NOT_FOUND) {
    return "not found — check the organization, project and repository names";
  }
  // An HTML error page is not a reason; quoting its first tag helps nobody.
  const firstLine = body.trim().startsWith("<") ? "" : body.trim().split("\n")[0]?.slice(0, ERROR_SNIPPET_CHARS);
  return firstLine || resp.statusText || "unknown error";
};

const retryDelayMs = (resp: Response, attempt: number): number => {
  const retryAfter = Number(resp.headers.get("retry-after"));
  if (Number.isFinite(retryAfter) && retryAfter > 0) return retryAfter * MS_PER_SECOND;
  return ADO_RETRY_BASE_DELAY_MS * attempt;
};

/** Reads a successful response: raw text, or parsed JSON ({} when there is no body). */
const readBody = async <T>(resp: Response, url: string, asText: boolean): Promise<T> => {
  if (asText) return (resp.status === HTTP.NO_CONTENT ? "" : await resp.text()) as T;
  if (resp.status === HTTP.NO_CONTENT) return {} as T;
  const text = await resp.text();
  if (!text.trim()) return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new AdoHttpError(resp.status, url, `unexpected response (not JSON): ${text.trim().slice(0, ERROR_SNIPPET_CHARS)}`);
  }
};

/**
 * Whether a response is worth another attempt, and how.
 * - "auth": an expired cached token; drop it and re-acquire. A sign-in page
 *   gets one retry only: a second one will not change for a third token (a
 *   mistyped organization would otherwise cost several `az` processes).
 * - "wait": throttled, or a transient server fault on a replay-safe method;
 *   back off (honouring Retry-After).
 */
const retryAfterResponse = (
  resp: Response,
  { signIn, replaySafe, attempt }: { signIn: boolean; replaySafe: boolean; attempt: number },
): "auth" | "wait" | null => {
  const authAttempts = signIn ? ADO_SIGN_IN_MAX_ATTEMPTS : ADO_MAX_ATTEMPTS;
  if ((resp.status === HTTP.UNAUTHORIZED || signIn) && attempt < authAttempts) return "auth";
  const transient = resp.status === HTTP.TOO_MANY_REQUESTS || (resp.status >= HTTP.SERVER_ERROR && replaySafe);
  if (transient && attempt < ADO_MAX_ATTEMPTS) return "wait";
  return null;
};

const requestUrl = async <T>(
  baseUrl: string,
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  path: string,
  options: AdoRequestOptions & { body?: unknown; as?: "json" | "text" } = {},
): Promise<T> => {
  const url = buildUrl(baseUrl, path, options.query, options.apiVersion);
  // After a timeout, connection error or 5xx the server may already have
  // acted, so only idempotent methods are replayed: retrying a POST there
  // would post the comment twice. 429 and 401 are rejected before anything
  // runs, so they are safe to retry for every method.
  const replaySafe = method !== "POST";
  const asText = options.as === "text";

  for (let attempt = 1; attempt <= ADO_MAX_ATTEMPTS; attempt += 1) {
    const authHeader = await getAdoAuthHeader();
    if (!authHeader) {
      throw new AdoHttpError(HTTP.UNAUTHORIZED, url, "no Azure DevOps credentials (az login or AZURE_DEVOPS_EXT_PAT)");
    }

    const headers: Record<string, string> = {
      Authorization: authHeader,
      Accept: asText ? "text/plain" : "application/json",
    };
    if (options.body !== undefined) headers["Content-Type"] = "application/json";

    let resp: Response;
    try {
      resp = await fetch(url, {
        method,
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: AbortSignal.timeout(options.timeoutMs ?? ADO_REQUEST_TIMEOUT_MS),
      });
    } catch (cause) {
      if (attempt === ADO_MAX_ATTEMPTS || !replaySafe) {
        throw new AdoHttpError(0, url, cause instanceof Error ? cause.message : String(cause));
      }
      await Bun.sleep(ADO_RETRY_BASE_DELAY_MS * attempt);
      continue;
    }

    const signIn = isSignInPage(resp, asText);
    const retry = retryAfterResponse(resp, { signIn, replaySafe, attempt });
    if (retry === "auth") {
      clearAuthHeaderCache();
      continue;
    }
    if (retry === "wait") {
      await Bun.sleep(retryDelayMs(resp, attempt));
      continue;
    }
    if (signIn) throw new AdoHttpError(HTTP.UNAUTHORIZED, url, signInMessage(url));
    if (!resp.ok) {
      throw new AdoHttpError(resp.status, url, await describeFailure(resp));
    }

    return readBody<T>(resp, url, asText);
  }

  throw new AdoHttpError(0, url, "exhausted retries");
};

export const adoGet = <T>(organization: string, path: string, options?: AdoRequestOptions): Promise<T> =>
  requestUrl<T>(organization, "GET", path, options);

export const adoPost = <T>(organization: string, path: string, body: unknown, options?: AdoRequestOptions): Promise<T> =>
  requestUrl<T>(organization, "POST", path, { ...options, body });

export const adoPut = <T>(organization: string, path: string, body: unknown, options?: AdoRequestOptions): Promise<T> =>
  requestUrl<T>(organization, "PUT", path, { ...options, body });

export const adoPatch = <T>(organization: string, path: string, body: unknown, options?: AdoRequestOptions): Promise<T> =>
  requestUrl<T>(organization, "PATCH", path, { ...options, body });

export const adoDelete = <T>(organization: string, path: string, options?: AdoRequestOptions): Promise<T> =>
  requestUrl<T>(organization, "DELETE", path, options);

/** GET returning the raw response body (e.g. file content from the git items API). */
export const adoGetText = (organization: string, path: string, options?: AdoRequestOptions): Promise<string> =>
  requestUrl<string>(organization, "GET", path, { ...options, as: "text" });

/** For endpoints on a different host (e.g. the vssps identity service). */
export const adoGetFrom = <T>(baseUrl: string, path: string, options?: AdoRequestOptions): Promise<T> =>
  requestUrl<T>(baseUrl, "GET", path, options);

/** Exposed for tests. */
export const __buildUrl = buildUrl;
