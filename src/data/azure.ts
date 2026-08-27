/**
 * Barrel for the Azure DevOps data layer. Reads go over the REST API;
 * the az CLI remains the credential source and performs the mutations.
 *   - adoFetch.ts     — REST client (auth header, retries, error mapping)
 *   - azureAuth.ts    — cached auth header (PAT / AAD bearer via az)
 *   - azureCommon.ts  — az constants + CLI availability check
 *   - azureDiff.ts    — on-demand file diffs via the git items REST API
 *   - azureLoad.ts    — project/repo/PR discovery and the loadAppData tree
 *   - azureRest.ts    — PR comment threads + pipeline runs
 *   - azureActions.ts — PR mutations (vote / abandon / complete) via az
 */
export { checkAzAvailable } from "./azureCommon";
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
  completionStrategyNote,
  rejectPr,
  type PrRef,
} from "./azureActions";
