import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildDispatchTask,
  cleanupStagedSkills,
  redactSkillFromBootstrap,
  registerStagedSkillForCleanup,
  STAGED_SIBLING_MANIFEST,
  STAGED_SKILL_PREFIX,
  selectEvals,
  stageSiblingSkills,
  stageSkillForCC,
} from "./run";
import type { Eval } from "./types";
import { SNAPSHOT_META } from "./workspace-teardown";

const FIXTURE_ROOT = join(tmpdir(), `slow-powers-run-test-${process.pid}`);

beforeAll(() => {
  mkdirSync(FIXTURE_ROOT, { recursive: true });
});

afterAll(() => {
  rmSync(FIXTURE_ROOT, { recursive: true, force: true });
});

describe("selectEvals", () => {
  const mkEvals = (...ids: string[]): Eval[] =>
    ids.map((id) => ({ id, prompt: `p-${id}`, expected_output: `o-${id}` }));

  test("returns the full list unchanged when neither flag is set", () => {
    const evals = mkEvals("a", "b", "c");
    expect(selectEvals(evals, {})).toEqual(evals);
  });

  test("--only keeps just the named ids, preserving config order", () => {
    const evals = mkEvals("a", "b", "c");
    const got = selectEvals(evals, { only: ["c", "a"] });
    expect(got.map((e) => e.id)).toEqual(["a", "c"]);
  });

  test("--skip drops the named ids", () => {
    const evals = mkEvals("a", "b", "c");
    const got = selectEvals(evals, { skip: ["b"] });
    expect(got.map((e) => e.id)).toEqual(["a", "c"]);
  });

  test("throws on an unknown id, listing the unknown and the available ids", () => {
    const evals = mkEvals("a", "b");
    expect(() => selectEvals(evals, { only: ["a", "nope"] })).toThrow(
      /unknown eval id\(s\): nope\. Available ids: a, b/,
    );
  });

  test("throws when both --only and --skip are given", () => {
    const evals = mkEvals("a", "b");
    expect(() => selectEvals(evals, { only: ["a"], skip: ["b"] })).toThrow(
      /only one of --only \/ --skip/,
    );
  });

  test("throws when a flag resolves to an empty id list", () => {
    const evals = mkEvals("a", "b");
    expect(() => selectEvals(evals, { only: [] })).toThrow(
      /at least one eval id/,
    );
  });
});

describe("stageSkillForCC", () => {
  test("writes SKILL.md to <repoRoot>/.claude/skills/<slug>/SKILL.md and returns the slug", () => {
    const repoRoot = join(FIXTURE_ROOT, "stage-basic");
    mkdirSync(repoRoot, { recursive: true });
    const content =
      "---\nname: example\ndescription: example skill\n---\n\nbody\n";

    const slug = stageSkillForCC({
      content,
      iteration: 3,
      condition: "with_skill",
      skillName: "verification-before-completion",
      repoRoot,
    });

    expect(slug).toBe(
      `${STAGED_SKILL_PREFIX}3-with_skill__verification-before-completion`,
    );
    const stagedPath = join(repoRoot, ".claude", "skills", slug, "SKILL.md");
    expect(existsSync(stagedPath)).toBe(true);
    expect(readFileSync(stagedPath, "utf8")).toBe(content);
  });

  test("overwrites an existing staged skill at the same slug", () => {
    const repoRoot = join(FIXTURE_ROOT, "stage-overwrite");
    mkdirSync(repoRoot, { recursive: true });

    stageSkillForCC({
      content: "first",
      iteration: 1,
      condition: "with_skill",
      skillName: "s",
      repoRoot,
    });
    const slug = stageSkillForCC({
      content: "second",
      iteration: 1,
      condition: "with_skill",
      skillName: "s",
      repoRoot,
    });

    const stagedPath = join(repoRoot, ".claude", "skills", slug, "SKILL.md");
    expect(readFileSync(stagedPath, "utf8")).toBe("second");
  });

  test("stageNameOverride stages under the verbatim name instead of the eval slug", () => {
    const repoRoot = join(FIXTURE_ROOT, "stage-override");
    mkdirSync(repoRoot, { recursive: true });
    const content =
      "---\nname: example\ndescription: example skill\n---\n\nbody\n";

    const slug = stageSkillForCC({
      content,
      iteration: 2,
      condition: "with_skill",
      skillName: "verification-before-completion",
      repoRoot,
      stageNameOverride: "verification-before-completion",
    });

    expect(slug).toBe("verification-before-completion");
    const stagedPath = join(repoRoot, ".claude", "skills", slug, "SKILL.md");
    expect(existsSync(stagedPath)).toBe(true);
    expect(readFileSync(stagedPath, "utf8")).toBe(content);
  });
});

describe("registerStagedSkillForCleanup", () => {
  test("appends the custom dir to the manifest so cleanup removes it", () => {
    const root = join(FIXTURE_ROOT, "register-cleanup");
    const skillsDir = join(root, ".claude", "skills");
    mkdirSync(skillsDir, { recursive: true });
    // A sibling manifest already exists (written by stageSiblingSkills).
    writeFileSync(
      join(skillsDir, STAGED_SIBLING_MANIFEST),
      `${JSON.stringify(
        {
          created_at: "x",
          staged_under_test: "verification-before-completion",
          created_entries: [{ name: "sibling-a", preexisting: false }],
        },
        null,
        2,
      )}\n`,
    );
    const customDir = join(skillsDir, "verification-before-completion");
    mkdirSync(customDir, { recursive: true });
    writeFileSync(join(customDir, "SKILL.md"), "staged");

    registerStagedSkillForCleanup(root, "verification-before-completion");

    const manifest = JSON.parse(
      readFileSync(join(skillsDir, STAGED_SIBLING_MANIFEST), "utf8"),
    ) as { created_entries: Array<{ name: string }> };
    expect(manifest.created_entries.map((e) => e.name).sort()).toEqual([
      "sibling-a",
      "verification-before-completion",
    ]);

    cleanupStagedSkills(root);
    expect(existsSync(customDir)).toBe(false);
  });

  test("is idempotent — registering the same name twice does not duplicate it", () => {
    const root = join(FIXTURE_ROOT, "register-idempotent");
    const skillsDir = join(root, ".claude", "skills");
    mkdirSync(skillsDir, { recursive: true });
    writeFileSync(
      join(skillsDir, STAGED_SIBLING_MANIFEST),
      `${JSON.stringify(
        {
          created_at: "x",
          staged_under_test: "foo",
          created_entries: [],
        },
        null,
        2,
      )}\n`,
    );

    registerStagedSkillForCleanup(root, "foo-staged");
    registerStagedSkillForCleanup(root, "foo-staged");

    const manifest = JSON.parse(
      readFileSync(join(skillsDir, STAGED_SIBLING_MANIFEST), "utf8"),
    ) as { created_entries: Array<{ name: string }> };
    expect(
      manifest.created_entries.filter((e) => e.name === "foo-staged").length,
    ).toBe(1);
  });
});

