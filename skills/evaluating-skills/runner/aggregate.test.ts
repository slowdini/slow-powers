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

const FIXTURE_ROOT = join(
  tmpdir(),
  `slow-powers-aggregate-test-${process.pid}`,
);
const AGGREGATE_TS = join(import.meta.dir, "aggregate.ts");

beforeAll(() => {
  mkdirSync(FIXTURE_ROOT, { recursive: true });
});

afterAll(() => {
  rmSync(FIXTURE_ROOT, { recursive: true, force: true });
});

function writeJson(path: string, value: unknown) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

describe("aggregate.ts user-mode (--skill-dir, isolated CWD)", () => {
  test("computes benchmark.json from a hand-built graded workspace under CWD", () => {
    const root = join(FIXTURE_ROOT, "agg-basic");
    // Skill dir + skill-under-test (detectRunContext validates SKILL.md exists)
    const skillDir = join(root, "skill-dir");
    const skillSub = join(skillDir, "mr-review");
    mkdirSync(skillSub, { recursive: true });
    writeFileSync(
      join(skillSub, "SKILL.md"),
      "---\nname: mr-review\ndescription: review MRs\n---\n\nbody\n",
    );

    // Working dir that holds the workspace (mirrors stageRoot/workspaceRoot = CWD)
    const cwd = join(root, "work");
    const iterationDir = join(
      cwd,
      "skills-workspace",
      "mr-review",
      "iteration-1",
    );
    mkdirSync(iterationDir, { recursive: true });
    writeJson(join(iterationDir, "conditions.json"), {
      mode: "new-skill",
      conditions: [
        { name: "with_skill", skill_path: join(skillSub, "SKILL.md") },
        { name: "without_skill", skill_path: null },
      ],
      timestamp: new Date().toISOString(),
      harness: "claude-code",
    });

    const mkCond = (cond: string, passRate: number, tokens: number) => {
      const condDir = join(iterationDir, "eval-e1", cond);
      mkdirSync(condDir, { recursive: true });
      writeJson(join(condDir, "grading.json"), {
        assertion_results: [],
        summary: { passed: 1, failed: 0, total: 1, pass_rate: passRate },
      });
      writeJson(join(condDir, "timing.json"), {
        total_tokens: tokens,
        duration_ms: 1000,
      });
    };
    mkCond("with_skill", 1, 5000);
    mkCond("without_skill", 0, 3000);

    const res = Bun.spawnSync(
      [
        "bun",
        "run",
        AGGREGATE_TS,
        "--skill-dir",
        skillDir,
        "--skill",
        "mr-review",
        "--iteration",
        "1",
      ],
      { cwd, stdout: "pipe", stderr: "pipe" },
    );
    expect(res.exitCode).toBe(0);

    const benchmarkPath = join(iterationDir, "benchmark.json");
    expect(existsSync(benchmarkPath)).toBe(true);
    const benchmark = JSON.parse(readFileSync(benchmarkPath, "utf8")) as {
      delta: { pass_rate: number; total_tokens: number };
      run_summary: Record<string, { pass_rate: { mean: number } }>;
    };
    expect(benchmark.run_summary.with_skill.pass_rate.mean).toBe(1);
    expect(benchmark.run_summary.without_skill.pass_rate.mean).toBe(0);
    expect(benchmark.delta.pass_rate).toBe(1);
    expect(benchmark.delta.total_tokens).toBe(2000);
  });

  test("surfaces stray-writes violations as validity_warnings", () => {
    const root = join(FIXTURE_ROOT, "agg-stray");
    const skillDir = join(root, "skill-dir");
    const skillSub = join(skillDir, "mr-review");
    mkdirSync(skillSub, { recursive: true });
    writeFileSync(
      join(skillSub, "SKILL.md"),
      "---\nname: mr-review\ndescription: review MRs\n---\n\nbody\n",
    );

    const cwd = join(root, "work");
    const iterationDir = join(
      cwd,
      "skills-workspace",
      "mr-review",
      "iteration-1",
    );
    mkdirSync(iterationDir, { recursive: true });
    writeJson(join(iterationDir, "conditions.json"), {
      mode: "new-skill",
      conditions: [
        { name: "with_skill", skill_path: join(skillSub, "SKILL.md") },
        { name: "without_skill", skill_path: null },
      ],
      timestamp: new Date().toISOString(),
      harness: "claude-code",
    });
    for (const cond of ["with_skill", "without_skill"]) {
      const condDir = join(iterationDir, "eval-e1", cond);
      mkdirSync(condDir, { recursive: true });
      writeJson(join(condDir, "grading.json"), {
        assertion_results: [],
        summary: { passed: 1, failed: 0, total: 1, pass_rate: 1 },
      });
      writeJson(join(condDir, "timing.json"), {
        total_tokens: 100,
        duration_ms: 1,
      });
    }
    writeJson(join(iterationDir, "stray-writes.json"), {
      generated: new Date().toISOString(),
      iteration: 1,
      totals: { violations: 1, warnings: 0 },
      runs: [
        {
          eval_id: "e1",
          condition: "with_skill",
          violations: [
            {
              tool: "Write",
              path: "/repo/runner/run.ts",
              ordinal: 3,
              reason: "x",
            },
          ],
          warnings: [],
        },
      ],
    });

    const res = Bun.spawnSync(
      [
        "bun",
        "run",
        AGGREGATE_TS,
        "--skill-dir",
        skillDir,
        "--skill",
        "mr-review",
        "--iteration",
        "1",
      ],
      { cwd, stdout: "pipe", stderr: "pipe" },
    );
    expect(res.exitCode).toBe(0);
    const benchmark = JSON.parse(
      readFileSync(join(iterationDir, "benchmark.json"), "utf8"),
    ) as { validity_warnings: string[] };
    expect(
      benchmark.validity_warnings.some(
        (w) => w.includes("e1/with_skill") && w.includes("outside"),
      ),
    ).toBe(true);
  });

  test("surfaces live-source reads as validity_warnings", () => {
    const root = join(FIXTURE_ROOT, "agg-live-reads");
    const skillDir = join(root, "skill-dir");
    const skillSub = join(skillDir, "mr-review");
    mkdirSync(skillSub, { recursive: true });
    writeFileSync(
      join(skillSub, "SKILL.md"),
      "---\nname: mr-review\ndescription: review MRs\n---\n\nbody\n",
    );

    const cwd = join(root, "work");
    const iterationDir = join(
      cwd,
      "skills-workspace",
      "mr-review",
      "iteration-1",
    );
    mkdirSync(iterationDir, { recursive: true });
    writeJson(join(iterationDir, "conditions.json"), {
      mode: "revision",
      conditions: [
        { name: "old_skill", skill_path: join(skillSub, "SKILL.md") },
        { name: "new_skill", skill_path: join(skillSub, "SKILL.md") },
      ],
      timestamp: new Date().toISOString(),
      harness: "claude-code",
    });
    for (const cond of ["old_skill", "new_skill"]) {
      const condDir = join(iterationDir, "eval-e1", cond);
      mkdirSync(condDir, { recursive: true });
      writeJson(join(condDir, "grading.json"), {
        assertion_results: [],
        summary: { passed: 1, failed: 0, total: 1, pass_rate: 1 },
      });
      writeJson(join(condDir, "timing.json"), {
        total_tokens: 100,
        duration_ms: 1,
      });
    }
    writeJson(join(iterationDir, "stray-writes.json"), {
      generated: new Date().toISOString(),
      iteration: 1,
      totals: { violations: 0, warnings: 0, live_source_reads: 1 },
      runs: [
        {
          eval_id: "e1",
          condition: "old_skill",
          violations: [],
          warnings: [],
          live_source_reads: [
            {
              tool: "Read",
              path: join(skillSub, "SKILL.md"),
              ordinal: 0,
              reason: "x",
            },
          ],
        },
      ],
    });

    const res = Bun.spawnSync(
      [
        "bun",
        "run",
        AGGREGATE_TS,
        "--skill-dir",
        skillDir,
        "--skill",
        "mr-review",
        "--iteration",
        "1",
      ],
      { cwd, stdout: "pipe", stderr: "pipe" },
    );
    expect(res.exitCode).toBe(0);
    const benchmark = JSON.parse(
      readFileSync(join(iterationDir, "benchmark.json"), "utf8"),
    ) as { validity_warnings: string[] };
    expect(
      benchmark.validity_warnings.some(
        (w) => w.includes("e1/old_skill") && /live skill source/i.test(w),
      ),
    ).toBe(true);
  });

  test("warns when timing sources are mixed across the compared runs", () => {
    const root = join(FIXTURE_ROOT, "agg-mixed-timing");
    const skillDir = join(root, "skill-dir");
    const skillSub = join(skillDir, "mr-review");
    mkdirSync(skillSub, { recursive: true });
    writeFileSync(
      join(skillSub, "SKILL.md"),
      "---\nname: mr-review\ndescription: review MRs\n---\n\nbody\n",
    );

    const cwd = join(root, "work");
    const iterationDir = join(
      cwd,
      "skills-workspace",
      "mr-review",
      "iteration-1",
    );
    mkdirSync(iterationDir, { recursive: true });
    writeJson(join(iterationDir, "conditions.json"), {
      mode: "new-skill",
      conditions: [
        { name: "with_skill", skill_path: join(skillSub, "SKILL.md") },
        { name: "without_skill", skill_path: null },
      ],
      timestamp: new Date().toISOString(),
      harness: "claude-code",
    });
    // One arm has agent-captured completion-event timing (no source field, the
    // pre-provenance shape); the other was backfilled from the transcript.
    const mkCond = (cond: string, timing: unknown) => {
      const condDir = join(iterationDir, "eval-e1", cond);
      mkdirSync(condDir, { recursive: true });
      writeJson(join(condDir, "grading.json"), {
        assertion_results: [],
        summary: { passed: 1, failed: 0, total: 1, pass_rate: 1 },
      });
      writeJson(join(condDir, "timing.json"), timing);
    };
    mkCond("with_skill", { total_tokens: 5000, duration_ms: 1000 });
    mkCond("without_skill", {
      total_tokens: 90000,
      duration_ms: 1200,
      source: "transcript",
    });

    const res = Bun.spawnSync(
      [
        "bun",
        "run",
        AGGREGATE_TS,
        "--skill-dir",
        skillDir,
        "--skill",
        "mr-review",
        "--iteration",
        "1",
      ],
      { cwd, stdout: "pipe", stderr: "pipe" },
    );
    expect(res.exitCode).toBe(0);
    const benchmark = JSON.parse(
      readFileSync(join(iterationDir, "benchmark.json"), "utf8"),
    ) as { validity_warnings: string[] };
    expect(
      benchmark.validity_warnings.some(
        (w) => w.includes("timing source") && w.includes("transcript"),
      ),
    ).toBe(true);
  });

  test("does not warn when all timing comes from one source", () => {
    const root = join(FIXTURE_ROOT, "agg-same-timing");
    const skillDir = join(root, "skill-dir");
    const skillSub = join(skillDir, "mr-review");
    mkdirSync(skillSub, { recursive: true });
    writeFileSync(
      join(skillSub, "SKILL.md"),
      "---\nname: mr-review\ndescription: review MRs\n---\n\nbody\n",
    );

    const cwd = join(root, "work");
    const iterationDir = join(
      cwd,
      "skills-workspace",
      "mr-review",
      "iteration-1",
    );
    mkdirSync(iterationDir, { recursive: true });
    writeJson(join(iterationDir, "conditions.json"), {
      mode: "new-skill",
      conditions: [
        { name: "with_skill", skill_path: join(skillSub, "SKILL.md") },
        { name: "without_skill", skill_path: null },
      ],
      timestamp: new Date().toISOString(),
      harness: "claude-code",
    });
    for (const cond of ["with_skill", "without_skill"]) {
      const condDir = join(iterationDir, "eval-e1", cond);
      mkdirSync(condDir, { recursive: true });
      writeJson(join(condDir, "grading.json"), {
        assertion_results: [],
        summary: { passed: 1, failed: 0, total: 1, pass_rate: 1 },
      });
      writeJson(join(condDir, "timing.json"), {
        total_tokens: 100,
        duration_ms: 1,
        source: "transcript",
      });
    }

    const res = Bun.spawnSync(
      [
        "bun",
        "run",
        AGGREGATE_TS,
        "--skill-dir",
        skillDir,
        "--skill",
        "mr-review",
        "--iteration",
        "1",
      ],
      { cwd, stdout: "pipe", stderr: "pipe" },
    );
    expect(res.exitCode).toBe(0);
    const benchmark = JSON.parse(
      readFileSync(join(iterationDir, "benchmark.json"), "utf8"),
    ) as { validity_warnings: string[] };
    expect(
      benchmark.validity_warnings.some((w) => w.includes("timing source")),
    ).toBe(false);
  });

  test("surfaces plugin-shadow findings as validity_warnings", () => {
    const root = join(FIXTURE_ROOT, "agg-shadow");
    const skillDir = join(root, "skill-dir");
    const skillSub = join(skillDir, "mr-review");
    mkdirSync(skillSub, { recursive: true });
    writeFileSync(
      join(skillSub, "SKILL.md"),
      "---\nname: mr-review\ndescription: review MRs\n---\n\nbody\n",
    );

    const cwd = join(root, "work");
    const iterationDir = join(
      cwd,
      "skills-workspace",
      "mr-review",
      "iteration-1",
    );
    mkdirSync(iterationDir, { recursive: true });
    writeJson(join(iterationDir, "conditions.json"), {
      mode: "new-skill",
      conditions: [
        { name: "with_skill", skill_path: join(skillSub, "SKILL.md") },
        { name: "without_skill", skill_path: null },
      ],
      timestamp: new Date().toISOString(),
      harness: "claude-code",
    });
    for (const cond of ["with_skill", "without_skill"]) {
      const condDir = join(iterationDir, "eval-e1", cond);
      mkdirSync(condDir, { recursive: true });
      writeJson(join(condDir, "grading.json"), {
        assertion_results: [],
        summary: { passed: 1, failed: 0, total: 1, pass_rate: 1 },
      });
      writeJson(join(condDir, "timing.json"), {
        total_tokens: 100,
        duration_ms: 1,
      });
    }
    writeJson(join(iterationDir, "plugin-shadow.json"), {
      config_dir: "/home/u/.claude",
      shadowed: [
        {
          kind: "plugin",
          plugin: "slow-powers@slowdini",
          skill_name: "mr-review",
          path: "/home/u/.claude/plugins/cache/slowdini/slow-powers/skills/mr-review",
        },
      ],
    });

    const res = Bun.spawnSync(
      [
        "bun",
        "run",
        AGGREGATE_TS,
        "--skill-dir",
        skillDir,
        "--skill",
        "mr-review",
        "--iteration",
        "1",
      ],
      { cwd, stdout: "pipe", stderr: "pipe" },
    );
    expect(res.exitCode).toBe(0);
    const benchmark = JSON.parse(
      readFileSync(join(iterationDir, "benchmark.json"), "utf8"),
    ) as { validity_warnings: string[] };
    expect(
      benchmark.validity_warnings.some(
        (w) => w.includes("mr-review") && /contaminat/i.test(w),
      ),
    ).toBe(true);
  });
});
