import { useEffect } from "react";
import type { PullRequest, PullRequestFileChange } from "../../domain/types";
import { prScope } from "../../data/refs";

type UpdateFileDiff = (
  target: PullRequest,
  filePath: string,
  diffData: { rawDiff: string; additions: number; deletions: number } | null,
) => void;

/**
 * Lazily fetches the unified diff for the selected file once it becomes
 * visible (Azure's change list is metadata-only).
 */
export function useLazyFileDiff(
  selectedPr: PullRequest | undefined,
  selectedFile: PullRequestFileChange | undefined,
  updateFileDiff?: UpdateFileDiff,
  setFileLoading?: (target: PullRequest, filePath: string) => void,
): void {
  useEffect(() => {
    // `rawDiff === undefined`, not falsy: an empty file's diff is "" and is loaded.
    if (selectedPr && selectedFile && selectedFile.rawDiff === undefined && !selectedFile.loadingDiff && updateFileDiff && setFileLoading) {
      if (selectedPr.iterSourceCommit && selectedPr.iterTargetCommit) {
        setFileLoading(selectedPr, selectedFile.path);
        import("../../data/azure").then(({ fetchFileDiff }) => {
          fetchFileDiff(
            prScope(selectedPr),
            selectedFile,
            selectedPr.iterSourceCommit!,
            selectedPr.iterTargetCommit!
          ).then(res => {
            updateFileDiff(selectedPr, selectedFile.path, res);
          });
        });
      }
    }
  }, [selectedPr, selectedFile, updateFileDiff, setFileLoading]);
}
