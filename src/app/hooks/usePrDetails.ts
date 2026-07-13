import { useEffect } from "react";
import type { PullRequest } from "../../domain/types";
import { fetchPrDetails } from "../../data/azure";

export function usePrDetails(
  selectedPr: PullRequest | undefined,
  updatePr: (orgUrl: string, repoName: string, prId: number, updates: Partial<PullRequest>) => void
) {
  useEffect(() => {
    if (!selectedPr) return;
    if (selectedPr.detailsLoaded) return;

    // Fetch the details
    let isCancelled = false;

    fetchPrDetails(selectedPr).then((details) => {
      if (isCancelled) return;
      updatePr(selectedPr.organizationUrl, selectedPr.repository, selectedPr.id, details);
    }).catch((err) => {
      // In case of error, mark it as loaded so we don't infinitely retry
      if (!isCancelled) {
        updatePr(selectedPr.organizationUrl, selectedPr.repository, selectedPr.id, { detailsLoaded: true });
        console.error("Failed to load PR details lazily:", err);
      }
    });

    return () => {
      isCancelled = true;
    };
  }, [selectedPr, updatePr]);
}
