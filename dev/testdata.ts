#!/usr/bin/env bun
/**
 * Seeds (or removes) Azure DevOps test data for adotui load testing.
 *
 * Creates projects named `adotui-loadtest-p<N>`, each with repos containing an
 * initial commit (README + seed source files), feature branches, and active
 * PRs whose commits carry multi-line code changes (edits, additions and
 * deletions across several files) — entirely server-side via
 * the az CLI (no local clones). Cleanup deletes ONLY projects carrying the
 * loadtest prefix, so pre-existing projects are never touched.
 *
 * Usage:
 *   bun dev/testdata.ts create  --org <url> [--projects 2] [--repos 3] [--prs 2]
 *   bun dev/testdata.ts cleanup --org <url>
 */
import { CommandError, run, runJson } from "../src/data/command";
import { withTempFile } from "../src/data/tempFile";
import { mapWithConcurrency } from "../src/data/azure";

const DEFAULT_PREFIX = "adotui-loadtest-";
const AZ = "az";
const ZERO_OBJECT_ID = "0".repeat(40);

interface Options {
  org: string;
  prefix: string;
  projects: number;
  repos: number;
  prs: number;
}

const usage = (): never => {
  console.error(
    "Usage:\n" +
      "  bun dev/testdata.ts create  --org <url> [--projects 2] [--repos 3] [--prs 2] [--prefix adotui-loadtest-]\n" +
      "  bun dev/testdata.ts cleanup --org <url> [--prefix adotui-loadtest-]\n" +
      "  (--prefix must start with 'adotui-' so cleanup can never touch real projects)",
  );
  process.exit(1);
};

const parseArgs = (): { command: "create" | "cleanup"; options: Options } => {
  const [command, ...rest] = process.argv.slice(2);
  const get = (flag: string): string | undefined => {
    const i = rest.indexOf(flag);
    return i >= 0 ? rest[i + 1] : undefined;
  };
  const org = get("--org");
  const prefix = get("--prefix") ?? DEFAULT_PREFIX;
  if (command !== "create" && command !== "cleanup") {
    return usage();
  }
  if (!org || !prefix.startsWith("adotui-")) {
    return usage();
  }
  return {
    command,
    options: {
      org,
      prefix,
      projects: Number(get("--projects") ?? 2),
      repos: Number(get("--repos") ?? 3),
      prs: Number(get("--prs") ?? 2),
    },
  };
};

const log = (msg: string): void => {
  console.log(`[testdata] ${msg}`);
};

/** Retries transient az/network failures with linear backoff. */
const withRetry = async <T>(
  label: string,
  fn: () => Promise<T>,
  attempts = 3,
): Promise<T> => {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fn();
    } catch (cause) {
      lastError = cause;
      if (attempt < attempts) {
        log(`retrying ${label} (attempt ${attempt + 1}/${attempts})`);
        await Bun.sleep(2_000 * attempt);
      }
    }
  }
  throw lastError;
};

/** POST a server-side git push (commit + ref update) via az devops invoke. */
const invokePush = (
  org: string,
  project: string,
  repositoryId: string,
  body: unknown,
): Promise<{ commits?: { commitId?: string }[] }> =>
  withTempFile(
    JSON.stringify(body),
    (tmpPath) =>
      runJson(AZ, [
        "devops", "invoke",
        "--area", "git",
        "--resource", "pushes",
        "--route-parameters", `project=${project}`, `repositoryId=${repositoryId}`,
        "--http-method", "POST",
        "--in-file", tmpPath,
        "--api-version", "7.1",
        "--organization", org,
        "--output", "json",
      ], { timeoutMs: 30_000 }),
    { prefix: "adotui-testdata", suffix: ".json" },
  );

const addFile = (path: string, content: string): Record<string, unknown> => ({
  changeType: "add",
  item: { path },
  newContent: { content, contentType: "rawtext" },
});

const editFile = (path: string, content: string): Record<string, unknown> => ({
  changeType: "edit",
  item: { path },
  newContent: { content, contentType: "rawtext" },
});

// ─── seed file contents ───────────────────────────────────────────────────────
// Built from line arrays (not template literals) so the generated code can
// itself contain backticks and ${} placeholders. The base files land on main;
// each feature branch edits them (changed constants, rewritten bodies, added
// and removed blocks) so every PR shows realistic multi-line, multi-hunk diffs.

