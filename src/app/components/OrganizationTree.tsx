import React from "react";
import { Box, Text } from "ink";
import type { AppData, RepositoryNode } from "../../domain/types";
import type { FocusArea, TreeFilter } from "../types";
import { glyph, palette, truncate } from "../theme";

type OrganizationTreeProps = {
  data: AppData;
  selectedOrgIndex: number;
  selectedRepoIndex: number;
  focus: FocusArea;
  treeFilter: TreeFilter;
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
}) => {
  const active = focus === "tree";
  const filteringByPrs = treeFilter === "with-prs";

  return (
    <Box
      width={PANEL_WIDTH}
      borderStyle="round"
      borderColor={active ? palette.accent : palette.muted}
      paddingX={1}
      flexDirection="column"
    >
      {/* Header row: title + filter badge */}
      <Box justifyContent="space-between">
        <Text color={active ? palette.accent : palette.muted} bold>
          {glyph.files} Organizations
        </Text>
        <Text color={filteringByPrs ? palette.warn : palette.muted}>
          {filteringByPrs ? "PRs only" : "all"}
        </Text>
      </Box>



      {data.organizations.length === 0 ? (
        <Text color={palette.muted}>No organizations.</Text>
      ) : (
        data.organizations.map((org, orgIndex) => {
          const orgSelected = orgIndex === selectedOrgIndex;

          // Apply filter: only include repos that have at least one PR
          const visibleRepos = filteringByPrs
            ? org.repositories.filter((r) => r.pullRequests.length > 0)
            : org.repositories;

          const prCount = org.repositories.reduce(
            (sum, repo) => sum + repo.pullRequests.length,
            0,
          );

          const visibleCount = visibleRepos.length;

          // Build flat-index-preserving groups from the FILTERED repos.
          // We must preserve the original flatIndex so selection in App.tsx
          // (which uses the unfiltered array) still points to the right repo.
          const filteredWithIndex = filteringByPrs
            ? org.repositories
              .map((repo, idx) => ({ repo, flatIndex: idx }))
              .filter(({ repo }) => repo.pullRequests.length > 0)
            : org.repositories.map((repo, idx) => ({ repo, flatIndex: idx }));

          const projectGroups = groupByProject(
            filteredWithIndex.map(({ repo }) => repo),
          );
          // Re-attach original flat indices
          const flatIndexMap = new Map<string, number>(
            filteredWithIndex.map(({ repo, flatIndex }) => [repo.name, flatIndex]),
          );

          return (
            <Box key={org.organizationUrl || org.name} flexDirection="column" marginTop={orgIndex === 0 ? 1 : 0}>
              {/* Org row */}
              <Text
                color={orgSelected ? palette.textBright : palette.text}
                bold={orgSelected}
              >
                {orgSelected ? glyph.pointer : glyph.pointerIdle}{" "}
                {truncate(org.name, PANEL_WIDTH - 4)}
              </Text>
              <Text color={palette.muted}>
                {"  "}
                {filteringByPrs
                  ? `${visibleCount}/${org.repositories.length} repos ${glyph.bullet} ${prCount} prs`
                  : `${org.repositories.length} repos ${glyph.bullet} ${prCount} prs`}
              </Text>

              {/* Project → Repo rows (only when org is selected) */}
              {orgSelected &&
                (visibleCount === 0 ? (
                  <Text color={palette.muted}>{"  "}No repos with PRs.</Text>
                ) : (
                  projectGroups.map(({ projectName, entries }, projIdx) => {
                    const isLastProject = projIdx === projectGroups.length - 1;
                    const projConnector = isLastProject ? glyph.branchLast : glyph.branch;

                    return (
                      <Box key={projectName} flexDirection="column">
                        {/* Project header */}
                        <Box>
                          <Text color={palette.muted}>{"  "}{projConnector} </Text>
                          <Text color={palette.warn} bold>
                            {truncate(projectName, PANEL_WIDTH - 8)}
                          </Text>
                        </Box>

                        {/* Repo rows under this project */}
                        {entries.map(({ repo }, entryIdx) => {
                          const originalFlatIndex = flatIndexMap.get(repo.name) ?? 0;
                          const repoSelected = originalFlatIndex === selectedRepoIndex;
                          const isLastRepo = entryIdx === entries.length - 1;
                          const vertPrefix = isLastProject ? "     " : `  ${glyph.vert}  `;
                          const repoConnector = isLastRepo ? glyph.branchLast : glyph.branch;

                          return (
                            <Box key={repo.name}>
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
                            </Box>
                          );
                        })}
                      </Box>
                    );
                  })
                ))}
            </Box>
          );
        })
      )}

      {active && (
        <Box marginTop={1}>
          <Text color={palette.muted}>
            <Text color={palette.accentDim}>ᐃ and ᐁ</Text> navigate{"  "}
            <Text color={palette.accentDim}>↲</Text> select{"  "}
            <Text color={palette.accentDim}>v</Text> view all
          </Text>
        </Box>
      )}
    </Box>
  );
};
