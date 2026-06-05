#!/usr/bin/env bun
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { detectRunContext } from "./context";
import { classifyBash, isUnder, pathArg, WRITE_TOOLS } from "./sandbox-policy";
import type { ConditionsRecord, RunRecord, ToolInvocation } from "./types";
import { validateAgainstSchema } from "./validate-schema";

function die(msg: string): never {
  console.error(`error: ${msg}`);
  process.exit(1);
}

export type StrayFinding = {
  tool: string;
  path?: string;
  command?: string;
  ordinal: number;
  reason: string;
};

export type RunFindings = {
  violations: StrayFinding[];
  warnings: StrayFinding[];
};

/**
 * Classify a run's tool invocations against its allowed outputs dir.
 *
 * - `violations`: file-write tools (Write/Edit/MultiEdit/NotebookEdit) whose
 *   target path resolves outside `outputsDir`. High confidence — a run that
 *   edits the real repo is a tainted data point.
 * - `warnings`: Bash commands matching a mutating pattern that don't reference
 *   `outputsDir`. Heuristic — review before trusting.
 *
 * Relative paths resolve against `repoRoot` (the subagent's working dir);
 * Claude Code's write tools use absolute paths, so this is a best-effort
 * fallback only.
 */
export function detectStrayWrites(
  invocations: Array<Pick<ToolInvocation, "name" | "args" | "ordinal">>,
  outputsDir: string,
  repoRoot: string,
): RunFindings {
  const violations: StrayFinding[] = [];
  const warnings: StrayFinding[] = [];

  for (const inv of invocations) {
    if (WRITE_TOOLS.has(inv.name)) {
      const p = pathArg(inv.args);
      if (p && !isUnder(p, outputsDir, repoRoot)) {
        violations.push({
          tool: inv.name,
          path: p,
          ordinal: inv.ordinal,
          reason: "writes outside the run's outputs dir",
        });
      }
      continue;
    }

    if (inv.name === "Bash") {
      const args = inv.args as { command?: unknown } | undefined;
      const command = typeof args?.command === "string" ? args.command : "";
      const reason = classifyBash(command, [outputsDir]);
      if (reason)
        warnings.push({ tool: "Bash", command, ordinal: inv.ordinal, reason });
    }
  }

  return { violations, warnings };
}

/** Read-only tools that carry a target path argument (see `pathArg`). */
const READ_TOOLS = new Set(["Read", "Glob", "Grep"]);

const LIVE_SOURCE_REASON =
  "reads the live skill source instead of its staged copy — the arm may be contaminated";

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Flag tool invocations that read the **live** skill-under-test directory.
 *
 * Eval subagents are only ever meant to see the *staged* copy of the skill
 * (`.claude/skills/<slug>/`, or the inlined SKILL.md under `--no-stage`). A
 * read of the live source typically means the Skill tool couldn't resolve the
 * staged slug yet (mid-session registry refresh race) and the agent improvised
 * — fatal in revision mode, where the old_skill arm then reads new-skill
 * content. Reads are detected, not blocked: the guard stays read-permissive,
 * so this surfaces post-hoc as a validity warning.
 *
 * - Read-tool calls (Read/Glob/Grep) whose path arg resolves under the live
 *   dir are flagged; relative paths resolve against `repoRoot`.
 * - Bash commands that reference the live dir (absolute, or repo-relative
 *   text) are flagged. A staged copy under `.claude/skills/` can carry the
 *   same `skills/<name>` relative text (e.g. via `--stage-name`), so that
 *   prefix is excluded.
 */
export function detectLiveSourceReads(
  invocations: Array<Pick<ToolInvocation, "name" | "args" | "ordinal">>,
  liveSkillDir: string,
  repoRoot: string,
): StrayFinding[] {
  const findings: StrayFinding[] = [];
  const liveDir = resolve(liveSkillDir);
  const rel = relative(repoRoot, liveDir);
  const relRe = rel.startsWith("..")
    ? null
    : new RegExp(
        // The lookbehind fires at the boundary char itself, so it checks for a
        // bare `.claude` — the `/` is consumed by the boundary group.
        `(?<!\\.claude)(^|[\\s'"=:(/])${escapeRegExp(rel)}(/|[\\s'")]|$)`,
      );

  for (const inv of invocations) {
    if (READ_TOOLS.has(inv.name)) {
      const p = pathArg(inv.args);
      if (p && isUnder(p, liveDir, repoRoot)) {
        findings.push({
          tool: inv.name,
          path: p,
          ordinal: inv.ordinal,
          reason: LIVE_SOURCE_REASON,
        });
      }
      continue;
    }

    if (inv.name === "Bash") {
      const args = inv.args as { command?: unknown } | undefined;
      const command = typeof args?.command === "string" ? args.command : "";
      if (command.includes(liveDir) || relRe?.test(command)) {
        findings.push({
          tool: "Bash",
          command,
          ordinal: inv.ordinal,
          reason: LIVE_SOURCE_REASON,
        });
      }
    }
  }

  return findings;
}

