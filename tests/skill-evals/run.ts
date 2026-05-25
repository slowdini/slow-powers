#!/usr/bin/env bun
import {
	cpSync,
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import type { ConditionsRecord, Eval, EvalsConfig } from "./types";
import { validateEvalsConfig } from "./validate";

const REPO_ROOT = resolve(import.meta.dir, "../..");
const SKILLS_DIR = join(REPO_ROOT, "skills");
const WORKSPACE_ROOT = join(REPO_ROOT, "skills-workspace");

type Mode = "new-skill" | "revision";

type Args = {
	command: "run" | "snapshot";
	skill: string;
	mode?: Mode;
	baseline?: string;
	label?: string;
	iteration?: number;
	dryRun: boolean;
};

function die(msg: string): never {
	console.error(`error: ${msg}`);
	process.exit(1);
}

function parseArgs(argv: string[]): Args {
	const positionals = argv.filter((a) => !a.startsWith("--"));
	const command: "run" | "snapshot" =
		positionals[0] === "snapshot" ? "snapshot" : "run";

	const flag = (name: string): string | undefined => {
		const i = argv.indexOf(`--${name}`);
		if (i === -1) return undefined;
		const v = argv[i + 1];
		if (v === undefined || v.startsWith("--")) {
			die(`flag --${name} requires a value`);
		}
		return v;
	};

	const has = (name: string) => argv.includes(`--${name}`);

	const skill = flag("skill");
	if (!skill) die("missing required flag --skill");

	const iterationFlag = flag("iteration");
	const iteration =
		iterationFlag !== undefined ? Number(iterationFlag) : undefined;
	if (iteration !== undefined && !Number.isInteger(iteration))
		die(`--iteration must be an integer, got ${iterationFlag}`);

	return {
		command,
		skill,
		mode: flag("mode") as Mode | undefined,
		baseline: flag("baseline"),
		label: flag("label"),
		iteration,
		dryRun: has("dry-run"),
	};
}

function ensureDir(path: string): void {
	if (!existsSync(path)) mkdirSync(path, { recursive: true });
}

function writeJson(path: string, value: unknown): void {
	writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function readJson<T>(path: string): T {
	return JSON.parse(readFileSync(path, "utf8"));
}

function nextIteration(
	workspaceSkillDir: string,
	override?: number,
): number {
	if (override !== undefined) return override;
	if (!existsSync(workspaceSkillDir)) return 1;
	const entries = readdirSync(workspaceSkillDir).filter((e) =>
		e.startsWith("iteration-"),
	);
	if (entries.length === 0) return 1;
	const nums = entries
		.map((e) => Number(e.slice("iteration-".length)))
		.filter((n) => Number.isFinite(n));
	return Math.max(...nums, 0) + 1;
}

function conditionNamesFor(mode: Mode): [string, string] {
	return mode === "new-skill"
		? ["with_skill", "without_skill"]
		: ["old_skill", "new_skill"];
}

function commandSnapshot(args: Args): void {
	if (!args.label) die("snapshot requires --label <name>");
	const skillDir = join(SKILLS_DIR, args.skill);
	const skillMd = join(skillDir, "SKILL.md");
	if (!existsSync(skillMd)) die(`skill not found: ${skillMd}`);

	const destDir = join(WORKSPACE_ROOT, args.skill, "snapshots", args.label);
	if (existsSync(destDir))
		die(
			`snapshot already exists: ${destDir}\n` +
				"  Use a different --label or delete the existing snapshot first.",
		);
	ensureDir(destDir);

	cpSync(skillMd, join(destDir, "SKILL.md"));
	for (const entry of readdirSync(skillDir)) {
		if (entry === "SKILL.md" || entry === "evals") continue;
		const src = join(skillDir, entry);
		const dst = join(destDir, entry);
		if (statSync(src).isDirectory()) cpSync(src, dst, { recursive: true });
		else cpSync(src, dst);
	}

	console.log(`Snapshotted ${args.skill} → ${destDir}`);
}

function commandRun(args: Args): void {
	if (!args.mode) die("--mode required: new-skill | revision");
	if (args.mode !== "new-skill" && args.mode !== "revision")
		die(`unknown --mode: ${args.mode}`);
	if (args.mode === "revision" && !args.baseline)
		die("revision mode requires --baseline <label>");

	const skillDir = join(SKILLS_DIR, args.skill);
	const skillMd = join(skillDir, "SKILL.md");
	if (!existsSync(skillMd)) die(`skill not found: ${skillMd}`);

	const evalsPath = join(skillDir, "evals", "evals.json");
	if (!existsSync(evalsPath)) die(`evals.json not found: ${evalsPath}`);

	const config: EvalsConfig = validateEvalsConfig(
		readJson(evalsPath),
		evalsPath,
	);
	if (config.skill_name !== args.skill)
		die(
			`evals.json skill_name (${config.skill_name}) does not match --skill (${args.skill})`,
		);

	const workspaceSkillDir = join(WORKSPACE_ROOT, args.skill);
	const iteration = nextIteration(workspaceSkillDir, args.iteration);
	const iterationDir = join(workspaceSkillDir, `iteration-${iteration}`);

	if (existsSync(iterationDir) && args.iteration === undefined)
		die(
			`iteration-${iteration} already exists; pass --iteration to overwrite explicitly`,
		);

	const [conditionA, conditionB] = conditionNamesFor(args.mode);

	let skillPathForA: string | null;
	let skillPathForB: string | null;
	if (args.mode === "new-skill") {
		skillPathForA = skillMd;
		skillPathForB = null;
	} else {
		const baselineSkill = join(
			workspaceSkillDir,
			"snapshots",
			args.baseline as string,
			"SKILL.md",
		);
		if (!existsSync(baselineSkill))
			die(
				`baseline snapshot not found: ${baselineSkill}\n` +
					`  Run: bun run evals:snapshot --skill ${args.skill} --label ${args.baseline} (before editing)`,
			);
		skillPathForA = baselineSkill;
		skillPathForB = skillMd;
	}

	console.log(
		`Preparing ${args.skill} iteration-${iteration} (${args.mode})`,
	);
	console.log(`  ${conditionA}: ${skillPathForA ?? "(no skill)"}`);
	console.log(`  ${conditionB}: ${skillPathForB ?? "(no skill)"}`);

	ensureDir(iterationDir);
	cpSync(skillMd, join(iterationDir, "skill-snapshot.md"));

	const conditions: ConditionsRecord = {
		mode: args.mode,
		baseline: args.baseline,
		conditions: [
			{ name: conditionA, skill_path: skillPathForA },
			{ name: conditionB, skill_path: skillPathForB },
		],
		timestamp: new Date().toISOString(),
	};
	writeJson(join(iterationDir, "conditions.json"), conditions);

	const tasks: DispatchTask[] = [];

	for (const ev of config.evals) {
		const evalDir = join(iterationDir, `eval-${ev.id}`);
		ensureDir(evalDir);

		for (const [condName, condSkillPath] of [
			[conditionA, skillPathForA],
			[conditionB, skillPathForB],
		] as const) {
			const condDir = join(evalDir, condName);
			const outputsDir = join(condDir, "outputs");
			ensureDir(outputsDir);

			const fixtures = copyFixtures(ev, skillDir, condDir);
			tasks.push(
				buildDispatchTask({
					evalId: ev.id,
					condition: condName,
					skillPath: condSkillPath,
					userPrompt: ev.prompt,
					fixtures,
					outputsDir,
					condDir,
				}),
			);
		}
	}

	const manifestPath = join(iterationDir, "dispatch-manifest.md");
	writeFileSync(
		manifestPath,
		buildManifest({
			skillName: args.skill,
			mode: args.mode,
			baseline: args.baseline,
			iteration,
			tasks,
		}),
	);

	const dispatchJsonPath = join(iterationDir, "dispatch.json");
	writeJson(dispatchJsonPath, {
		skill_name: args.skill,
		iteration,
		iteration_dir: iterationDir,
		mode: args.mode,
		baseline: args.baseline ?? null,
		conditions: conditions.conditions,
		tasks,
	});

	console.log(`\nWorkspace prepared: ${iterationDir}`);
	console.log(`Dispatch manifest:  ${manifestPath}`);
	console.log(`Dispatch tasks:     ${dispatchJsonPath}`);
	console.log(
		`\n${tasks.length} dispatches required (${config.evals.length} evals × 2 conditions).`,
	);

	if (args.dryRun) console.log("\n--dry-run: stopping after workspace prep.");
	else
		console.log(
			"\nNext (CLI mode): dispatch subagents per the manifest, then run `bun run evals:grade`.",
			"\nNext (agent-driven mode): read dispatch.json, dispatch each task as a subagent, write run.json + timing.json to the paths in each task.",
		);
}

type DispatchTask = {
	eval_id: string;
	condition: string;
	skill_path: string | null;
	user_prompt: string;
	fixtures: string[];
	outputs_dir: string;
	run_record_path: string;
	timing_path: string;
	agent_description: string;
	dispatch_prompt: string;
};

function copyFixtures(
	ev: Eval,
	skillDir: string,
	condDir: string,
): string[] {
	if (!ev.files || ev.files.length === 0) return [];
	const inputsDir = join(condDir, "inputs");
	ensureDir(inputsDir);
	const copied: string[] = [];
	for (const f of ev.files) {
		const src = join(skillDir, "evals", f);
		if (!existsSync(src)) die(`fixture not found: ${src}`);
		const dst = join(inputsDir, basename(f));
		if (statSync(src).isDirectory()) cpSync(src, dst, { recursive: true });
		else cpSync(src, dst);
		copied.push(dst);
	}
	return copied;
}

function buildDispatchTask(opts: {
	evalId: string;
	condition: string;
	skillPath: string | null;
	userPrompt: string;
	fixtures: string[];
	outputsDir: string;
	condDir: string;
}): DispatchTask {
	const skillBlock = opts.skillPath
		? [
				"The following skill is loaded into your operating guidelines. Apply it where relevant to the user's request.",
				"",
				`<skill name="${basename(dirname(opts.skillPath))}">`,
				readFileSync(opts.skillPath, "utf8").trim(),
				"</skill>",
			].join("\n")
		: "No skill is loaded. Respond as you naturally would.";
	const fixturesBlock = opts.fixtures.length
		? `Available fixture files:\n${opts.fixtures.map((f) => `  - ${f}`).join("\n")}`
		: "Available fixture files: none";

	const dispatchPrompt = [
		"You are executing a single test case for a skill evaluation framework.",
		"Treat this as a real user request — do NOT optimize behavior for the eval.",
		"",
		skillBlock,
		"",
		fixturesBlock,
		`Output directory: ${opts.outputsDir}`,
		"",
		"Instructions:",
		"- Write any files you produce into the output directory.",
		`- After completing the task, write your final user-facing response to ${opts.outputsDir}/final-message.md.`,
		"- Do not write outside the output directory.",
		"",
		"User request:",
		opts.userPrompt,
	].join("\n");

	return {
		eval_id: opts.evalId,
		condition: opts.condition,
		skill_path: opts.skillPath,
		user_prompt: opts.userPrompt,
		fixtures: opts.fixtures,
		outputs_dir: opts.outputsDir,
		run_record_path: join(opts.condDir, "run.json"),
		timing_path: join(opts.condDir, "timing.json"),
		agent_description: `${opts.evalId}:${opts.condition}`,
		dispatch_prompt: dispatchPrompt,
	};
}

function buildManifest(opts: {
	skillName: string;
	mode: Mode;
	baseline?: string;
	iteration: number;
	tasks: DispatchTask[];
}): string {
	const header = [
		`# Dispatch manifest — ${opts.skillName} iteration-${opts.iteration}`,
		"",
		`Mode: ${opts.mode}${opts.baseline ? ` (baseline: ${opts.baseline})` : ""}`,
		`Generated: ${new Date().toISOString()}`,
		`Total dispatches: ${opts.tasks.length}`,
		"",
		"## How to use this manifest",
		"",
		"**Two ways to drive this:**",
		"",
		"1. **CLI / manual mode** — Read each dispatch below. Hand each one to a fresh general-purpose subagent. When the subagent finishes, write `run.json` and `timing.json` to the paths shown.",
		"2. **Agent-driven mode** — In an agent session, read `dispatch.json` (sibling of this file) instead of this manifest. Each task has a `dispatch_prompt` field ready to hand to the host's subagent dispatch primitive, plus exact paths for `run.json` and `timing.json`.",
		"",
		"**Transcript correlation (agent-driven mode):** Each task has an `agent_description` field of the form `<eval_id>:<condition>`. When dispatching the subagent via the host's primitive (e.g. Claude Code's Agent tool), pass this string as the dispatch `description`. The transcript adapter uses it to correlate each subagent's persisted transcript back to the right `(eval, condition)` slot.",
		"",
		"After every dispatch:",
		"",
		"1. Write `run.json` matching `skills/evaluating-skills/schema/run-record.schema.json`. Populate `final_message` from the subagent's reply and leave `tool_invocations` as `[]` for now — `evals:fill-transcripts` will populate it from the persisted transcript in a later step.",
		"2. Capture `total_tokens` and `duration_ms` from the harness's task completion event into `timing.json`. These values may not be persisted anywhere else — save them immediately.",
		"",
		"After all dispatches:",
		"",
		"3. (Claude Code only, optional) Run `bun run evals:fill-transcripts --skill <name> --iteration <N> --subagents-dir ~/.claude/projects/<project-slug>/<parent-session-id>/subagents/` to fill `tool_invocations` from each subagent's persisted transcript. Skipping this step leaves `transcript_check` assertions unverifiable.",
		"4. Run `bun run evals:grade --skill <name> --iteration <N>` to grade.",
		"",
		"## Dispatches",
		"",
	].join("\n");

	const entries = opts.tasks
		.map((t) =>
			[
				`### ${t.eval_id} / ${t.condition}`,
				"",
				`- run.json:    ${t.run_record_path}`,
				`- timing.json: ${t.timing_path}`,
				"",
				"```",
				t.dispatch_prompt,
				"```",
				"",
			].join("\n"),
		)
		.join("\n");

	return header + entries;
}

const args = parseArgs(Bun.argv.slice(2));
if (args.command === "snapshot") commandSnapshot(args);
else commandRun(args);
