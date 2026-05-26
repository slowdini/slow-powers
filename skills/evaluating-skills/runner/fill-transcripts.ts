#!/usr/bin/env bun
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { detectRunContext } from "./context";
import * as claudeAdapter from "./adapters/claude-code-transcript";
import * as antigravityAdapter from "./adapters/antigravity-transcript";
import type { ConditionsRecord, RunRecord } from "./types";

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
	const has = (name: string) => argv.includes(`--${name}`);
	const iteration = flag("iteration");
	const subagentsDir = flag("subagents-dir");
	const harness = flag("harness");
	const overwrite = has("overwrite");
	if (!iteration) die("missing --iteration");
	if (!subagentsDir)
		die(
			"missing --subagents-dir (e.g. ~/.claude/projects/<project-slug>/<parent-session-id>/subagents/ or ~/.gemini/antigravity-cli/brain/)",
		);
	return { iteration, subagentsDir, harness, overwrite };
}

const fillArgv = Bun.argv.slice(2);
const { iteration, subagentsDir, harness, overwrite } = parseArgs(fillArgv);
const fillCtx = detectRunContext(fillArgv);
const skill = fillCtx.skillName;

if (!existsSync(subagentsDir))
	die(`subagents-dir not found: ${subagentsDir}`);

let adapter: typeof claudeAdapter | typeof antigravityAdapter = claudeAdapter;
let selectedHarness = "claude-code";

if (harness === "antigravity") {
	adapter = antigravityAdapter;
	selectedHarness = "antigravity";
} else if (harness === "claude-code") {
	adapter = claudeAdapter;
	selectedHarness = "claude-code";
} else {
	// Auto-detect
	if (
		subagentsDir.includes("antigravity-cli") ||
		subagentsDir.includes("brain") ||
		existsSync(join(subagentsDir, "..", "conversations"))
	) {
		adapter = antigravityAdapter;
		selectedHarness = "antigravity (auto-detected)";
	} else {
		adapter = claudeAdapter;
		selectedHarness = "claude-code (auto-detected)";
	}
}

console.log(`Using harness transcript adapter: ${selectedHarness}`);

const iterationDir = join(
	fillCtx.workspaceRoot,
	skill,
	`iteration-${iteration}`,
);
if (!existsSync(iterationDir)) die(`not found: ${iterationDir}`);

const conditionsPath = join(iterationDir, "conditions.json");
if (!existsSync(conditionsPath)) die(`missing: ${conditionsPath}`);
const conditions: ConditionsRecord = JSON.parse(
	readFileSync(conditionsPath, "utf8"),
);
const conditionNames = conditions.conditions.map((c) => c.name);

const evalDirs = readdirSync(iterationDir).filter((d) => d.startsWith("eval-"));

let filled = 0;
let skipped = 0;
let missing = 0;

for (const evalDir of evalDirs) {
	const evalId = evalDir.replace(/^eval-/, "");
	for (const cond of conditionNames) {
		const condDir = join(iterationDir, evalDir, cond);
		const runPath = join(condDir, "run.json");
		if (!existsSync(runPath)) continue;

		const run: RunRecord = JSON.parse(readFileSync(runPath, "utf8"));
		const existing = Array.isArray(run.tool_invocations)
			? run.tool_invocations
			: [];
		if (existing.length > 0 && !overwrite) {
			console.log(`skip ${evalId}/${cond}: already has ${existing.length} tool_invocations (use --overwrite to replace)`);
			skipped++;
			continue;
		}

		const description = `${evalId}:${cond}`;
		const subagent = adapter.findByDescription(subagentsDir, description);
		if (!subagent) {
			console.warn(
				`miss ${evalId}/${cond}: no subagent transcript with description='${description}'`,
			);
			missing++;
			continue;
		}

		const invocations = adapter.parseTranscript(subagent.jsonlPath);
		run.tool_invocations = invocations;
		writeFileSync(runPath, `${JSON.stringify(run, null, 2)}\n`);
		console.log(
			`fill ${evalId}/${cond}: wrote ${invocations.length} tool_invocations from ${subagent.jsonlPath}`,
		);
		filled++;
	}
}

console.log(
	`\nFilled: ${filled}, skipped (already populated): ${skipped}, missing transcript: ${missing}`,
);
if (missing > 0)
	console.warn(
		"Missing transcripts mean the dispatching agent did not use the expected `description` format (eval-id:condition). transcript_check assertions for those runs will be graded unverifiable.",
	);
