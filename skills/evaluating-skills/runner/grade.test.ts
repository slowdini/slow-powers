import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
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
    expect(checkSkillInvokedFromTranscript(invocations, slug)).toBe(true);
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
    expect(checkSkillInvokedFromTranscript(invocations, slug)).toBe(false);
  });

  test("returns false on empty invocations array", () => {
    expect(checkSkillInvokedFromTranscript([], "anything")).toBe(false);
  });

  test("tolerates Skill invocations whose args are missing or malformed", () => {
    const slug = "superslow-eval-1-with_skill__foo";
    const invocations: ToolInvocation[] = [
      { name: "Skill", ordinal: 0 },
      { name: "Skill", args: "not-an-object", ordinal: 1 },
      { name: "Skill", args: { other: "field" }, ordinal: 2 },
    ];
    expect(checkSkillInvokedFromTranscript(invocations, slug)).toBe(false);
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

describe("emitJudgeTasks run.json validation", () => {
  test("fails fast with a schema error when a run.json is malformed", () => {
    const root = join(GRADE_FIXTURE_ROOT, "bad-run-record");
    const skill = "mr-review";
    const skillDir = join(root, "skill-dir");
    const skillSub = join(skillDir, skill);
    mkdirSync(join(skillSub, "evals"), { recursive: true });
    writeFileSync(
      join(skillSub, "SKILL.md"),
      "---\nname: mr-review\ndescription: review MRs\n---\n\nbody\n",
    );
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

    for (const cond of ["with_skill", "without_skill"]) {
      const condDir = join(iterationDir, "eval-pos-eval", cond);
      mkdirSync(condDir, { recursive: true });
      // Missing required `final_message` and `files` — must be rejected.
      writeJsonFile(join(condDir, "run.json"), {
        eval_id: "pos-eval",
        condition: cond,
        skill_path: null,
        prompt: "p",
        tool_invocations: [],
      });
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
    expect(res.exitCode).not.toBe(0);
    expect(res.stderr.toString()).toContain("run-record schema");
  });
});

describe("emitJudgeTasks file-pointer dispatch", () => {
  test("writes each judge prompt to a file and drops the inline prompt from judge-tasks.json", () => {
    const root = join(GRADE_FIXTURE_ROOT, "judge-prompt-file");
    const skill = "mr-review";
    const skillDir = join(root, "skill-dir");
    const skillSub = join(skillDir, skill);
    mkdirSync(join(skillSub, "evals"), { recursive: true });
    writeFileSync(
      join(skillSub, "SKILL.md"),
      "---\nname: mr-review\ndescription: review MRs\n---\n\nbody\n",
    );
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

    for (const cond of ["with_skill", "without_skill"]) {
      const condDir = join(iterationDir, "eval-pos-eval", cond);
      mkdirSync(condDir, { recursive: true });
      writeJsonFile(join(condDir, "run.json"), {
        eval_id: "pos-eval",
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
    ) as {
      tasks: Array<{
        assertion_id: string;
        response_path: string;
        dispatch_prompt?: string;
        dispatch_prompt_path: string;
      }>;
    };

    expect(tasks.tasks.length).toBeGreaterThan(0);
    for (const t of tasks.tasks) {
      // Nothing inlined; the orchestrator reads the prompt from a file.
      expect(t.dispatch_prompt).toBeUndefined();
      expect(t.dispatch_prompt_path.endsWith(`${t.assertion_id}.txt`)).toBe(
        true,
      );
      expect(existsSync(t.dispatch_prompt_path)).toBe(true);
      const contents = readFileSync(t.dispatch_prompt_path, "utf8");
      // The judge still learns where to write its verdict from the prompt text.
      expect(contents).toContain(t.response_path);
    }
  });
});
