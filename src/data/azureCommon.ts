/** Shared constants and helpers used by azure.ts and azureRest.ts. */

export const AZ = "az";

export const orgArgs = (organization: string): string[] => [
  "--organization",
  organization,
];

export const jsonOutput = ["--output", "json"];
