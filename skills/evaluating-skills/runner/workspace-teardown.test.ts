import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  cleanupWorkspace,
  PROMOTED_MARKER,
  SNAPSHOT_META,
} from "./workspace-teardown";

const FIXTURE_ROOT = join(
  tmpdir(),
  `slow-powers-workspace-teardown-test-${process.pid}`,
);

beforeAll(() => {
  mkdirSync(FIXTURE_ROOT, { recursive: true });
});

afterAll(() => {
  rmSync(FIXTURE_ROOT, { recursive: true, force: true });
});

let caseSeq = 0;
function freshWorkspace(): string {
  caseSeq += 1;
  const workspaceRoot = join(
    FIXTURE_ROOT,
    `case-${caseSeq}`,
    "skills-workspace",
  );
  mkdirSync(workspaceRoot, { recursive: true });
  return workspaceRoot;
}

function writeJson(path: string, value: unknown) {
  mkdirSync(join(path, ".."), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

/** Build an iteration dir; `opts` controls which artifacts it carries. */
function makeIteration(
  workspaceRoot: string,
  skill: string,
  iteration: string,
  opts: {
    promoted?: boolean;
    benchmark?: boolean;
    runRecord?: boolean;
    grading?: boolean;
    scaffoldingOnly?: boolean;
  },
): string {
  const dir = join(workspaceRoot, skill, iteration);
  mkdirSync(dir, { recursive: true });
  if (opts.scaffoldingOnly) {
    writeFileSync(join(dir, "dispatch.json"), "[]\n");
  }
  if (opts.benchmark) {
    writeJson(join(dir, "benchmark.json"), { delta: { pass_rate: 0.5 } });
  }
  if (opts.runRecord) {
    writeJson(join(dir, "eval-e1", "with_skill", "run.json"), {
      eval_id: "e1",
    });
  }
  if (opts.grading) {
    writeJson(join(dir, "eval-e1", "with_skill", "grading.json"), {
      summary: { pass_rate: 1 },
    });
  }
  if (opts.promoted) {
    writeJson(join(dir, PROMOTED_MARKER), {
      promoted_at: "2026-06-04T00:00:00.000Z",
      baseline_dir: "/somewhere/evals/baseline",
      commit: "abc1234",
    });
  }
  return dir;
}

function makeSnapshot(
  workspaceRoot: string,
  skill: string,
  label: string,
  source: "ref" | "working-tree" | null,
): string {
  const dir = join(workspaceRoot, skill, "snapshots", label);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "SKILL.md"), "snapshot body\n");
  if (source !== null) {
    writeJson(
      join(dir, SNAPSHOT_META),
      source === "ref" ? { source, ref: "HEAD~1" } : { source },
    );
  }
  return dir;
}