const baseAppFile = (repo: string): string =>
  [
    "/**",
    " * Demo order service for " + repo + " — seeded by dev/testdata.ts.",
    " */",
    "export interface Order {",
    "  id: number;",
    "  customer: string;",
    "  items: string[];",
    "  total: number;",
    '  status: "pending" | "paid" | "shipped";',
    "}",
    "",
    "const TAX_RATE = 0.08;",
    "",
    "export const applyTax = (subtotal: number): number => {",
    "  return subtotal * (1 + TAX_RATE);",
    "};",
    "",
    "export const formatOrder = (order: Order): string => {",
    "  const lines = [",
    "    `Order #${order.id} for ${order.customer}`,",
    '    `Items: ${order.items.join(", ")}`,',
    "    `Total: ${order.total.toFixed(2)}`,",
    "    `Status: ${order.status}`,",
    "  ];",
    '  return lines.join("\\n");',
    "};",
    "",
    "export const summarize = (orders: Order[]): string => {",
    "  const total = orders.reduce((acc, order) => acc + order.total, 0);",
    '  const shipped = orders.filter((order) => order.status === "shipped").length;',
    "  return `${orders.length} orders, ${shipped} shipped, revenue ${total.toFixed(2)}`;",
    "};",
    "",
  ].join("\n");

const modifiedAppFile = (repo: string, n: number): string =>
  [
    "/**",
    " * Demo order service for " + repo + " — seeded by dev/testdata.ts.",
    " * Revision " + n + ": fees, discounts and refreshed formatting.",
    " */",
    "export interface Order {",
    "  id: number;",
    "  customer: string;",
    "  items: string[];",
    "  total: number;",
    '  status: "pending" | "paid" | "shipped" | "refunded";',
    "}",
    "",
    "const TAX_RATE = 0.0" + (8 + n) + ";",
    "const SERVICE_FEE = " + n + ".5;",
    "",
    "export const applyTax = (subtotal: number, includeFee = true): number => {",
    "  const taxed = subtotal * (1 + TAX_RATE);",
    "  return includeFee ? taxed + SERVICE_FEE : taxed;",
    "};",
    "",
    "export const applyDiscount = (subtotal: number, percent: number): number => {",
    "  if (percent <= 0) return subtotal;",
    "  const capped = Math.min(percent, 50);",
    "  return subtotal * (1 - capped / 100);",
    "};",
    "",
    "export const formatOrder = (order: Order): string => {",
    "  const lines = [",
    "    `Order #${order.id} — ${order.customer}`,",
    '    `Items (${order.items.length}): ${order.items.join(" | ")}`,',
    "    `Total: ${applyTax(order.total).toFixed(2)} incl. tax`,",
    "  ];",
    '  return lines.join("\\n");',
    "};",
    "",
    "export const summarize = (orders: Order[]): string => {",
    "  const total = orders.reduce((acc, order) => acc + order.total, 0);",
    '  const shipped = orders.filter((order) => order.status === "shipped").length;',
    '  const refunded = orders.filter((order) => order.status === "refunded").length;',
    "  return `${orders.length} orders, ${shipped} shipped, ${refunded} refunded, revenue ${total.toFixed(2)}`;",
    "};",
    "",
  ].join("\n");

const baseUtilsFile = (repo: string): string =>
  [
    "// Utility helpers for " + repo + ".",
    "",
    "export const clamp = (value: number, min: number, max: number): number => {",
    "  if (value < min) return min;",
    "  if (value > max) return max;",
    "  return value;",
    "};",
    "",
    "export const chunk = <T>(items: T[], size: number): T[][] => {",
    "  const result: T[][] = [];",
    "  for (let i = 0; i < items.length; i += size) {",
    "    result.push(items.slice(i, i + size));",
    "  }",
    "  return result;",
    "};",
    "",
    "export const unique = <T>(items: T[]): T[] => {",
    "  return [...new Set(items)];",
    "};",
    "",
  ].join("\n");

