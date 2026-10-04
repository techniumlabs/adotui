import { useEffect } from "react";
import type { PullRequest } from "../../domain/types";
import { fetchPrDetails } from "../../data/azure";
import type { PrTarget } from "../actions/prDataActions";

export function usePrDetails(
  selectedPr: PullRequest | undefined,
  updatePr: (target: PrTarget, updates: Partial<PullRequest>) => void
) {
  useEffect(() => {
    if (!selectedPr) return;
    // A refresh keeps the previous details on screen but clears this flag,
    // so the selected PR revalidates in the background.
    if (selectedPr.detailsLoaded) return;

    // Fetch the details
    let isCancelled = false;

    fetchPrDetails(selectedPr).then((details) => {
      if (isCancelled) return;
      updatePr(selectedPr, details);
    }).catch((err) => {
      // In case of error, mark it as loaded so we don't infinitely retry
      if (!isCancelled) {
        updatePr(selectedPr, { detailsLoaded: true });
        console.error("Failed to load PR details lazily:", err);
      }
    });

    return () => {
      isCancelled = true;
    };
  }, [selectedPr, updatePr]);
}
