import React from "react";
import { Box, Text, useApp } from "ink";
import Spinner from "ink-spinner";
import { CommandBar } from "./components/CommandBar";
import { CommentsView } from "./components/CommentsView";
import { CompletionEditor } from "./components/CompletionEditor";
import { FilesView } from "./components/FilesView";
import { OrganizationTree } from "./components/OrganizationTree";
import { PipelineRunsView } from "./components/PipelineRunsView";
import { PrDetails } from "./components/PrDetails";
import { PrTabs } from "./components/PrTabs";
import { PullRequestList } from "./components/PullRequestList";
import { SummaryBar } from "./components/SummaryBar";
import { formatRelativeAge } from "./utils";
import { glyph, palette } from "./theme";
import { useAppState } from "./hooks/useAppState";
import { useAppKeyboard } from "./hooks/useAppKeyboard";

export const App: React.FC = () => {
  const { exit } = useApp();
  const app = useAppState(exit);
  useAppKeyboard(app, exit);

  const {
    state,
    setState,
    selectedOrg,
    selectedRepo,
    selectedPr,
    totalPrs,
    repoCount,
    activePrs,
  } = app;

  return (
    <Box flexDirection="column" padding={1}>
      <Box justifyContent="space-between">
        <Box>
          <Text color={palette.accent} bold>
            {glyph.dot} adotui
          </Text>
          <Text color={palette.muted}> Azure DevOps PR Monitor</Text>
        </Box>
        <Text color={palette.muted}>
          {process.platform} {glyph.bullet} bun {Bun.version}
        </Text>
      </Box>

      <Box marginTop={1}>
        <Text
          color={
            state.loadState === "error"
              ? palette.danger
              : state.pendingConfirm
                ? palette.warn
                : state.loadState === "loading"
                  ? palette.warn
                  : palette.text
          }
        >
          {state.loadState === "loading" ? <Spinner type="dots" /> : ""}
          {state.loadState === "loading" ? " " : ""}
          {state.banner}
        </Text>
      </Box>

      <SummaryBar
        activePrs={activePrs}
        totalPrs={totalPrs}
        orgCount={state.data.organizations.length}
        repoCount={repoCount}
        autoRefresh={state.autoRefresh}
        relativeLastRefresh={formatRelativeAge(state.lastRefreshISO)}
        loadState={state.loadState}
      />

      <Box marginTop={1}>
        <OrganizationTree
          data={state.data}
          selectedOrgIndex={state.selectedOrgIndex}
          selectedRepoIndex={state.selectedRepoIndex}
          focus={state.focus}
          treeFilter={state.treeFilter}
        />

        <Box flexGrow={1} marginLeft={1} flexDirection="column">
          <PullRequestList
            pullRequests={selectedRepo?.pullRequests ?? []}
            repoName={selectedRepo?.name}
            selectedPrIndex={state.selectedPrIndex}
            focus={state.focus}
            prFilter={state.prFilter}
          />
          {selectedPr && <PrTabs focus={state.focus} />}
          {state.focus === "files" ? (
            <FilesView
              selectedPr={selectedPr}
              selectedFileIndex={state.selectedFileIndex}
              diffScrollOffset={state.diffScrollOffset}
              onScrollOffsetChange={(offset) => setState(c => ({ ...c, diffScrollOffset: offset }))}
              diffSelectedRow={state.diffSelectedRow}
              onSelectedRowChange={(row) => setState(c => ({ ...c, diffSelectedRow: row }))}
              focus={state.focus}
              diffViewMode={state.diffViewMode}
              onInputModeChange={(active) => setState(c => c.commentInputActive === active ? c : { ...c, commentInputActive: active })}
            />
          ) : state.focus === "comments" ? (
            <CommentsView 
              selectedPr={selectedPr} 
              focus={state.focus}
              currentUserEmail={state.data.currentUserEmail}
              onInputModeChange={(active) => setState(c => c.commentInputActive === active ? c : { ...c, commentInputActive: active })}
            />
          ) : state.focus === "runs" ? (
            <PipelineRunsView selectedPr={selectedPr} focus={state.focus} />
          ) : (
            <PrDetails selectedPr={selectedPr} focus={state.focus} />
          )}
        </Box>
      </Box>

      <CommandBar
        focus={state.focus}
        commandText={state.commandText}
        pendingConfirm={state.pendingConfirm}
      />

      <Box marginTop={1} flexWrap="wrap">
        <Text color={palette.muted}>
          <Text color={palette.accentDim}>tab</Text> focus{"   "}
          <Text color={palette.accentDim}>1-4</Text> views{"   "}
          <Text color={palette.accentDim}>r</Text> refresh{"   "}
          <Text color={palette.ok}>a</Text> approve{"   "}
          <Text color={palette.danger}>x</Text> reject{"   "}
          <Text color={palette.info}>c</Text> complete{"   "}
          <Text color={palette.accentDim}>o</Text> open browser{"   "}
          <Text color={palette.accentDim}>q</Text> quit
        </Text>
      </Box>

      <CompletionEditor state={state} />
    </Box>
  );
};
