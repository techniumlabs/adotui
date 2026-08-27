import { useCallback, useEffect, useRef, useState } from "react";
import type { PipelineRun, PullRequest } from "../../domain/types";
import { fetchPipelineRuns } from "../../data/azureRest";
import { getRunsCache, runsCacheKey, setRunsCache } from "../../data/cache";

/**
 * Data layer for the pipeline runs view: cached fetching per org/project.
 * Selection state stays in the component; `onFreshLoad` fires after each
 * non-cached fetch so the caller can reset it.
 */
export function usePipelineRuns(
  selectedPr: PullRequest | undefined,
  onFreshLoad?: () => void,
) {
  const [runs, setRuns] = useState<PipelineRun[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onFreshLoadRef = useRef(onFreshLoad);
  onFreshLoadRef.current = onFreshLoad;

  const loadRuns = useCallback(
    async (force = false) => {
      if (!selectedPr) return;
      const key = runsCacheKey(selectedPr.organizationUrl, selectedPr.project);

      if (!force) {
        const cached = getRunsCache(key);
        if (cached) {
          setRuns(cached);
          return;
        }
      }

      setLoading(true);
      setError(null);
      try {
        const data = await fetchPipelineRuns(
          selectedPr.organizationUrl,
          selectedPr.project,
        );
        setRunsCache(key, data);
        setRuns(data);
        onFreshLoadRef.current?.();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load pipeline runs.");
      } finally {
        setLoading(false);
      }
    },
    [selectedPr],
  );

  useEffect(() => {
    if (selectedPr) {
      void loadRuns();
    } else {
      setRuns([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPr?.id]);

  return { runs, loading, error, loadRuns };
}
