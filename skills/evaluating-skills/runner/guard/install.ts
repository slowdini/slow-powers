import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

export const GUARD_MARKER = ".slow-powers-eval-guard.json";
export const GUARD_MANIFEST = ".slow-powers-eval-guard-manifest.json";
const GUARD_TTL_MS = 6 * 60 * 60 * 1000; // 6h — bounds a crashed run's lingering hook

const HOOK_MATCHER = "Write|Edit|MultiEdit|NotebookEdit|Bash";

type GuardManifest = {
  created_at: string;
  settings_path: string;
  settings_existed: boolean;
  settings_backup: string | null;
  marker_path: string;
};

type Settings = {
  hooks?: {
    PreToolUse?: Array<{ matcher?: string; hooks?: unknown[] }>;
    [k: string]: unknown;
  };
  [k: string]: unknown;
};

/**
 * Arm the Claude Code write guard for an eval run. Writes a marker listing the
 * allowed roots and merges a `PreToolUse` hook into `.claude/settings.local.json`
 * that runs `guard.ts` on every Write/Edit/Bash. The original settings file is
 * backed up verbatim in a manifest so {@link teardownGuard} restores it exactly.
 *
 * Returns the marker path. The guard is a no-op until this marker exists and is
 * unexpired (see guard/policy.ts), so the hook is inert outside an active run.
 */
export function installGuard(opts: {
  stageRoot: string;
  workspaceRoot: string;
  guardScriptPath: string;
  ttlMs?: number;
}): string {
  const skillsDir = join(opts.stageRoot, ".claude", "skills");
  mkdirSync(skillsDir, { recursive: true });

  const markerPath = join(skillsDir, GUARD_MARKER);
  const allowedRoots = [
    resolve(opts.workspaceRoot),
    resolve(skillsDir),
    resolve(tmpdir()),
  ];
  writeFileSync(
    markerPath,
    `${JSON.stringify(
      {
        active: true,
        allowedRoots,
        expiresAt: new Date(
          Date.now() + (opts.ttlMs ?? GUARD_TTL_MS),
        ).toISOString(),
      },
      null,
      2,
    )}\n`,
  );

  const settingsPath = join(opts.stageRoot, ".claude", "settings.local.json");
  const settingsExisted = existsSync(settingsPath);
  const backup = settingsExisted ? readFileSync(settingsPath, "utf8") : null;

  let settings: Settings = {};
  if (backup) {
    try {
      settings = JSON.parse(backup);
    } catch {
      settings = {};
    }
  }
  settings.hooks ??= {};
  settings.hooks.PreToolUse ??= [];
  settings.hooks.PreToolUse.push({
    matcher: HOOK_MATCHER,
    hooks: [
      {
        type: "command",
        command: `bun run "${opts.guardScriptPath}" "${markerPath}"`,
      },
    ],
  });
  writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`);

  const manifest: GuardManifest = {
    created_at: new Date().toISOString(),
    settings_path: settingsPath,
    settings_existed: settingsExisted,
    settings_backup: backup,
    marker_path: markerPath,
  };
  writeFileSync(
    join(skillsDir, GUARD_MANIFEST),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  return markerPath;
}

/**
 * Disarm the guard: restore the original `settings.local.json` (or delete it if
 * we created it) and remove the marker + manifest. Safe to call when no guard is
 * installed. Returns true if a guard was found and torn down.
 */
export function teardownGuard(stageRoot: string): boolean {
  const skillsDir = join(stageRoot, ".claude", "skills");
  const manifestPath = join(skillsDir, GUARD_MANIFEST);
  const markerPath = join(skillsDir, GUARD_MARKER);

  if (!existsSync(manifestPath)) {
    // No manifest — still sweep a stray marker so the guard can't stay armed.
    if (existsSync(markerPath)) {
      rmSync(markerPath, { force: true });
      return true;
    }
    return false;
  }

  let manifest: GuardManifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch {
    rmSync(manifestPath, { force: true });
    rmSync(markerPath, { force: true });
    return true;
  }

  if (manifest.settings_existed && manifest.settings_backup !== null) {
    writeFileSync(manifest.settings_path, manifest.settings_backup);
  } else if (existsSync(manifest.settings_path)) {
    rmSync(manifest.settings_path, { force: true });
  }
  rmSync(manifest.marker_path, { force: true });
  rmSync(manifestPath, { force: true });
  return true;
}
