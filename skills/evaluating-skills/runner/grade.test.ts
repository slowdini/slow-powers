import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { checkSkillInvokedFromTranscript } from "./grade";
import type { ToolInvocation } from "./types";

describe("checkSkillInvokedFromTranscript", () => {
  test("returns true when transcript contains a Skill call with input.skill matching the slug", () => {
    const slug = "superslow-eval-1-with_skill__verification-before-completion";
    const invocations: ToolInvocation[] = [
      { name: "Bash", args: { command: "ls" }, ordinal: 0 },
      { name: "Skill", args: { skill: slug }, ordinal: 1 },
      { name: "Read", args: { file_path: "/tmp/x" }, ordinal: 2 },
    ];
    expect(checkSkillInvokedFromTranscript(invocations, slug, null)).toBe(true);
  });

  test("returns false when transcript has no Skill calls", () => {
    const invocations: ToolInvocation[] = [
      { name: "Bash", args: { command: "ls" }, ordinal: 0 },
      { name: "Read", args: { file_path: "/tmp/x" }, ordinal: 1 },
    ];
    expect(
      checkSkillInvokedFromTranscript(
        invocations,
        "superslow-eval-1-with_skill__foo",
        null,
      ),
    ).toBe(false);
  });

  test("returns false when Skill call references a different slug", () => {
    const slug = "superslow-eval-1-with_skill__verification-before-completion";
    const invocations: ToolInvocation[] = [
      {
        name: "Skill",
        args: { skill: "superslow:writing-skills" },
        ordinal: 0,
      },
      {
        name: "Skill",
        args: { skill: "superslow-eval-2-old_skill__other" },
        ordinal: 1,
      },
    ];
    expect(checkSkillInvokedFromTranscript(invocations, slug, null)).toBe(
      false,
    );
  });

  test("returns false on empty invocations array", () => {
    expect(checkSkillInvokedFromTranscript([], "anything", null)).toBe(false);
  });

  test("tolerates Skill invocations whose args are missing or malformed", () => {
    const slug = "superslow-eval-1-with_skill__foo";
    const invocations: ToolInvocation[] = [
      { name: "Skill", ordinal: 0 },
      { name: "Skill", args: "not-an-object", ordinal: 1 },
      { name: "Skill", args: { other: "field" }, ordinal: 2 },
    ];
    expect(checkSkillInvokedFromTranscript(invocations, slug, null)).toBe(
      false,
    );
  });

  test("returns true when transcript contains a view_file call with IsSkillFile matching the skillPath", () => {
    const skillPath = "/Users/user/superslow/skills/writing-plans/SKILL.md";
    const invocations: ToolInvocation[] = [
      { name: "ls", args: {}, ordinal: 0 },
      {
        name: "view_file",
        args: {
          AbsolutePath: "/Users/user/superslow/skills/writing-plans/SKILL.md",
          IsSkillFile: true,
        },
        ordinal: 1,
      },
    ];
    expect(checkSkillInvokedFromTranscript(invocations, null, skillPath)).toBe(
      true,
    );
  });

  test("returns true when transcript contains default_api:view_file call with IsSkillFile matching skill-snapshot.md", () => {
    const skillPath = "/Users/user/superslow/skills/writing-plans/SKILL.md";
    const invocations: ToolInvocation[] = [
      {
        name: "default_api:view_file",
        args: {
          AbsolutePath:
            "/Users/user/superslow/skills-workspace/writing-plans/iteration-1/skill-snapshot.md",
          IsSkillFile: "true",
        },
        ordinal: 0,
      },
    ];
    expect(checkSkillInvokedFromTranscript(invocations, null, skillPath)).toBe(
      true,
    );
  });

  test("returns false when view_file does not have IsSkillFile: true", () => {
    const skillPath = "/Users/user/superslow/skills/writing-plans/SKILL.md";
    const invocations: ToolInvocation[] = [
      {
        name: "view_file",
        args: {
          AbsolutePath: "/Users/user/superslow/skills/writing-plans/SKILL.md",
        },
        ordinal: 0,
      },
    ];
    expect(checkSkillInvokedFromTranscript(invocations, null, skillPath)).toBe(
      false,
    );
  });

  test("returns false when view_file path does not match", () => {
    const skillPath = "/Users/user/superslow/skills/writing-plans/SKILL.md";
    const invocations: ToolInvocation[] = [
      {
        name: "view_file",
        args: {
          AbsolutePath: "/Users/user/superslow/skills/other-skill/SKILL.md",
          IsSkillFile: true,
        },
        ordinal: 0,
      },
    ];
    expect(checkSkillInvokedFromTranscript(invocations, null, skillPath)).toBe(
      false,
    );
  });
});

