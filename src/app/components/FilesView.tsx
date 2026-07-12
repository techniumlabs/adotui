import React, { useMemo, useState, useEffect } from "react";
import { Box, Text, useInput } from "ink";
import Spinner from "ink-spinner";
import type { PullRequest } from "../../domain/types";
import type { DiffViewMode, FocusArea } from "../types";
import { fileChangeBadge, glyph, palette, truncate } from "../theme";
import { postPrComment } from "../../data/azureRest";
import { usePasteHandler } from "../hooks/usePasteHandler";
// import fs from "node:fs";
type FilesViewProps = {
  selectedPr?: PullRequest;
  selectedFileIndex: number;
  diffScrollOffset: number;
  onScrollOffsetChange: (offset: number) => void;
  diffSelectedRow: number;
  onSelectedRowChange: (row: number) => void;
  focus: FocusArea;
  diffViewMode: DiffViewMode;
  onInputModeChange: (active: boolean) => void;
  isLoading?: boolean;
  fileFilter?: string;
  updateFileDiff?: (filePath: string, diffData: { rawDiff: string; additions: number; deletions: number } | null) => void;
  setFileLoading?: (filePath: string) => void;
};

// ─── diff renderer ──────────────────────────────────────────────────────────

type ParsedLine =
  | { kind: "header" | "hunk"; text: string }
  | { kind: "add" | "del" | "ctx"; text: string; oldNo: number | null; newNo: number | null };

const parseDiff = (raw: string): ParsedLine[] => {
  const lines = raw.replace(/\t/g, "    ").split(/\r?\n/);
  if (lines.length > 0 && lines[lines.length - 1] === "") {
    lines.pop();
  }
  const result: ParsedLine[] = [];
  let oldLine = 1, newLine = 1;

  for (const l of lines) {
    if (l.length === 0) {
      result.push({ kind: "ctx", text: "", oldNo: oldLine++, newNo: newLine++ });
    } else if (l.startsWith("---") || l.startsWith("+++")) {
      result.push({ kind: "header", text: l });
    } else if (l.startsWith("@@")) {
      result.push({ kind: "hunk", text: l });
      const m = l.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      oldLine = m ? parseInt(m[1]!, 10) : 1;
      newLine = m ? parseInt(m[2]!, 10) : 1;
    } else if (l.startsWith("+")) {
      result.push({ kind: "add", text: l.slice(1), oldNo: null, newNo: newLine++ });
    } else if (l.startsWith("-")) {
      result.push({ kind: "del", text: l.slice(1), oldNo: oldLine++, newNo: null });
    } else if (l.startsWith(" ")) {
      result.push({ kind: "ctx", text: l.slice(1), oldNo: oldLine++, newNo: newLine++ });
    } else if (l === "\\ No newline at end of file") {
      // Ignore
    } else {
      result.push({ kind: "ctx", text: l, oldNo: oldLine++, newNo: newLine++ });
    }
  }
  return result;
};

type Token = { text: string; changed: boolean };

/** Word-level LCS diff — identifies exactly which words changed between two lines */
const wordDiff = (a: string, b: string): { oldT: Token[]; newT: Token[] } => {
  const split = (s: string) => s.match(/\S+|\s+/g) ?? [];
  const aw = split(a), bw = split(b);
  const m = aw.length, n = bw.length;
  const dp = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i]![j] = aw[i - 1] === bw[j - 1]
        ? dp[i - 1]![j - 1]! + 1
        : Math.max(dp[i - 1]![j]!, dp[i]![j - 1]!);
  const oldT: Token[] = [], newT: Token[] = [];
  let i = m, j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && aw[i - 1] === bw[j - 1]) {
      oldT.unshift({ text: aw[i - 1]!, changed: false });
      newT.unshift({ text: bw[j - 1]!, changed: false });
      i--; j--;
    } else if (j > 0 && (i === 0 || dp[i]![j - 1]! >= dp[i - 1]![j]!)) {
      newT.unshift({ text: bw[j - 1]!, changed: true }); j--;
    } else {
      oldT.unshift({ text: aw[i - 1]!, changed: true }); i--;
    }
  }
  return { oldT, newT };
};

const LN_W = 4; // width of each line-number gutter column

const fmtLineNo = (n: number | null): string =>
  n !== null ? String(n).padStart(LN_W) : " ".repeat(LN_W);