describe("cleanupStagedSkills", () => {
  test("removes only directories with the staged-skill prefix under .claude/skills", () => {
    const repoRoot = join(FIXTURE_ROOT, "cleanup");
    const skillsDir = join(repoRoot, ".claude", "skills");
    mkdirSync(skillsDir, { recursive: true });

    const stagedA = join(skillsDir, `${STAGED_SKILL_PREFIX}1-with_skill__foo`);
    const stagedB = join(skillsDir, `${STAGED_SKILL_PREFIX}1-new_skill__bar`);
    const productionLike = join(skillsDir, "user-custom-skill");
    mkdirSync(stagedA, { recursive: true });
    mkdirSync(stagedB, { recursive: true });
    mkdirSync(productionLike, { recursive: true });

    cleanupStagedSkills(repoRoot);

    expect(existsSync(stagedA)).toBe(false);
    expect(existsSync(stagedB)).toBe(false);
    expect(existsSync(productionLike)).toBe(true);
  });

  test("is a no-op when .claude/skills does not exist", () => {
    const repoRoot = join(FIXTURE_ROOT, "cleanup-empty");
    mkdirSync(repoRoot, { recursive: true });
    expect(() => cleanupStagedSkills(repoRoot)).not.toThrow();
  });
});

describe("stageSiblingSkills", () => {
  function buildSourceSkills(root: string): string {
    const src = join(root, "src-skills");
    mkdirSync(join(src, "alpha", "evals"), { recursive: true });
    writeFileSync(join(src, "alpha", "SKILL.md"), "alpha content");
    writeFileSync(join(src, "alpha", "helper.md"), "alpha helper");
    writeFileSync(join(src, "alpha", "evals", "evals.json"), "{}");
    mkdirSync(join(src, "beta"), { recursive: true });
    writeFileSync(join(src, "beta", "SKILL.md"), "beta content");
    mkdirSync(join(src, "gamma"), { recursive: true });
    writeFileSync(join(src, "gamma", "SKILL.md"), "gamma content");
    return src;
  }

  test("stages each sibling at .claude/skills/<name>/ with full content minus evals/", () => {
    const root = join(FIXTURE_ROOT, "sibling-basic");
    mkdirSync(root, { recursive: true });
    const src = buildSourceSkills(root);

    stageSiblingSkills({
      skillUnderTest: "gamma",
      skillsSourceDir: src,
      repoRoot: root,
    });

    const skillsDir = join(root, ".claude", "skills");
    expect(readFileSync(join(skillsDir, "alpha", "SKILL.md"), "utf8")).toBe(
      "alpha content",
    );
    expect(readFileSync(join(skillsDir, "alpha", "helper.md"), "utf8")).toBe(
      "alpha helper",
    );
    expect(existsSync(join(skillsDir, "alpha", "evals"))).toBe(false);
    expect(readFileSync(join(skillsDir, "beta", "SKILL.md"), "utf8")).toBe(
      "beta content",
    );
    expect(existsSync(join(skillsDir, "gamma"))).toBe(false);

    const manifestPath = join(skillsDir, STAGED_SIBLING_MANIFEST);
    expect(existsSync(manifestPath)).toBe(true);
    const written = JSON.parse(readFileSync(manifestPath, "utf8")) as {
      created_entries: Array<{ name: string; preexisting: boolean }>;
    };
    expect(written.created_entries.map((e) => e.name).sort()).toEqual([
      "alpha",
      "beta",
    ]);
    for (const e of written.created_entries) {
      expect(e.preexisting).toBe(false);
    }
  });

  test("backs up colliding pre-existing entries and records them in the manifest", () => {
    const root = join(FIXTURE_ROOT, "sibling-collide");
    mkdirSync(root, { recursive: true });
    const src = buildSourceSkills(root);

    const skillsDir = join(root, ".claude", "skills");
    mkdirSync(join(skillsDir, "alpha"), { recursive: true });
    writeFileSync(join(skillsDir, "alpha", "SKILL.md"), "USER OWNED");

    stageSiblingSkills({
      skillUnderTest: "gamma",
      skillsSourceDir: src,
      repoRoot: root,
    });

    expect(readFileSync(join(skillsDir, "alpha", "SKILL.md"), "utf8")).toBe(
      "alpha content",
    );
    const manifest = JSON.parse(
      readFileSync(join(skillsDir, STAGED_SIBLING_MANIFEST), "utf8"),
    ) as {
      created_entries: Array<{
        name: string;
        preexisting: boolean;
        backup_path?: string;
      }>;
    };
    const alphaEntry = manifest.created_entries.find((e) => e.name === "alpha");
    expect(alphaEntry).toBeDefined();
    expect(alphaEntry?.preexisting).toBe(true);
    expect(alphaEntry?.backup_path).toBeDefined();
    const backupPath = alphaEntry?.backup_path as string;
    expect(existsSync(backupPath)).toBe(true);
    expect(readFileSync(join(backupPath, "SKILL.md"), "utf8")).toBe(
      "USER OWNED",
    );
  });

  test("skips the skill-under-test even if it appears in the source skills dir", () => {
    const root = join(FIXTURE_ROOT, "sibling-skip-under-test");
    mkdirSync(root, { recursive: true });
    const src = buildSourceSkills(root);

    stageSiblingSkills({
      skillUnderTest: "alpha",
      skillsSourceDir: src,
      repoRoot: root,
    });

    const skillsDir = join(root, ".claude", "skills");
    expect(existsSync(join(skillsDir, "alpha"))).toBe(false);
    expect(existsSync(join(skillsDir, "beta"))).toBe(true);
    expect(existsSync(join(skillsDir, "gamma"))).toBe(true);
  });
});

