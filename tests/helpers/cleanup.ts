/**
 * Preloaded for every test file (bunfig.toml). `bun test` runs all files in one process and the
 * store is module-global, so an <App/> left mounted keeps re-rendering on every store update of
 * every later test. Twenty of them made late tests time out on slow CI runners.
 */
import { afterEach } from "bun:test";
import { cleanup } from "ink-testing-library";
import { resetRefreshState } from "../../src/app/actions/refreshActions";

afterEach(() => {
  cleanup();
  // A refresh still in flight from the unmounted app would otherwise queue the next app's load behind it.
  resetRefreshState();
});
