#!/usr/bin/env bun
import {
	existsSync,
	mkdirSync,
	readFileSync,
	readdirSync,
	writeFileSync,
} from "node:fs";
import { join, resolve } from "node:path";
import {
	type AssertionResult,
	type AssertionTranscriptCheck,
	type ConditionsRecord,
	type EvalsConfig,
	type GradingResult,
	type RunRecord,
	SKILL_INVOKED_META_ID,
	type ToolInvocation,
} from "./types";
import { validateEvalsConfig } from "./validate";

const REPO_ROOT = resolve(import.meta.dir, "../..");
const SKILLS_DIR = join(REPO_ROOT, "skills");
const WORKSPACE_ROOT = join(REPO_ROOT, "skills-workspace");

type Mode = "emit-judge-tasks" | "finalize";

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
	const skill = flag("skill");
	const iteration = flag("iteration");
	if (!skill) die("missing --skill");
	if (!iteration) die("missing --iteration");

	const mode: Mode = has("finalize") ? "finalize" : "emit-judge-tasks";
	return { skill, iteration, mode };
}

function readJson<T>(path: string): T {
	return JSON.parse(readFileSync(path, "utf8"));
}

function writeJson(path: string, value: unknown) {
	writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function ensureDir(path: string): void {
	if (!existsSync(path)) mkdirSync(path, { recursive: true });
}

const { skill, iteration, mode } = parseArgs(Bun.argv.slice(2));

const iterationDir = join(WORKSPACE_ROOT, skill, `iteration-${iteration}`);
if (!existsSync(iterationDir)) die(`not found: ${iterationDir}`);

const conditionsPath = join(iterationDir, "conditions.json");
if (!existsSync(conditionsPath)) die(`missing: ${conditionsPath}`);
const conditions: ConditionsRecord = readJson(conditionsPath);
const conditionNames = conditions.conditions.map((c) => c.name);

const evalsPath = join(SKILLS_DIR, skill, "evals", "evals.json");
const evalsConfig: EvalsConfig = validateEvalsConfig(readJson(evalsPath), evalsPath);

if (mode === "emit-judge-tasks") {
	emitJudgeTasks();
} else {
	finalize();
}

type JudgeTask = {
	eval_id: string;
	condition: string;
	assertion_id: string;
	rubric: string;
	model: string | null;
	is_meta: boolean;
	run_record_path: string;
	outputs_dir: string;
	response_path: string;
	dispatch_prompt: string;
};

function skillInvokedRubric(skillName: string): string {
	return [
		`The agent was given the **${skillName}** skill loaded directly into its operating guidelines (the full SKILL.md text appears inside the run record's \`prompt\` field). This meta-check asks whether there is evidence the agent actually applied the skill in this run — separate from whether the response was correct.`,
		"",
		"Evidence the skill WAS applied:",
		"- The agent cites the skill by name or references specific named sections (e.g. \"Iron Law\", \"Red Flags\", \"Gate Function\", or any other distinctive heading from the skill).",
		"- The agent's response uses distinctive vocabulary or phrasing taken from the skill content.",
		"- The agent's behavior follows a specific procedural step prescribed by the skill in a way that mirrors the skill's phrasing — not just generic best practice.",
		"- The agent explicitly acknowledges following the skill's guidance.",
		"",
		"Evidence the skill was NOT applied:",
		"- The response uses only generic best-practice language unrelated to the skill's specific framing.",
		"- No vocabulary, structure, or rules from the skill content appear anywhere in the response.",
		"- The response would read identically with or without the skill loaded.",
		"",
		"Compare the agent's `final_message` against the skill content embedded in `prompt`. Look for stylistic and procedural fingerprints.",
		"",
		"PASS if there is observable evidence the skill influenced the response.",
		"FAIL if there is no observable evidence — the response is indistinguishable from baseline behavior.",
	].join("\n");
}

function emitJudgeTasks(): void {
	const tasks: JudgeTask[] = [];
	let skipped = 0;
	let unverifiableCount = 0;
	let metaInjected = 0;

	const conditionSkillPaths = new Map<string, string | null>();
	for (const c of conditions.conditions)
		conditionSkillPaths.set(c.name, c.skill_path);

	for (const ev of evalsConfig.evals) {
		const hasAssertions =
			ev.assertions && ev.assertions.length > 0;

		for (const cond of conditionNames) {
			const condDir = join(iterationDir, `eval-${ev.id}`, cond);
			const runRecordPath = join(condDir, "run.json");
			const outputsDir = join(condDir, "outputs");
			const judgeResponsesDir = join(condDir, "judge-responses");

			if (!existsSync(runRecordPath)) {
				console.warn(`warn: missing run.json for ${ev.id}/${cond} — skipping`);
				if (hasAssertions && ev.assertions)
					skipped += ev.assertions.length;
				continue;
			}

			ensureDir(judgeResponsesDir);
			const runRecord: RunRecord = readJson(runRecordPath);

			if (hasAssertions && ev.assertions) {
				for (const assertion of ev.assertions) {
					if (assertion.type === "transcript_check") {
						skipped++;
						unverifiableCount++;
						continue;
					}
					const responsePath = join(
						judgeResponsesDir,
						`${assertion.id}.json`,
					);
					const dispatchPrompt = buildJudgePrompt({
						rubric: assertion.rubric,
						runRecord,
						outputsDir,
						responsePath,
					});
					tasks.push({
						eval_id: ev.id,
						condition: cond,
						assertion_id: assertion.id,
						rubric: assertion.rubric,
						model: assertion.model ?? null,
						is_meta: false,
						run_record_path: runRecordPath,
						outputs_dir: outputsDir,
						response_path: responsePath,
						dispatch_prompt: dispatchPrompt,
					});
				}
			}

			const condSkillPath = conditionSkillPaths.get(cond);
			if (condSkillPath) {
				const rubric = skillInvokedRubric(evalsConfig.skill_name);
				const responsePath = join(
					judgeResponsesDir,
					`${SKILL_INVOKED_META_ID}.json`,
				);
				const dispatchPrompt = buildJudgePrompt({
					rubric,
					runRecord,
					outputsDir,
					responsePath,
				});
				tasks.push({
					eval_id: ev.id,
					condition: cond,
					assertion_id: SKILL_INVOKED_META_ID,
					rubric,
					model: null,
					is_meta: true,
					run_record_path: runRecordPath,
					outputs_dir: outputsDir,
					response_path: responsePath,
					dispatch_prompt: dispatchPrompt,
				});
				metaInjected++;
			}
		}
	}

	const tasksPath = join(iterationDir, "judge-tasks.json");
	writeJson(tasksPath, {
		generated: new Date().toISOString(),
		total_tasks: tasks.length,
		meta_tasks_injected: metaInjected,
		skipped_transcript_checks: unverifiableCount,
		tasks,
	});

	console.log(`Wrote ${tasksPath}`);
	console.log(
		`Judge tasks: ${tasks.length} (${metaInjected} skill-invocation meta-check${metaInjected === 1 ? "" : "s"})`,
	);
	if (unverifiableCount > 0)
		console.log(
			`transcript_check assertions: ${unverifiableCount} (not dispatched; graded directly in finalize from run.json's tool_invocations).`,
		);
	if (skipped > unverifiableCount)
		console.log(
			`Skipped due to missing run records: ${skipped - unverifiableCount}`,
		);
	console.log(
		"\nNext: dispatch each task as a judge subagent (use templates/judge-prompt.md guidance).",
	);
	console.log(
		"     Write each judge's JSON response to the task's `response_path`.",
	);
	console.log(
		`     Then run: bun run evals:grade -- --skill ${skill} --iteration ${iteration} --finalize`,
	);
}

function buildJudgePrompt(opts: {
	rubric: string;
	runRecord: RunRecord;
	outputsDir: string;
	responsePath: string;
}): string {
	const outputsListing = existsSync(opts.outputsDir)
		? listOutputs(opts.outputsDir)
		: "(none)";

	return [
		"You are grading one assertion for a skill evaluation run. Be strict but fair.",
		"",
		"# Run record",
		"",
		"```json",
		JSON.stringify(opts.runRecord, null, 2),
		"```",
		"",
		"# Outputs directory contents",
		"",
		"```",
		outputsListing,
		"```",
		"",
		"# Assertion to grade",
		"",
		opts.rubric,
		"",
		"# Grading principles",
		"",
		"- PASS requires concrete evidence (a direct quote or specific reference from the run record's `final_message` or outputs). Don't infer behavior not present in the record.",
		"- A correct response expressed in different words from what the assertion implies is still a PASS if the substance matches.",
		"- If the assertion is unverifiable from the available material (e.g. requires the tool-invocation list and the run record has none), return `passed: false`, `evidence: 'assertion is unverifiable from available material'`, `confidence: 1.0`.",
		"",
		"# Task",
		"",
		`Write your verdict as a JSON file to: ${opts.responsePath}`,
		"",
		"The JSON must match this schema (exactly these keys, no extra prose in the file):",
		"",
		"```json",
		'{ "passed": true|false, "evidence": "direct quote or reference", "confidence": 0.0-1.0 }',
		"```",
		"",
		"After writing the file, your final user-facing reply should be one sentence summarising the verdict.",
	].join("\n");
}

function describeInvocation(inv: ToolInvocation): string {
	const args = inv.args === undefined ? "" : ` ${JSON.stringify(inv.args)}`;
	return `${inv.name}${args}`;
}

function gradeTranscriptCheck(
	assertion: AssertionTranscriptCheck,
	invocations: ToolInvocation[],
): AssertionResult {
	if (invocations.length === 0) {
		return {
			id: assertion.id,
			passed: false,
			evidence:
				"tool_invocations is empty — run record was not filled by a transcript adapter. Run `bun run evals:fill-transcripts` for Claude Code, or rely on `llm_judge` assertions for harnesses without an adapter.",
			confidence: 1.0,
			grader: "transcript_check",
		};
	}

	if (assertion.check !== "tool_invocation_matches") {
		return {
			id: assertion.id,
			passed: false,
			evidence: `unsupported transcript_check kind: '${assertion.check}'`,
			confidence: 1.0,
			grader: "transcript_check",
		};
	}

	const pattern = assertion.pattern;
	if (!pattern) {
		return {
			id: assertion.id,
			passed: false,
			evidence: "transcript_check 'tool_invocation_matches' requires a `pattern` field",
			confidence: 1.0,
			grader: "transcript_check",
		};
	}

	let re: RegExp;
	try {
		re = new RegExp(pattern);
	} catch (err) {
		return {
			id: assertion.id,
			passed: false,
			evidence: `invalid regex in pattern '${pattern}': ${(err as Error).message}`,
			confidence: 1.0,
			grader: "transcript_check",
		};
	}

	for (const inv of invocations) {
		const target = describeInvocation(inv);
		if (re.test(target))
			return {
				id: assertion.id,
				passed: true,
				evidence: `matched ordinal ${inv.ordinal}: ${target.slice(0, 200)}`,
				confidence: 1.0,
				grader: "transcript_check",
			};
	}

	return {
		id: assertion.id,
		passed: false,
		evidence: `no tool invocation matched /${pattern}/ across ${invocations.length} invocation(s)`,
		confidence: 1.0,
		grader: "transcript_check",
	};
}

function listOutputs(dir: string): string {
	const entries = readdirSync(dir, { withFileTypes: true })
		.filter(
			(e) => !e.name.startsWith(".") && e.name !== "node_modules",
		)
		.map((e) => (e.isDirectory() ? `${e.name}/` : e.name));
	return entries.sort().join("\n") || "(empty)";
}

function finalize(): void {
	type JudgeResponse = {
		passed: boolean;
		evidence: string;
		confidence?: number;
	};

	const conditionSkillPaths = new Map<string, string | null>();
	for (const c of conditions.conditions)
		conditionSkillPaths.set(c.name, c.skill_path);

	let totalGraded = 0;
	let totalUnverifiable = 0;
	let totalMetaGraded = 0;
	let metaFailures = 0;

	for (const ev of evalsConfig.evals) {
		const hasAssertions = ev.assertions && ev.assertions.length > 0;

		for (const cond of conditionNames) {
			const condDir = join(iterationDir, `eval-${ev.id}`, cond);
			if (!existsSync(condDir)) continue;
			const judgeResponsesDir = join(condDir, "judge-responses");
			const gradingPath = join(condDir, "grading.json");

			const assertionResults: AssertionResult[] = [];
			const runRecordPath = join(condDir, "run.json");
			const runRecord: RunRecord | null = existsSync(runRecordPath)
				? readJson<RunRecord>(runRecordPath)
				: null;
			if (hasAssertions && ev.assertions) {
				for (const assertion of ev.assertions) {
					if (assertion.type === "transcript_check") {
						const invocations = runRecord?.tool_invocations ?? [];
						const result = gradeTranscriptCheck(assertion, invocations);
						assertionResults.push(result);
						if (invocations.length === 0) totalUnverifiable++;
						else totalGraded++;
						continue;
					}
					const responsePath = join(
						judgeResponsesDir,
						`${assertion.id}.json`,
					);
					if (!existsSync(responsePath)) {
						console.warn(
							`warn: missing judge response: ${responsePath} (assertion will be FAIL)`,
						);
						assertionResults.push({
							id: assertion.id,
							passed: false,
							evidence: `judge response missing at ${responsePath}`,
							confidence: 0,
							grader: "llm_judge",
						});
						continue;
					}
					const response: JudgeResponse = readJson(responsePath);
					assertionResults.push({
						id: assertion.id,
						passed: !!response.passed,
						evidence: response.evidence ?? "",
						confidence: response.confidence ?? 0,
						grader: "llm_judge",
					});
					totalGraded++;
				}
			}

			const metaResults: AssertionResult[] = [];
			const condSkillPath = conditionSkillPaths.get(cond);
			if (condSkillPath) {
				const responsePath = join(
					judgeResponsesDir,
					`${SKILL_INVOKED_META_ID}.json`,
				);
				if (existsSync(responsePath)) {
					const response: JudgeResponse = readJson(responsePath);
					const passed = !!response.passed;
					metaResults.push({
						id: SKILL_INVOKED_META_ID,
						passed,
						evidence: response.evidence ?? "",
						confidence: response.confidence ?? 0,
						grader: "llm_judge",
					});
					totalMetaGraded++;
					if (!passed) metaFailures++;
				} else {
					console.warn(
						`warn: missing skill-invocation meta response: ${responsePath}`,
					);
					metaResults.push({
						id: SKILL_INVOKED_META_ID,
						passed: false,
						evidence: `meta judge response missing at ${responsePath}`,
						confidence: 0,
						grader: "llm_judge",
					});
				}
			}

			const passed = assertionResults.filter((r) => r.passed).length;
			const total = assertionResults.length;
			const metaPassed = metaResults.filter((r) => r.passed).length;
			const skillInvoked =
				metaResults.length === 0
					? null
					: metaResults.every((r) => r.passed);

			const grading: GradingResult = {
				assertion_results: assertionResults,
				summary: {
					passed,
					failed: total - passed,
					total,
					pass_rate: total === 0 ? 0 : passed / total,
				},
			};
			if (metaResults.length > 0) {
				grading.meta_results = metaResults;
				grading.meta_summary = {
					passed: metaPassed,
					failed: metaResults.length - metaPassed,
					total: metaResults.length,
					skill_invoked: skillInvoked,
				};
			}
			writeJson(gradingPath, grading);
			const metaTag =
				metaResults.length === 0
					? ""
					: ` [skill_invoked=${skillInvoked}]`;
			console.log(
				`Wrote ${gradingPath} (${passed}/${total} substantive, rate ${total === 0 ? "n/a" : `${(grading.summary.pass_rate * 100).toFixed(0)}%`})${metaTag}`,
			);
		}
	}

	console.log(
		`\nFinalized: ${totalGraded} substantive assertion${totalGraded === 1 ? "" : "s"} graded, ${totalMetaGraded} skill-invocation meta-check${totalMetaGraded === 1 ? "" : "s"} graded, ${totalUnverifiable} transcript_check unverifiable (empty tool_invocations).`,
	);
	if (metaFailures > 0)
		console.warn(
			`\n⚠ ${metaFailures} run(s) failed the skill-invocation meta-check. Substantive results for those runs may be unreliable — the skill may not have actually influenced behavior.`,
		);
	console.log(
		`\nNext: bun run evals:aggregate -- --skill ${skill} --iteration ${iteration}`,
	);
}
