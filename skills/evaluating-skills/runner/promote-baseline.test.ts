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
import { PROMOTED_MARKER } from "./workspace-teardown";

const FIXTURE_ROOT = join(tmpdir(), `slow-powers-promote-test-${process.pid}`);
const PROMOTE_TS = join(import.meta.dir, "promote-baseline.ts");

beforeAll(() => {
  mkdirSync(FIXTURE_ROOT, { recursive: true });
});

afterAll(() => {
  rmSync(FIXTURE_ROOT, { recursive: true, force: true });
});

function writeJson(path: string, value: unknown) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

describe("promote-baseline.ts (--skill-dir, isolated CWD)", () => {
  test("copies benchmark + per-run gradings into the skill's committed baseline/", () => {
    const root = join(FIXTURE_ROOT, "promote-basic");

    // Skill dir + skill-under-test (detectRunContext validates SKILL.md exists).
    const skillDir = join(root, "skill-dir");
    const skillSub = join(skillDir, "mr-review");
    mkdirSync(skillSub, { recursive: true });
    writeFileSync(
      join(skillSub, "SKILL.md"),
      "---\nname: mr-review\ndescription: review MRs\n---\n\nbody\n",
    );

    // Working dir holding the workspace (mirrors workspaceRoot = <cwd>/skills-workspace).
    const cwd = join(root, "work");
    const iterationDir = join(
      cwd,
      "skills-workspace",
      "mr-review",
      "iteration-2",
    );
    mkdirSync(iterationDir, { recursive: true });

    const timestamp = "2026-05-27T00:00:00.000Z";
    writeJson(join(iterationDir, "conditions.json"), {
      mode: "new-skill",
      conditions: [
        { name: "with_skill", skill_path: join(skillSub, "SKILL.md") },
        { name: "without_skill", skill_path: null },
      ],
      timestamp,
      harness: "claude-code",
    });
    writeJson(join(iterationDir, "benchmark.json"), {
      run_summary: {
        with_skill: { pass_rate: { mean: 0.83 } },
        without_skill: { pass_rate: { mean: 0.33 } },
      },
      delta: { pass_rate: 0.5 },
    });

    const mkGrading = (evalId: string, cond: string, passRate: number) => {
      const condDir = join(iterationDir, `eval-${evalId}`, cond);
      mkdirSync(condDir, { recursive: true });
      writeJson(join(condDir, "grading.json"), {
        assertion_results: [
          {
            id: "a1",
            passed: passRate > 0,
            evidence: `${cond} evidence`,
            confidence: 1,
          },
        ],
        summary: { passed: 1, failed: 0, total: 1, pass_rate: passRate },
      });
    };
    mkGrading("e1", "with_skill", 1);
    mkGrading("e1", "without_skill", 0);

    const res = Bun.spawnSync(
      [
        "bun",
        "run",
        PROMOTE_TS,
        "--skill-dir",
        skillDir,
        "--skill",
        "mr-review",
        "--iteration",
        "2",
      ],
      { cwd, stdout: "pipe", stderr: "pipe" },
    );
    expect(res.stderr.toString()).toBe("");
    expect(res.exitCode).toBe(0);

    const baselineDir = join(skillSub, "evals", "baseline");

    // benchmark.json copied verbatim.
    const benchmarkPath = join(baselineDir, "benchmark.json");
    expect(existsSync(benchmarkPath)).toBe(true);
    const benchmark = JSON.parse(readFileSync(benchmarkPath, "utf8")) as {
      delta: { pass_rate: number };
    };
    expect(benchmark.delta.pass_rate).toBe(0.5);

    // Per-run gradings copied under grading/<eval-id>__<condition>.json.
    const withGrading = join(baselineDir, "grading", "e1__with_skill.json");
    const withoutGrading = join(
      baselineDir,
      "grading",
      "e1__without_skill.json",
    );
    expect(existsSync(withGrading)).toBe(true);
    expect(existsSync(withoutGrading)).toBe(true);
    const withParsed = JSON.parse(readFileSync(withGrading, "utf8")) as {
      summary: { pass_rate: number };
    };
    expect(withParsed.summary.pass_rate).toBe(1);

    // Provenance file records mode, iteration, harness, timestamp.
    const provenancePath = join(baselineDir, "BASELINE.md");
    expect(existsSync(provenancePath)).toBe(true);
    const provenance = readFileSync(provenancePath, "utf8");
    expect(provenance).toContain("new-skill");
    expect(provenance).toContain("iteration-2");
    expect(provenance).toContain("claude-code");
    expect(provenance).toContain(timestamp);
    // Model rows default to "unspecified" when no flags are passed.
    expect(provenance).toContain("Agent model | unspecified");
    expect(provenance).toContain("Judge model | unspecified");
  });

  test("drops a .promoted.json marker into the iteration dir for teardown", () => {
    const root = join(FIXTURE_ROOT, "promote-marker");

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
      "iteration-3",
    );
    mkdirSync(iterationDir, { recursive: true });
    writeJson(join(iterationDir, "benchmark.json"), {
      delta: { pass_rate: 0 },
    });

    const res = Bun.spawnSync(
      [
        "bun",
        "run",
        PROMOTE_TS,
        "--skill-dir",
        skillDir,
        "--skill",
        "mr-review",
        "--iteration",
        "3",
      ],
      { cwd, stdout: "pipe", stderr: "pipe" },
    );
    expect(res.stderr.toString()).toBe("");
    expect(res.exitCode).toBe(0);

    const markerPath = join(iterationDir, PROMOTED_MARKER);
    expect(existsSync(markerPath)).toBe(true);
    const marker = JSON.parse(readFileSync(markerPath, "utf8")) as {
      promoted_at: string;
      baseline_dir: string;
    };
    expect(marker.promoted_at).toBeTruthy();
    expect(marker.baseline_dir).toBe(join(skillSub, "evals", "baseline"));
  });

  test("records agent and judge models in provenance when flags are passed", () => {
    const root = join(FIXTURE_ROOT, "promote-models");

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
      timestamp: "2026-05-27T00:00:00.000Z",
      harness: "claude-code",
    });
    writeJson(join(iterationDir, "benchmark.json"), {
      delta: { pass_rate: 0 },
    });

    const res = Bun.spawnSync(
      [
        "bun",
        "run",
        PROMOTE_TS,
        "--skill-dir",
        skillDir,
        "--skill",
        "mr-review",
        "--iteration",
        "1",
        "--agent-model",
        "claude-haiku-4-5-20251001",
        "--judge-model",
        "claude-opus-4-7",
      ],
      { cwd, stdout: "pipe", stderr: "pipe" },
    );
    expect(res.stderr.toString()).toBe("");
    expect(res.exitCode).toBe(0);

    const provenance = readFileSync(
      join(skillSub, "evals", "baseline", "BASELINE.md"),
      "utf8",
    );
    expect(provenance).toContain("Agent model | claude-haiku-4-5-20251001");
    expect(provenance).toContain("Judge model | claude-opus-4-7");
  });

  test("fails clearly when the iteration directory is missing", () => {
    const root = join(FIXTURE_ROOT, "promote-missing");
    const skillDir = join(root, "skill-dir");
    const skillSub = join(skillDir, "mr-review");
    mkdirSync(skillSub, { recursive: true });
    writeFileSync(
      join(skillSub, "SKILL.md"),
      "---\nname: mr-review\ndescription: review MRs\n---\n\nbody\n",
    );
    const cwd = join(root, "work");
    mkdirSync(cwd, { recursive: true });

    const res = Bun.spawnSync(
      [
        "bun",
        "run",
        PROMOTE_TS,
        "--skill-dir",
        skillDir,
        "--skill",
        "mr-review",
        "--iteration",
        "9",
      ],
      { cwd, stdout: "pipe", stderr: "pipe" },
    );
    expect(res.exitCode).not.toBe(0);
    expect(res.stderr.toString()).toContain("iteration-9");
  });
});
