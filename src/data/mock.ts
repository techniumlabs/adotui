import type { AppData } from "../domain/types";

export const MOCK_DATA: AppData = {
  organizations: [
    {
      name: "contoso-platform",
      repositories: [
        {
          name: "adotui-core",
          pullRequests: [
            {
              id: 401,
              title: "Add grouped PR feed state orchestration",
              author: "maya",
              draft: false,
              status: "active",
              reviewState: "pending",
              sourceBranch: "feature/grouped-feed",
              targetBranch: "main",
              updatedAt: "2026-07-01T14:00:00.000Z",
              comments: 7,
              checksPassed: 8,
              checksTotal: 9,
              url: "https://dev.azure.com/contoso-platform/adotui-core/_git/adotui-core/pullrequest/401",
              changedFiles: [
                {
                  path: "src/app/App.tsx",
                  status: "modified",
                  additions: 28,
                  deletions: 11,
                  diff: [
                    "- const nextRepoIndex = clampPrIndex(nextOrg?.repositories[current.selectedRepoIndex], current.selectedRepoIndex + repoDelta);",
                    "+ const nextRepoIndex = clampPrIndex(nextOrg?.repositories[current.selectedRepoIndex], current.selectedRepoIndex + repoDelta);",
                    "+ const nextRepo = nextOrg?.repositories[nextRepoIndex];",
                    "+ return { ...current, selectedOrgIndex: nextOrgIndex, selectedRepoIndex: nextRepoIndex, selectedPrIndex: clampPrIndex(nextRepo, current.selectedPrIndex) };",
                  ],
                },
                {
                  path: "src/domain/types.ts",
                  status: "modified",
                  additions: 12,
                  deletions: 0,
                  diff: [
                    "+ export interface PullRequestFileChange {",
                    "+   path: string;",
                    "+   status: \"added\" | \"modified\" | \"deleted\";",
                    "+   additions: number;",
                    "+   deletions: number;",
                    "+   diff: string[];",
                    "+ }",
                  ],
                },
              ],
            },
            {
              id: 399,
              title: "Improve keyboard intent router for command mode",
              author: "ram",
              draft: true,
              status: "active",
              reviewState: "pending",
              sourceBranch: "feature/intent-router",
              targetBranch: "main",
              updatedAt: "2026-06-30T09:40:00.000Z",
              comments: 2,
              checksPassed: 3,
              checksTotal: 6,
              url: "https://dev.azure.com/contoso-platform/adotui-core/_git/adotui-core/pullrequest/399",
              changedFiles: [
                {
                  path: "src/app/App.tsx",
                  status: "modified",
                  additions: 17,
                  deletions: 4,
                  diff: [
                    "- if (command.startsWith(\"complete\")) {",
                    "+ if (command.startsWith(\"complete\")) {",
                    "+   openCompletionEditor(parseCompletionCommand(rawCommand));",
                    "+   return;",
                    "  }",
                  ],
                },
              ],
            }
          ]
        },
        {
          name: "adotui-connectors",
          pullRequests: [
            {
              id: 214,
              title: "PAT profile loading and schema validation",
              author: "sanjay",
              draft: false,
              status: "active",
              reviewState: "approved",
              sourceBranch: "feature/pat-config",
              targetBranch: "main",
              updatedAt: "2026-07-01T08:15:00.000Z",
              comments: 4,
              checksPassed: 5,
              checksTotal: 5,
              url: "https://dev.azure.com/contoso-platform/adotui-connectors/_git/adotui-connectors/pullrequest/214",
              changedFiles: [
                {
                  path: "src/data/mock.ts",
                  status: "modified",
                  additions: 22,
                  deletions: 0,
                  diff: [
                    "+ changedFiles: [",
                    "+   { path: \"src/app/App.tsx\", status: \"modified\", additions: 8, deletions: 1, diff: [...] },",
                    "+ ],",
                  ],
                },
              ],
            }
          ]
        }
      ]
    },
    {
      name: "fabrikam-engineering",
      repositories: [
        {
          name: "services-gateway",
          pullRequests: [
            {
              id: 882,
              title: "Parallelize PR fetch batching across repositories",
              author: "nina",
              draft: false,
              status: "active",
              reviewState: "changes-requested",
              sourceBranch: "perf/parallel-fetch",
              targetBranch: "main",
              updatedAt: "2026-06-29T18:35:00.000Z",
              comments: 13,
              checksPassed: 12,
              checksTotal: 12,
              url: "https://dev.azure.com/fabrikam-engineering/services-gateway/_git/services-gateway/pullrequest/882",
              changedFiles: [
                {
                  path: "src/app/App.tsx",
                  status: "modified",
                  additions: 40,
                  deletions: 18,
                  diff: [
                    "- const cmd = [\"open\", url];",
                    "+ const cmd = platform === \"darwin\" ? [\"open\", url] : ...;",
                    "+ Bun.spawn({ cmd, stdout: \"ignore\", stderr: \"ignore\" });",
                  ],
                },
                {
                  path: "src/data/mock.ts",
                  status: "modified",
                  additions: 9,
                  deletions: 1,
                  diff: [
                    "+ changedFiles: [...],",
                  ],
                },
              ],
            },
            {
              id: 870,
              title: "Reduce repaint churn in Ink list rendering",
              author: "lee",
              draft: false,
              status: "completed",
              reviewState: "approved",
              sourceBranch: "perf/repaint-reduction",
              targetBranch: "main",
              updatedAt: "2026-06-28T11:05:00.000Z",
              comments: 5,
              checksPassed: 10,
              checksTotal: 10,
              url: "https://dev.azure.com/fabrikam-engineering/services-gateway/_git/services-gateway/pullrequest/870",
              changedFiles: [
                {
                  path: "src/app/App.tsx",
                  status: "modified",
                  additions: 14,
                  deletions: 8,
                  diff: [
                    "- <Text color=\"gray\">complete options...</Text>",
                    "+ <Text color=\"gray\">configured: ...</Text>",
                  ],
                },
              ],
            }
          ]
        },
        {
          name: "ui-observability",
          pullRequests: [
            {
              id: 128,
              title: "Introduce stale-while-revalidate cache policy",
              author: "ivy",
              draft: false,
              status: "active",
              reviewState: "pending",
              sourceBranch: "feature/swr-cache",
              targetBranch: "main",
              updatedAt: "2026-06-30T23:10:00.000Z",
              comments: 1,
              checksPassed: 2,
              checksTotal: 3,
              url: "https://dev.azure.com/fabrikam-engineering/ui-observability/_git/ui-observability/pullrequest/128",
              changedFiles: [
                {
                  path: "src/domain/types.ts",
                  status: "modified",
                  additions: 5,
                  deletions: 0,
                  diff: [
                    "+ export interface PullRequestFileChange { ... }",
                  ],
                },
              ],
            }
          ]
        }
      ]
    }
  ]
};
