import React, { useMemo } from "react";
import { Box, Text } from "ink";
import type { PullRequest, PullRequestFileChange } from "../../domain/types";
import type { DiffViewMode, FocusArea } from "../types";
import { fileChangeBadge, glyph, palette, truncate } from "../theme";

type FilesViewProps = {
  selectedPr?: PullRequest;
  selectedFileIndex: number;
  diffScrollOffset: number;
  focus: FocusArea;
  diffViewMode: DiffViewMode;
};

// ─── diff renderer ──────────────────────────────────────────────────────────

type ParsedLine =
  | { kind: "header" | "hunk"; text: string }
  | { kind: "add" | "del" | "ctx"; text: string; oldNo: number | null; newNo: number | null };

const parseDiff = (raw: string): ParsedLine[] => {
  const lines = raw.split("\n").filter((l) => l.length > 0);
  const result: ParsedLine[] = [];
  let oldLine = 1, newLine = 1;

  for (const l of lines) {
    if (l.startsWith("---") || l.startsWith("+++")) {
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
    } else {
      result.push({ kind: "ctx", text: l.slice(1), oldNo: oldLine++, newNo: newLine++ });
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
}> = ({ oldNo, newNo, marker, lineColor, gutterColor, tokens, highlightColor, plainText, width }) => {
  // gutter: "NNNN NNNN + " = LN_W + 1 + LN_W + 1 + 1 + 1 = LN_W*2 + 4
  const gutterW = LN_W * 2 + 4;
  const contentW = Math.max(0, width - gutterW);
  const gutter = `${fmtLineNo(oldNo)} ${fmtLineNo(newNo)} ${marker} `;

  if (tokens) {
    return (
      <Text wrap="truncate-end">
        <Text color={gutterColor}>{gutter}</Text>
        {tokens.slice(0, 120).map((t, i) =>
          t.changed
            ? <Text key={i} color={highlightColor ?? lineColor} bold underline>{t.text}</Text>
            : <Text key={i} color={lineColor}>{t.text}</Text>
        )}
      </Text>
    );
  }

  const content = (plainText ?? "").slice(0, contentW);
  return (
    <Text wrap="truncate-end">
      <Text color={gutterColor}>{gutter}</Text>
      <Text color={lineColor}>{content}</Text>
    </Text>
  );
};

/** GitHub-style unified diff pane with word-level change highlighting */
const DiffPane: React.FC<{ file: PullRequestFileChange; width: number; scrollOffset: number }> = ({ file, width, scrollOffset }) => {
  const lines = useMemo(() => {
    const src = file.rawDiff ?? (file.diff.length > 0 ? file.diff.join("\n") : null);
    return src ? parseDiff(src) : null;
  }, [file.path, file.rawDiff, file.diff]);

  if (!lines) {
    return <Text color={palette.muted}>Diff content not loaded (Azure change list is metadata-only).</Text>;
  }

  const terminalHeight = process.stdout.rows ?? 40;
  // Reserve rows for: app header (~5) + file list + file header + box borders
  const viewportH = Math.max(5, terminalHeight - 20);

  const rows: React.ReactNode[] = [];
  let idx = 0;

  while (idx < lines.length) {
    const cur = lines[idx]!;
    const nxt = lines[idx + 1];

    if (cur.kind === "header") {
      idx++;
      continue;
    }

    if (cur.kind === "hunk") {
      rows.push(
        <Text key={idx} color="blueBright" dimColor wrap="truncate-end">
          {cur.text}
        </Text>
      );
      idx++;
      continue;
    }

    // Paired del+add → word-diff highlighting
    if (cur.kind === "del" && nxt?.kind === "add") {
      const { oldT, newT } = wordDiff(cur.text, (nxt as { text: string }).text);
      rows.push(
        <DiffRow key={`${idx}d`} oldNo={cur.oldNo} newNo={null}
          marker="-" lineColor="red" gutterColor="red"
          highlightColor="redBright" tokens={oldT} width={width} />,
        <DiffRow key={`${idx}a`} oldNo={null} newNo={(nxt as { newNo: number | null }).newNo}
          marker="+" lineColor="green" gutterColor="green"
          highlightColor="greenBright" tokens={newT} width={width} />,
      );
      idx += 2;
      continue;
    }

    if (cur.kind === "add") {
      rows.push(<DiffRow key={idx} oldNo={null} newNo={cur.newNo}
        marker="+" lineColor="green" gutterColor="green"
        plainText={cur.text} width={width} />);
    } else if (cur.kind === "del") {
      rows.push(<DiffRow key={idx} oldNo={cur.oldNo} newNo={null}
        marker="-" lineColor="red" gutterColor="red"
        plainText={cur.text} width={width} />);
    } else if (cur.kind === "ctx") {
      rows.push(<DiffRow key={idx} oldNo={cur.oldNo} newNo={cur.newNo}
        marker=" " lineColor={palette.text} gutterColor={palette.muted}
        plainText={cur.text} width={width} />);
    }
    idx++;
  }

  const total = rows.length;
  const clampedOffset = Math.min(scrollOffset, Math.max(0, total - viewportH));
  const visible = rows.slice(clampedOffset, clampedOffset + viewportH);
  const canScrollDown = clampedOffset + viewportH < total;
  const canScrollUp = clampedOffset > 0;

  return (
    <Box flexDirection="column">
      <Box flexDirection="column">{visible}</Box>
      <Text color={palette.muted}>
        {canScrollUp ? "↑ " : "  "}
        {`line ${clampedOffset + 1}-${Math.min(clampedOffset + viewportH, total)} of ${total}`}
        {canScrollDown ? " ↓" : "  "}
        {" · "}
        <Text color={palette.accentDim}>PgDn/]</Text>{" scroll down  "}
        <Text color={palette.accentDim}>PgUp/[</Text>{" scroll up  "}
        <Text color={palette.accentDim}>G</Text>{" end  "}
        <Text color={palette.accentDim}>g</Text>{" top"}
      </Text>
    </Box>
  );
};

export const FilesView: React.FC<FilesViewProps> = ({
  selectedPr,
  selectedFileIndex,
  diffScrollOffset,
  focus,
  diffViewMode,
}) => {
  const active = focus === "files";
  const terminalWidth = process.stdout.columns ?? 120;
  const treePaneWidth = 36;
  const paneGap = 1;
  const rootPadding = 2;
  const rightPaneWidth = Math.max(52, terminalWidth - treePaneWidth - paneGap - rootPadding);
  // border (2) + paddingX (2) = 4, then subtract 2 more as safety margin
  const filesInnerWidth = Math.max(44, rightPaneWidth - 6);

  if (!selectedPr || selectedPr.changedFiles.length === 0) {
    return (
      <Box
        width={rightPaneWidth}
        marginTop={1}
        borderStyle="round"
        borderColor={active ? palette.accent : palette.muted}
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

  const flatFiles = selectedPr.changedFiles;
  const selectedFile = flatFiles[selectedFileIndex];
  const hasDiff = !!selectedFile && (selectedFile.diff.length > 0 || !!selectedFile.rawDiff);

  return (
    <Box
      width={rightPaneWidth}
      marginTop={1}
      borderStyle="round"
      borderColor={active ? palette.accent : palette.muted}
      paddingX={1}
      flexDirection="column"
    >
      <Box justifyContent="space-between">
        <Text color={active ? palette.accent : palette.muted} bold>
          {glyph.files} Files
        </Text>
        <Text color={palette.muted}>
          {flatFiles.length} {glyph.bullet} {diffViewMode}
        </Text>
      </Box>

      {/* File list */}
      <Box marginTop={1} flexDirection="column">
        {flatFiles.map((file, idx) => {
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
        })}
      </Box>

      {/* Diff view for selected file */}
      {selectedFile && (
        <Box marginTop={1} flexDirection="column">
          {/* File header */}
          <Text color={palette.accentDim} wrap="truncate-end">
            {"  "}{truncate(selectedFile.path, filesInnerWidth - 16)}
            {"  "}
            <Text color={palette.ok}>+{selectedFile.additions}</Text>
            <Text color={palette.danger}> -{selectedFile.deletions}</Text>
          </Text>
          {hasDiff ? (
            <DiffPane file={selectedFile} width={filesInnerWidth} scrollOffset={diffScrollOffset} />
          ) : (
            <Text color={palette.muted}>
              Diff content not loaded (Azure change list is metadata-only).
            </Text>
          )}
        </Box>
      )}
    </Box>
  );
};
