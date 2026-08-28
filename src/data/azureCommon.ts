/** Shared constants and helpers used by the azure* data modules. */
import { CommandError, run } from "./command";

export const AZ = "az";

export const orgArgs = (organization: string): string[] => [
  "--organization",
  organization,
];

export const jsonOutput = ["--output", "json"];

/** Verifies the az CLI and the azure-devops extension are available. */
export const checkAzAvailable = async (): Promise<
  { ok: true } | { ok: false; error: string }
> => {
  try {
    await run(AZ, ["repos", "-h"], { timeoutMs: 15_000 });
    return { ok: true };
  } catch (cause) {
    if (cause instanceof CommandError) {
      return {
        ok: false,
        error:
          `Azure CLI check failed: ${cause.detail}. ` +
          `Ensure 'az' is installed, you're logged in (az login), and the ` +
          `azure-devops extension is present (az extension add --name azure-devops).`,
      };
    }
    return { ok: false, error: String(cause) };
  }
};
