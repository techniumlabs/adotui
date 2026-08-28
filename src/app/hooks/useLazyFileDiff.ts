import { useEffect } from "react";
import type { PullRequest, PullRequestFileChange } from "../../domain/types";

type UpdateFileDiff = (
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
  setFileLoading?: (filePath: string) => void,
): void {
  useEffect(() => {
    if (selectedPr && selectedFile && !selectedFile.rawDiff && !selectedFile.loadingDiff && updateFileDiff && setFileLoading) {
      if (selectedPr.iterSourceCommit && selectedPr.iterTargetCommit) {
        setFileLoading(selectedFile.path);
        import("../../data/azure").then(({ fetchFileDiff }) => {
          fetchFileDiff(
            selectedPr.organizationUrl,
            selectedPr.project,
            selectedPr.repositoryId ?? selectedPr.repository,
            selectedFile,
            selectedPr.iterSourceCommit!,
            selectedPr.iterTargetCommit!
          ).then(res => {
            updateFileDiff(selectedFile.path, res);
          });
        });
      }
    }
  }, [selectedPr, selectedFile, updateFileDiff, setFileLoading]);
}