const modifiedUtilsFile = (repo: string, n: number): string =>
  [
    "// Utility helpers for " + repo + " (revision " + n + ").",
    "",
    "export const clamp = (value: number, min: number, max: number): number =>",
    "  Math.min(Math.max(value, min), max);",
    "",
    "export const chunk = <T>(items: T[], size: number): T[][] => {",
    "  if (size <= 0) throw new RangeError(`chunk size must be positive, got ${size}`);",
    "  const result: T[][] = [];",
    "  for (let i = 0; i < items.length; i += size) {",
    "    result.push(items.slice(i, i + size));",
    "  }",
    "  return result;",
    "};",
    "",
    "export const unique = <T>(items: T[]): T[] => {",
    "  return [...new Set(items)];",
    "};",
    "",
    "export const sum = (values: number[]): number => {",
    "  return values.reduce((acc, value) => acc + value, 0);",
    "};",
    "",
  ].join("\n");

const featureFile = (repo: string, n: number): string =>
  [
    "// Feature module " + n + " for " + repo + ".",
    "",
    "export interface FeatureFlag {",
    "  name: string;",
    "  enabled: boolean;",
    "  rollout: number;",
    "}",
    "",
    "export const FLAG: FeatureFlag = {",
    '  name: "feature-' + n + '",',
    "  enabled: " + (n % 2 === 0) + ",",
    "  rollout: " + n * 10 + ",",
    "};",
    "",
  ].join("\n");

const projectState = async (org: string, name: string): Promise<string | null> => {
  try {
    const proj = await runJson<{ state?: string }>(AZ, [
      "devops", "project", "show",
      "--project", name,
      "--organization", org,
      "--output", "json",
    ]);
    return proj.state ?? null;
  } catch {
    return null;
  }
};

const ensureProject = async (org: string, name: string): Promise<void> => {
  const state = await projectState(org, name);
  if (state === "wellFormed") {
    log(`project ${name} already exists`);
    return;
  }
  if (state === null) {
    log(`creating project ${name}`);
    await withRetry(`create project ${name}`, () =>
      runJson(AZ, [
        "devops", "project", "create",
        "--name", name,
        "--organization", org,
        "--output", "json",
      ], { timeoutMs: 60_000 }),
    );
  }
  for (let attempt = 0; attempt < 30; attempt += 1) {
    if ((await projectState(org, name)) === "wellFormed") {
      log(`project ${name} ready`);
      return;
    }
    await Bun.sleep(3_000);
  }
  throw new Error(`project ${name} never became wellFormed`);
};

/** Creates a repo with an initial commit, then `prCount` branches + PRs. */
const seedRepo = async (
  options: Options,
  project: string,
  repo: string,
): Promise<number[]> => {
  let repoId = "";
  try {
    const created = await runJson<{ id?: string }>(AZ, [
      "repos", "create",
      "--name", repo,
      "--project", project,
      "--organization", options.org,
      "--output", "json",
    ], { timeoutMs: 30_000 });
    repoId = created.id ?? "";
  } catch {
    const existing = await runJson<{ id?: string }>(AZ, [
      "repos", "show",
      "--repository", repo,
      "--project", project,
      "--organization", options.org,
      "--output", "json",
    ]);
    repoId = existing.id ?? "";
  }
  if (!repoId) {
    throw new Error(`could not resolve repository id for ${project}/${repo}`);
  }

  let tip: string | undefined;
  try {
    const init = await invokePush(options.org, project, repoId, {
      refUpdates: [{ name: "refs/heads/main", oldObjectId: ZERO_OBJECT_ID }],
      commits: [{
        comment: "chore: initial commit",
        changes: [
          addFile("/README.md", `# ${repo}\n\nSeeded by dev/testdata.ts.`),
          addFile("/src/app.ts", baseAppFile(repo)),
          addFile("/src/utils.ts", baseUtilsFile(repo)),
        ],
      }],
    });
    tip = init.commits?.[0]?.commitId;
  } catch {
    // Repo may already be seeded from a previous run — reuse its main tip.
  }
  if (!tip) {
    const refs = await runJson<unknown>(AZ, [
      "repos", "ref", "list",
      "--repository", repoId,
      "--project", project,
      "--organization", options.org,
      "--filter", "heads/main",
      "--output", "json",
    ]);
    // `az repos ref list` emits a plain array; tolerate a REST-style
    // envelope too in case the CLI shape changes.
    const refList = Array.isArray(refs)
      ? (refs as { objectId?: string }[])
      : ((refs as { value?: { objectId?: string }[] }).value ?? []);
    tip = refList[0]?.objectId;
  }
  if (!tip) {
    throw new Error(`could not initialise ${project}/${repo}`);
  }

  const prIds: number[] = [];
  for (let n = 1; n <= options.prs; n += 1) {
    try {
      // Branch/push may already exist on a re-run; failures here are fine as
      // long as the PR can still be created (or already exists).
      await withRetry(`ref feature-${n} in ${repo}`, () =>
        runJson(AZ, [
          "repos", "ref", "create",
          "--name", `heads/feature-${n}`,
          "--object-id", tip!,
          "--repository", repoId,
          "--project", project,
          "--organization", options.org,
          "--output", "json",
        ]),
      ).catch(() => {});
      await withRetry(`push feature-${n} in ${repo}`, () =>
        invokePush(options.org, project, repoId, {
          refUpdates: [{ name: `refs/heads/feature-${n}`, oldObjectId: tip! }],
          commits: [{
            comment: `feat: change ${n} for ${repo}`,
            changes: [
              editFile("/src/app.ts", modifiedAppFile(repo, n)),
              editFile("/src/utils.ts", modifiedUtilsFile(repo, n)),
              addFile(`/src/feature-${n}.ts`, featureFile(repo, n)),
            ],
          }],
        }),
      ).catch(() => {});
      const pr = await withRetry(`pr feature-${n} in ${repo}`, () =>
        runJson<{ pullRequestId?: number }>(AZ, [
          "repos", "pr", "create",
          "--organization", options.org,
          "--project", project,
          "--repository", repo,
          "--source-branch", `feature-${n}`,
          "--target-branch", "main",
          "--title", `feat: change ${n} in ${repo}`,
          "--description", "Seeded by dev/testdata.ts for load testing.",
          "--output", "json",
        ], { timeoutMs: 30_000 }),
      );
      if (pr.pullRequestId) {
        prIds.push(pr.pullRequestId);
      }
    } catch (cause) {
      log(`WARN: skipped PR ${n} in ${project}/${repo}: ${cause instanceof CommandError ? cause.detail : String(cause)}`);
    }
  }
  log(`${project}/${repo}: ${prIds.length} PR(s) ${prIds.map((id) => `!${id}`).join(" ")}`);
  return prIds;
};