describe("cleanupWorkspace — iterations", () => {
  test("removes a promoted iteration and prunes the emptied workspace", () => {
    const ws = freshWorkspace();
    const iter = makeIteration(ws, "mr-review", "iteration-1", {
      promoted: true,
      benchmark: true,
      grading: true,
    });

    const summary = cleanupWorkspace(ws, "mr-review");

    expect(existsSync(iter)).toBe(false);
    expect(summary.removedIterations).toEqual(["iteration-1"]);
    expect(summary.workspaceRemoved).toBe(true);
    // Skill dir and the workspace root are pruned once empty.
    expect(existsSync(join(ws, "mr-review"))).toBe(false);
    expect(existsSync(ws)).toBe(false);
  });

  test("keeps an unpromoted iteration that holds a benchmark, and reports it", () => {
    const ws = freshWorkspace();
    const iter = makeIteration(ws, "mr-review", "iteration-1", {
      benchmark: true,
    });

    const summary = cleanupWorkspace(ws, "mr-review");

    expect(existsSync(iter)).toBe(true);
    expect(summary.removedIterations).toEqual([]);
    expect(summary.keptIterations.map((k) => k.iteration)).toEqual([
      "iteration-1",
    ]);
    // Nothing was emptied, so the workspace stays.
    expect(existsSync(ws)).toBe(true);
  });

  test("keeps an unpromoted iteration that holds only a run record", () => {
    const ws = freshWorkspace();
    const iter = makeIteration(ws, "mr-review", "iteration-1", {
      runRecord: true,
    });

    const summary = cleanupWorkspace(ws, "mr-review");

    expect(existsSync(iter)).toBe(true);
    expect(summary.keptIterations.map((k) => k.iteration)).toEqual([
      "iteration-1",
    ]);
  });

  test("removes an unpromoted scaffolding-only iteration (no captured results)", () => {
    const ws = freshWorkspace();
    const iter = makeIteration(ws, "mr-review", "iteration-1", {
      scaffoldingOnly: true,
    });

    const summary = cleanupWorkspace(ws, "mr-review");

    expect(existsSync(iter)).toBe(false);
    expect(summary.removedIterations).toEqual(["iteration-1"]);
  });

  test("mixed: promoted removed, unpromoted-with-results kept, skill dir NOT pruned", () => {
    const ws = freshWorkspace();
    const promoted = makeIteration(ws, "mr-review", "iteration-1", {
      promoted: true,
      benchmark: true,
    });
    const kept = makeIteration(ws, "mr-review", "iteration-2", {
      benchmark: true,
    });

    const summary = cleanupWorkspace(ws, "mr-review");

    expect(existsSync(promoted)).toBe(false);
    expect(existsSync(kept)).toBe(true);
    expect(summary.removedIterations).toEqual(["iteration-1"]);
    expect(summary.keptIterations.map((k) => k.iteration)).toEqual([
      "iteration-2",
    ]);
    expect(summary.workspaceRemoved).toBe(false);
    expect(existsSync(join(ws, "mr-review"))).toBe(true);
  });
});

describe("cleanupWorkspace — snapshots", () => {
  test("removes ref snapshots, keeps working-tree and legacy (no-meta) snapshots", () => {
    const ws = freshWorkspace();
    const refSnap = makeSnapshot(ws, "mr-review", "old-ref", "ref");
    const wtSnap = makeSnapshot(ws, "mr-review", "wt", "working-tree");
    const legacySnap = makeSnapshot(ws, "mr-review", "legacy", null);

    const summary = cleanupWorkspace(ws, "mr-review");

    expect(existsSync(refSnap)).toBe(false);
    expect(existsSync(wtSnap)).toBe(true);
    expect(existsSync(legacySnap)).toBe(true);
    expect(summary.removedSnapshots).toEqual(["old-ref"]);
    expect(summary.keptSnapshots.sort()).toEqual(["legacy", "wt"]);
  });
});

describe("cleanupWorkspace — safety", () => {
  test("never touches another skill's workspace, and leaves the root intact", () => {
    const ws = freshWorkspace();
    makeIteration(ws, "mr-review", "iteration-1", { promoted: true });
    const otherIter = makeIteration(ws, "other-skill", "iteration-1", {
      benchmark: true,
    });

    cleanupWorkspace(ws, "mr-review");

    expect(existsSync(join(ws, "mr-review"))).toBe(false);
    expect(existsSync(otherIter)).toBe(true);
    // Root survives because other-skill still lives there.
    expect(existsSync(ws)).toBe(true);
  });

  test("returns an empty summary and does not throw when the skill has no workspace", () => {
    const ws = freshWorkspace();
    const summary = cleanupWorkspace(ws, "never-ran");
    expect(summary.removedIterations).toEqual([]);
    expect(summary.keptIterations).toEqual([]);
    expect(summary.removedSnapshots).toEqual([]);
    expect(summary.keptSnapshots).toEqual([]);
    expect(summary.workspaceRemoved).toBe(false);
  });
});
