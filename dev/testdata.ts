#!/usr/bin/env bun
/**
 * Seeds (or removes) Azure DevOps test data for adotui load testing.
 *
 * Creates projects named `adotui-loadtest-p<N>`, each with repos containing an
 * initial commit, feature branches, and active PRs — entirely server-side via
 * the az CLI (no local clones). Cleanup deletes ONLY projects carrying the
 * loadtest prefix, so pre-existing projects are never touched.
 *
 * Usage:
 *   bun dev/testdata.ts create  --org <url> [--projects 2] [--repos 3] [--prs 2]
 *   bun dev/testdata.ts cleanup --org <url>
 */
import { unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CommandError, run, runJson } from "../src/data/command";
import { mapWithConcurrency } from "../src/data/azure";

const PREFIX = "adotui-loadtest-";
const AZ = "az";
const ZERO_OBJECT_ID = "0".repeat(40);

interface Options {
  org: string;
  projects: number;
  repos: number;
  prs: number;
}

const usage = (): never => {
  console.error(
    "Usage:\n" +
      "  bun dev/testdata.ts create  --org <url> [--projects 2] [--repos 3] [--prs 2]\n" +
      "  bun dev/testdata.ts cleanup --org <url>",
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
  if ((command !== "create" && command !== "cleanup") || !org) {
    usage();
  }
  return {
    command,
    options: {
      org: org!,
      projects: Number(get("--projects") ?? 2),
      repos: Number(get("--repos") ?? 3),
      prs: Number(get("--prs") ?? 2),
    },
  };
};

const log = (msg: string): void => {
  console.log(`[testdata] ${msg}`);
};

/** POST a server-side git push (commit + ref update) via az devops invoke. */
const invokePush = async (
  org: string,
  project: string,
  repositoryId: string,
  body: unknown,
): Promise<{ commits?: { commitId?: string }[] }> => {
  const tmpPath = join(
    tmpdir(),
    `adotui_testdata_${Date.now()}_${Math.random().toString(36).slice(2)}.json`,
  );
  await writeFile(tmpPath, JSON.stringify(body), "utf-8");
  try {
    return await runJson(AZ, [
      "devops", "invoke",
      "--area", "git",
      "--resource", "pushes",
      "--route-parameters", `project=${project}`, `repositoryId=${repositoryId}`,
      "--http-method", "POST",
      "--in-file", tmpPath,
      "--api-version", "7.1",
      "--organization", org,
      "--output", "json",
    ], { timeoutMs: 30_000 });
  } finally {
    await unlink(tmpPath).catch(() => {});
  }
};

const addFile = (path: string, content: string): Record<string, unknown> => ({
  changeType: "add",
  item: { path },
  newContent: { content, contentType: "rawtext" },
});

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
    await runJson(AZ, [
      "devops", "project", "create",
      "--name", name,
      "--organization", org,
      "--output", "json",
    ], { timeoutMs: 60_000 });
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

  const init = await invokePush(options.org, project, repoId, {
    refUpdates: [{ name: "refs/heads/main", oldObjectId: ZERO_OBJECT_ID }],
    commits: [{
      comment: "chore: initial commit",
      changes: [addFile("/README.md", `# ${repo}\n\nSeeded by dev/testdata.ts.`)],
    }],
  });
  const tip = init.commits?.[0]?.commitId;
  if (!tip) {
    throw new Error(`initial push failed for ${project}/${repo}`);
  }

  const prIds: number[] = [];
  for (let n = 1; n <= options.prs; n += 1) {
    await runJson(AZ, [
      "repos", "ref", "create",
      "--name", `heads/feature-${n}`,
      "--object-id", tip,
      "--repository", repoId,
      "--project", project,
      "--organization", options.org,
      "--output", "json",
    ]);
    await invokePush(options.org, project, repoId, {
      refUpdates: [{ name: `refs/heads/feature-${n}`, oldObjectId: tip }],
      commits: [{
        comment: `feat: change ${n} for ${repo}`,
        changes: [addFile(`/src/change-${n}.md`, `## Change ${n}\n\nSeeded change for ${repo}.`)],
      }],
    });
    const pr = await runJson<{ pullRequestId?: number }>(AZ, [
      "repos", "pr", "create",
      "--organization", options.org,
      "--project", project,
      "--repository", repo,
      "--source-branch", `feature-${n}`,
      "--target-branch", "main",
      "--title", `feat: change ${n} in ${repo}`,
      "--description", "Seeded by dev/testdata.ts for load testing.",
      "--output", "json",
    ], { timeoutMs: 30_000 });
    if (pr.pullRequestId) {
      prIds.push(pr.pullRequestId);
    }
  }
  log(`${project}/${repo}: ${prIds.length} PR(s) ${prIds.map((id) => `!${id}`).join(" ")}`);
  return prIds;
};

const create = async (options: Options): Promise<void> => {
  let totalPrs = 0;
  for (let p = 1; p <= options.projects; p += 1) {
    const project = `${PREFIX}p${p}`;
    await ensureProject(options.org, project);
    const repoNames = Array.from(
      { length: options.repos },
      (_, j) => `${project}-repo-${j + 1}`,
    );
    const prLists = await mapWithConcurrency(repoNames, 3, (repo) =>
      seedRepo(options, project, repo),
    );
    totalPrs += prLists.reduce((acc, list) => acc + list.length, 0);
  }
  log(`DONE: ${options.projects} project(s) x ${options.repos} repo(s) -> ${totalPrs} PR(s) created`);
};

const cleanup = async (options: Options): Promise<void> => {
  const list = await runJson<{ value: { id: string; name: string }[] }>(AZ, [
    "devops", "project", "list",
    "--organization", options.org,
    "--output", "json",
  ]);
  const targets = list.value.filter((proj) => proj.name.startsWith(PREFIX));
  if (targets.length === 0) {
    log(`no ${PREFIX}* projects found — nothing to clean up`);
    return;
  }
  for (const proj of targets) {
    log(`deleting project ${proj.name} (${proj.id})`);
    await run(AZ, [
      "devops", "project", "delete",
      "--id", proj.id,
      "--organization", options.org,
      "--yes",
    ], { timeoutMs: 60_000 });
  }
  log(`DONE: removed ${targets.length} project(s)`);
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