const create = async (options: Options): Promise<void> => {
  const projectNames = Array.from(
    { length: options.projects },
    (_, i) => `${options.prefix}p${i + 1}`,
  );
  // Provision projects three at a time; ADO queues creation server-side.
  const prCounts = await mapWithConcurrency(projectNames, 3, async (project) => {
    await ensureProject(options.org, project);
    const repoNames = Array.from(
      { length: options.repos },
      (_, j) => `${project}-repo-${j + 1}`,
    );
    const prLists = await mapWithConcurrency(repoNames, 3, (repo) =>
      seedRepo(options, project, repo),
    );
    return prLists.reduce((acc, list) => acc + list.length, 0);
  });
  const totalPrs = prCounts.reduce((acc, count) => acc + count, 0);
  log(`DONE: ${options.projects} project(s) x ${options.repos} repo(s) -> ${totalPrs} PR(s) created`);
};

const cleanup = async (options: Options): Promise<void> => {
  const list = await runJson<{ value: { id: string; name: string }[] }>(AZ, [
    "devops", "project", "list",
    "--organization", options.org,
    "--output", "json",
  ]);
  const targets = list.value.filter((proj) => proj.name.startsWith(options.prefix));
  if (targets.length === 0) {
    log(`no ${options.prefix}* projects found — nothing to clean up`);
    return;
  }
  let failed = 0;
  for (const proj of targets) {
    log(`deleting project ${proj.name} (${proj.id})`);
    try {
      await withRetry(`delete ${proj.name}`, () =>
        run(AZ, [
          "devops", "project", "delete",
          "--id", proj.id,
          "--organization", options.org,
          "--yes",
        ], { timeoutMs: 60_000 }),
      );
    } catch (cause) {
      failed += 1;
      log(`WARN: could not delete ${proj.name}: ${cause instanceof CommandError ? cause.detail : String(cause)}`);
    }
  }
  log(`DONE: removed ${targets.length - failed}/${targets.length} project(s)`);
  if (failed > 0) {
    process.exitCode = 1;
  }
};

const { command, options } = parseArgs();
try {
  if (command === "create") {
    await create(options);
  } else {
    await cleanup(options);
  }
} catch (cause) {
  console.error(
    `[testdata] FAILED: ${cause instanceof CommandError ? cause.message : String(cause)}`,
  );
  process.exit(1);
}