describe("cleanupStagedSkills (manifest-aware)", () => {
  test("removes manifest-listed sibling entries and restores backed-up pre-existing content", () => {
    const root = join(FIXTURE_ROOT, "cleanup-restore");
    mkdirSync(root, { recursive: true });
    const src = join(root, "src-skills");
    mkdirSync(join(src, "alpha"), { recursive: true });
    writeFileSync(join(src, "alpha", "SKILL.md"), "new alpha");
    mkdirSync(join(src, "beta"), { recursive: true });
    writeFileSync(join(src, "beta", "SKILL.md"), "new beta");

    const skillsDir = join(root, ".claude", "skills");
    mkdirSync(join(skillsDir, "alpha"), { recursive: true });
    writeFileSync(join(skillsDir, "alpha", "SKILL.md"), "USER ALPHA");

    stageSiblingSkills({
      skillUnderTest: "x",
      skillsSourceDir: src,
      repoRoot: root,
    });
    expect(readFileSync(join(skillsDir, "alpha", "SKILL.md"), "utf8")).toBe(
      "new alpha",
    );
    expect(readFileSync(join(skillsDir, "beta", "SKILL.md"), "utf8")).toBe(
      "new beta",
    );

    cleanupStagedSkills(root);

    expect(readFileSync(join(skillsDir, "alpha", "SKILL.md"), "utf8")).toBe(
      "USER ALPHA",
    );
    expect(existsSync(join(skillsDir, "beta"))).toBe(false);
    expect(existsSync(join(skillsDir, STAGED_SIBLING_MANIFEST))).toBe(false);
  });

  test("still sweeps prefix-staged entries when no manifest is present", () => {
    const root = join(FIXTURE_ROOT, "cleanup-legacy");
    const skillsDir = join(root, ".claude", "skills");
    mkdirSync(skillsDir, { recursive: true });
    mkdirSync(join(skillsDir, `${STAGED_SKILL_PREFIX}1-with_skill__foo`), {
      recursive: true,
    });
    mkdirSync(join(skillsDir, "user-custom"), { recursive: true });

    cleanupStagedSkills(root);

    expect(
      existsSync(join(skillsDir, `${STAGED_SKILL_PREFIX}1-with_skill__foo`)),
    ).toBe(false);
    expect(existsSync(join(skillsDir, "user-custom"))).toBe(true);
  });
});

describe("cleanupStagedSkills (runner-created .claude/skills)", () => {
  test("removes the whole .claude/skills tree when the runner created it, and prunes an empty .claude", () => {
    const root = join(FIXTURE_ROOT, "cleanup-created");
    mkdirSync(root, { recursive: true });
    const src = join(root, "src-skills");
    mkdirSync(join(src, "alpha"), { recursive: true });
    writeFileSync(join(src, "alpha", "SKILL.md"), "alpha");

    // .claude/skills did NOT pre-exist — stageSiblingSkills creates it.
    stageSiblingSkills({
      skillUnderTest: "x",
      skillsSourceDir: src,
      repoRoot: root,
    });
    // A stray, non-prefixed dir a recursive eval might have left behind.
    mkdirSync(join(root, ".claude", "skills", "stray-leftover"), {
      recursive: true,
    });

    cleanupStagedSkills(root);

    expect(existsSync(join(root, ".claude", "skills"))).toBe(false);
    // .claude held nothing else, so it is pruned too.
    expect(existsSync(join(root, ".claude"))).toBe(false);
  });

  test("keeps .claude (and settings.json) when the runner created only skills/", () => {
    const root = join(FIXTURE_ROOT, "cleanup-keep-settings");
    const claudeDir = join(root, ".claude");
    mkdirSync(claudeDir, { recursive: true });
    writeFileSync(join(claudeDir, "settings.json"), "{}");
    const src = join(root, "src-skills");
    mkdirSync(join(src, "alpha"), { recursive: true });
    writeFileSync(join(src, "alpha", "SKILL.md"), "alpha");

    // .claude exists but .claude/skills does not — runner creates skills/.
    stageSiblingSkills({
      skillUnderTest: "x",
      skillsSourceDir: src,
      repoRoot: root,
    });

    cleanupStagedSkills(root);

    expect(existsSync(join(claudeDir, "skills"))).toBe(false);
    expect(existsSync(claudeDir)).toBe(true);
    expect(existsSync(join(claudeDir, "settings.json"))).toBe(true);
  });

  test("leaves a pre-existing .claude/skills dir in place (surgical restore only)", () => {
    const root = join(FIXTURE_ROOT, "cleanup-preexisting-skillsdir");
    const skillsDir = join(root, ".claude", "skills");
    // The user already had a .claude/skills with their own skill.
    mkdirSync(join(skillsDir, "user-owned"), { recursive: true });
    writeFileSync(join(skillsDir, "user-owned", "SKILL.md"), "USER");
    const src = join(root, "src-skills");
    mkdirSync(join(src, "alpha"), { recursive: true });
    writeFileSync(join(src, "alpha", "SKILL.md"), "alpha");

    stageSiblingSkills({
      skillUnderTest: "x",
      skillsSourceDir: src,
      repoRoot: root,
    });

    cleanupStagedSkills(root);

    expect(existsSync(skillsDir)).toBe(true);
    expect(
      readFileSync(join(skillsDir, "user-owned", "SKILL.md"), "utf8"),
    ).toBe("USER");
    expect(existsSync(join(skillsDir, "alpha"))).toBe(false);
  });
});

