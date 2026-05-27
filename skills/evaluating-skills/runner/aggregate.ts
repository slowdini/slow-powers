#!/usr/bin/env bun
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { detectRunContext } from "./context";
import type { ConditionsRecord, GradingResult, TimingRecord } from "./types";

function die(msg: string): never {
  console.error(`error: ${msg}`);
  process.exit(1);
}

function parseArgs(argv: string[]) {
  const flag = (name: string): string | undefined => {
    const i = argv.indexOf(`--${name}`);
    if (i === -1) return undefined;
    return argv[i + 1];
  };
  const iteration = flag("iteration");
  if (!iteration) die("missing --iteration");
  return { iteration };
}

type Series = number[];

function mean(values: Series): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function stddev(values: Series, m = mean(values)): number {
  if (values.length < 2) return 0;
  const v = values.reduce((s, x) => s + (x - m) ** 2, 0) / values.length;
  return Math.sqrt(v);
}

function round(n: number, dp: number): number {
  const p = 10 ** dp;
  return Math.round(n * p) / p;
}

function stats(values: Series, dp: number) {
  const m = mean(values);
  return {
    mean: round(m, dp),
    stddev: round(stddev(values, m), dp),
    n: values.length,
  };
}

const aggArgv = Bun.argv.slice(2);
const { iteration } = parseArgs(aggArgv);
const aggCtx = detectRunContext(aggArgv);
const iterationDir = join(
  aggCtx.workspaceRoot,
  aggCtx.skillName,
  `iteration-${iteration}`,
);
if (!existsSync(iterationDir)) die(`not found: ${iterationDir}`);

const conditionsPath = join(iterationDir, "conditions.json");
if (!existsSync(conditionsPath)) die(`missing: ${conditionsPath}`);
const conditions: ConditionsRecord = JSON.parse(
  readFileSync(conditionsPath, "utf8"),
);
const conditionNames = conditions.conditions.map((c) => c.name);
if (conditionNames.length !== 2)
  die(`expected exactly 2 conditions, got ${conditionNames.length}`);

const evalDirs = readdirSync(iterationDir).filter((d) => d.startsWith("eval-"));
if (evalDirs.length === 0) die("no eval directories found");

type Bucket = {
  passRates: Series;
  durations: Series;
  tokens: Series;
  skillInvoked: boolean[];
  hadSkillLoaded: boolean;
};
const byCondition: Record<string, Bucket> = {};
const conditionSkillPaths = new Map<string, string | null>();
for (const c of conditions.conditions) {
  conditionSkillPaths.set(c.name, c.skill_path);
  byCondition[c.name] = {
    passRates: [],
    durations: [],
    tokens: [],
    skillInvoked: [],
    hadSkillLoaded: !!c.skill_path,
  };
}

let missingGradings = 0;
for (const evalDir of evalDirs) {
  for (const cond of conditionNames) {
    const condDir = join(iterationDir, evalDir, cond);
    const gradingPath = join(condDir, "grading.json");
    const timingPath = join(condDir, "timing.json");
    if (!existsSync(gradingPath)) {
      console.warn(`warn: missing grading for ${evalDir}/${cond}`);
      missingGradings++;
      continue;
    }
    const grading: GradingResult = JSON.parse(
      readFileSync(gradingPath, "utf8"),
    );
    byCondition[cond].passRates.push(grading.summary.pass_rate);
    if (grading.meta_summary?.skill_invoked != null)
      byCondition[cond].skillInvoked.push(grading.meta_summary.skill_invoked);
    if (existsSync(timingPath)) {
      const timing: TimingRecord = JSON.parse(readFileSync(timingPath, "utf8"));
      if (typeof timing.total_tokens === "number")
        byCondition[cond].tokens.push(timing.total_tokens);
      if (typeof timing.duration_ms === "number")
        byCondition[cond].durations.push(timing.duration_ms);
    }
  }
}

type ConditionSummary = {
  pass_rate: ReturnType<typeof stats>;
  duration_ms: ReturnType<typeof stats>;
  total_tokens: ReturnType<typeof stats>;
  skill_invocation_rate?: number | null;
  skill_invocation_n?: number;
};

const runSummary: Record<string, ConditionSummary> = {};
for (const cond of conditionNames) {
  const bucket = byCondition[cond];
  const summary: ConditionSummary = {
    pass_rate: stats(bucket.passRates, 3),
    duration_ms: stats(bucket.durations, 0),
    total_tokens: stats(bucket.tokens, 0),
  };
  if (bucket.hadSkillLoaded) {
    summary.skill_invocation_n = bucket.skillInvoked.length;
    summary.skill_invocation_rate =
      bucket.skillInvoked.length === 0
        ? null
        : round(
            bucket.skillInvoked.filter(Boolean).length /
              bucket.skillInvoked.length,
            3,
          );
  }
  runSummary[cond] = summary;
}

const [a, b] = conditionNames;
const delta = {
  direction: `${a} - ${b}`,
  pass_rate: round(
    runSummary[a].pass_rate.mean - runSummary[b].pass_rate.mean,
    3,
  ),
  duration_ms: round(
    runSummary[a].duration_ms.mean - runSummary[b].duration_ms.mean,
    0,
  ),
  total_tokens: round(
    runSummary[a].total_tokens.mean - runSummary[b].total_tokens.mean,
    0,
  ),
};

const validityWarnings: string[] = [];
for (const cond of conditionNames) {
  const s = runSummary[cond];
  if (s.skill_invocation_rate != null && s.skill_invocation_rate < 1) {
    validityWarnings.push(
      `condition '${cond}' had skill loaded but invocation rate ${(s.skill_invocation_rate * 100).toFixed(0)}% (${s.skill_invocation_n} runs checked) — substantive results may not reflect skill effectiveness.`,
    );
  }
}

const benchmark = {
  generated: new Date().toISOString(),
  mode: conditions.mode,
  baseline: conditions.baseline,
  conditions_compared: [a, b],
  missing_gradings: missingGradings,
  validity_warnings: validityWarnings,
  run_summary: runSummary,
  delta,
};

const outPath = join(iterationDir, "benchmark.json");
writeFileSync(outPath, `${JSON.stringify(benchmark, null, 2)}\n`);
console.log(`Wrote ${outPath}`);
if (missingGradings > 0)
  console.warn(
    `note: ${missingGradings} grading.json file(s) were missing — benchmark is incomplete.`,
  );
for (const warning of validityWarnings) console.warn(`⚠ ${warning}`);
if (validityWarnings.length === 0) {
  for (const cond of conditionNames) {
    const s = runSummary[cond];
    if (s.skill_invocation_rate === 1)
      console.log(
        `✓ ${cond}: skill invocation rate 100% (${s.skill_invocation_n} runs) — substantive results are valid.`,
      );
  }
}
