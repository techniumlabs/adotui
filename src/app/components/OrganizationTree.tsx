import React from "react";
import { Box, Text } from "ink";
import type { AppData, RepositoryNode } from "../../domain/types";
import type { FocusArea, TreeFilter } from "../types";
import { glyph, palette, truncate } from "../theme";
import { matchesTreeFilter, clamp } from "../utils";
import { PanelTitle } from "./ui/PanelTitle";
import { ClickableBox } from "./ui/ClickableBox";

type OrganizationTreeProps = {
  data: AppData;
  selectedOrgIndex: number;
  selectedRepoIndex: number;
  focus: FocusArea;
  treeFilter: TreeFilter;
  /** Maximum tree rows to render; overflow is hidden and scrolls with the selection. */
  maxRows: number;
  /** Mouse: a click on an organization or repository row. */
  onSelectNode?: (orgIndex: number, repoIndex?: number) => void;
};

type TreeTarget = { orgIndex: number; repoIndex?: number };

const PANEL_WIDTH = 36;

/** Groups repos by their project name, preserving each repo's original flat index. */
const groupByProject = (
  entries: { repo: RepositoryNode; flatIndex: number }[],
): { projectName: string; entries: { repo: RepositoryNode; flatIndex: number }[] }[] => {
  const groups: { projectName: string; entries: { repo: RepositoryNode; flatIndex: number }[] }[] = [];
  const map = new Map<string, typeof groups[number]>();
  entries.forEach((entry) => {
    const key = entry.repo.project;
    if (!map.has(key)) {
      const g: typeof groups[number] = { projectName: key, entries: [] };
      map.set(key, g);
      groups.push(g);
    }
    map.get(key)!.entries.push(entry);
  });
  return groups;
};

/** One repository row under its project, in the tree's box-drawing layout. */
const RepoRow: React.FC<{ repo: RepositoryNode; selected: boolean; isLastProject: boolean; isLastRepo: boolean }> = ({
  repo,
  selected,
  isLastProject,
  isLastRepo,
}) => {
  const vertPrefix = isLastProject ? "     " : `  ${glyph.vert}  `;
  const connector = isLastRepo ? glyph.branchLast : glyph.branch;
  return (
    // One Text per row, truncated: a row that wraps to a second line makes the
    // body taller than the number of rows the window budgeted, and Ink
    // composites the surplus back over the header (and blanks rows mid-list).
    <Text wrap="truncate-end">
      {/* Colour alone was too easy to miss, so the selected repo gets the same
          pointer the org row and PR list use. It replaces the connector to
          keep the columns aligned. */}
      <Text color={selected ? palette.accent : palette.muted} bold={selected}>
        {vertPrefix}{selected ? glyph.pointer : connector}{" "}
      </Text>
      <Text color={selected ? palette.accent : palette.text} bold={selected}>
        {truncate(repo.name, PANEL_WIDTH - 16)}
      </Text>
      <Text color={repo.pullRequests.length > 0 ? palette.ok : palette.muted}>
        {" "}({repo.pullRequests.length})
      </Text>
    </Text>
  );
};

/**
 * Windows the tree rows to the panel: keeps the selection roughly centred and
 * shows how many rows are hidden above/below.
 * maxRows is the panel's TOTAL height budget from App, but two rows go to the
 * border, one to the header and one to the "v switch view" hint. Handing the
 * body more than that does not clip: Ink composites the surplus back over the
 * first rows, which is why the title used to read "3 moretions" and rows under
 * the cursor blanked out mid-navigation.
 */
const windowRows = (
  rows: React.ReactNode[],
  selectedRow: number,
  maxRows: number,
): { body: React.ReactNode[]; rowAt: (line: number) => number | undefined } => {
  const bodyRows = Math.max(3, maxRows - 4);
  const total = rows.length;
  if (total <= bodyRows) return { body: rows, rowAt: (line) => line };
  const inner = Math.max(3, bodyRows - 2);
  const start = clamp(selectedRow - Math.floor(inner / 2), 0, total - inner);
  const end = start + inner;
  // Line 0 and the last line are the "N more" markers.
  const rowAt = (line: number) => (line >= 1 && line <= inner ? start + line - 1 : undefined);
  const body = [
    <Text key="tree-more-up" color={palette.muted}>
      {start > 0 ? `  ${glyph.up} ${start} more` : " "}
    </Text>,
    ...rows.slice(start, end),
    <Text key="tree-more-down" color={palette.muted}>
      {end < total ? `  ${glyph.down} ${total - end} more` : " "}
    </Text>,
  ];
  return { body, rowAt };
};