describe("buildDispatchTask bootstrap injection", () => {
  const baseOpts = {
    evalId: "e1",
    condition: "with_skill",
    skillPath: null,
    stagedSkillSlug: "slow-powers-eval-1-with_skill__foo" as string | null,
    userPrompt: "do the thing",
    fixtures: [] as string[],
    outputsDir: "/tmp/out",
    condDir: "/tmp/cond",
    skillName: "foo",
    availableSkills: [] as {
      name: string;
      path: string;
      description: string;
    }[],
  };

  test("prepends <session-start-context> for claude-code when bootstrapContent is provided", () => {
    const task = buildDispatchTask({
      ...baseOpts,
      bootstrapContent: "BOOT-LOADED",
    });
    expect(task.dispatch_prompt.startsWith("<session-start-context>")).toBe(
      true,
    );
    expect(task.dispatch_prompt).toContain("BOOT-LOADED");
    expect(task.dispatch_prompt).toContain("</session-start-context>");
  });

  test("omits <session-start-context> when bootstrapContent is null and nothing is staged", () => {
    const task = buildDispatchTask({
      ...baseOpts,
      bootstrapContent: null,
    });
    expect(task.dispatch_prompt).not.toContain("<session-start-context>");
  });

  test("emits a harness-native available-skills block (no <session-start-context>) when bootstrapContent is null", () => {
    const task = buildDispatchTask({
      ...baseOpts,
      bootstrapContent: null,
      availableSkills: [
        { name: "foo", path: "/x/foo/SKILL.md", description: "the foo skill" },
      ],
    });
    // Without a bootstrap, there is no SessionStart block — only the skills list.
    expect(task.dispatch_prompt).not.toContain("<session-start-context>");
    expect(task.dispatch_prompt).toContain(
      "The following skills are available for use with the Skill tool:",
    );
    expect(task.dispatch_prompt).toContain("- foo: the foo skill");
    // The eval-flavored wording and custom format are gone.
    expect(task.dispatch_prompt).not.toContain("staged and discoverable");
    expect(task.dispatch_prompt).not.toContain("*Trigger:*");
    // No product framing should appear without a bootstrap file.
    expect(task.dispatch_prompt).not.toContain("loaded at session start");
  });

  test("renders the available-skills block as its own section, outside <session-start-context>, after the verbatim bootstrap", () => {
    const task = buildDispatchTask({
      ...baseOpts,
      bootstrapContent: "BOOT-LOADED",
      availableSkills: [
        { name: "foo", path: "/x/foo/SKILL.md", description: "the foo skill" },
      ],
    });
    const prompt = task.dispatch_prompt;
    // The skills list is a separate block, not bundled inside the SessionStart
    // context (which carries bootstrap content only).
    const sscEnd = prompt.indexOf("</session-start-context>");
    const listIdx = prompt.indexOf(
      "The following skills are available for use with the Skill tool:",
    );
    const bootIdx = prompt.indexOf("BOOT-LOADED");
    expect(sscEnd).toBeGreaterThan(-1);
    expect(bootIdx).toBeGreaterThan(-1);
    expect(bootIdx).toBeLessThan(sscEnd);
    expect(listIdx).toBeGreaterThan(sscEnd);
  });

  test("sets dispatch_prompt_path to dispatch-prompt.txt under the condition dir", () => {
    const task = buildDispatchTask({
      ...baseOpts,
      bootstrapContent: null,
    });
    expect(task.dispatch_prompt_path).toBe("/tmp/cond/dispatch-prompt.txt");
  });

  const SAMPLE_DIRECTORY = [
    "## Active Skills Directory",
    "",
    "* **`test-driven-development`**",
    "  * *Trigger:* Use whenever implementing code.",
    "* **`systematic-debugging`**",
    "  * *Trigger:* Use when debugging.",
  ].join("\n");

  test("redactSkillFromBootstrap removes the skill-under-test's directory entry", () => {
    const redacted = redactSkillFromBootstrap(
      SAMPLE_DIRECTORY,
      "test-driven-development",
    );
    expect(redacted).not.toContain("test-driven-development");
    expect(redacted).not.toContain("Use whenever implementing code.");
    // Sibling entries and the heading survive.
    expect(redacted).toContain("systematic-debugging");
    expect(redacted).toContain("Use when debugging.");
    expect(redacted).toContain("## Active Skills Directory");
  });

  test("redacts the skill-under-test from bootstrap in the skill-absent condition", () => {
    const withoutSkill = buildDispatchTask({
      ...baseOpts,
      condition: "without_skill",
      skillPath: null,
      stagedSkillSlug: null,
      skillName: "test-driven-development",
      bootstrapContent: SAMPLE_DIRECTORY,
    });
    expect(withoutSkill.dispatch_prompt).not.toContain(
      "test-driven-development",
    );
    // A sibling skill named in the same bootstrap is untouched.
    expect(withoutSkill.dispatch_prompt).toContain("systematic-debugging");

    const withSkill = buildDispatchTask({
      ...baseOpts,
      condition: "with_skill",
      skillPath: null,
      stagedSkillSlug: "slow-powers-eval-1-with_skill__test-driven-development",
      skillName: "test-driven-development",
      bootstrapContent: SAMPLE_DIRECTORY,
    });
    expect(withSkill.dispatch_prompt).toContain("test-driven-development");
  });

  test("names the staged slug for disambiguation without instructing invocation", () => {
    const task = buildDispatchTask({
      ...baseOpts,
      bootstrapContent: "BOOT-LOADED",
    });
    // The slug is still surfaced so a deliberate invocation targets the staged
    // version and the meta-check can find it — but we no longer assert a plugin
    // is "loaded" or tell the agent to prefer the slug over the bare name, which
    // invited it to hunt for a global copy (issue #144 global-plugin leakage).
    expect(task.dispatch_prompt).toContain(
      "slow-powers-eval-1-with_skill__foo",
    );
    // ...but the over-promoting invoke imperative (issue #119) is gone, so
    // invocation reflects the skill's own triggering rather than an order.
    expect(task.dispatch_prompt).not.toContain("invoke that slug");
    expect(task.dispatch_prompt).not.toContain("if the skill applies");
    expect(task.dispatch_prompt).not.toContain("under evaluation");
    // ...and the leakage-inviting framing is gone (issue #144): no claim that a
    // plugin is loaded, no "use the slug rather than the bare name" contrast.
    expect(task.dispatch_prompt).not.toContain("plugin loaded");
    expect(task.dispatch_prompt).not.toContain("rather than the bare name");
  });

  test("without-skill condition under realistic env carries no eval-announcing skill commentary", () => {
    const task = buildDispatchTask({
      ...baseOpts,
      skillPath: null,
      stagedSkillSlug: null,
      bootstrapContent: "BOOT-LOADED",
    });
    // The arm stays silent about the absent skill: the available-skills block
    // already omits it, so nothing announces that this is an eval control arm.
    expect(task.dispatch_prompt).not.toContain("No skill is loaded");
    expect(task.dispatch_prompt.toLowerCase()).not.toContain("not available");
    expect(task.dispatch_prompt).not.toContain("under evaluation");
  });

  test("without-skill condition without bootstrap (e.g. --no-stage) keeps the legacy 'No skill is loaded' wording", () => {
    const task = buildDispatchTask({
      ...baseOpts,
      skillPath: null,
      stagedSkillSlug: null,
      bootstrapContent: null,
    });
    expect(task.dispatch_prompt).toContain("No skill is loaded");
  });
});

