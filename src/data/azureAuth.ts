/**
 * Authentication for adotui's direct Azure DevOps REST calls.
 *
 * Almost all data access goes through the az CLI (which manages its own
 * auth); the ONE exception is raw file content for diff rendering
 * (azureDiff.ts), which hits the git items REST API directly and needs the
 * Authorization header produced here.
 */
import { runJson } from "./command";
import { AZ, jsonOutput } from "./azureCommon";

/**
 * Returns an Authorization header value for direct Azure DevOps REST calls.
 * Prefers a PAT from AZURE_DEVOPS_EXT_PAT (also populated from the config
 * file's `pat` by dataController); falls back to an AAD bearer token
 * obtained via `az account get-access-token`.
 */
export const getAdoAuthHeader = async (): Promise<string | null> => {
  const pat = process.env.AZURE_DEVOPS_EXT_PAT;
  if (pat) {
    return `Basic ${btoa(`:${pat}`)}`;
  }
  try {
    const result = await runJson<{ accessToken: string }>(AZ, [
      "account",
      "get-access-token",
      "--resource",
      "499b84ac-1321-427f-aa17-267ca6975798",
      ...jsonOutput,
    ], { timeoutMs: 10_000 });
    return `Bearer ${result.accessToken}`;
  } catch {
    return null;
  }
};
