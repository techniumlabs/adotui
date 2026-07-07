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
import { HelpView } from "./components/HelpView";

export const App: React.FC = () => {
  const [showSplash, setShowSplash] = React.useState(process.env.NODE_ENV !== "test");
  const { exit } = useApp();
  const size = useTerminalSize();
  const app = useAppState(exit);
  useAppKeyboard(app, exit);

  React.useEffect(() => {
    // If we've finished the initial load, wait a short moment and dismiss splash
    if (app.state.loadState !== "loading" && showSplash) {
      const t = setTimeout(() => setShowSplash(false), 2000);
      return () => clearTimeout(t);
    }
  }, [app.state.loadState, showSplash]);

  const {
    state,
    selectedRepo,
    visiblePrs,
    selectedPr,
    totalPrs,
    repoCount,
    activePrs,
    actions,
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
        {state.focus === "help" ? (
          <HelpView />
        ) : (
          <>
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
                visiblePrs={visiblePrs}
                repoName={selectedRepo?.name}
                selectedPrIndex={state.selectedPrIndex}
                focus={state.focus}
              />
              {selectedPr && <PrTabs focus={state.focus} />}
              {(() => {
                const renderFocus = (state.focus === "command" || state.focus === "completion") 
                  ? (state.previousFocus ?? "detail") 
                  : state.focus;
                
                if (renderFocus === "files") {
                  return (
                    <FilesView
                      selectedPr={selectedPr}
                  selectedFileIndex={state.selectedFileIndex}
                  diffScrollOffset={state.diffScrollOffset}
                  onScrollOffsetChange={actions.setDiffScrollOffset}
                  diffSelectedRow={state.diffSelectedRow}
                  onSelectedRowChange={actions.setDiffSelectedRow}
                  focus={state.focus}
                  diffViewMode={state.diffViewMode}
                  onInputModeChange={actions.setCommentInputActive}
                      isLoading={state.loadState === "loading"}
                      fileFilter={state.fileFilter}
                      updateFileDiff={actions.updateFileDiff}
                      setFileLoading={actions.setFileLoading}
                    />
                  );
                }
                
                if (renderFocus === "comments") {
                  return (
                    <CommentsView
                      selectedPr={selectedPr}
                  focus={state.focus}
                  currentUserEmail={state.data.currentUserEmail}
                      onInputModeChange={actions.setCommentInputActive}
                    />
                  );
                }
                
                if (renderFocus === "runs") {
                  return <PipelineRunsView selectedPr={selectedPr} focus={state.focus} />;
                }
                
                return <PrDetails selectedPr={selectedPr} focus={state.focus} />;
              })()}
            </Box>
          </>
        )}
      </Box>

      <CommandBar
        focus={state.focus}
        commandText={state.commandText}
        pendingConfirm={state.pendingConfirm}
        hasSelectedPr={!!selectedPr}
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
          <Text color={palette.accent} bold>1-4</Text> switch view tab{"   "}
          <Text color={palette.accent} bold>tab</Text> focus{"   "}
          {selectedPr ? (
            <>
              <Text color={palette.accent} bold>a</Text> approve{"   "}
              <Text color={palette.accent} bold>x</Text> reject{"   "}
              <Text color={palette.accent} bold>c</Text> complete{"   "}
            </>
          ) : (
            <>
              <Text color={palette.accent} bold>enter</Text> open pr{"   "}
            </>
          )}
          <Text color={palette.accent} bold>?</Text> help{"   "}
          <Text color={palette.accent} bold>q</Text> quit
        </Text>
      </Box>

      <CompletionEditor state={state} />
    </Box>
  );
};
