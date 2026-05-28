import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { detectRunContext } from "./context";

const FIXTURE_ROOT = join(tmpdir(), `superslow-context-test-${process.pid}`);

function fixturePath(name: string): string {
  return join(FIXTURE_ROOT, name);
}

function makeSkillDir(root: string, skills: string[]): string {
  const dir = join(root, "skill-dir");
  mkdirSync(dir, { recursive: true });
  for (const name of skills) {
    const sub = join(dir, name);
    mkdirSync(sub, { recursive: true });
    writeFileSync(
      join(sub, "SKILL.md"),
      `---\nname: ${name}\ndescription: ${name} skill\n---\n\nbody\n`,
    );
  }
  return dir;
}

beforeAll(() => {
  mkdirSync(FIXTURE_ROOT, { recursive: true });
});

afterAll(() => {
  rmSync(FIXTURE_ROOT, { recursive: true, force: true });
});

describe("detectRunContext", () => {
  test("dies when --skill-dir is missing", () => {
    expect(() => detectRunContext(["--skill", "foo"])).toThrow(/--skill-dir/);
  });

  test("dies when --skill is missing", () => {
    const root = fixturePath("missing-skill");
    const skillDir = makeSkillDir(root, ["foo"]);
    expect(() => detectRunContext(["--skill-dir", skillDir])).toThrow(
      /--skill/,
    );
  });

  test("dies when --skill-dir is not a directory", () => {
    expect(() =>
      detectRunContext([
        "--skill-dir",
        "/nonexistent/does-not-exist-12345",
        "--skill",
        "foo",
      ]),
    ).toThrow(/--skill-dir/);
  });

  test("dies when skill subdir does not exist", () => {
    const root = fixturePath("missing-subdir");
    const skillDir = makeSkillDir(root, ["foo"]);
    expect(() =>
      detectRunContext(["--skill-dir", skillDir, "--skill", "bar"]),
    ).toThrow(/skill not found/);
  });

  test("dies when --bootstrap path is passed but file does not exist", () => {
    const root = fixturePath("bad-bootstrap");
    const skillDir = makeSkillDir(root, ["foo"]);
    expect(() =>
      detectRunContext([
        "--skill-dir",
        skillDir,
        "--skill",
        "foo",
        "--bootstrap",
        "/nonexistent/no-bootstrap-12345.md",
      ]),
    ).toThrow(/--bootstrap/);
  });

  test("returns RunContext with absolute paths when --skill-dir and --skill are valid", () => {
    const root = fixturePath("happy-path");
    const skillDir = makeSkillDir(root, ["mr-review"]);
    const ctx = detectRunContext([
      "--skill-dir",
      skillDir,
      "--skill",
      "mr-review",
    ]);
    expect(ctx.skillDir).toBe(resolve(skillDir));
    expect(ctx.skillName).toBe("mr-review");
    expect(ctx.skillSubdir).toBe(resolve(skillDir, "mr-review"));
    expect(ctx.siblingSkillNames).toEqual([]);
    expect(ctx.bootstrapPath).toBeNull();
    expect(ctx.harness).toBe("claude-code");
  });

  test("enumerates siblings excluding the skill-under-test", () => {
    const root = fixturePath("siblings");
    const skillDir = makeSkillDir(root, ["alpha", "beta", "gamma"]);
    const ctx = detectRunContext(["--skill-dir", skillDir, "--skill", "beta"]);
    expect(ctx.siblingSkillNames.sort()).toEqual(["alpha", "gamma"]);
  });

  test("ignores entries in --skill-dir that do not have a SKILL.md", () => {
    const root = fixturePath("not-skills");
    const skillDir = makeSkillDir(root, ["real"]);
    mkdirSync(join(skillDir, "node_modules"), { recursive: true });
    mkdirSync(join(skillDir, "no-skill-md-here"), { recursive: true });
    writeFileSync(join(skillDir, "loose-file.txt"), "hello");
    const ctx = detectRunContext(["--skill-dir", skillDir, "--skill", "real"]);
    expect(ctx.siblingSkillNames).toEqual([]);
  });

  test("workspaceRoot defaults to <CWD>/skills-workspace when --workspace-dir is omitted", () => {
    const root = fixturePath("workspace-default");
    const skillDir = makeSkillDir(root, ["foo"]);
    const ctx = detectRunContext(["--skill-dir", skillDir, "--skill", "foo"]);
    expect(ctx.workspaceRoot).toBe(resolve(process.cwd(), "skills-workspace"));
  });

  test("workspaceRoot honors --workspace-dir override (resolved absolute)", () => {
    const root = fixturePath("workspace-override");
    const skillDir = makeSkillDir(root, ["foo"]);
    const customWs = join(root, "custom-ws");
    mkdirSync(customWs, { recursive: true });
    const ctx = detectRunContext([
      "--skill-dir",
      skillDir,
      "--skill",
      "foo",
      "--workspace-dir",
      customWs,
    ]);
    expect(ctx.workspaceRoot).toBe(resolve(customWs));
  });

  test("stageRoot defaults to CWD", () => {
    const root = fixturePath("stage-default");
    const skillDir = makeSkillDir(root, ["foo"]);
    const ctx = detectRunContext(["--skill-dir", skillDir, "--skill", "foo"]);
    expect(ctx.stageRoot).toBe(resolve(process.cwd()));
  });

  test("--bootstrap path is resolved absolute when file exists", () => {
    const root = fixturePath("bootstrap-ok");
    const skillDir = makeSkillDir(root, ["foo"]);
    const bootstrapPath = join(root, "my-bootstrap.md");
    writeFileSync(bootstrapPath, "BOOT");
    const ctx = detectRunContext([
      "--skill-dir",
      skillDir,
      "--skill",
      "foo",
      "--bootstrap",
      bootstrapPath,
    ]);
    expect(ctx.bootstrapPath).toBe(resolve(bootstrapPath));
  });

  test("unknown --harness value is rejected", () => {
    const root = fixturePath("harness-bad");
    const skillDir = makeSkillDir(root, ["foo"]);
    expect(() =>
      detectRunContext([
        "--skill-dir",
        skillDir,
        "--skill",
        "foo",
        "--harness",
        "vscode",
      ]),
    ).toThrow(/harness/);
  });
});

// Sanity: ensure existsSync helper from node:fs is what we expect
test.skip("smoke: existsSync points at node:fs", () => {
  expect(typeof existsSync).toBe("function");
});
