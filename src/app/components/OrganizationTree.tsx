import React from "react";
import { Box, Text } from "ink";
import type { AppData, RepositoryNode } from "../../domain/types";
import type { FocusArea } from "../types";
import { glyph, palette, truncate } from "../theme";

type OrganizationTreeProps = {
  data: AppData;
  selectedOrgIndex: number;
  selectedRepoIndex: number;
  focus: FocusArea;
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
}) => {
  const active = focus === "tree";

  return (
    <Box
      width={PANEL_WIDTH}
      borderStyle="round"
      borderColor={active ? palette.accent : palette.muted}
      paddingX={1}
      flexDirection="column"
    >
      <Text color={active ? palette.accent : palette.muted} bold>
        {glyph.files} Organizations
      </Text>

      {data.organizations.length === 0 ? (
        <Text color={palette.muted}>No organizations.</Text>
      ) : (
        data.organizations.map((org, orgIndex) => {
          const orgSelected = orgIndex === selectedOrgIndex;
          const prCount = org.repositories.reduce(
            (sum, repo) => sum + repo.pullRequests.length,
            0,
          );
          const projectGroups = groupByProject(org.repositories);

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
                {org.repositories.length} repos {glyph.bullet} {prCount} prs
              </Text>

              {/* Project → Repo rows (only when org is selected) */}
              {orgSelected &&
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
                      {entries.map(({ repo, flatIndex }, entryIdx) => {
                        const repoSelected = flatIndex === selectedRepoIndex;
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
                            <Text color={palette.muted}> ({repo.pullRequests.length})</Text>
                          </Box>
                        );
                      })}
                    </Box>
                  );
                })}
            </Box>
          );
        })
      )}
    </Box>
  );
};