const GRADE_FIXTURE_ROOT = join(
  tmpdir(),
  `superslow-grade-test-${process.pid}`,
);
const GRADE_TS = join(import.meta.dir, "grade.ts");

beforeAll(() => {
  mkdirSync(GRADE_FIXTURE_ROOT, { recursive: true });
});

afterAll(() => {
  rmSync(GRADE_FIXTURE_ROOT, { recursive: true, force: true });
});

function writeJsonFile(path: string, value: unknown) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

describe("emitJudgeTasks skill-invocation meta-check gating", () => {
  test("omits the skill-invocation meta-check for evals marked skill_should_trigger: false", () => {
    const root = join(GRADE_FIXTURE_ROOT, "negative-eval");
    const skill = "mr-review";
    const skillDir = join(root, "skill-dir");
    const skillSub = join(skillDir, skill);
    mkdirSync(join(skillSub, "evals"), { recursive: true });
    writeFileSync(
      join(skillSub, "SKILL.md"),
      "---\nname: mr-review\ndescription: review MRs\n---\n\nbody\n",
    );
    // Two evals: a positive one (skill should fire) and a negative one
    // (skill should NOT fire — non-invocation is the desired behavior).
    writeJsonFile(join(skillSub, "evals", "evals.json"), {
      skill_name: skill,
      evals: [
        {
          id: "pos-eval",
          prompt: "Fix the failing build.",
          expected_output: "Agent debugs systematically.",
          assertions: [
            { id: "a1", type: "llm_judge", rubric: "Did it debug?" },
          ],
        },
        {
          id: "neg-eval",
          prompt: "Add a --verbose flag.",
          expected_output: "Agent treats it as a feature, no debugging.",
          skill_should_trigger: false,
          assertions: [
            { id: "a2", type: "llm_judge", rubric: "Did it avoid debugging?" },
          ],
        },
      ],
    });

    const cwd = join(root, "work");
    const iterationDir = join(cwd, "skills-workspace", skill, "iteration-1");
    mkdirSync(iterationDir, { recursive: true });
    writeJsonFile(join(iterationDir, "conditions.json"), {
      mode: "new-skill",
      conditions: [
        { name: "with_skill", skill_path: join(skillSub, "SKILL.md") },
        { name: "without_skill", skill_path: null },
      ],
      timestamp: new Date().toISOString(),
      harness: "claude-code",
    });

    for (const evalId of ["pos-eval", "neg-eval"]) {
      for (const cond of ["with_skill", "without_skill"]) {
        const condDir = join(iterationDir, `eval-${evalId}`, cond);
        mkdirSync(condDir, { recursive: true });
        // Empty tool_invocations => meta routed to a judge task (not code-checked).
        writeJsonFile(join(condDir, "run.json"), {
          eval_id: evalId,
          condition: cond,
          skill_path: cond === "with_skill" ? join(skillSub, "SKILL.md") : null,
          prompt: "p",
          files: [],
          final_message: "done",
          tool_invocations: [],
          total_tokens: 100,
          duration_ms: 1000,
        });
      }
    }

    const res = Bun.spawnSync(
      [
        "bun",
        "run",
        GRADE_TS,
        "--skill-dir",
        skillDir,
        "--skill",
        skill,
        "--iteration",
        "1",
      ],
      { cwd, stdout: "pipe", stderr: "pipe" },
    );
    expect(res.exitCode).toBe(0);

    const tasks = JSON.parse(
      readFileSync(join(iterationDir, "judge-tasks.json"), "utf8"),
    ) as { tasks: Array<{ eval_id: string; is_meta: boolean }> };
    const metaTasks = tasks.tasks.filter((t) => t.is_meta);
    // Exactly one meta-check, and only for the positive eval.
    expect(metaTasks.map((t) => t.eval_id)).toEqual(["pos-eval"]);
  });
});
