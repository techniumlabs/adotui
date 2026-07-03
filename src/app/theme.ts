import type { PullRequestStatus, ReviewState } from "../domain/types";
import type { PullRequestFileChange } from "../domain/types";

/**
 * Centralized theme: colors, glyphs, and badge helpers so the whole UI stays
 * visually consistent. Symbols are paired with color (never color alone) for
 * accessibility, including colorblind users.
 */

export const palette = {
  accent: "cyanBright",
  accentDim: "cyan",
  text: "white",
  textBright: "whiteBright",
  muted: "gray",
  ok: "greenBright",
  okDim: "green",
  warn: "yellowBright",
  danger: "redBright",
  info: "blueBright",
  draft: "magentaBright",
} as const;

/** Glyphs (kept to a widely-supported subset for terminal compatibility). */
export const glyph = {
  pointer: "▸",
  pointerIdle: " ",
  branch: "├─",
  branchLast: "└─",
  vert: "│",
  arrow: "→",
  dot: "•",
  check: "✓",
  cross: "✗",
  pending: "○",
  clock: "◔",
  draft: "◑",
  files: "◇",
  added: "+",
  removed: "-",
  modified: "~",
  auto: "⟳",
  bullet: "·",
} as const;

export interface Badge {
  symbol: string;
  label: string;
  color: string;
}

export const reviewBadge = (state: ReviewState): Badge => {
  switch (state) {
    case "approved":
      return { symbol: glyph.check, label: "approved", color: palette.ok };
    case "changes-requested":
      return {
        symbol: glyph.cross,
        label: "rejected",
        color: palette.danger,
      };
    case "missing-required":
      return { symbol: glyph.clock, label: "missing required", color: palette.warn };
    default:
      return { symbol: glyph.pending, label: "pending", color: palette.warn };
  }
};

export const statusBadge = (status: PullRequestStatus): Badge => {
  switch (status) {
    case "completed":
      return { symbol: glyph.check, label: "completed", color: palette.info };
    case "abandoned":
      return { symbol: glyph.cross, label: "abandoned", color: palette.muted };
    default:
      return { symbol: glyph.dot, label: "active", color: palette.okDim };
  }
};

export const fileChangeBadge = (
  status: PullRequestFileChange["status"],
): Badge => {
  switch (status) {
    case "added":
      return { symbol: glyph.added, label: "added", color: palette.ok };
    case "deleted":
      return { symbol: glyph.removed, label: "deleted", color: palette.danger };
    default:
      return { symbol: glyph.modified, label: "modified", color: palette.info };
  }
};

/** Rolls up a checks passed/total into a compact status + color. */
export const checksBadge = (passed: number, total: number): Badge => {
  if (total === 0) {
    return { symbol: glyph.bullet, label: "no checks", color: palette.muted };
  }
  if (passed >= total) {
    return {
      symbol: glyph.check,
      label: `${passed}/${total}`,
      color: palette.ok,
    };
  }
  return {
    symbol: glyph.clock,
    label: `${passed}/${total}`,
    color: palette.warn,
  };
};

/** Fixed-width truncation with an ellipsis for tidy column alignment. */
export const truncate = (value: string, width: number): string => {
  if (width <= 1) {
    return value.slice(0, Math.max(0, width));
  }
  if (value.length <= width) {
    return value;
  }
  return `${value.slice(0, width - 1)}…`;
};

/** Right-pads to a fixed width for column alignment. */
export const pad = (value: string, width: number): string => {
  if (value.length >= width) {
    return value;
  }
  return value + " ".repeat(width - value.length);
};
