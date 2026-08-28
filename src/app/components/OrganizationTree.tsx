import React from "react";
import { Box, Text } from "ink";
import type { AppData, RepositoryNode } from "../../domain/types";
import type { FocusArea, TreeFilter } from "../types";
import { glyph, palette, truncate } from "../theme";
import { matchesTreeFilter, clamp } from "../utils";

type OrganizationTreeProps = {
  data: AppData;
  selectedOrgIndex: number;
  selectedRepoIndex: number;
  focus: FocusArea;
  treeFilter: TreeFilter;
  /** Maximum tree rows to render; overflow is hidden and scrolls with the selection. */
  maxRows: number;
};

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

export const OrganizationTree: React.FC<OrganizationTreeProps> = ({
  data,
  selectedOrgIndex,
  selectedRepoIndex,
  focus,
  treeFilter,
  maxRows,
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
            const repoSelected = orgSelected && flatIndex === selectedRepoIndex;
            const isLastRepo = entryIdx === entries.length - 1;
            const vertPrefix = isLastProject ? "     " : `  ${glyph.vert}  `;
            const repoConnector = isLastRepo ? glyph.branchLast : glyph.branch;

            if (repoSelected) selectedRow = rows.length;
            rows.push(
              // One Text per row, truncated: a row that wraps to a second
              // line makes the body taller than the number of rows the
              // window budgeted, and Ink composites the surplus back over
              // the header (and blanks rows out mid-list).
              <Text key={`${orgKey}-repo-${flatIndex}`} wrap="truncate-end">
                {/* Colour alone was too easy to miss, so the selected repo
                    gets the same pointer the org row and PR list use. It
                    replaces the connector to keep the columns aligned. */}
                <Text color={repoSelected ? palette.accent : palette.muted} bold={repoSelected}>
                  {vertPrefix}{repoSelected ? glyph.pointer : repoConnector}{" "}
                </Text>
                <Text
                  color={repoSelected ? palette.accent : palette.text}
                  bold={repoSelected}
                >
                  {truncate(repo.name, PANEL_WIDTH - 16)}
                </Text>
                <Text color={repo.pullRequests.length > 0 ? palette.ok : palette.muted}>
                  {" "}({repo.pullRequests.length})
                </Text>
              </Text>,
            );
          });
        });
      }
    }
  });

  // Window the rows: keep the selection roughly centered and show how many
  // rows are hidden above/below.
  // maxRows is the panel's TOTAL height budget from App, but two rows go to
  // the border and one to the header, so only maxRows - 3 are left for the
  // tree. Handing the body more than that does not clip: Ink composites the
  // surplus back over the first rows, which is why the title used to read
  // "3 moretions" and rows under the cursor blanked out mid-navigation.
  const bodyRows = Math.max(3, maxRows - 4);
  const total = rows.length;
  let body = rows;
  if (total > bodyRows) {
    const inner = Math.max(3, bodyRows - 2);
    const start = clamp(selectedRow - Math.floor(inner / 2), 0, total - inner);
    const end = start + inner;
    body = [
      <Text key="tree-more-up" color={palette.muted}>
        {start > 0 ? `  ${glyph.up} ${start} more` : " "}
      </Text>,
      ...rows.slice(start, end),
      <Text key="tree-more-down" color={palette.muted}>
        {end < total ? `  ${glyph.down} ${total - end} more` : " "}
      </Text>,
    ];
  }

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
        <Text color={active ? palette.accent : palette.muted} bold>
          {glyph.files} Organizations
        </Text>
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
        body
      )}

      {/* Says what the header's "v" does. The body budget above reserves this
          row, so the panel still fits the height App allots it. */}
      <Text color={palette.muted} wrap="truncate-end">
        {"  "}<Text color={palette.accentDim}>v</Text> switch view
      </Text>

    </Box>
  );
};