/**
 * GitHub-style diff row — uses foreground colors only (no backgroundColor)
 * to avoid Ink rendering artifacts where backgrounds bleed outside borders.
 *
 * Line coloring:
 *   - Added lines: green text (light feel)
 *   - Deleted lines: red text (light feel)
 *   - Changed words within: bold + brighter shade (stands out as "darker/heavier")
 *   - Context lines: normal dim text
 */
const DiffRow: React.FC<{
  oldNo: number | null;
  newNo: number | null;
  marker: string;
  lineColor: string;
  gutterColor: string;
  tokens?: Token[];
  highlightColor?: string;
  plainText?: string;
  width: number;
  isSelected?: boolean;
}> = ({ oldNo, newNo, marker, lineColor, gutterColor, tokens, highlightColor, plainText, isSelected }) => {
  // gutter: "NNNN NNNN + " = LN_W + 1 + LN_W + 1 + 1 + 1 = LN_W*2 + 4
  const pointer = isSelected ? glyph.pointer : " ";
  const gutter = `${pointer} ${fmtLineNo(oldNo)} ${fmtLineNo(newNo)} ${marker} `;

  if (tokens) {
    return (
      <Text wrap="wrap">
        <Text color={gutterColor}>{gutter}</Text>
        {tokens.map((t, i) =>
          t.changed
            ? <Text key={i} color={highlightColor ?? lineColor} bold underline>{t.text}</Text>
            : <Text key={i} color={lineColor}>{t.text}</Text>
        )}
      </Text>
    );
  }

  const content = plainText ?? "";
  return (
    <Text wrap="wrap">
      <Text color={gutterColor}>{gutter}</Text>
      <Text color={lineColor}>{content}</Text>
    </Text>
  );
};

const okStatus = (msg: string | null) => msg === "Comment posted.";