if (import.meta.main) {
  const argv = Bun.argv.slice(2);
  const flag = (name: string): string | undefined => {
    const i = argv.indexOf(`--${name}`);
    return i === -1 ? undefined : argv[i + 1];
  };
  const iteration = flag("iteration");
  if (!iteration) die("missing --iteration");
  const ctx = detectRunContext(argv);

  const iterationDir = join(
    ctx.workspaceRoot,
    ctx.skillName,
    `iteration-${iteration}`,
  );
  if (!existsSync(iterationDir)) die(`not found: ${iterationDir}`);

  const conditionsPath = join(iterationDir, "conditions.json");
  if (!existsSync(conditionsPath)) die(`missing: ${conditionsPath}`);
  const conditions: ConditionsRecord = JSON.parse(
    readFileSync(conditionsPath, "utf8"),
  );
  const conditionNames = conditions.conditions.map((c) => c.name);

  // dispatch.json carries the authoritative outputs_dir per task; fall back to
  // the conventional <condDir>/outputs when it's absent (hand-authored runs).
  const dispatchPath = join(iterationDir, "dispatch.json");
  const outputsByKey = new Map<string, string>();
  if (existsSync(dispatchPath)) {
    try {
      const dispatch = JSON.parse(readFileSync(dispatchPath, "utf8")) as {
        tasks?: Array<{
          eval_id: string;
          condition: string;
          outputs_dir?: string;
        }>;
      };
      for (const t of dispatch.tasks ?? []) {
        if (t.outputs_dir)
          outputsByKey.set(`${t.eval_id}:${t.condition}`, t.outputs_dir);
      }
    } catch {
      // fall through to convention
    }
  }

  const repoRoot = process.cwd();
  const evalDirs = readdirSync(iterationDir).filter((d) =>
    d.startsWith("eval-"),
  );

  type RunReport = {
    eval_id: string;
    condition: string;
    violations: StrayFinding[];
    warnings: StrayFinding[];
    live_source_reads: StrayFinding[];
  };
  const runs: RunReport[] = [];
  let totalViolations = 0;
  let totalWarnings = 0;
  let totalLiveReads = 0;

  for (const evalDir of evalDirs) {
    const evalId = evalDir.replace(/^eval-/, "");
    for (const cond of conditionNames) {
      const condDir = join(iterationDir, evalDir, cond);
      const runPath = join(condDir, "run.json");
      if (!existsSync(runPath)) continue;
      const run = validateAgainstSchema<RunRecord>(
        "run-record",
        JSON.parse(readFileSync(runPath, "utf8")),
        runPath,
      );
      const invocations = Array.isArray(run.tool_invocations)
        ? run.tool_invocations
        : [];
      const outputsDir =
        outputsByKey.get(`${evalId}:${cond}`) ?? join(condDir, "outputs");
      const findings = detectStrayWrites(invocations, outputsDir, repoRoot);
      const liveReads = detectLiveSourceReads(
        invocations,
        ctx.skillSubdir,
        repoRoot,
      );
      if (
        findings.violations.length ||
        findings.warnings.length ||
        liveReads.length
      ) {
        runs.push({
          eval_id: evalId,
          condition: cond,
          violations: findings.violations,
          warnings: findings.warnings,
          live_source_reads: liveReads,
        });
      }
      totalViolations += findings.violations.length;
      totalWarnings += findings.warnings.length;
      totalLiveReads += liveReads.length;
    }
  }

  const report = {
    generated: new Date().toISOString(),
    iteration: Number(iteration),
    totals: {
      violations: totalViolations,
      warnings: totalWarnings,
      live_source_reads: totalLiveReads,
    },
    runs,
  };
  const outPath = join(iterationDir, "stray-writes.json");
  validateAgainstSchema("stray-writes", report, outPath);
  writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Wrote ${outPath}`);

  for (const r of runs) {
    for (const v of r.violations)
      console.warn(
        `✗ ${r.eval_id}/${r.condition}: ${v.tool} wrote outside outputs dir → ${v.path} (ordinal ${v.ordinal})`,
      );
    for (const w of r.warnings)
      console.warn(
        `⚠ ${r.eval_id}/${r.condition}: Bash ${w.reason} (ordinal ${w.ordinal}): ${w.command}`,
      );
    for (const l of r.live_source_reads)
      console.warn(
        `⚠ ${r.eval_id}/${r.condition}: ${l.tool} read the live skill source (ordinal ${l.ordinal}): ${l.path ?? l.command}`,
      );
  }
  if (totalViolations === 0 && totalWarnings === 0 && totalLiveReads === 0)
    console.log("✓ No out-of-bounds writes or live-source reads detected.");
  else
    console.warn(
      `\n${totalViolations} violation(s), ${totalWarnings} warning(s), ${totalLiveReads} live-source read(s). Runs with violations edited files outside their sandbox; runs with live-source reads saw the live skill instead of their staged copy — treat those data points as tainted.`,
    );
}