describe("buildDispatchTask plan-mode injection", () => {
  const baseOpts = {
    evalId: "e1",
    condition: "with_skill",
    skillPath: null,
    stagedSkillSlug: "slow-powers-eval-1-with_skill__foo" as string | null,
    userPrompt: "BUILD-THE-TODO-APP",
    fixtures: [] as string[],
    outputsDir: "/tmp/out",
    condDir: "/tmp/cond",
    skillName: "foo",
    bootstrapContent: null as string | null,
    availableSkills: [
      { name: "foo", path: "/x/foo/SKILL.md", description: "the foo skill" },
    ] as { name: string; path: string; description: string }[],
  };

  test("omits the plan-mode block when planModeContent is null/absent", () => {
    const task = buildDispatchTask({ ...baseOpts });
    expect(task.dispatch_prompt).not.toContain("<system-reminder>");
    const withNull = buildDispatchTask({ ...baseOpts, planModeContent: null });
    expect(withNull.dispatch_prompt).not.toContain("<system-reminder>");
  });

  test("injects the rendered plan-mode block when planModeContent is provided", () => {
    const task = buildDispatchTask({
      ...baseOpts,
      planModeContent: "Plan mode is active. PLAN-RAIL-MARKER.",
    });
    expect(task.dispatch_prompt).toContain("<system-reminder>");
    expect(task.dispatch_prompt).toContain("PLAN-RAIL-MARKER.");
    expect(task.dispatch_prompt).toContain("</system-reminder>");
  });

  test("places the plan-mode block after the available-skills block and before the user request", () => {
    const prompt = buildDispatchTask({
      ...baseOpts,
      planModeContent: "PLAN-RAIL-MARKER",
    }).dispatch_prompt;
    const skillsIdx = prompt.indexOf(
      "The following skills are available for use with the Skill tool:",
    );
    const planIdx = prompt.indexOf("<system-reminder>");
    const promptIdx = prompt.indexOf("BUILD-THE-TODO-APP");
    expect(skillsIdx).toBeGreaterThan(-1);
    expect(planIdx).toBeGreaterThan(skillsIdx);
    expect(promptIdx).toBeGreaterThan(planIdx);
  });

  test("injects an identical plan-mode block in the with- and without-skill arms", () => {
    const planModeContent = "Plan mode is active. PLAN-RAIL-MARKER.";
    const rendered =
      "<system-reminder>\nPlan mode is active. PLAN-RAIL-MARKER.\n</system-reminder>";
    const withSkill = buildDispatchTask({
      ...baseOpts,
      condition: "with_skill",
      stagedSkillSlug: "slow-powers-eval-1-with_skill__foo",
      planModeContent,
    });
    const withoutSkill = buildDispatchTask({
      ...baseOpts,
      condition: "without_skill",
      skillPath: null,
      stagedSkillSlug: null,
      availableSkills: [],
      planModeContent,
    });
    expect(withSkill.dispatch_prompt).toContain(rendered);
    expect(withoutSkill.dispatch_prompt).toContain(rendered);
  });
});

