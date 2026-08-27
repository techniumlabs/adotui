/**
 * Barrel for the Azure DevOps data layer. Implementation lives in:
 *   - azureCommon.ts  — az constants + CLI availability check
 *   - azureAuth.ts    — auth header for direct REST calls (PAT / AAD bearer)
 *   - azureDiff.ts    — on-demand file diffs via the git items REST API
 *   - azureLoad.ts    — project/repo/PR discovery and the loadAppData tree
 *   - azureActions.ts — PR mutations (vote / abandon / complete)
 *   - azureRest.ts    — PR comment threads + pipeline runs via az devops invoke
 */
export { checkAzAvailable } from "./azureCommon";
export { fetchFileDiff } from "./azureDiff";
export {
  fetchPrDetails,
  groupPrsByRepository,
  loadAppData,
  mapWithConcurrency,
  type LoadOptions,
  type LoadProgress,
} from "./azureLoad";
export {
  abandonPr,
  approvePr,
  completePr,
  completionStrategyNote,
  rejectPr,
  setVote,
  type PrRef,
} from "./azureActions";
