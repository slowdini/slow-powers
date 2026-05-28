import { afterEach, describe, expect, test } from "bun:test";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  GUARD_MANIFEST,
  GUARD_MARKER,
  installGuard,
  teardownGuard,
} from "./install";

const ROOT = join(tmpdir(), `guard-install-test-${process.pid}`);

afterEach(() => rmSync(ROOT, { recursive: true, force: true }));

function setup() {
  const stageRoot = join(ROOT, `case-${Math.random().toString(36).slice(2)}`);
  mkdirSync(stageRoot, { recursive: true });
  const workspaceRoot = join(stageRoot, "skills-workspace");
  return { stageRoot, workspaceRoot };
}

const skillsDir = (s: string) => join(s, ".claude", "skills");
const settingsPath = (s: string) => join(s, ".claude", "settings.local.json");

describe("installGuard / teardownGuard", () => {
  test("install writes an active marker, hook, and manifest", () => {
    const { stageRoot, workspaceRoot } = setup();
    installGuard({ stageRoot, workspaceRoot, guardScriptPath: "/g/guard.ts" });

    const marker = JSON.parse(
      readFileSync(join(skillsDir(stageRoot), GUARD_MARKER), "utf8"),
    );
    expect(marker.active).toBe(true);
    expect(Date.parse(marker.expiresAt)).toBeGreaterThan(Date.now());
    expect(
      marker.allowedRoots.some((r: string) => r.includes("skills-workspace")),
    ).toBe(true);

    const settings = JSON.parse(readFileSync(settingsPath(stageRoot), "utf8"));
    expect(settings.hooks.PreToolUse[0].matcher).toContain("Write");
    expect(settings.hooks.PreToolUse[0].hooks[0].command).toContain("guard.ts");

    expect(existsSync(join(skillsDir(stageRoot), GUARD_MANIFEST))).toBe(true);
  });

  test("teardown deletes settings.local.json it created", () => {
    const { stageRoot, workspaceRoot } = setup();
    installGuard({ stageRoot, workspaceRoot, guardScriptPath: "/g/guard.ts" });
    expect(existsSync(settingsPath(stageRoot))).toBe(true);

    expect(teardownGuard(stageRoot)).toBe(true);
    expect(existsSync(settingsPath(stageRoot))).toBe(false);
    expect(existsSync(join(skillsDir(stageRoot), GUARD_MARKER))).toBe(false);
    expect(existsSync(join(skillsDir(stageRoot), GUARD_MANIFEST))).toBe(false);
  });

  test("teardown restores a pre-existing settings.local.json verbatim", () => {
    const { stageRoot, workspaceRoot } = setup();
    mkdirSync(join(stageRoot, ".claude"), { recursive: true });
    const original = `${JSON.stringify({ permissions: { allow: ["Bash(ls)"] } }, null, 2)}\n`;
    writeFileSync(settingsPath(stageRoot), original);

    installGuard({ stageRoot, workspaceRoot, guardScriptPath: "/g/guard.ts" });
    // hook present while armed
    expect(readFileSync(settingsPath(stageRoot), "utf8")).toContain(
      "PreToolUse",
    );

    teardownGuard(stageRoot);
    expect(readFileSync(settingsPath(stageRoot), "utf8")).toBe(original);
  });

  test("teardown is a safe no-op when nothing is installed", () => {
    const { stageRoot } = setup();
    expect(teardownGuard(stageRoot)).toBe(false);
  });

  test("teardown sweeps a stray marker even without a manifest", () => {
    const { stageRoot } = setup();
    mkdirSync(skillsDir(stageRoot), { recursive: true });
    writeFileSync(join(skillsDir(stageRoot), GUARD_MARKER), "{}");
    expect(teardownGuard(stageRoot)).toBe(true);
    expect(existsSync(join(skillsDir(stageRoot), GUARD_MARKER))).toBe(false);
  });
});