describe("run.ts user-mode end-to-end (--skill-dir, isolated CWD)", () => {
  const RUN_TS = join(import.meta.dir, "run.ts");

  function setup(
    name: string,
    evals: Eval[] = [
      { id: "e1", prompt: "review this MR", expected_output: "a review" },
    ],
  ): { skillDir: string; cwd: string } {
    const root = join(FIXTURE_ROOT, name);
    const skillDir = join(root, "skill-dir");
    const skillSub = join(skillDir, "mr-review");
    mkdirSync(join(skillSub, "evals"), { recursive: true });
    writeFileSync(
      join(skillSub, "SKILL.md"),
      "---\nname: mr-review\ndescription: review merge requests\n---\n\nbody\n",
    );
    writeFileSync(
      join(skillSub, "evals", "evals.json"),
      JSON.stringify({ skill_name: "mr-review", evals }),
    );
    const cwd = join(root, "work");
    mkdirSync(cwd, { recursive: true });
    return { skillDir, cwd };
  }

  function runCli(args: string[], cwd: string) {
    return Bun.spawnSync(["bun", "run", RUN_TS, ...args], {
      cwd,
      stdout: "pipe",
      stderr: "pipe",
    });
  }

  test("stages only the skill-under-test and writes workspace under CWD", () => {
    const { skillDir, cwd } = setup("usermode-basic");
    const res = runCli(
      [
        "--skill-dir",
        skillDir,
        "--skill",
        "mr-review",
        "--mode",
        "new-skill",
        "--dry-run",
      ],
      cwd,
    );
    expect(res.exitCode).toBe(0);

    const dispatchJson = join(
      cwd,
      "skills-workspace",
      "mr-review",
      "iteration-1",
      "dispatch.json",
    );
    expect(existsSync(dispatchJson)).toBe(true);

    const stagedSkillsDir = join(cwd, ".claude", "skills");
    const entries = readdirSync(stagedSkillsDir).filter(
      (e) => e !== STAGED_SIBLING_MANIFEST,
    );
    expect(entries).toEqual(["slow-powers-eval-1-with_skill__mr-review"]);
  });

  test("--plan-mode injects the resolved profile into every dispatch and records plan_mode in dispatch.json", () => {
    const { skillDir, cwd } = setup("usermode-plan-mode");
    const res = runCli(
      [
        "--skill-dir",
        skillDir,
        "--skill",
        "mr-review",
        "--mode",
        "new-skill",
        "--plan-mode",
        "--dry-run",
      ],
      cwd,
    );
    expect(res.exitCode).toBe(0);

    const iterationDir = join(
      cwd,
      "skills-workspace",
      "mr-review",
      "iteration-1",
    );
    const dispatch = JSON.parse(
      readFileSync(join(iterationDir, "dispatch.json"), "utf8"),
    ) as {
      plan_mode: boolean;
      tasks: Array<{ condition: string; dispatch_prompt_path: string }>;
    };
    expect(dispatch.plan_mode).toBe(true);

    // Both arms carry the same harness-injected plan-mode operating context.
    for (const t of dispatch.tasks) {
      const prompt = readFileSync(t.dispatch_prompt_path, "utf8");
      expect(prompt).toContain("<system-reminder>");
      expect(prompt).toContain("Plan mode is active");
      expect(prompt).toContain("ExitPlanMode");
    }
  });

  test("without --plan-mode, dispatch.json records plan_mode:false and no plan-mode block is injected", () => {
    const { skillDir, cwd } = setup("usermode-no-plan-mode");
    const res = runCli(
      [
        "--skill-dir",
        skillDir,
        "--skill",
        "mr-review",
        "--mode",
        "new-skill",
        "--dry-run",
      ],
      cwd,
    );
    expect(res.exitCode).toBe(0);

    const iterationDir = join(
      cwd,
      "skills-workspace",
      "mr-review",
      "iteration-1",
    );
    const dispatch = JSON.parse(
      readFileSync(join(iterationDir, "dispatch.json"), "utf8"),
    ) as {
      plan_mode: boolean;
      tasks: Array<{ dispatch_prompt_path: string }>;
    };
    expect(dispatch.plan_mode).toBe(false);
    for (const t of dispatch.tasks) {
      const prompt = readFileSync(t.dispatch_prompt_path, "utf8");
      expect(prompt).not.toContain("<system-reminder>");
    }
  });

  test("--stage-name stages the SUT under the verbatim name, threads it everywhere, and registers it for cleanup", () => {
    const { skillDir, cwd } = setup("usermode-stage-name");
    const res = runCli(
      [
        "--skill-dir",
        skillDir,
        "--skill",
        "mr-review",
        "--mode",
        "new-skill",
        "--stage-name",
        "mr-review",
        "--dry-run",
      ],
      cwd,
    );
    expect(res.exitCode).toBe(0);

    // Staged dir is the natural name, not the conspicuous eval slug.
    const stagedSkillsDir = join(cwd, ".claude", "skills");
    const entries = readdirSync(stagedSkillsDir).filter(
      (e) => e !== STAGED_SIBLING_MANIFEST,
    );
    expect(entries).toEqual(["mr-review"]);

    const iterationDir = join(
      cwd,
      "skills-workspace",
      "mr-review",
      "iteration-1",
    );

    // conditions.json carries the natural slug — the grader meta-check reads it.
    const conditions = JSON.parse(
      readFileSync(join(iterationDir, "conditions.json"), "utf8"),
    ) as {
      conditions: Array<{ name: string; staged_skill_slug: string | null }>;
    };
    const withSkill = conditions.conditions.find(
      (c) => c.name === "with_skill",
    );
    expect(withSkill?.staged_skill_slug).toBe("mr-review");

    // The custom dir is registered for cleanup (prefix scan won't catch it).
    const manifest = JSON.parse(
      readFileSync(join(stagedSkillsDir, STAGED_SIBLING_MANIFEST), "utf8"),
    ) as { created_entries: Array<{ name: string }> };
    expect(manifest.created_entries.map((e) => e.name)).toContain("mr-review");

    // The dispatch prompt disambiguates to the natural identifier, not the slug.
    const dispatch = JSON.parse(
      readFileSync(join(iterationDir, "dispatch.json"), "utf8"),
    ) as {
      tasks: Array<{ condition: string; dispatch_prompt_path: string }>;
    };
    const task = dispatch.tasks.find((t) => t.condition === "with_skill");
    const prompt = readFileSync(task?.dispatch_prompt_path ?? "", "utf8");
    expect(prompt).toContain("registered under the identifier `mr-review`");
    expect(prompt).not.toContain("slow-powers-eval-");
  });

  test("--stage-name refuses to clobber a pre-existing same-named dir", () => {
    const { skillDir, cwd } = setup("usermode-stage-name-clobber");
    const preexisting = join(cwd, ".claude", "skills", "my-real-skill");
    mkdirSync(preexisting, { recursive: true });
    writeFileSync(join(preexisting, "SKILL.md"), "USER OWNED");

    const res = runCli(
      [
        "--skill-dir",
        skillDir,
        "--skill",
        "mr-review",
        "--mode",
        "new-skill",
        "--stage-name",
        "my-real-skill",
        "--dry-run",
      ],
      cwd,
    );
    expect(res.exitCode).not.toBe(0);
    expect(readFileSync(join(preexisting, "SKILL.md"), "utf8")).toBe(
      "USER OWNED",
    );
  });

  test("dispatch prompt lists only the skill-under-test, no other skills, and no product framing without --bootstrap", () => {
    const { skillDir, cwd } = setup("usermode-prompt");
    const res = runCli(
      [
        "--skill-dir",
        skillDir,
        "--skill",
        "mr-review",
        "--mode",
        "new-skill",
        "--dry-run",
      ],
      cwd,
    );
    expect(res.exitCode).toBe(0);

    const dispatch = JSON.parse(
      readFileSync(
        join(
          cwd,
          "skills-workspace",
          "mr-review",
          "iteration-1",
          "dispatch.json",
        ),
        "utf8",
      ),
    ) as {
      tasks: Array<{
        condition: string;
        dispatch_prompt?: string;
        dispatch_prompt_path: string;
      }>;
    };

    const withSkill = dispatch.tasks.find((t) => t.condition === "with_skill");
    expect(withSkill).toBeDefined();
    // The full prompt is no longer inlined in dispatch.json — it lives in a file.
    expect(withSkill?.dispatch_prompt).toBeUndefined();
    const prompt = readFileSync(withSkill?.dispatch_prompt_path ?? "", "utf8");
    expect(prompt).toContain(
      "The following skills are available for use with the Skill tool:",
    );
    expect(prompt).toContain("- mr-review:");
    expect(prompt).not.toContain("test-driven-development");
    expect(prompt).not.toContain("writing-skills");
    // No product framing (EXTREMELY-IMPORTANT etc.) without a --bootstrap file.
    expect(prompt).not.toContain("EXTREMELY-IMPORTANT");
    expect(prompt).not.toContain("loaded at session start");
  });

  test("writes each dispatch prompt to a file and drops the inline prompt from dispatch.json", () => {
    const { skillDir, cwd } = setup("usermode-prompt-file");
    const res = runCli(
      [
        "--skill-dir",
        skillDir,
        "--skill",
        "mr-review",
        "--mode",
        "new-skill",
        "--dry-run",
      ],
      cwd,
    );
    expect(res.exitCode).toBe(0);

    const dispatch = JSON.parse(
      readFileSync(
        join(
          cwd,
          "skills-workspace",
          "mr-review",
          "iteration-1",
          "dispatch.json",
        ),
        "utf8",
      ),
    ) as {
      tasks: Array<{ dispatch_prompt?: string; dispatch_prompt_path: string }>;
    };

    expect(dispatch.tasks.length).toBeGreaterThan(0);
    for (const t of dispatch.tasks) {
      // Nothing inlined; everything goes through the file pointer.
      expect(t.dispatch_prompt).toBeUndefined();
      expect(t.dispatch_prompt_path.endsWith("dispatch-prompt.txt")).toBe(true);
      expect(existsSync(t.dispatch_prompt_path)).toBe(true);
      const contents = readFileSync(t.dispatch_prompt_path, "utf8");
      expect(contents.length).toBeGreaterThan(0);
      expect(contents).toContain("User request:");
    }
  });

  test("--guard installs a PreToolUse hook; teardown-guard removes it", () => {
    const { skillDir, cwd } = setup("usermode-guard");
    const settingsPath = join(cwd, ".claude", "settings.local.json");

    const res = runCli(
      [
        "--skill-dir",
        skillDir,
        "--skill",
        "mr-review",
        "--mode",
        "new-skill",
        "--guard",
      ],
      cwd,
    );
    expect(res.exitCode).toBe(0);
    expect(existsSync(settingsPath)).toBe(true);
    const settings = JSON.parse(readFileSync(settingsPath, "utf8"));
    expect(settings.hooks.PreToolUse[0].matcher).toContain("Write");

    const down = runCli(
      ["teardown-guard", "--skill-dir", skillDir, "--skill", "mr-review"],
      cwd,
    );
    expect(down.exitCode).toBe(0);
    expect(existsSync(settingsPath)).toBe(false);
  });

  test("teardown removes the guard AND the staged skill set the runner created", () => {
    const { skillDir, cwd } = setup("usermode-teardown");
    const settingsPath = join(cwd, ".claude", "settings.local.json");
    const stagedSkillsDir = join(cwd, ".claude", "skills");

    const res = runCli(
      [
        "--skill-dir",
        skillDir,
        "--skill",
        "mr-review",
        "--mode",
        "new-skill",
        "--guard",
      ],
      cwd,
    );
    expect(res.exitCode).toBe(0);
    expect(existsSync(settingsPath)).toBe(true);
    expect(existsSync(stagedSkillsDir)).toBe(true);

    const down = runCli(
      ["teardown", "--skill-dir", skillDir, "--skill", "mr-review"],
      cwd,
    );
    expect(down.exitCode).toBe(0);
    // Guard gone, staged skills gone, and the .claude scaffolding the runner
    // created in this throwaway cwd (no settings.json) is pruned entirely.
    expect(existsSync(settingsPath)).toBe(false);
    expect(existsSync(stagedSkillsDir)).toBe(false);
    expect(existsSync(join(cwd, ".claude"))).toBe(false);
    // The run only produced scaffolding (no results), so teardown reclaims the
    // workspace too — a completed run leaves nothing uncommitted behind.
    expect(existsSync(join(cwd, "skills-workspace"))).toBe(false);
  });

  test("teardown preserves an iteration with uncommitted results and warns", () => {
    const { skillDir, cwd } = setup("usermode-teardown-keep");

    const res = runCli(
      ["--skill-dir", skillDir, "--skill", "mr-review", "--mode", "new-skill"],
      cwd,
    );
    expect(res.exitCode).toBe(0);

    // Simulate a graded-but-not-promoted run: drop an aggregate into the
    // iteration the runner just created.
    const iterationDir = join(
      cwd,
      "skills-workspace",
      "mr-review",
      "iteration-1",
    );
    writeFileSync(
      join(iterationDir, "benchmark.json"),
      `${JSON.stringify({ delta: { pass_rate: 0.4 } })}\n`,
    );

    const down = runCli(
      ["teardown", "--skill-dir", skillDir, "--skill", "mr-review"],
      cwd,
    );
    expect(down.exitCode).toBe(0);

    // Uncommitted results are preserved, and the user is told how to commit.
    expect(existsSync(iterationDir)).toBe(true);
    const out =
      new TextDecoder().decode(down.stdout) +
      new TextDecoder().decode(down.stderr);
    expect(out).toContain("iteration-1");
    expect(out).toContain("promote-baseline");
  });

  test("a normal run does not install a guard", () => {
    const { skillDir, cwd } = setup("usermode-noguard");
    const res = runCli(
      [
        "--skill-dir",
        skillDir,
        "--skill",
        "mr-review",
        "--mode",
        "new-skill",
        "--dry-run",
      ],
      cwd,
    );
    expect(res.exitCode).toBe(0);
    expect(existsSync(join(cwd, ".claude", "settings.local.json"))).toBe(false);
  });

  test("namespaces agent_description per iteration+run and records run_nonce", () => {
    const { skillDir, cwd } = setup("usermode-nonce");
    const res = runCli(
      [
        "--skill-dir",
        skillDir,
        "--skill",
        "mr-review",
        "--mode",
        "new-skill",
        "--dry-run",
      ],
      cwd,
    );
    expect(res.exitCode).toBe(0);

    const iterationDir = join(
      cwd,
      "skills-workspace",
      "mr-review",
      "iteration-1",
    );
    const dispatch = JSON.parse(
      readFileSync(join(iterationDir, "dispatch.json"), "utf8"),
    ) as {
      run_nonce: string;
      tasks: Array<{ condition: string; agent_description: string }>;
    };
    expect(typeof dispatch.run_nonce).toBe("string");
    expect(dispatch.run_nonce.length).toBeGreaterThan(0);

    for (const t of dispatch.tasks) {
      // <eval_id>:<condition>:i<iteration>-<nonce> — unique across iterations
      // and re-runs so fill-transcripts can't cross-match a colliding agent.
      expect(t.agent_description).toMatch(
        new RegExp(`:${t.condition}:i1-${dispatch.run_nonce}$`),
      );
    }

    const conditions = JSON.parse(
      readFileSync(join(iterationDir, "conditions.json"), "utf8"),
    ) as { run_nonce?: string };
    expect(conditions.run_nonce).toBe(dispatch.run_nonce);
  });

  test("--bootstrap content is prepended verbatim before the available-skills block", () => {
    const { skillDir, cwd } = setup("usermode-bootstrap");
    const bootstrapPath = join(cwd, "my-bootstrap.md");
    writeFileSync(bootstrapPath, "MY CUSTOM EVAL FRAMING");
    const res = runCli(
      [
        "--skill-dir",
        skillDir,
        "--skill",
        "mr-review",
        "--mode",
        "new-skill",
        "--bootstrap",
        bootstrapPath,
        "--dry-run",
      ],
      cwd,
    );
    expect(res.exitCode).toBe(0);

    const dispatch = JSON.parse(
      readFileSync(
        join(
          cwd,
          "skills-workspace",
          "mr-review",
          "iteration-1",
          "dispatch.json",
        ),
        "utf8",
      ),
    ) as {
      tasks: Array<{ condition: string; dispatch_prompt_path: string }>;
    };
    const withSkill = dispatch.tasks.find((t) => t.condition === "with_skill");
    const prompt = withSkill
      ? readFileSync(withSkill.dispatch_prompt_path, "utf8")
      : "";
    const bootIdx = prompt.indexOf("MY CUSTOM EVAL FRAMING");
    const listIdx = prompt.indexOf(
      "The following skills are available for use with the Skill tool:",
    );
    expect(bootIdx).toBeGreaterThan(-1);
    expect(listIdx).toBeGreaterThan(bootIdx);
  });

  test("--only restricts dispatches to the named eval ids", () => {
    const { skillDir, cwd } = setup("usermode-only", [
      { id: "e1", prompt: "review MR 1", expected_output: "a review" },
      { id: "e2", prompt: "review MR 2", expected_output: "a review" },
    ]);
    const res = runCli(
      [
        "--skill-dir",
        skillDir,
        "--skill",
        "mr-review",
        "--mode",
        "new-skill",
        "--only",
        "e1",
        "--dry-run",
      ],
      cwd,
    );
    expect(res.exitCode).toBe(0);

    const dispatch = JSON.parse(
      readFileSync(
        join(
          cwd,
          "skills-workspace",
          "mr-review",
          "iteration-1",
          "dispatch.json",
        ),
        "utf8",
      ),
    ) as { tasks: Array<{ eval_id: string }> };

    expect(dispatch.tasks.map((t) => t.eval_id).sort()).toEqual(["e1", "e1"]);
    // The "N evals × 2 conditions" line reflects the filtered set.
    expect(new TextDecoder().decode(res.stdout)).toContain(
      "1 evals × 2 conditions",
    );
  });

  test("--only with an unknown id exits non-zero and names the unknown id", () => {
    const { skillDir, cwd } = setup("usermode-only-unknown", [
      { id: "e1", prompt: "review MR 1", expected_output: "a review" },
    ]);
    const res = runCli(
      [
        "--skill-dir",
        skillDir,
        "--skill",
        "mr-review",
        "--mode",
        "new-skill",
        "--only",
        "nope",
        "--dry-run",
      ],
      cwd,
    );
    expect(res.exitCode).not.toBe(0);
    expect(new TextDecoder().decode(res.stderr)).toContain(
      "unknown eval id(s): nope",
    );
  });
});

