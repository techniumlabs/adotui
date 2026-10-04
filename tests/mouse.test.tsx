import { beforeEach, describe, expect, test } from "bun:test";
import { render } from "ink-testing-library";
import { App } from "../src/app/App";
import { useAppStore } from "../src/app/store";
import { INITIAL_STATE } from "../src/app/constants";
import { selectVisiblePrs } from "../src/app/selectors";
import { parseMouse, WHEEL_DOWN_INPUT, WHEEL_UP_INPUT } from "../src/app/mouse/parseMouse";
import { until } from "./helpers/wait";

process.env.ADOTUI_MOCK = "1";
process.env.NODE_ENV = "test";

/** SGR reports are 1-based. */
const press = (col: number, row: number) => `\x1b[<0;${col + 1};${row + 1}M`;
const release = (col: number, row: number) => `\x1b[<0;${col + 1};${row + 1}m`;
const click = (col: number, row: number) => press(col, row) + release(col, row);

describe("parseMouse", () => {
  test("a left press becomes a 0-based click; its release is dropped", () => {
    expect(parseMouse(click(4, 9))).toEqual({ rest: "", clicks: [{ col: 4, row: 9 }] });
  });

  test("typed keys around a report pass through untouched", () => {
    expect(parseMouse(`a${click(0, 0)}b`)).toEqual({ rest: "ab", clicks: [{ col: 0, row: 0 }] });
  });

  test("the wheel becomes arrow keys", () => {
    expect(parseMouse("\x1b[<64;5;5M\x1b[<65;5;5M").rest).toBe(WHEEL_UP_INPUT + WHEEL_DOWN_INPUT);
  });

  test("right / middle buttons, drags and modifier-only noise are ignored", () => {
    expect(parseMouse("\x1b[<2;5;5M\x1b[<1;5;5M\x1b[<32;5;5M")).toEqual({ rest: "", clicks: [] });
  });
});

describe("clicking in the app", () => {
  beforeEach(() => {
    // "all": the first repository then shows more than one PR to click between.
    useAppStore.setState({ ...INITIAL_STATE, treeFilter: "all" });
  });

  const start = async () => {
    const app = render(<App mouse />);
    await until(() => useAppStore.getState().loadState === "ready", "the mock data to load");
    // A realistic terminal: at the test renderer's default size the Diff tab's file list is
    // squeezed off screen. Resize once the app's listener is attached, then wait for it.
    Object.defineProperty(app.stdout, "rows", { value: 50, configurable: true });
    app.stdout.emit("resize");
    await until(() => (app.lastFrame() ?? "").split("\n").length >= 49, "the 50-row frame");
    await new Promise((r) => setTimeout(r, 100));
    return app;
  };

  /** Screen cell of the first occurrence of `text`, searching from the right pane when asked. */
  const cellOf = (frame: string, text: string, fromCol = 0) => {
    const lines = frame.split("\n");
    for (let row = 0; row < lines.length; row += 1) {
      const col = lines[row]!.indexOf(text, fromCol);
      if (col !== -1) return { col, row };
    }
    throw new Error(`"${text}" is not on screen`);
  };

  const state = () => useAppStore.getState();

  test("a PR row, a tab, a file and a tree row are clickable, and the wheel moves the selection", async () => {
    const { stdin, lastFrame } = await start();

    // PR row: the second visible PR of the selected repository.
    const prs = selectVisiblePrs(state());
    expect(prs.length).toBeGreaterThan(1);
    const second = cellOf(lastFrame()!, prs[1]!.title.slice(0, 12));
    stdin.write(click(second.col, second.row));
    await until(() => state().selectedPrIndex === 1 && state().focus === "list", "the PR click");

    // Wheel up over the list = ↑: back to the first PR.
    stdin.write(`\x1b[<64;${second.col + 1};${second.row + 1}M`);
    await until(() => state().selectedPrIndex === 0, "the wheel");

    // Tab label "2 diff".
    const diffTab = cellOf(lastFrame()!, "2 diff");
    stdin.write(click(diffTab.col + 1, diffTab.row));
    await until(() => state().focus === "files", "the Diff tab click");

    // Second file in the Diff tab.
    await new Promise((r) => setTimeout(r, 100));
    const files = selectVisiblePrs(state())[0]!.changedFiles;
    expect(files.length).toBeGreaterThan(1);
    const name = files[1]!.path.split("/").pop()!;
    const fileCell = cellOf(lastFrame()!, name, 30);
    stdin.write(click(fileCell.col, fileCell.row));
    await until(() => state().selectedFileIndex === 1, "the file click");

    // A repository row in the tree (left pane): a different repo of the selected organization.
    const repoName = state().data.organizations[0]!.repositories[1]!.name;
    const repoCell = cellOf(lastFrame()!, repoName.slice(0, 10));
    expect(repoCell.col).toBeLessThan(36);
    stdin.write(click(repoCell.col, repoCell.row));
    await until(() => state().selectedRepoIndex === 1 && state().focus === "tree", "the tree click");
  });

  test("a click on a non-clickable cell does nothing, and its digits never reach the keys", async () => {
    const { stdin } = await start();
    const before = { focus: state().focus, pr: state().selectedPrIndex, repo: state().selectedRepoIndex };
    // Row 0 is the header; the report's "2"s and "3"s must not act as tab keys.
    stdin.write(click(22, 0) + click(33, 0));
    await new Promise((r) => setTimeout(r, 150));
    expect({ focus: state().focus, pr: state().selectedPrIndex, repo: state().selectedRepoIndex }).toEqual(before);
  });
});
