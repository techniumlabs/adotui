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
import { ToastContainer } from "./components/ToastContainer";
import { formatRelativeAge } from "./utils";
import { glyph, palette } from "./theme";
import { useAppState } from "./hooks/useAppState";
import { useAppKeyboard } from "./hooks/useAppKeyboard";
import { useTerminalSize } from "./hooks/useTerminalSize";
import { Splash } from "./components/Splash";

export const App: React.FC = () => {
  const [showSplash, setShowSplash] = React.useState(process.env.NODE_ENV !== "test");
  const { exit } = useApp();
  const size = useTerminalSize();
  const app = useAppState(exit);
  useAppKeyboard(app, exit);

  React.useEffect(() => {
    // If we've finished the initial load, wait a short moment and dismiss splash
    if (app.state.loadState !== "loading" && showSplash) {
      const t = setTimeout(() => setShowSplash(false), 1200);
      return () => clearTimeout(t);
    }
  }, [app.state.loadState, showSplash]);

  const {
    state,
    setState,
    selectedRepo,
    selectedPr,
    totalPrs,
    repoCount,
    activePrs,
  } = app;

  if (showSplash) {
    return <Splash />;
  }

  return (
    <Box flexDirection="column" minHeight={size.rows} width="100%">
      <ToastContainer toasts={state.toasts || []} />
      {/* Header */}
      <Box paddingX={1} justifyContent="space-between">
        <Text color={palette.accent} bold>
          {glyph.dot} ADOTUI
        </Text>
        <Text color={palette.muted}>
          Azure DevOps PR Monitor {glyph.bullet} {process.platform}
        </Text>
      </Box>

      {/* Banner / Status line */}
      <Box paddingX={1} borderBottom={false} borderStyle="single" borderColor={palette.border}>
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

      <Box paddingX={1}>
        <SummaryBar
          activePrs={activePrs}
          totalPrs={totalPrs}
          orgCount={state.data.organizations.length}
          repoCount={repoCount}
          autoRefresh={state.autoRefresh}
          relativeLastRefresh={formatRelativeAge(state.lastRefreshISO)}
          loadState={state.loadState}
        />
      </Box>

      <Box flexGrow={1} flexDirection="row" overflow="hidden">
        <OrganizationTree
          data={state.data}
          selectedOrgIndex={state.selectedOrgIndex}
          selectedRepoIndex={state.selectedRepoIndex}
          focus={state.focus}
          treeFilter={state.treeFilter}
        />

        <Box
          flexGrow={1}
          marginLeft={1}
          flexDirection="column"
          borderStyle="round"
          borderColor={state.focus !== "tree" ? palette.accent : palette.border}
        >
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

      {/* Unified Footer */}
      <Box
        borderStyle="single"
        borderTop={true}
        borderLeft={false}
        borderRight={false}
        borderBottom={false}
        borderColor={palette.border}
        paddingX={2}
        paddingBottom={1}
      >
        <Text color={palette.muted}>
          <Text color={palette.accent} bold>/</Text> filter{"   "}
          <Text color={palette.accent} bold>j/k</Text> move{"   "}
          <Text color={palette.accent} bold>enter</Text> open pr{"   "}
          <Text color={palette.accent} bold>tab</Text> switch pane{"   "}
          <Text color={palette.accent} bold>?</Text> help{"   "}
          <Text color={palette.accent} bold>q</Text> quit
        </Text>
      </Box>

      <CompletionEditor state={state} />
    </Box>
  );
};