describe("snapshot --ref (read baseline from a git ref, issue #122)", () => {
  const RUN_TS = join(import.meta.dir, "run.ts");

  function git(args: string[], cwd: string) {
    const res = Bun.spawnSync(
      [
        "git",
        "-c",
        "user.email=eval@test",
        "-c",
        "user.name=eval",
        "-c",
        "commit.gpgsign=false",
        ...args,
      ],
      { cwd, stdout: "pipe", stderr: "pipe" },
    );
    if (res.exitCode !== 0)
      throw new Error(`git ${args.join(" ")} failed: ${res.stderr.toString()}`);
    return res;
  }

  function runCli(args: string[], cwd: string) {
    return Bun.spawnSync(["bun", "run", RUN_TS, ...args], {
      cwd,
      stdout: "pipe",
      stderr: "pipe",
    });
  }

  /**
   * Builds a git repo at <root> containing a `mr-review` skill committed as v1,
   * then overwrites the working-tree SKILL.md with v2 (uncommitted). Returns the
   * paths a snapshot needs, so a test can assert `--ref HEAD` reads v1 while the
   * working tree keeps v2.
   */
  function setupRepo(
    name: string,
    opts: { extraCommitted?: Record<string, string> } = {},
  ): { root: string; skillDir: string; skillSub: string; cwd: string } {
    const root = join(FIXTURE_ROOT, name);
    const skillDir = join(root, "skill-dir");
    const skillSub = join(skillDir, "mr-review");
    mkdirSync(skillSub, { recursive: true });
    writeFileSync(join(skillSub, "SKILL.md"), "v1 baseline\n");
    for (const [rel, content] of Object.entries(opts.extraCommitted ?? {})) {
      const p = join(skillSub, rel);
      mkdirSync(join(p, ".."), { recursive: true });
      writeFileSync(p, content);
    }

    git(["init", "-q"], root);
    git(["add", "-A"], root);
    git(["commit", "-q", "-m", "v1"], root);

    // Working tree diverges to v2; the commit still holds v1.
    writeFileSync(join(skillSub, "SKILL.md"), "v2 working tree\n");

    const cwd = join(root, "work");
    mkdirSync(cwd, { recursive: true });
    return { root, skillDir, skillSub, cwd };
  }

  function snapshotPath(cwd: string, label: string, rel: string): string {
    return join(cwd, "skills-workspace", "mr-review", "snapshots", label, rel);
  }

  test("snapshots the SKILL.md committed at the ref, leaving the working tree untouched", () => {
    const { skillDir, skillSub, cwd } = setupRepo("ref-old-content");
    const res = runCli(
      [
        "snapshot",
        "--skill-dir",
        skillDir,
        "--skill",
        "mr-review",
        "--label",
        "old",
        "--ref",
        "HEAD",
      ],
      cwd,
    );
    expect(res.exitCode).toBe(0);

    // Snapshot holds the committed v1...
    expect(readFileSync(snapshotPath(cwd, "old", "SKILL.md"), "utf8")).toBe(
      "v1 baseline\n",
    );
    // ...and the working tree still holds the edited v2 (no clobber).
    expect(readFileSync(join(skillSub, "SKILL.md"), "utf8")).toBe(
      "v2 working tree\n",
    );
  });

  test("captures sibling assets at the ref but excludes evals/", () => {
    const { skillDir, cwd } = setupRepo("ref-assets", {
      extraCommitted: {
        "assets/notes.md": "asset body\n",
        "evals/evals.json": '{"skill_name":"mr-review","evals":[]}',
      },
    });
    const res = runCli(
      [
        "snapshot",
        "--skill-dir",
        skillDir,
        "--skill",
        "mr-review",
        "--label",
        "old",
        "--ref",
        "HEAD",
      ],
      cwd,
    );
    expect(res.exitCode).toBe(0);

    expect(existsSync(snapshotPath(cwd, "old", "assets/notes.md"))).toBe(true);
    expect(
      readFileSync(snapshotPath(cwd, "old", "assets/notes.md"), "utf8"),
    ).toBe("asset body\n");
    expect(existsSync(snapshotPath(cwd, "old", "evals"))).toBe(false);
  });

  test("records ref provenance so teardown can reclaim the snapshot", () => {
    const { skillDir, cwd } = setupRepo("ref-meta");
    const res = runCli(
      [
        "snapshot",
        "--skill-dir",
        skillDir,
        "--skill",
        "mr-review",
        "--label",
        "old",
        "--ref",
        "HEAD",
      ],
      cwd,
    );
    expect(res.exitCode).toBe(0);

    const meta = JSON.parse(
      readFileSync(snapshotPath(cwd, "old", SNAPSHOT_META), "utf8"),
    ) as { source: string; ref: string };
    expect(meta.source).toBe("ref");
    expect(meta.ref).toBe("HEAD");
  });

  test("a ref that does not exist fails with a clear message", () => {
    const { skillDir, cwd } = setupRepo("ref-bad");
    const res = runCli(
      [
        "snapshot",
        "--skill-dir",
        skillDir,
        "--skill",
        "mr-review",
        "--label",
        "old",
        "--ref",
        "does-not-exist",
      ],
      cwd,
    );
    expect(res.exitCode).not.toBe(0);
    expect(new TextDecoder().decode(res.stderr)).toContain("does-not-exist");
  });

  test("without --ref, snapshot still reads the working tree (v2)", () => {
    const { skillDir, cwd } = setupRepo("ref-default-path");
    const res = runCli(
      [
        "snapshot",
        "--skill-dir",
        skillDir,
        "--skill",
        "mr-review",
        "--label",
        "wt",
      ],
      cwd,
    );
    expect(res.exitCode).toBe(0);
    expect(readFileSync(snapshotPath(cwd, "wt", "SKILL.md"), "utf8")).toBe(
      "v2 working tree\n",
    );
  });

  test("records working-tree provenance so teardown preserves the snapshot", () => {
    const { skillDir, cwd } = setupRepo("wt-meta");
    const res = runCli(
      [
        "snapshot",
        "--skill-dir",
        skillDir,
        "--skill",
        "mr-review",
        "--label",
        "wt",
      ],
      cwd,
    );
    expect(res.exitCode).toBe(0);

    const meta = JSON.parse(
      readFileSync(snapshotPath(cwd, "wt", SNAPSHOT_META), "utf8"),
    ) as { source: string };
    expect(meta.source).toBe("working-tree");
  });
});
