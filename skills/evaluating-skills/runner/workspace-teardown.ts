import { existsSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";

/**
 * Marker `promote-baseline` drops into an iteration dir once that iteration's
 * durable results (benchmark + gradings) are committed under the skill's
 * `evals/baseline/`. Teardown treats its presence as "safe to delete" — the
 * data now lives in version control.
 */
export const PROMOTED_MARKER = ".promoted.json";

/**
 * Provenance the `snapshot` command writes into each `snapshots/<label>/` dir,
 * recording whether it was materialized from a git ref (reproducible) or copied
 * from the working tree (not reproducible). Teardown only reclaims ref snapshots.
 */
export const SNAPSHOT_META = ".snapshot-meta.json";

export type WorkspaceCleanupSummary = {
  /** Iteration dir names removed (promoted, or pure scaffolding). */
  removedIterations: string[];
  /** Iterations kept because they hold uncommitted results, with the reason. */
  keptIterations: { iteration: string; reason: string }[];
  /** Snapshot labels removed (reproducible from a git ref). */
  removedSnapshots: string[];
  /** Snapshot labels kept (working-tree or legacy, can't be regenerated). */
  keptSnapshots: string[];
  /** True when the skill's whole workspace subtree was removed. */
  workspaceRemoved: boolean;
};

/** Remove `dir` only if it exists and is empty. */
function pruneIfEmpty(dir: string): void {
  if (existsSync(dir) && readdirSync(dir).length === 0) {
    rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * An iteration carries "captured results" worth preserving if it reached the
 * point of producing an aggregate (`benchmark.json`) or any per-run record or
 * grading. Anything short of that (e.g. a `--dry-run` or a run staged but never
 * dispatched) is reproducible scaffolding.
 */
function iterationHasResults(iterDir: string): boolean {
  if (existsSync(join(iterDir, "benchmark.json"))) return true;
  for (const entry of readdirSync(iterDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || !entry.name.startsWith("eval-")) continue;
    const evalDir = join(iterDir, entry.name);
    for (const cond of readdirSync(evalDir, { withFileTypes: true })) {
      if (!cond.isDirectory()) continue;
      const condDir = join(evalDir, cond.name);
      if (existsSync(join(condDir, "run.json"))) return true;
      if (existsSync(join(condDir, "grading.json"))) return true;
    }
  }
  return false;
}

function snapshotSource(snapDir: string): string | null {
  const metaPath = join(snapDir, SNAPSHOT_META);
  if (!existsSync(metaPath)) return null;
  try {
    const meta = JSON.parse(readFileSync(metaPath, "utf8")) as {
      source?: string;
    };
    return meta.source ?? null;
  } catch {
    return null;
  }
}

/**
 * End-of-run cleanup of a skill's `skills-workspace/<skill>/` subtree, so a
 * finished eval leaves behind nothing that wasn't meant to be committed —
 * without ever destroying results the user hasn't moved into version control.
 *
 * Per iteration: promoted (marker present) → removed; unpromoted but holding
 * captured results → kept and reported; unpromoted scaffolding → removed. Per
 * snapshot: ref-sourced → removed; working-tree or legacy → kept. Empty parents
 * (`snapshots/`, the skill dir, the workspace root) are pruned, but a non-empty
 * one — e.g. another skill's artifacts — is never touched.
 */
export function cleanupWorkspace(
  workspaceRoot: string,
  skillName: string,
): WorkspaceCleanupSummary {
  const summary: WorkspaceCleanupSummary = {
    removedIterations: [],
    keptIterations: [],
    removedSnapshots: [],
    keptSnapshots: [],
    workspaceRemoved: false,
  };

  const skillDir = join(workspaceRoot, skillName);
  if (!existsSync(skillDir)) return summary;

  for (const entry of readdirSync(skillDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || !entry.name.startsWith("iteration-")) continue;
    const iterDir = join(skillDir, entry.name);
    if (existsSync(join(iterDir, PROMOTED_MARKER))) {
      rmSync(iterDir, { recursive: true, force: true });
      summary.removedIterations.push(entry.name);
    } else if (iterationHasResults(iterDir)) {
      summary.keptIterations.push({
        iteration: entry.name,
        reason: "uncommitted results — not promoted to evals/baseline/",
      });
    } else {
      rmSync(iterDir, { recursive: true, force: true });
      summary.removedIterations.push(entry.name);
    }
  }

  const snapshotsDir = join(skillDir, "snapshots");
  if (existsSync(snapshotsDir)) {
    for (const entry of readdirSync(snapshotsDir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const snapDir = join(snapshotsDir, entry.name);
      if (snapshotSource(snapDir) === "ref") {
        rmSync(snapDir, { recursive: true, force: true });
        summary.removedSnapshots.push(entry.name);
      } else {
        summary.keptSnapshots.push(entry.name);
      }
    }
    pruneIfEmpty(snapshotsDir);
  }

  pruneIfEmpty(skillDir);
  summary.workspaceRemoved = !existsSync(skillDir);
  pruneIfEmpty(workspaceRoot);

  return summary;
}
