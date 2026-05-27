#!/usr/bin/env bun
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { isAbsolute, join, resolve, sep } from "node:path";
import { detectRunContext } from "./context";
import type { ConditionsRecord, RunRecord, ToolInvocation } from "./types";

function die(msg: string): never {
  console.error(`error: ${msg}`);
  process.exit(1);
}

/** Tools that mutate the filesystem and carry a target path argument. */
const WRITE_TOOLS = new Set(["Write", "Edit", "MultiEdit", "NotebookEdit"]);

/**
 * Bash command patterns that mutate state outside an eval's sandbox. These are
 * heuristics surfaced as warnings (not hard violations) — Bash is too flexible
 * to parse exactly. Each fires only when the command does not reference the
 * run's outputs dir (see `detectStrayWrites`).
 */
const BASH_MUTATION_PATTERNS: Array<{ re: RegExp; reason: string }> = [
  {
    re: /\b(npm|pnpm|yarn|bun)\s+(install|add|ci|i)\b/,
    reason: "package install/add",
  },
  { re: /\bpip3?\s+install\b/, reason: "pip install" },
  { re: /\bsed\s+-i\b/, reason: "in-place file edit (sed -i)" },
  {
    re: /\bgit\s+(commit|add|push|checkout|reset|restore|merge|rebase)\b/,
    reason: "git mutation",
  },
  { re: /(^|\s)(>>?|tee)\s/, reason: "output redirection to a file" },
];

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

function pathArg(args: unknown): string | undefined {
  if (!args || typeof args !== "object") return undefined;
  const a = args as Record<string, unknown>;
  const p = a.file_path ?? a.notebook_path ?? a.path;
  return typeof p === "string" ? p : undefined;
}

function isUnder(target: string, dir: string, repoRoot: string): boolean {
  const base = resolve(dir);
  const abs = isAbsolute(target) ? resolve(target) : resolve(repoRoot, target);
  return abs === base || abs.startsWith(base + sep);
}

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
      if (!command) continue;
      // Scoped to the sandbox — the command names the outputs dir.
      if (command.includes(outputsDir)) continue;
      for (const { re, reason } of BASH_MUTATION_PATTERNS) {
        if (re.test(command)) {
          warnings.push({
            tool: "Bash",
            command,
            ordinal: inv.ordinal,
            reason,
          });
          break;
        }
      }
    }
  }

  return { violations, warnings };
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
  };
  const runs: RunReport[] = [];
  let totalViolations = 0;
  let totalWarnings = 0;

  for (const evalDir of evalDirs) {
    const evalId = evalDir.replace(/^eval-/, "");
    for (const cond of conditionNames) {
      const condDir = join(iterationDir, evalDir, cond);
      const runPath = join(condDir, "run.json");
      if (!existsSync(runPath)) continue;
      const run: RunRecord = JSON.parse(readFileSync(runPath, "utf8"));
      const invocations = Array.isArray(run.tool_invocations)
        ? run.tool_invocations
        : [];
      const outputsDir =
        outputsByKey.get(`${evalId}:${cond}`) ?? join(condDir, "outputs");
      const findings = detectStrayWrites(invocations, outputsDir, repoRoot);
      if (findings.violations.length || findings.warnings.length) {
        runs.push({
          eval_id: evalId,
          condition: cond,
          violations: findings.violations,
          warnings: findings.warnings,
        });
      }
      totalViolations += findings.violations.length;
      totalWarnings += findings.warnings.length;
    }
  }

  const report = {
    generated: new Date().toISOString(),
    iteration: Number(iteration),
    totals: { violations: totalViolations, warnings: totalWarnings },
    runs,
  };
  const outPath = join(iterationDir, "stray-writes.json");
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
  }
  if (totalViolations === 0 && totalWarnings === 0)
    console.log("✓ No out-of-bounds writes detected.");
  else
    console.warn(
      `\n${totalViolations} violation(s), ${totalWarnings} warning(s). Runs with violations edited files outside their sandbox — treat those data points as tainted.`,
    );
}
