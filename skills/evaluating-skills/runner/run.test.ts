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
  STAGED_SIBLING_MANIFEST,
  STAGED_SKILL_PREFIX,
  selectEvals,
  stageSiblingSkills,
  stageSkillForCC,
} from "./run";
import type { Eval } from "./types";

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

  test("emits <session-start-context> with a staged-skills inventory even when bootstrapContent is null", () => {
    const task = buildDispatchTask({
      ...baseOpts,
      bootstrapContent: null,
      availableSkills: [
        { name: "foo", path: "/x/foo/SKILL.md", description: "the foo skill" },
      ],
    });
    expect(task.dispatch_prompt).toContain("<session-start-context>");
    expect(task.dispatch_prompt).toContain("staged and discoverable");
    expect(task.dispatch_prompt).toContain("* `foo`");
    expect(task.dispatch_prompt).toContain("*Trigger:* the foo skill");
    // No product framing should appear without a bootstrap file.
    expect(task.dispatch_prompt).not.toContain("loaded at session start");
  });

  test("staged-skills inventory follows the verbatim bootstrap content when both are present", () => {
    const task = buildDispatchTask({
      ...baseOpts,
      bootstrapContent: "BOOT-LOADED",
      availableSkills: [
        { name: "foo", path: "/x/foo/SKILL.md", description: "the foo skill" },
      ],
    });
    const bootIdx = task.dispatch_prompt.indexOf("BOOT-LOADED");
    const invIdx = task.dispatch_prompt.indexOf("staged and discoverable");
    expect(bootIdx).toBeGreaterThan(-1);
    expect(invIdx).toBeGreaterThan(bootIdx);
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

  test("references staged slug in skill block for claude-code", () => {
    const task = buildDispatchTask({
      ...baseOpts,
      bootstrapContent: "BOOT-LOADED",
    });
    expect(task.dispatch_prompt).toContain(
      "slow-powers-eval-1-with_skill__foo",
    );
  });

  test("without-skill condition under realistic env reflects 'this skill removed, others available' rather than 'no skill loaded'", () => {
    const task = buildDispatchTask({
      ...baseOpts,
      skillPath: null,
      stagedSkillSlug: null,
      bootstrapContent: "BOOT-LOADED",
    });
    expect(task.dispatch_prompt).not.toContain("No skill is loaded");
    expect(task.dispatch_prompt.toLowerCase()).toContain("not available");
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
    expect(prompt).toContain("<session-start-context>");
    expect(prompt).toContain("* `mr-review`");
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

  test("--bootstrap content is prepended verbatim before the staged-skills inventory", () => {
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
    const invIdx = prompt.indexOf("staged and discoverable");
    expect(bootIdx).toBeGreaterThan(-1);
    expect(invIdx).toBeGreaterThan(bootIdx);
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
