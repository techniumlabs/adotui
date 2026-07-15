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

/** Groups repos by their project name, preserving the original flat index. */
const groupByProject = (
  repos: RepositoryNode[],
): { projectName: string; entries: { repo: RepositoryNode; flatIndex: number }[] }[] => {
  const groups: { projectName: string; entries: { repo: RepositoryNode; flatIndex: number }[] }[] = [];
  const map = new Map<string, typeof groups[number]>();
  repos.forEach((repo, idx) => {
    const key = repo.project;
    if (!map.has(key)) {
      const g = { projectName: key, entries: [] };
      map.set(key, g);
      groups.push(g);
    }
    map.get(key)!.entries.push({ repo, flatIndex: idx });
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

  // Build one element per terminal line so the pane can be windowed to the
  // available height, scrolling to keep the selection visible.
  const rows: React.ReactNode[] = [];
  let selectedRow = 0;

  data.organizations.forEach((org, orgIndex) => {
    const orgSelected = orgIndex === selectedOrgIndex;
    const orgKey = org.organizationUrl || org.name;

    const visibleRepos = org.repositories.map(repo => {
      const matchingPrs = (treeFilter === "all" || treeFilter === "with-prs")
        ? repo.pullRequests
        : repo.pullRequests.filter(pr => matchesTreeFilter(pr, treeFilter, data.currentUserEmail));
      return { ...repo, pullRequests: matchingPrs };
    }).filter(r => (treeFilter === "all" ? true : r.pullRequests.length > 0));

    const prCount = visibleRepos.reduce(
      (sum, repo) => sum + repo.pullRequests.length,
      0,
    );

    const visibleCount = visibleRepos.length;

    // Build flat-index-preserving groups from the FILTERED repos.
    const filteredWithIndex = org.repositories
      .map((repo, idx) => {
        const matchingPrs = (treeFilter === "all" || treeFilter === "with-prs")
          ? repo.pullRequests
          : repo.pullRequests.filter(pr => matchesTreeFilter(pr, treeFilter, data.currentUserEmail));
        return { repo: { ...repo, pullRequests: matchingPrs }, flatIndex: idx };
      })
      .filter(({ repo }) => (treeFilter === "all" ? true : repo.pullRequests.length > 0));

    const projectGroups = groupByProject(
      filteredWithIndex.map(({ repo }) => repo),
    );
    // Re-attach original flat indices
    const flatIndexMap = new Map<string, number>(
      filteredWithIndex.map(({ repo, flatIndex }) => [repo.name, flatIndex]),
    );

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
            <Box key={`${orgKey}-proj-${projectName}`}>
              <Text color={palette.muted}>{"  "}{projConnector} </Text>
              <Text color={palette.warn} bold>
                {truncate(projectName, PANEL_WIDTH - 8)}
              </Text>
            </Box>,
          );

          entries.forEach(({ repo }, entryIdx) => {
            const originalFlatIndex = flatIndexMap.get(repo.name) ?? 0;
            const repoSelected = orgSelected && originalFlatIndex === selectedRepoIndex;
            const isLastRepo = entryIdx === entries.length - 1;
            const vertPrefix = isLastProject ? "     " : `  ${glyph.vert}  `;
            const repoConnector = isLastRepo ? glyph.branchLast : glyph.branch;

            if (repoSelected) selectedRow = rows.length;
            rows.push(
              <Box key={`${orgKey}-repo-${repo.name}`}>
                <Text color={palette.muted}>
                  {vertPrefix}{repoConnector}{" "}
                </Text>
                <Text
                  color={repoSelected ? palette.accent : palette.text}
                  bold={repoSelected}
                >
                  {truncate(repo.name, PANEL_WIDTH - 14)}
                </Text>
                <Text color={repo.pullRequests.length > 0 ? palette.ok : palette.muted}>
                  {" "}({repo.pullRequests.length})
                </Text>
              </Box>,
            );
          });
        });
      }
    }
  });

  // Window the rows: keep the selection roughly centered and show how many
  // rows are hidden above/below.
  const total = rows.length;
  let body = rows;
  if (total > maxRows) {
    const inner = Math.max(3, maxRows - 2);
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
      {/* Header row: title + filter badge */}
      <Box justifyContent="space-between">
        <Text color={active ? palette.accent : palette.muted} bold>
          {glyph.files} Organizations
        </Text>
        <Text color={filteringByPrs || isCustomFilter ? palette.warn : palette.muted}>
          {filteringByPrs
            ? "PRs only"
            : treeFilter === "all"
              ? "All"
              : treeFilter === "me"
                ? "My PRs"
                : `Filter: ${treeFilter}`}
        </Text>
      </Box>

      {data.organizations.length === 0 ? (
        <Text color={palette.muted}>No organizations.</Text>
      ) : (
        body
      )}

      {/* Hints moved to global footer */}
    </Box>
  );
};
