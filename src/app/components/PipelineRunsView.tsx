import React, { useCallback, useEffect, useState } from "react";
import { Box, Text, useInput } from "ink";
import type { PipelineRun, PullRequest } from "../../domain/types";
import type { FocusArea } from "../types";
import { glyph, palette, truncate } from "../theme";
import { formatRelativeAge, openInBrowser } from "../utils";
import { fetchPipelineRuns } from "../../data/azureRest";
import { getRunsCache, runsCacheKey, setRunsCache } from "../../data/cache";

type PipelineRunsViewProps = {
  selectedPr?: PullRequest;
  focus: FocusArea;
};

const stateIcon = (run: PipelineRun): string => {
  if (run.state === "inProgress" || run.state === "canceling") return glyph.clock;
  if (run.result === "succeeded") return glyph.check;
  if (run.result === "failed") return glyph.cross;
  if (run.result === "canceled") return glyph.cross;
  return glyph.pending;
};

const stateColor = (run: PipelineRun): string => {
  if (run.state === "inProgress") return palette.info;
  if (run.state === "canceling") return palette.warn;
  if (run.result === "succeeded") return palette.ok;
  if (run.result === "failed") return palette.danger;
  if (run.result === "canceled") return palette.muted;
  return palette.muted;
};

const stateLabel = (run: PipelineRun): string => {
  if (run.state === "inProgress") return "in progress";
  if (run.state === "canceling") return "canceling";
  if (run.state === "none") return "pending";
  return run.result ?? "unknown";
};

const durationLabel = (run: PipelineRun): string => {
  if (!run.startTime) return "";
  const start = Date.parse(run.startTime);
  const end = run.finishTime ? Date.parse(run.finishTime) : Date.now();
  const secs = Math.max(0, Math.floor((end - start) / 1000));
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  const rem = secs % 60;
  return `${mins}m${rem}s`;
};

export const PipelineRunsView: React.FC<PipelineRunsViewProps> = ({
  selectedPr,
  focus,
}) => {
  const active = focus === "runs";

  const [runs, setRuns] = useState<PipelineRun[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedIdx, setSelectedIdx] = useState(0);

  // ── Data loading ───────────────────────────────────────────────────────────

  const loadRuns = useCallback(
    async (force = false) => {
      if (!selectedPr) return;
      const key = runsCacheKey(selectedPr.organizationUrl, selectedPr.project);

      if (!force) {
        const cached = getRunsCache(key);
        if (cached) {
          setRuns(cached);
          return;
        }
      }

      setLoading(true);
      setError(null);
      try {
        const data = await fetchPipelineRuns(
          selectedPr.organizationUrl,
          selectedPr.project,
        );
        setRunsCache(key, data);
        setRuns(data);
        setSelectedIdx(0);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load pipeline runs.");
      } finally {
        setLoading(false);
      }
    },
    [selectedPr],
  );

  useEffect(() => {
    if (selectedPr) {
      void loadRuns();
    } else {
      setRuns([]);
    }
  }, [selectedPr?.id]);

  // ── Keyboard ───────────────────────────────────────────────────────────────

  useInput(
    (input, key) => {
      if (!active) return;

      if (input === "j" || key.downArrow) {
        setSelectedIdx((i) => Math.min(i + 1, runs.length - 1));
      } else if (input === "k" || key.upArrow) {
        setSelectedIdx((i) => Math.max(i - 1, 0));
      } else if (input === "o") {
        const run = runs[selectedIdx];
        if (run?.url) openInBrowser(run.url);
      } else if (input === "R") {
        void loadRuns(true);
      }
    },
    { isActive: active },
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  // Count summary
  const succeeded = runs.filter((r) => r.result === "succeeded").length;
  const failed = runs.filter((r) => r.result === "failed").length;
  const inProgress = runs.filter((r) => r.state === "inProgress").length;

  return (
    <Box
      marginTop={1}
      borderStyle="round"
      borderColor={active ? palette.accent : palette.muted}
      paddingX={1}
      flexDirection="column"
    >
      {/* Header */}
      <Box justifyContent="space-between">
        <Text color={active ? palette.accent : palette.muted} bold>
          {glyph.clock} Pipeline Runs
          {selectedPr ? ` — ${selectedPr.project}` : ""}
        </Text>
        <Text color={palette.muted}>
          {loading
            ? `${glyph.clock} loading…`
            : `${runs.length} runs`}
        </Text>
      </Box>

      {/* Summary badges */}
      {runs.length > 0 && (
        <Box marginTop={1}>
          <Text color={palette.ok}>{glyph.check} {succeeded} passed{"   "}</Text>
          <Text color={palette.danger}>{glyph.cross} {failed} failed{"   "}</Text>
          {inProgress > 0 && (
            <Text color={palette.info}>{glyph.clock} {inProgress} running</Text>
          )}
        </Box>
      )}

      {error && <Text color={palette.danger}>{error}</Text>}

      {!selectedPr && (
        <Text color={palette.muted}>Select a PR to view pipeline runs.</Text>
      )}

      {selectedPr && !loading && runs.length === 0 && !error && (
        <Text color={palette.muted}>No pipeline runs found for this project.</Text>
      )}

      {/* Run list */}
      {runs.map((run, idx) => {
        const isSelected = idx === selectedIdx && active;
        const icon = stateIcon(run);
        const color = stateColor(run);
        const label = stateLabel(run);
        const duration = durationLabel(run);
        const started = run.startTime ? formatRelativeAge(run.startTime) : "";

        return (
          <Box key={run.id} marginTop={1} flexDirection="column">
            <Box>
              <Text color={isSelected ? palette.accent : palette.muted}>
                {isSelected ? glyph.pointer : glyph.pointerIdle}{" "}
              </Text>
              {/* Status icon */}
              <Box width={3}>
                <Text color={color}>{icon} </Text>
              </Box>
              {/* Pipeline name */}
              <Box flexGrow={1}>
                <Text
                  color={isSelected ? palette.textBright : palette.text}
                  bold={isSelected}
                >
                  {truncate(run.pipelineName, 28)}
                </Text>
              </Box>
              {/* Run label */}
              <Box marginLeft={1} width={12}>
                <Text color={color}>{truncate(label, 11)}</Text>
              </Box>
              {/* Duration */}
              {duration && (
                <Box marginLeft={1} width={8}>
                  <Text color={palette.muted}>{duration}</Text>
                </Box>
              )}
              {/* Age */}
              {started && (
                <Text color={palette.muted}>{started}</Text>
              )}
            </Box>
            {/* Run name (build number) on second line when selected */}
            {isSelected && (
              <Box marginLeft={4}>
                <Text color={palette.muted}>
                  #{run.id} {truncate(run.name, 40)}
                  {"  "}<Text color={palette.accentDim}>o</Text> open in browser
                </Text>
              </Box>
            )}
          </Box>
        );
      })}

      {/* Keyboard hint */}
      {active && (
        <Box marginTop={1}>
          <Text color={palette.muted}>
            <Text color={palette.accentDim}>j/k</Text> navigate{"  "}
            <Text color={palette.accentDim}>o</Text> open{"  "}
            <Text color={palette.accentDim}>R</Text> refresh{"  "}
            <Text color={palette.accentDim}>h</Text> back
          </Text>
        </Box>
      )}
    </Box>
  );
};
