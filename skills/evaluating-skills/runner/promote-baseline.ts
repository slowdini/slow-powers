#!/usr/bin/env bun
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { detectRunContext } from "./context";
import type { ConditionsRecord } from "./types";

function die(msg: string): never {
  console.error(`error: ${msg}`);
  process.exit(1);
}

function ensureDir(path: string): void {
  if (!existsSync(path)) mkdirSync(path, { recursive: true });
}

function gitHead(cwd: string): string {
  try {
    const res = Bun.spawnSync(["git", "rev-parse", "--short", "HEAD"], {
      cwd,
      stdout: "pipe",
      stderr: "ignore",
    });
    if (res.exitCode === 0) return res.stdout.toString().trim();
  } catch {
    // not a git repo / git unavailable — provenance still useful without it
  }
  return "unknown";
}

export type PromoteOptions = {
  workspaceRoot: string;
  skillName: string;
  skillSubdir: string;
  iteration: string;
  harness: string;
  label: string | null;
  /** Directory used to resolve the committing repo's git HEAD for provenance. */
  gitCwd: string;
};

/**
 * Copies the durable, reference-worthy subset of a workspace iteration into the
 * skill's version-controlled `evals/baseline/` directory: the aggregate
 * `benchmark.json`, every per-run `grading.json` (judge rationales), and a
 * `BASELINE.md` provenance file. Ephemeral scaffolding (dispatch files, timing,
 * full run records, produced outputs, transcripts) is intentionally left behind
 * in the gitignored workspace.
 */
export function promoteBaseline(opts: PromoteOptions): {
  baselineDir: string;
  gradingsCopied: number;
} {
  const iterationDir = join(
    opts.workspaceRoot,
    opts.skillName,
    `iteration-${opts.iteration}`,
  );
  if (!existsSync(iterationDir)) {
    die(
      `not found: ${iterationDir} (build/grade iteration-${opts.iteration} first)`,
    );
  }

  const benchmarkSrc = join(iterationDir, "benchmark.json");
  if (!existsSync(benchmarkSrc)) {
    die(
      `missing benchmark.json in iteration-${opts.iteration} — run 'evals:aggregate' before promoting`,
    );
  }

  const conditionsSrc = join(iterationDir, "conditions.json");
  const conditions: ConditionsRecord | null = existsSync(conditionsSrc)
    ? JSON.parse(readFileSync(conditionsSrc, "utf8"))
    : null;

  const baselineDir = join(opts.skillSubdir, "evals", "baseline");
  const gradingDir = join(baselineDir, "grading");
  ensureDir(gradingDir);

  copyFileSync(benchmarkSrc, join(baselineDir, "benchmark.json"));

  let gradingsCopied = 0;
  for (const entry of readdirSync(iterationDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || !entry.name.startsWith("eval-")) continue;
    const evalId = entry.name.slice("eval-".length);
    const evalDir = join(iterationDir, entry.name);
    for (const cond of readdirSync(evalDir, { withFileTypes: true })) {
      if (!cond.isDirectory()) continue;
      const gradingSrc = join(evalDir, cond.name, "grading.json");
      if (!existsSync(gradingSrc)) continue;
      copyFileSync(
        gradingSrc,
        join(gradingDir, `${evalId}__${cond.name}.json`),
      );
      gradingsCopied++;
    }
  }

  const head = gitHead(opts.gitCwd);
  const mode = conditions?.mode ?? "unknown";
  const timestamp = conditions?.timestamp ?? "unknown";
  const conditionNames = conditions?.conditions.map((c) => c.name) ?? [];
  const provenance = [
    `# Baseline — ${opts.skillName}`,
    "",
    "Committed reference output from a canonical eval run. Regenerate with",
    "`bun run evals:promote-baseline -- --skill " +
      `${opts.skillName} --iteration <N>` +
      "` after aggregating. The ephemeral workspace (run records, timing,",
    "dispatch files, produced outputs) stays gitignored under `skills-workspace/`.",
    "",
    "| Field | Value |",
    "|-------|-------|",
    `| Mode | ${mode} |`,
    `| Iteration | iteration-${opts.iteration} |`,
    `| Harness | ${opts.harness} |`,
    `| Conditions | ${conditionNames.join(", ") || "unknown"} |`,
    `| Run timestamp | ${timestamp} |`,
    `| Label | ${opts.label ?? "(none)"} |`,
    `| Promoted from commit | ${head} |`,
    "",
    "Files:",
    "- `benchmark.json` — aggregate pass-rate / duration / token deltas.",
    "- `grading/<eval-id>__<condition>.json` — per-run assertion results and judge rationales.",
    "",
  ].join("\n");
  writeFileSync(join(baselineDir, "BASELINE.md"), `${provenance}\n`);

  return { baselineDir, gradingsCopied };
}

if (import.meta.main) {
  const argv = Bun.argv.slice(2);
  let ctx: ReturnType<typeof detectRunContext>;
  try {
    ctx = detectRunContext(argv);
  } catch (err) {
    die(err instanceof Error ? err.message : String(err));
  }

  const iterIdx = argv.indexOf("--iteration");
  const iteration = iterIdx === -1 ? undefined : argv[iterIdx + 1];
  if (!iteration) die("missing --iteration <N>");

  const labelIdx = argv.indexOf("--label");
  const label = labelIdx === -1 ? null : (argv[labelIdx + 1] ?? null);

  const { baselineDir, gradingsCopied } = promoteBaseline({
    workspaceRoot: ctx.workspaceRoot,
    skillName: ctx.skillName,
    skillSubdir: ctx.skillSubdir,
    iteration,
    harness: ctx.harness,
    label,
    gitCwd: ctx.skillSubdir,
  });

  console.log(
    `Promoted baseline for ${ctx.skillName} → ${baselineDir} (benchmark.json + ${gradingsCopied} grading file${gradingsCopied === 1 ? "" : "s"} + BASELINE.md)`,
  );
}