export const OrganizationTree: React.FC<OrganizationTreeProps> = ({
  data,
  selectedOrgIndex,
  selectedRepoIndex,
  focus,
  treeFilter,
  maxRows,
  onSelectNode,
}) => {
  const active = focus === "tree";
  const filteringByPrs = treeFilter === "with-prs";
  const isCustomFilter = treeFilter !== "all" && treeFilter !== "with-prs";
  // The header is "<title> v <badge>" inside a fixed 36-wide panel, which
  // leaves ~15 columns for the badge. A custom filter is shown verbatim
  // (its warn colour already marks it as a filter) and truncated to fit,
  // rather than spending 8 of those columns on a "Filter:" prefix that
  // would push the title off the row.
  const filterLabel = filteringByPrs
    ? "PRs only"
    : treeFilter === "all"
      ? "All"
      : treeFilter === "me"
        ? "My PRs"
        : truncate(treeFilter, 15);

  // Build one element per terminal line so the pane can be windowed to the
  // available height, scrolling to keep the selection visible.
  const rows: React.ReactNode[] = [];
  /** What a click on rows[i] selects (blank and project rows select nothing). */
  const targets: TreeTarget[] = [];
  let selectedRow = 0;

  data.organizations.forEach((org, orgIndex) => {
    const orgSelected = orgIndex === selectedOrgIndex;
    const orgKey = org.organizationUrl || org.name;

    // Filter repos once, keeping each repo's original flat index so selection
    // stays aligned with the unfiltered list.
    const filteredWithIndex = org.repositories
      .map((repo, idx) => {
        const matchingPrs = (treeFilter === "all" || treeFilter === "with-prs")
          ? repo.pullRequests
          : repo.pullRequests.filter(pr => matchesTreeFilter(pr, treeFilter, data.currentUserEmail));
        return { repo: { ...repo, pullRequests: matchingPrs }, flatIndex: idx };
      })
      .filter(({ repo }) => (treeFilter === "all" ? true : repo.pullRequests.length > 0));

    const prCount = filteredWithIndex.reduce(
      (sum, { repo }) => sum + repo.pullRequests.length,
      0,
    );

    const visibleCount = filteredWithIndex.length;

    const projectGroups = groupByProject(filteredWithIndex);

    if (orgIndex === 0) {
      rows.push(<Text key={`${orgKey}-space`}> </Text>);
    }

    if (orgSelected) selectedRow = rows.length;
    targets[rows.length] = { orgIndex };
    rows.push(
      <Text
        key={`${orgKey}-name`}
        color={orgSelected ? palette.textBright : palette.text}
        bold={orgSelected}
      >
        {orgSelected ? glyph.pointer : glyph.pointerIdle}{" "}
        {truncate(org.name, PANEL_WIDTH - 4)}
      </Text>,
    );
    targets[rows.length] = { orgIndex };
    rows.push(
      <Text key={`${orgKey}-count`} color={palette.muted}>
        {"  "}
        {filteringByPrs || isCustomFilter
          ? `${visibleCount}/${org.repositories.length} repos ${glyph.bullet} ${prCount} prs`
          : `${org.repositories.length} repos ${glyph.bullet} ${prCount} prs`}
      </Text>,
    );

    // Project → Repo rows (only when org is selected)
    if (orgSelected) {
      if (visibleCount === 0) {
        rows.push(
          <Text key={`${orgKey}-empty`} color={palette.muted}>
            {"  "}No repos with PRs.
          </Text>,
        );
      } else {
        projectGroups.forEach(({ projectName, entries }, projIdx) => {
          const isLastProject = projIdx === projectGroups.length - 1;
          const projConnector = isLastProject ? glyph.branchLast : glyph.branch;

          rows.push(
            <Text key={`${orgKey}-proj-${projectName}`} wrap="truncate-end">
              <Text color={palette.muted}>{"  "}{projConnector} </Text>
              <Text color={palette.warn} bold>
                {truncate(projectName, PANEL_WIDTH - 10)}
              </Text>
            </Text>,
          );

          entries.forEach(({ repo, flatIndex }, entryIdx) => {
            const selected = flatIndex === selectedRepoIndex;
            if (selected) selectedRow = rows.length;
            targets[rows.length] = { orgIndex, repoIndex: flatIndex };
            rows.push(
              <RepoRow
                key={`${orgKey}-repo-${flatIndex}`}
                repo={repo}
                selected={selected}
                isLastProject={isLastProject}
                isLastRepo={entryIdx === entries.length - 1}
              />,
            );
          });
        });
      }
    }
  });

  const { body, rowAt } = windowRows(rows, selectedRow, maxRows);

  return (
    <Box
      width={PANEL_WIDTH}
      borderStyle="round"
      borderColor={active ? palette.accent : palette.border}
      paddingRight={1}
      flexDirection="column"
      overflow="hidden"
    >
      {/* Header row: title + the active view, prefixed with the key that
          cycles it. Everything shares this one row on purpose: a third
          element or an extra row makes the panel taller than the height App
          allots it, and Ink composites the overflow back over this line
          instead of clipping (a garbled title once the tree scrolls). */}
      <Box justifyContent="space-between">
        <PanelTitle active={active}>
          {glyph.files} Organizations
        </PanelTitle>
        <Text
          color={filteringByPrs || isCustomFilter ? palette.warn : palette.muted}
          wrap="truncate-end"
        >
          {filterLabel}
        </Text>
      </Box>

      {data.organizations.length === 0 ? (
        <Text color={palette.muted}>No organizations.</Text>
      ) : (
        <ClickableBox
          flexDirection="column"
          onClick={(line) => {
            const target = targets[rowAt(line) ?? -1];
            if (target) onSelectNode?.(target.orgIndex, target.repoIndex);
          }}
        >
          {body}
        </ClickableBox>
      )}

      {/* Says what the header's "v" does. The body budget above reserves this
          row, so the panel still fits the height App allots it. */}
      <Text color={palette.muted} wrap="truncate-end">
        {"  "}<Text color={palette.accentDim}>v</Text> switch view
      </Text>

    </Box>
  );
};
