/**
 * The signed-in Azure DevOps identity, from the REST connectionData endpoint.
 * Works for PAT and az logins alike (unlike `az account show`, which has
 * nothing to say for a PAT), and gives the identity GUID that voting needs.
 */
import { adoGet } from "./adoFetch";
import { debugLog } from "../shared/debugLog";

export interface AdoIdentity {
  /** Identity GUID, the reviewer id for votes. */
  id: string;
  /** Sign-in address (UPN/email), as used by the "me" filter; null if not reported. */
  email: string | null;
}

interface ConnectionData {
  authenticatedUser?: {
    id?: string;
    properties?: { Account?: { $value?: string } };
  };
}

/** connectionData is preview-only: plain 7.1 answers HTTP 400 (checked live). */
const CONNECTION_DATA_API_VERSION = "7.1-preview.1";

const cache = new Map<string, Promise<AdoIdentity | null>>();

const fetchIdentity = async (organization: string): Promise<AdoIdentity | null> => {
  try {
    const data = await adoGet<ConnectionData>(organization, "_apis/connectionData", {
      apiVersion: CONNECTION_DATA_API_VERSION,
    });
    const user = data.authenticatedUser;
    if (!user?.id) return null;
    return { id: user.id, email: user.properties?.Account?.$value ?? null };
  } catch (cause) {
    debugLog("identity lookup failed for", organization, cause);
    return null;
  }
};

/**
 * Resolves the identity once per organization (it cannot change mid-session).
 * A failed lookup is not cached, so a transient error does not stick.
 */
export const getCurrentIdentity = (organization: string): Promise<AdoIdentity | null> => {
  let pending = cache.get(organization);
  if (!pending) {
    pending = fetchIdentity(organization).then((identity) => {
      if (!identity) cache.delete(organization);
      return identity;
    });
    cache.set(organization, pending);
  }
  return pending;
};

/** Test hook. */
export const clearIdentityCache = (): void => cache.clear();
