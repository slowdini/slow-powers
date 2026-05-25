#!/usr/bin/env bun
import {
	existsSync,
	readdirSync,
	readFileSync,
	writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import type {
	ConditionsRecord,
	GradingResult,
	TimingRecord,
} from "./types";

const REPO_ROOT = resolve(import.meta.dir, "../..");
const WORKSPACE_ROOT = join(REPO_ROOT, "skills-workspace");

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
	const skill = flag("skill");
	const iteration = flag("iteration");
	if (!skill) die("missing --skill");
	if (!iteration) die("missing --iteration");
	return { skill, iteration };
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

const { skill, iteration } = parseArgs(Bun.argv.slice(2));
const iterationDir = join(WORKSPACE_ROOT, skill, `iteration-${iteration}`);
if (!existsSync(iterationDir)) die(`not found: ${iterationDir}`);

const conditionsPath = join(iterationDir, "conditions.json");
if (!existsSync(conditionsPath)) die(`missing: ${conditionsPath}`);
const conditions: ConditionsRecord = JSON.parse(
	readFileSync(conditionsPath, "utf8"),
);
const conditionNames = conditions.conditions.map((c) => c.name);
if (conditionNames.length !== 2)
	die(`expected exactly 2 conditions, got ${conditionNames.length}`);

const evalDirs = readdirSync(iterationDir).filter((d) =>
	d.startsWith("eval-"),
);
if (evalDirs.length === 0) die("no eval directories found");

type Bucket = { passRates: Series; durations: Series; tokens: Series };
const byCondition: Record<string, Bucket> = {};
for (const c of conditionNames)
	byCondition[c] = { passRates: [], durations: [], tokens: [] };

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
		if (existsSync(timingPath)) {
			const timing: TimingRecord = JSON.parse(
				readFileSync(timingPath, "utf8"),
			);
			if (typeof timing.total_tokens === "number")
				byCondition[cond].tokens.push(timing.total_tokens);
			if (typeof timing.duration_ms === "number")
				byCondition[cond].durations.push(timing.duration_ms);
		}
	}
}

const runSummary: Record<
	string,
	{
		pass_rate: ReturnType<typeof stats>;
		duration_ms: ReturnType<typeof stats>;
		total_tokens: ReturnType<typeof stats>;
	}
> = {};
for (const cond of conditionNames) {
	const bucket = byCondition[cond];
	runSummary[cond] = {
		pass_rate: stats(bucket.passRates, 3),
		duration_ms: stats(bucket.durations, 0),
		total_tokens: stats(bucket.tokens, 0),
	};
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

const benchmark = {
	generated: new Date().toISOString(),
	mode: conditions.mode,
	baseline: conditions.baseline,
	conditions_compared: [a, b],
	missing_gradings: missingGradings,
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
