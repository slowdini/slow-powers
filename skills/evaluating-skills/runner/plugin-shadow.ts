// Plugin-shadow detector (Claude Code). The runner stages eval skills into the
// project-local `.claude/skills/` dir, but eval subagents are dispatched via the
// Task tool and run in-process — so they ALSO inherit whatever skills the
// orchestrator session loaded from installed plugins and the global skills dir.
// When a staged skill name collides with one of those, both copies are
// discoverable: the with/without comparison is contaminated and the control arm
// is not truly skill-absent.
//
// The runner cannot unload a plugin from a running session (plugins load at
// session start), so this module only *detects and reports* the overlap. It
// reads declared settings as a best-effort proxy for what the session loaded —
// it can't observe the live-loaded set, so a session that changed settings
// without restarting may differ. Isolation itself is a launch-time concern; see
// harness-details/claude.md → "Isolating from installed plugins".
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export type ShadowSource =
  | { kind: "plugin"; plugin: string; skill_name: string; path: string }
  | { kind: "global-skill"; skill_name: string; path: string };

export type PluginShadowReport = {
  config_dir: string;
  shadowed: ShadowSource[];
};

const ISOLATION_DOC =
  'harness-details/claude.md → "Isolating from installed plugins"';

/** The Claude Code config dir: `$CLAUDE_CONFIG_DIR` if set, else `~/.claude`. */
export function resolveConfigDir(env: NodeJS.ProcessEnv = process.env): string {
  const override = env.CLAUDE_CONFIG_DIR;
  return override?.trim() ? override : join(homedir(), ".claude");
}

function readJsonSafe<T>(path: string): T | null {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as T;
  } catch {
    return null;
  }
}

type Settings = { enabledPlugins?: Record<string, boolean> };

/**
 * Effective `enabledPlugins` map, honoring Claude Code's settings precedence
 * (local > project > user). User scope lives under the config dir; project and
 * local scope live under `<cwd>/.claude/`. Later sources override earlier keys,
 * so a project-scope `false` correctly masks a user-scope `true`.
 */
export function resolveEnabledPlugins(opts: {
  configDir: string;
  cwd: string;
}): Record<string, boolean> {
  const sources = [
    join(opts.configDir, "settings.json"),
    join(opts.cwd, ".claude", "settings.json"),
    join(opts.cwd, ".claude", "settings.local.json"),
  ];
  let merged: Record<string, boolean> = {};
  for (const path of sources) {
    const s = readJsonSafe<Settings>(path);
    if (s?.enabledPlugins) merged = { ...merged, ...s.enabledPlugins };
  }
  return merged;
}

/** Names of skill folders (those holding a `SKILL.md`) directly under `dir`. */
function skillFolderNames(dir: string): Array<{ name: string; path: string }> {
  if (!existsSync(dir)) return [];
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return [];
  }
  const out: Array<{ name: string; path: string }> = [];
  for (const name of entries) {
    const skillDir = join(dir, name);
    try {
      if (!statSync(skillDir).isDirectory()) continue;
    } catch {
      continue;
    }
    if (existsSync(join(skillDir, "SKILL.md")))
      out.push({ name, path: skillDir });
  }
  return out;
}

type InstalledPlugins = {
  plugins?: Record<string, Array<{ installPath?: string }>>;
};

/** Skills exposed by currently-enabled installed plugins. */
export function listEnabledPluginSkills(opts: {
  configDir: string;
  enabled: Record<string, boolean>;
}): Array<{ plugin: string; skill_name: string; path: string }> {
  const manifest = readJsonSafe<InstalledPlugins>(
    join(opts.configDir, "plugins", "installed_plugins.json"),
  );
  const out: Array<{ plugin: string; skill_name: string; path: string }> = [];
  if (!manifest?.plugins) return out;
  for (const [key, installs] of Object.entries(manifest.plugins)) {
    if (opts.enabled[key] !== true) continue; // only enabled plugins shadow
    for (const inst of installs ?? []) {
      if (!inst.installPath) continue;
      for (const s of skillFolderNames(join(inst.installPath, "skills")))
        out.push({ plugin: key, skill_name: s.name, path: s.path });
    }
  }
  return out;
}

/** Skills under the global skills dir (`<configDir>/skills`). */
export function listGlobalSkills(
  configDir: string,
): Array<{ skill_name: string; path: string }> {
  return skillFolderNames(join(configDir, "skills")).map((s) => ({
    skill_name: s.name,
    path: s.path,
  }));
}

/**
 * Which of `stagedSkillNames` are also discoverable from enabled plugins or the
 * global skills dir. Matches on the skill folder name (exact).
 */
export function detectPluginShadows(opts: {
  configDir: string;
  cwd: string;
  stagedSkillNames: string[];
}): PluginShadowReport {
  const staged = new Set(opts.stagedSkillNames);
  const enabled = resolveEnabledPlugins({
    configDir: opts.configDir,
    cwd: opts.cwd,
  });
  const shadowed: ShadowSource[] = [];

  for (const s of listEnabledPluginSkills({
    configDir: opts.configDir,
    enabled,
  }))
    if (staged.has(s.skill_name))
      shadowed.push({
        kind: "plugin",
        plugin: s.plugin,
        skill_name: s.skill_name,
        path: s.path,
      });

  for (const s of listGlobalSkills(opts.configDir))
    if (staged.has(s.skill_name))
      shadowed.push({
        kind: "global-skill",
        skill_name: s.skill_name,
        path: s.path,
      });

  return { config_dir: opts.configDir, shadowed };
}

function sourceLabel(s: ShadowSource): string {
  return s.kind === "plugin"
    ? `enabled plugin '${s.plugin}'`
    : "the global skills dir";
}

/** One `validity_warnings` line per shadowed skill (for benchmark.json). */
export function shadowValidityWarnings(report: PluginShadowReport): string[] {
  return report.shadowed.map(
    (s) =>
      `staged skill '${s.skill_name}' is also provided by ${sourceLabel(s)} — ` +
      `eval subagents could discover both copies, so with/without results may be ` +
      `contaminated. Re-run from an isolated session (see ${ISOLATION_DOC}).`,
  );
}

/** Build-time banner for the runner. Empty string when nothing is shadowed. */
export function formatShadowBanner(report: PluginShadowReport): string {
  if (report.shadowed.length === 0) return "";
  const lines = report.shadowed.map(
    (s) => `  • ${s.skill_name} — ${sourceLabel(s)}`,
  );
  return [
    "",
    "⚠ Plugin-shadow warning: skills staged for this eval are ALSO discoverable",
    "  from your live environment:",
    ...lines,
    "  Eval subagents (dispatched via the Task tool) inherit this session's plugins,",
    "  so both the staged copy and the installed copy are discoverable — the",
    "  with/without comparison may be contaminated and the control arm is not truly",
    "  skill-absent. The runner cannot unload a plugin from a running session.",
    `  Re-run from an isolated session — see ${ISOLATION_DOC}.`,
  ].join("\n");
}
