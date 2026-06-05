import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import {
  mkdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  detectLiveSourceReads,
  detectStrayWrites,
} from "./detect-stray-writes";

const OUTPUTS = "/work/iteration-1/eval-x/with_skill/outputs";
const REPO = "/work/repo";
const LIVE_SKILL = join(REPO, "skills", "mr-review");

describe("detectStrayWrites", () => {
  test("a Write inside the outputs dir is clean", () => {
    const findings = detectStrayWrites(
      [
        {
          name: "Write",
          args: { file_path: join(OUTPUTS, "answer.md") },
          ordinal: 0,
        },
      ],
      OUTPUTS,
      REPO,
    );
    expect(findings.violations).toHaveLength(0);
    expect(findings.warnings).toHaveLength(0);
  });

  test("a Write outside the outputs dir is a violation", () => {
    const findings = detectStrayWrites(
      [
        {
          name: "Write",
          args: { file_path: join(REPO, "runner/run.ts") },
          ordinal: 2,
        },
      ],
      OUTPUTS,
      REPO,
    );
    expect(findings.violations).toHaveLength(1);
    expect(findings.violations[0]).toMatchObject({
      tool: "Write",
      path: join(REPO, "runner/run.ts"),
      ordinal: 2,
    });
  });

  test("an Edit/MultiEdit/NotebookEdit outside outputs is a violation", () => {
    const findings = detectStrayWrites(
      [
        { name: "Edit", args: { file_path: "/etc/hosts" }, ordinal: 0 },
        {
          name: "NotebookEdit",
          args: { notebook_path: "/tmp/x.ipynb" },
          ordinal: 1,
        },
      ],
      OUTPUTS,
      REPO,
    );
    expect(findings.violations.map((v) => v.tool).sort()).toEqual([
      "Edit",
      "NotebookEdit",
    ]);
  });

  test("an install command is a warning", () => {
    const findings = detectStrayWrites(
      [{ name: "Bash", args: { command: "npm install left-pad" }, ordinal: 0 }],
      OUTPUTS,
      REPO,
    );
    expect(findings.warnings).toHaveLength(1);
    expect(findings.warnings[0].tool).toBe("Bash");
    expect(findings.warnings[0].reason).toMatch(/install/i);
  });

  test("a mutating Bash command scoped to the outputs dir is not flagged", () => {
    const findings = detectStrayWrites(
      [
        {
          name: "Bash",
          args: { command: `echo hi > ${join(OUTPUTS, "log.txt")}` },
          ordinal: 0,
        },
      ],
      OUTPUTS,
      REPO,
    );
    expect(findings.warnings).toHaveLength(0);
  });

  test("git worktree add is a warning (working tree outside the sandbox)", () => {
    const findings = detectStrayWrites(
      [
        {
          name: "Bash",
          args: { command: "git worktree add ../wt -b scratch" },
          ordinal: 0,
        },
      ],
      OUTPUTS,
      REPO,
    );
    expect(findings.warnings).toHaveLength(1);
    expect(findings.warnings[0].reason).toMatch(/worktree/i);
  });

  test("creating a path under .claude is a warning", () => {
    const findings = detectStrayWrites(
      [{ name: "Bash", args: { command: "mkdir -p .claude/foo" }, ordinal: 0 }],
      OUTPUTS,
      REPO,
    );
    expect(findings.warnings).toHaveLength(1);
    expect(findings.warnings[0].reason).toMatch(/\.claude/i);
  });

  test("read-only tools are never flagged", () => {
    const findings = detectStrayWrites(
      [
        { name: "Read", args: { file_path: "/anywhere" }, ordinal: 0 },
        { name: "Grep", args: { pattern: "x" }, ordinal: 1 },
        { name: "Bash", args: { command: "ls -la /" }, ordinal: 2 },
      ],
      OUTPUTS,
      REPO,
    );
    expect(findings.violations).toHaveLength(0);
    expect(findings.warnings).toHaveLength(0);
  });
});