export const FilesView: React.FC<FilesViewProps> = ({
  selectedPr,
  selectedFileIndex,
  diffScrollOffset,
  onScrollOffsetChange,
  diffSelectedRow,
  onSelectedRowChange,
  focus,
  diffViewMode,
  onInputModeChange,
  isLoading,
  fileFilter,
  updateFileDiff,
  setFileLoading,
}) => {
  const active = focus === "files";
  const [commentMode, setCommentMode] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const isSubmittingRef = React.useRef(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  // useEffect(() => {
  //   if (selectedPr) {
  //     fs.writeFileSync("debug.json", JSON.stringify(selectedPr, null, 2));
  //   }
  // }, [selectedPr]);

  usePasteHandler((pastedText) => {
    if (commentMode && !submitting) {
      setCommentText((t) => t + pastedText);
    }
  });

  useEffect(() => {
    onInputModeChange(commentMode);
  }, [commentMode, onInputModeChange]);

  const flatFiles = React.useMemo(() => {
    if (!selectedPr) return [];
    if (!fileFilter) return selectedPr.changedFiles;
    try {
      const regex = new RegExp(fileFilter.replace(/\*/g, '.*'), 'i');
      return selectedPr.changedFiles.filter(f => regex.test(f.path));
    } catch {
      return selectedPr.changedFiles.filter(f => f.path.toLowerCase().includes(fileFilter.toLowerCase()));
    }
  }, [selectedPr, fileFilter]);
  const selectedFile = flatFiles[selectedFileIndex];

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

  const terminalWidth = process.stdout.columns ?? 120;
  const treePaneWidth = 36;
  const paneGap = 1;
  const rootPadding = 2;
  const rightPaneWidth = Math.max(52, terminalWidth - treePaneWidth - paneGap - rootPadding);
  const filesInnerWidth = Math.max(44, rightPaneWidth - 6);

  // Compute diff rows
  const diffRows = useMemo(() => {
    if (!selectedFile) return [];
    const src = selectedFile.rawDiff ?? (selectedFile.diff.length > 0 ? selectedFile.diff.join("\n") : null);
    if (!src) return [];

    const lines = parseDiff(src);
    const result: { element: React.ReactNode; oldNo: number | null; newNo: number | null }[] = [];
    let idx = 0;

    while (idx < lines.length) {
      const cur = lines[idx]!;
      const nxt = lines[idx + 1];
      const isSelected = result.length === diffSelectedRow;

      if (cur.kind === "header") {
        idx++;
        continue;
      }

      if (cur.kind === "hunk") {
        result.push({
          element: (
            <Text key={idx} color="blueBright" dimColor wrap="wrap">
              {isSelected ? glyph.pointer + " " : "  "}{cur.text}
            </Text>
          ),
          oldNo: null, newNo: null
        });
        idx++;
        continue;
      }

      if (cur.kind === "del" && nxt?.kind === "add") {
        const { oldT, newT } = wordDiff(cur.text, (nxt as { text: string }).text);
        const isNextSelected = result.length + 1 === diffSelectedRow;
        result.push({
          element: (
            <DiffRow key={`${idx}d`} oldNo={cur.oldNo} newNo={null}
              marker="-" lineColor="red" gutterColor="red"
              highlightColor="redBright" tokens={oldT} width={filesInnerWidth} isSelected={isSelected} />
          ),
          oldNo: cur.oldNo, newNo: null
        });
        result.push({
          element: (
            <DiffRow key={`${idx}a`} oldNo={null} newNo={(nxt as { newNo: number | null }).newNo}
              marker="+" lineColor="green" gutterColor="green"
              highlightColor="greenBright" tokens={newT} width={filesInnerWidth} isSelected={isNextSelected} />
          ),
          oldNo: null, newNo: (nxt as { newNo: number | null }).newNo
        });
        idx += 2;
        continue;
      }

      if (cur.kind === "add") {
        result.push({
          element: (
            <DiffRow key={idx} oldNo={null} newNo={cur.newNo}
              marker="+" lineColor="green" gutterColor="green"
              plainText={cur.text} width={filesInnerWidth} isSelected={isSelected} />
          ),
          oldNo: null, newNo: cur.newNo
        });
      } else if (cur.kind === "del") {
        result.push({
          element: (
            <DiffRow key={idx} oldNo={cur.oldNo} newNo={null}
              marker="-" lineColor="red" gutterColor="red"
              plainText={cur.text} width={filesInnerWidth} isSelected={isSelected} />
          ),
          oldNo: cur.oldNo, newNo: null
        });
      } else if (cur.kind === "ctx") {
        result.push({
          element: (
            <DiffRow key={idx} oldNo={cur.oldNo} newNo={cur.newNo}
              marker=" " lineColor={palette.text} gutterColor={palette.muted}
              plainText={cur.text} width={filesInnerWidth} isSelected={isSelected} />
          ),
          oldNo: cur.oldNo, newNo: cur.newNo
        });
      }
      idx++;
    }
    return result;
  }, [selectedFile, diffSelectedRow, filesInnerWidth]);

  useInput(
    (input, key) => {
      if (!active) return;

      if (commentMode) {
        if (key.escape) {
          setCommentMode(false);
          setCommentText("");
          return;
        }
        if (key.return) {
          if (!commentText.trim() || !selectedPr || !selectedFile || isSubmittingRef.current) return;

          isSubmittingRef.current = true;
          setSubmitting(true);
          const repoId = selectedPr.repositoryId ?? selectedPr.repository;

          let threadContext = { filePath: selectedFile.path } as any;
          let pullRequestThreadContext: any = undefined;

          if (diffRows.length > 0 && diffSelectedRow >= 0 && diffSelectedRow < diffRows.length) {
            const rowInfo = diffRows[diffSelectedRow];
            if (rowInfo && rowInfo.newNo !== null) {
              threadContext = {
                filePath: selectedFile.path,
                rightFileStart: { line: rowInfo.newNo, offset: 1 },
                rightFileEnd: { line: rowInfo.newNo, offset: 999 }
              };
              pullRequestThreadContext = { changeTrackingId: 1, iterationContext: { firstComparingIteration: 1, secondComparingIteration: 2 } };
            } else if (rowInfo && rowInfo.oldNo !== null) {
              threadContext = {
                filePath: selectedFile.path,
                leftFileStart: { line: rowInfo.oldNo, offset: 1 },
                leftFileEnd: { line: rowInfo.oldNo, offset: 999 }
              };
              pullRequestThreadContext = { changeTrackingId: 1, iterationContext: { firstComparingIteration: 1, secondComparingIteration: 1 } };
            }
          }

          postPrComment(
            selectedPr.organizationUrl,
            selectedPr.project,
            repoId,
            selectedPr.id,
            commentText.trim(),
            threadContext,
            pullRequestThreadContext
          ).then((ok) => {
            isSubmittingRef.current = false;
            setSubmitting(false);
            if (ok) {
              setStatusMsg("Comment posted.");
              setCommentMode(false);
              setCommentText("");
            } else {
              setStatusMsg("Failed to post comment.");
              // Don't close comment mode on failure so they don't lose their text, 
              // but we need to ensure the status message is visible!
            }
            setTimeout(() => setStatusMsg(null), 3000);
          });
          return;
        }
        if (key.backspace || key.delete) {
          setCommentText((t) => t.slice(0, -1));
          return;
        }
        if (!key.ctrl && !key.meta && input) {
          setCommentText((t) => t + input);
        }
        return;
      }

      // j/k navigation for lines
      if (!commentMode && diffRows.length > 0) {
        if (input === "j" || key.downArrow) {
          const nextRow = Math.min(diffSelectedRow + 1, diffRows.length - 1);
          onSelectedRowChange(nextRow);

          const terminalHeight = process.stdout.rows ?? 40;
          const viewportH = Math.max(5, terminalHeight - 27);
          if (nextRow >= diffScrollOffset + viewportH) {
            onScrollOffsetChange(nextRow - viewportH + 1);
          }
          return;
        }
        if (input === "k" || key.upArrow) {
          const nextRow = Math.max(diffSelectedRow - 1, 0);
          onSelectedRowChange(nextRow);

          if (nextRow < diffScrollOffset) {
            onScrollOffsetChange(nextRow);
          }
          return;
        }

        const terminalHeight = process.stdout.rows ?? 40;
        const viewportH = Math.max(5, terminalHeight - 27);

        if (input === "g") {
          onSelectedRowChange(0);
          onScrollOffsetChange(0);
          return;
        }
        if (input === "G") {
          const nextRow = diffRows.length - 1;
          onSelectedRowChange(nextRow);
          onScrollOffsetChange(Math.max(0, nextRow - viewportH + 1));
          return;
        }
        if (key.pageDown) {
          const nextRow = Math.min(diffSelectedRow + viewportH, diffRows.length - 1);
          onSelectedRowChange(nextRow);
          if (nextRow >= diffScrollOffset + viewportH) {
            onScrollOffsetChange(Math.min(diffRows.length - viewportH, diffScrollOffset + viewportH));
          }
          return;
        }
        if (key.pageUp) {
          const nextRow = Math.max(diffSelectedRow - viewportH, 0);
          onSelectedRowChange(nextRow);
          if (nextRow < diffScrollOffset) {
            onScrollOffsetChange(Math.max(0, diffScrollOffset - viewportH));
          }
          return;
        }
      }

      if (input === "n" && selectedFile && !submitting) {
        setCommentMode(true);
        setStatusMsg(null);
      }
    },
    { isActive: active }
  );

  if (!selectedPr || selectedPr.changedFiles.length === 0) {
    return (
      <Box
        marginTop={1}
        borderStyle="single"
        borderColor={palette.border}
        paddingX={1}
        flexDirection="column"
      >
        <Text color={active ? palette.accent : palette.muted} bold>
          {glyph.files} Files
        </Text>
        <Text color={palette.muted}>No changed files for this PR.</Text>
      </Box>
    );
  }

  const hasDiff = !!selectedFile && (selectedFile.diff.length > 0 || typeof selectedFile.rawDiff === "string");

  const terminalHeight = process.stdout.rows ?? 40;
  const viewportH = Math.max(5, terminalHeight - 27);
  const total = diffRows.length;
  const clampedOffset = Math.min(diffScrollOffset, Math.max(0, total - viewportH));
  const visibleRows = diffRows.slice(clampedOffset, clampedOffset + viewportH).map(r => r.element);
  const canScrollDown = clampedOffset + viewportH < total;
  const canScrollUp = clampedOffset > 0;

  return (
    <Box
      borderStyle="single"
      borderTop={true}
      borderBottom={false}
      borderLeft={false}
      borderRight={false}
      borderColor={palette.border}
      paddingX={1}
      flexDirection="column"
    >
      <Box justifyContent="space-between">
        <Text color={active ? palette.accent : palette.muted} bold>
          {glyph.files} Files
        </Text>
        <Text color={palette.muted}>
          {fileFilter && (
            <Text color={palette.accentDim}> Filtered: "{fileFilter}" </Text>
          )}
          {selectedFileIndex + 1}/{flatFiles.length} {glyph.bullet} {diffViewMode}
        </Text>
      </Box>

      {/* File list */}
      <Box marginTop={1} flexDirection="column">
        {flatFiles.length === 0 ? (
          <Text color={palette.danger}>No files match the filter "{fileFilter}".</Text>
        ) : (
          flatFiles.map((file, idx) => {
            const show =
              flatFiles.length <= 5
                ? true
                : selectedFileIndex < 2
                  ? idx < 5
                  : selectedFileIndex >= flatFiles.length - 2
                    ? idx >= flatFiles.length - 5
                    : Math.abs(idx - selectedFileIndex) <= 2;
            if (!show) return null;

            const isSelected = idx === selectedFileIndex;
            const badge = fileChangeBadge(file.status);
            const parts = file.path.split("/");
            const fileName = parts[parts.length - 1] ?? file.path;
            const dir = parts.slice(0, -1).join("/");

            return (
              <Text key={file.path} wrap="truncate-end">
                <Text color={isSelected ? palette.accent : palette.muted}>
                  {isSelected ? glyph.pointer : glyph.pointerIdle}{" "}
                </Text>
                <Text color={badge.color} bold>
                  {badge.symbol}{" "}
                </Text>
                <Text color={isSelected ? palette.textBright : palette.text}>
                  {dir ? (
                    <Text color={palette.muted}>{dir}/</Text>
                  ) : null}
                  {fileName}
                </Text>
                {file.additions > 0 || file.deletions > 0 ? (
                  <Text>
                    {" "}
                    <Text color={palette.ok}>+{file.additions}</Text>
                    <Text color={palette.danger}> -{file.deletions}</Text>
                  </Text>
                ) : null}
              </Text>
            );
          })
        )}
      </Box>

      {/* Diff view for selected file */}
      {selectedFile && (
        <Box marginTop={1} flexDirection="column">
          {/* File header */}
          <Text color={palette.accentDim} wrap="truncate-end">
            {"  "}{truncate(selectedFile.path, filesInnerWidth - 16)}
            {"  "}
            <Text color={palette.ok}>+{selectedFile.additions ?? 0}</Text>
            <Text color={palette.danger}> -{selectedFile.deletions ?? 0}</Text>
          </Text>

          {selectedFile.loadingDiff ? (
            <Box marginY={1} marginLeft={2}>
              <Text color={palette.accent}><Spinner type="dots" /> Loading diff...</Text>
            </Box>
          ) : hasDiff ? (
            <Box flexDirection="column">
              {diffRows.length > 0 ? (
                <>
                  <Box flexDirection="column" height={commentMode ? viewportH - 3.5 : viewportH} overflow="hidden">{visibleRows}</Box>
                  <Text color={palette.muted}>
                    {canScrollUp ? "↑ " : "  "}
                    {`row ${diffSelectedRow + 1} of ${total}`}
                    {canScrollDown ? " ↓" : "  "}
                  </Text>
                </>
              ) : (
                <Text color={palette.muted}>
                  {selectedFile.status === "added" ? "Empty file added." : selectedFile.status === "deleted" ? "Empty file deleted." : "No changes to display."}
                </Text>
              )}
            </Box>
          ) : isLoading ? (
            <Text color={palette.muted}>
              <Spinner type="dots" /> Loading diff...
            </Text>
          ) : (
            <Text color={palette.muted}>
              Diff content not loaded (Azure change list is metadata-only).
            </Text>
          )}

          {active && !commentMode && (
            <Box marginTop={1}>
              <Text color={palette.muted}>

                <Text color={palette.accentDim}>n</Text> comment{"  "}
                <Text color={palette.accentDim}>[/]</Text> switch files{"  "}
                <Text color={palette.accentDim}>j/k, ↑/↓</Text> navigate{"  "}
                <Text color={palette.accentDim}>g/G</Text> top/end
              </Text>
            </Box>
          )}
        </Box>
      )}

      {/* Comment input box */}
      {commentMode && (
        <Box
          marginTop={1}
          borderStyle="round"
          borderColor={palette.accent}
          paddingX={1}
          flexDirection="column"
        >
          <Text color={palette.accent} bold>
            {glyph.added} New diff comment on {selectedFile ? truncate(selectedFile.path, 30) : ""}
            {"  "}
            <Text color={palette.muted}>(Enter to send · Esc to cancel)</Text>
          </Text>
          <Text color={submitting ? palette.muted : palette.textBright}>
            {commentText || " "}
            {!submitting && <Text color={palette.accent}>▌</Text>}
          </Text>
        </Box>
      )}

      {/* Status Msg */}
      {statusMsg && (
        <Box marginTop={1}>
          <Text color={okStatus(statusMsg) ? palette.ok : palette.danger}>{statusMsg}</Text>
        </Box>
      )}

    </Box>
  );
};
