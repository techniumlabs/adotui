/**
 * Barrel for the Azure DevOps data layer. Everything goes over the REST API;
 * the az CLI is only a credential source (when no PAT is set).
 *   - adoFetch.ts     — REST client (auth header, retries, error mapping)
 *   - azureAuth.ts    — cached auth header (PAT / AAD bearer via az)
 *   - azureCommon.ts  — az constants (credential lookup)
 *   - azureIdentity.ts — the signed-in identity (connectionData)
 *   - azureDiff.ts    — on-demand file diffs via the git items REST API
 *   - azureLoad.ts    — project/repo/PR discovery and the loadAppData tree
 *   - azureRest.ts    — PR comment threads + pipeline runs
 *   - azureActions.ts — PR mutations (vote / abandon / complete)
 */
export { getCurrentIdentity } from "./azureIdentity";
export { findIdentityId, listBranches } from "./azureDiscovery";
export { fetchFileDiff } from "./azureDiff";
export {
  fetchPrDetails,
  groupPrsByRepository,
  loadAppData,
  mapWithConcurrency,
  type LoadPartial,
  type LoadProgress,
} from "./azureLoad";
export {
  abandonPr,
  approvePr,
  completePr,
  createPullRequest,
  rejectPr,
  type CompletionOutcome,
  type PrRef,
} from "./azureActions";