describe("detectLiveSourceReads", () => {
  test("a Read of the live SKILL.md is flagged", () => {
    const findings = detectLiveSourceReads(
      [
        {
          name: "Read",
          args: { file_path: join(LIVE_SKILL, "SKILL.md") },
          ordinal: 1,
        },
      ],
      LIVE_SKILL,
      REPO,
    );
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      tool: "Read",
      path: join(LIVE_SKILL, "SKILL.md"),
      ordinal: 1,
    });
    expect(findings[0].reason).toMatch(/live skill source/i);
  });

  test("a Read of a staged eval copy is not flagged", () => {
    const findings = detectLiveSourceReads(
      [
        {
          name: "Read",
          args: {
            file_path: join(
              REPO,
              ".claude/skills/slow-powers-eval-1-old_skill__mr-review/SKILL.md",
            ),
          },
          ordinal: 0,
        },
      ],
      LIVE_SKILL,
      REPO,
    );
    expect(findings).toHaveLength(0);
  });

  test("a relative Read path resolving under the live dir is flagged", () => {
    const findings = detectLiveSourceReads(
      [
        {
          name: "Read",
          args: { file_path: "skills/mr-review/SKILL.md" },
          ordinal: 0,
        },
      ],
      LIVE_SKILL,
      REPO,
    );
    expect(findings).toHaveLength(1);
  });

  test("a Grep scoped to the live dir is flagged", () => {
    const findings = detectLiveSourceReads(
      [{ name: "Grep", args: { pattern: "x", path: LIVE_SKILL }, ordinal: 2 }],
      LIVE_SKILL,
      REPO,
    );
    expect(findings).toHaveLength(1);
    expect(findings[0].tool).toBe("Grep");
  });

  test("a Bash command referencing the live dir relatively is flagged", () => {
    const findings = detectLiveSourceReads(
      [
        {
          name: "Bash",
          args: { command: "cat skills/mr-review/SKILL.md" },
          ordinal: 3,
        },
      ],
      LIVE_SKILL,
      REPO,
    );
    expect(findings).toHaveLength(1);
    expect(findings[0].tool).toBe("Bash");
    expect(findings[0].command).toBe("cat skills/mr-review/SKILL.md");
  });

  test("a Bash command referencing the live dir absolutely is flagged", () => {
    const findings = detectLiveSourceReads(
      [
        {
          name: "Bash",
          args: { command: `grep -r trigger ${LIVE_SKILL}/` },
          ordinal: 0,
        },
      ],
      LIVE_SKILL,
      REPO,
    );
    expect(findings).toHaveLength(1);
  });

  test("a Bash command referencing a staged copy under .claude/skills is not flagged", () => {
    // --stage-name can stage under the skill's natural name; that path contains
    // `skills/<name>` but lives under `.claude/`, so it must not match.
    const findings = detectLiveSourceReads(
      [
        {
          name: "Bash",
          args: { command: "cat .claude/skills/mr-review/SKILL.md" },
          ordinal: 0,
        },
      ],
      LIVE_SKILL,
      REPO,
    );
    expect(findings).toHaveLength(0);
  });

  test("unrelated reads and commands are not flagged", () => {
    const findings = detectLiveSourceReads(
      [
        {
          name: "Read",
          args: { file_path: join(OUTPUTS, "x.md") },
          ordinal: 0,
        },
        { name: "Bash", args: { command: "ls skills-workspace" }, ordinal: 1 },
        {
          name: "Write",
          args: { file_path: join(LIVE_SKILL, "SKILL.md") },
          ordinal: 2,
        },
      ],
      LIVE_SKILL,
      REPO,
    );
    // Write tools are detectStrayWrites' jurisdiction — this check is reads only.
    expect(findings).toHaveLength(0);
  });
});

describe("detect-stray-writes CLI", () => {
  // realpath: the spawned CLI sees its cwd resolved (macOS /var → /private/var),
  // so fixture paths must match that form for prefix checks to line up.
  const FIXTURE_ROOT = join(
    realpathSync(tmpdir()),
    `slow-powers-detect-stray-test-${process.pid}`,
  );
  const SCRIPT = join(import.meta.dir, "detect-stray-writes.ts");

  beforeAll(() => {
    mkdirSync(FIXTURE_ROOT, { recursive: true });
  });

  afterAll(() => {
    rmSync(FIXTURE_ROOT, { recursive: true, force: true });
  });

  test("reports live-source reads per run in stray-writes.json", () => {
    const root = join(FIXTURE_ROOT, "cli-live-reads");
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
    const condDir = join(iterationDir, "eval-e1", "old_skill");
    mkdirSync(condDir, { recursive: true });
    writeFileSync(
      join(iterationDir, "conditions.json"),
      `${JSON.stringify({
        mode: "revision",
        conditions: [
          { name: "old_skill", skill_path: join(skillSub, "SKILL.md") },
          { name: "new_skill", skill_path: join(skillSub, "SKILL.md") },
        ],
        timestamp: new Date().toISOString(),
        harness: "claude-code",
      })}\n`,
    );
    writeFileSync(
      join(condDir, "run.json"),
      `${JSON.stringify({
        eval_id: "e1",
        condition: "old_skill",
        skill_path: join(skillSub, "SKILL.md"),
        prompt: "do the task",
        files: [],
        final_message: "done",
        tool_invocations: [
          {
            name: "Read",
            args: { file_path: join(skillSub, "SKILL.md") },
            ordinal: 0,
          },
          {
            name: "Write",
            args: { file_path: join(condDir, "outputs", "answer.md") },
            ordinal: 1,
          },
        ],
      })}\n`,
    );

    const res = Bun.spawnSync(
      [
        "bun",
        "run",
        SCRIPT,
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

    const report = JSON.parse(
      readFileSync(join(iterationDir, "stray-writes.json"), "utf8"),
    ) as {
      totals: {
        violations: number;
        warnings: number;
        live_source_reads: number;
      };
      runs: Array<{
        eval_id: string;
        condition: string;
        live_source_reads: Array<{ tool: string; path?: string }>;
      }>;
    };
    expect(report.totals.live_source_reads).toBe(1);
    expect(report.totals.violations).toBe(0);
    expect(report.runs).toHaveLength(1);
    expect(report.runs[0]).toMatchObject({
      eval_id: "e1",
      condition: "old_skill",
    });
    expect(report.runs[0].live_source_reads[0]).toMatchObject({
      tool: "Read",
      path: join(skillSub, "SKILL.md"),
    });
  });
});
