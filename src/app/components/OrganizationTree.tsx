import React from "react";
import { Box, Text } from "ink";
import type { AppData } from "../../domain/types";
import type { FocusArea } from "../types";

type OrganizationTreeProps = {
  data: AppData;
  selectedOrgIndex: number;
  selectedRepoIndex: number;
  focus: FocusArea;
};

export const OrganizationTree: React.FC<OrganizationTreeProps> = ({
  data,
  selectedOrgIndex,
  selectedRepoIndex,
  focus,
}) => (
  <Box
    width={34}
    borderStyle="round"
    borderColor={focus === "tree" ? "cyan" : "gray"}
    paddingX={1}
    paddingY={0}
    flexDirection="column"
  >
    <Text color={focus === "tree" ? "cyan" : "gray"}>Organizations</Text>
    {data.organizations.map((org, orgIndex) => {
      const selectedOrgMarker = orgIndex === selectedOrgIndex ? ">" : " ";
      const repoCount = org.repositories.length;
      const prCount = org.repositories.reduce(
        (sum, repo) => sum + repo.pullRequests.length,
        0,
      );

      return (
        <Box key={org.name} flexDirection="column">
          <Text color={orgIndex === selectedOrgIndex ? "whiteBright" : "gray"}>
            {selectedOrgMarker} {org.name} ({repoCount} repos, {prCount} prs)
          </Text>
          {orgIndex === selectedOrgIndex &&
            org.repositories.map((repo, repoIndex) => (
              <Text
                key={repo.name}
                color={repoIndex === selectedRepoIndex ? "cyan" : "gray"}
              >
                {repoIndex === selectedRepoIndex ? "  >" : "   "} {repo.name} (
                {repo.pullRequests.length})
              </Text>
            ))}
        </Box>
      );
    })}
  </Box>
);
