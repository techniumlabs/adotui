import { homedir } from "node:os";
import { dirname, join, parse } from "node:path";

/**
 * A single Azure DevOps organization + project to monitor.
 *
 * `organization` must be the full org URL, e.g. https://dev.azure.com/contoso
 * `project` is the project name or id within that org.
 * `repositories` is optional: when omitted, every repo in the project is
 * auto-discovered via `az repos list`.
 */
export interface AdoProjectConfig {
  organization: string;
  project: string;
  repositories?: string[];
}

export interface AdoConfig {
  /** Projects (org + project pairs) to monitor. */
  projects: AdoProjectConfig[];
  /** PR status to list. Defaults to "active". */
  status?: "active" | "completed" | "abandoned" | "all";
  /** Max PRs to fetch per repository. Defaults to 50. */
  top?: number;
  /** Limit to PRs where the given user is a reviewer (e.g. an email/UPN). */
  reviewer?: string;
  /** Limit to PRs created by the given user. */
  creator?: string;
}

export type ConfigResult =
  | { ok: true; config: AdoConfig; source: string }
  | { ok: false; error: string; searchedPaths: string[] };

const CONFIG_ENV = "ADOTUI_CONFIG";

/** Local config filenames searched while walking up from the current dir. */
const LOCAL_CONFIG_NAMES = ["adotui.config.json", ".adotui.json"] as const;

/**
 * Walks up from the current working directory to the filesystem root, yielding
 * candidate local config paths at each ancestor (like how git locates `.git`).
 * This means adotui finds a project-local config regardless of which
 * subdirectory it is launched from.
 */
const walkUpConfigPaths = (): string[] => {
  const paths: string[] = [];
  let dir = process.cwd();
  const { root } = parse(dir);

  // Guard against pathological loops with a generous depth cap.
  for (let depth = 0; depth < 64; depth += 1) {
    for (const name of LOCAL_CONFIG_NAMES) {
      paths.push(join(dir, name));
    }
    if (dir === root) {
      break;
    }
    const parent = dirname(dir);
    if (parent === dir) {
      break;
    }
    dir = parent;
  }

  return paths;
};

const configSearchPaths = (): string[] => {
  const paths: string[] = [];

  const fromEnv = process.env[CONFIG_ENV];
  if (fromEnv) {
    paths.push(fromEnv);
  }

  const xdg = process.env.XDG_CONFIG_HOME;
  if (xdg) {
    paths.push(join(xdg, "adotui", "config.json"));
  }

  const home = homedir();
  paths.push(join(home, ".config", "adotui", "config.json"));
  paths.push(join(home, ".adotui.json"));

  // Project-local config: search the cwd and every ancestor directory.
  paths.push(...walkUpConfigPaths());

  // De-duplicate while preserving order.
  return [...new Set(paths)];
};

const normalizeConfig = (raw: unknown, source: string): ConfigResult => {
  if (typeof raw !== "object" || raw === null) {
    return {
      ok: false,
      error: `Config at ${source} is not a JSON object.`,
      searchedPaths: [source],
    };
  }

  const record = raw as Record<string, unknown>;

  // Support both the documented `projects` array and a shorthand where the
  // top level is directly an array of project configs.
  const projectsRaw = Array.isArray(record.projects)
    ? record.projects
    : Array.isArray(raw)
      ? (raw as unknown[])
      : null;

  if (!projectsRaw || projectsRaw.length === 0) {
    return {
      ok: false,
      error: `Config at ${source} has no "projects". Add at least one { organization, project }.`,
      searchedPaths: [source],
    };
  }

  const projects: AdoProjectConfig[] = [];
  for (const entry of projectsRaw) {
    if (typeof entry !== "object" || entry === null) {
      continue;
    }
    const item = entry as Record<string, unknown>;
    const organization =
      typeof item.organization === "string"
        ? item.organization
        : typeof item.org === "string"
          ? (item.org as string)
          : undefined;
    const project = typeof item.project === "string" ? item.project : undefined;

    if (!organization || !project) {
      continue;
    }

    const repositories = Array.isArray(item.repositories)
      ? item.repositories.filter(
          (value): value is string => typeof value === "string",
        )
      : undefined;

    projects.push({
      organization: organization.replace(/\/+$/, ""),
      project,
      ...(repositories && repositories.length > 0 ? { repositories } : {}),
    });
  }

  if (projects.length === 0) {
    return {
      ok: false,
      error: `Config at ${source} has no valid projects (each needs "organization" and "project").`,
      searchedPaths: [source],
    };
  }

  const status =
    record.status === "completed" ||
    record.status === "abandoned" ||
    record.status === "all"
      ? record.status
      : "active";

  const top =
    typeof record.top === "number" && Number.isFinite(record.top)
      ? record.top
      : 50;

  const config: AdoConfig = {
    projects,
    status,
    top,
    ...(typeof record.reviewer === "string" ? { reviewer: record.reviewer } : {}),
    ...(typeof record.creator === "string" ? { creator: record.creator } : {}),
  };

  return { ok: true, config, source };
};

/**
 * Loads the adotui config from the first path that exists.
 * Searches (in order): $ADOTUI_CONFIG, $XDG_CONFIG_HOME/adotui/config.json,
 * ~/.config/adotui/config.json, ~/.adotui.json, ./adotui.config.json.
 */
export const loadConfig = async (): Promise<ConfigResult> => {
  const searchedPaths = configSearchPaths();

  const existsResults = await Promise.all(
    searchedPaths.map(async (path) => ({
      path,
      exists: await Bun.file(path).exists(),
    }))
  );

  const existing = existsResults.find((r) => r.exists);

  if (existing) {
    const { path } = existing;
    const file = Bun.file(path);

    let parsed: unknown;
    try {
      parsed = await file.json();
    } catch (cause) {
      return {
        ok: false,
        error: `Failed to parse config at ${path}: ${
          cause instanceof Error ? cause.message : String(cause)
        }`,
        searchedPaths,
      };
    }

    return normalizeConfig(parsed, path);
  }

  return {
    ok: false,
    error: "No adotui config found.",
    searchedPaths,
  };
};

export const configSearchPathsForHelp = (): string[] => configSearchPaths();
