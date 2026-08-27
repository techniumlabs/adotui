import React from "react";
import { Text } from "ink";
import type { PullRequestFileChange } from "../../../domain/types";
import { glyph, palette } from "../../theme";

// ─── diff renderer (moved out of FilesView) ─────────────────────────────────

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

export type DiffRowInfo = {
  element: React.ReactNode;
  oldNo: number | null;
  newNo: number | null;
};

/** Builds the renderable diff rows for a file, marking the selected row. */
export const buildDiffRows = (
  selectedFile: PullRequestFileChange,
  diffSelectedRow: number,
  width: number,
): DiffRowInfo[] => {
  const src = selectedFile.rawDiff ?? (selectedFile.diff.length > 0 ? selectedFile.diff.join("\n") : null);
  if (!src) return [];

  const lines = parseDiff(src);
  const result: DiffRowInfo[] = [];
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
      const { oldT, newT } = wordDiff(cur.text, nxt.text);
      const isNextSelected = result.length + 1 === diffSelectedRow;
      result.push({
        element: (
          <DiffRow key={`${idx}d`} oldNo={cur.oldNo} newNo={null}
            marker="-" lineColor="red" gutterColor="red"
            highlightColor="redBright" tokens={oldT} width={width} isSelected={isSelected} />
        ),
        oldNo: cur.oldNo, newNo: null
      });
      result.push({
        element: (
          <DiffRow key={`${idx}a`} oldNo={null} newNo={nxt.newNo}
            marker="+" lineColor="green" gutterColor="green"
            highlightColor="greenBright" tokens={newT} width={width} isSelected={isNextSelected} />
        ),
        oldNo: null, newNo: nxt.newNo
      });
      idx += 2;
      continue;
    }

    if (cur.kind === "add") {
      result.push({
        element: (
          <DiffRow key={idx} oldNo={null} newNo={cur.newNo}
            marker="+" lineColor="green" gutterColor="green"
            plainText={cur.text} width={width} isSelected={isSelected} />
        ),
        oldNo: null, newNo: cur.newNo
      });
    } else if (cur.kind === "del") {
      result.push({
        element: (
          <DiffRow key={idx} oldNo={cur.oldNo} newNo={null}
            marker="-" lineColor="red" gutterColor="red"
            plainText={cur.text} width={width} isSelected={isSelected} />
        ),
        oldNo: cur.oldNo, newNo: null
      });
    } else if (cur.kind === "ctx") {
      result.push({
        element: (
          <DiffRow key={idx} oldNo={cur.oldNo} newNo={cur.newNo}
            marker=" " lineColor={palette.text} gutterColor={palette.muted}
            plainText={cur.text} width={width} isSelected={isSelected} />
        ),
        oldNo: cur.oldNo, newNo: cur.newNo
      });
    }
    idx++;
  }
  return result;
};
