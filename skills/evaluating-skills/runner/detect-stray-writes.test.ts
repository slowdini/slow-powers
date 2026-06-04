import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { detectStrayWrites } from "./detect-stray-writes";

const OUTPUTS = "/work/iteration-1/eval-x/with_skill/outputs";
const REPO = "/work/repo";

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
