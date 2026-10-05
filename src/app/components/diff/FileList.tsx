import React from "react";
import { Text } from "ink";
import type { PullRequestFileChange } from "../../../domain/types";
import { fileChangeBadge, glyph, palette } from "../../theme";
import { ClickableBox } from "../ui/ClickableBox";

/** How many file rows the list shows around the selection. */
const FILE_WINDOW = 5;
const FILE_WINDOW_HALF = 2;

/**
 * Whether file `index` is in the 5-row window: the first five while the
 * selection is near the top, the last five near the bottom, otherwise the
 * selection ±2. Exported so a click can map back to a file.
 */
export const isFileShown = (index: number, selected: number, count: number): boolean => {
  if (count <= FILE_WINDOW) return true;
  if (selected < FILE_WINDOW_HALF) return index < FILE_WINDOW;
  if (selected >= count - FILE_WINDOW_HALF) return index >= count - FILE_WINDOW;
  return Math.abs(index - selected) <= FILE_WINDOW_HALF;
};

const FileRow: React.FC<{ file: PullRequestFileChange; selected: boolean }> = ({ file, selected }) => {
  const badge = fileChangeBadge(file.status);
  const parts = file.path.split("/");
  const fileName = parts[parts.length - 1] ?? file.path;
  const dir = parts.slice(0, -1).join("/");
  return (
    <Text wrap="truncate-end">
      <Text color={selected ? palette.accent : palette.muted}>
        {selected ? glyph.pointer : glyph.pointerIdle}{" "}
      </Text>
      <Text color={badge.color} bold>
        {badge.symbol}{" "}
      </Text>
      <Text color={selected ? palette.textBright : palette.text}>
        {dir ? <Text color={palette.muted}>{dir}/</Text> : null}
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
};

/** The changed files, windowed to five rows around the selection. */
export const FileList: React.FC<{
  files: PullRequestFileChange[];
  selectedIndex: number;
  fileFilter?: string;
  /** Mouse: a click on a file row selects it (index into files). */
  onSelectFile?: (index: number) => void;
}> = ({ files, selectedIndex, fileFilter, onSelectFile }) => (
  <ClickableBox
    marginTop={1}
    flexDirection="column"
    onClick={(line) => {
      const shown = files.map((_, i) => i).filter((i) => isFileShown(i, selectedIndex, files.length));
      const index = shown[line];
      if (index !== undefined) onSelectFile?.(index);
    }}
  >
    {files.length === 0 ? (
      <Text color={palette.danger}>No files match the filter "{fileFilter}".</Text>
    ) : (
      files.map((file, idx) =>
        isFileShown(idx, selectedIndex, files.length) ? (
          <FileRow key={file.path} file={file} selected={idx === selectedIndex} />
        ) : null,
      )
    )}
  </ClickableBox>
);
