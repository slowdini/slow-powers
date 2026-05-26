import { existsSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";

export type Harness = "claude-code" | "antigravity";

export type RunContext = {
	skillDir: string;
	skillName: string;
	skillSubdir: string;
	siblingSkillNames: string[];
	workspaceRoot: string;
	stageRoot: string;
	bootstrapPath: string | null;
	harness: Harness;
};

function die(msg: string): never {
	throw new Error(msg);
}

function flag(argv: string[], name: string): string | undefined {
	const i = argv.indexOf(`--${name}`);
	if (i === -1) return undefined;
	const v = argv[i + 1];
	if (v === undefined || v.startsWith("--")) {
		die(`flag --${name} requires a value`);
	}
	return v;
}

export function detectRunContext(argv: string[]): RunContext {
	const skillDirRaw = flag(argv, "skill-dir");
	if (!skillDirRaw) die("missing required flag --skill-dir <path>");
	const skillDir = resolve(skillDirRaw);
	if (!existsSync(skillDir) || !statSync(skillDir).isDirectory()) {
		die(`--skill-dir is not a directory: ${skillDir}`);
	}

	const skillName = flag(argv, "skill");
	if (!skillName) die("missing required flag --skill <name>");

	const skillSubdir = resolve(skillDir, skillName);
	const skillMd = resolve(skillSubdir, "SKILL.md");
	if (!existsSync(skillMd)) {
		die(`skill not found: ${skillMd}`);
	}

	const bootstrapRaw = flag(argv, "bootstrap");
	let bootstrapPath: string | null = null;
	if (bootstrapRaw) {
		const resolved = resolve(bootstrapRaw);
		if (!existsSync(resolved)) {
			die(`--bootstrap file not found: ${resolved}`);
		}
		bootstrapPath = resolved;
	}

	const workspaceRaw = flag(argv, "workspace-dir");
	const workspaceRoot = workspaceRaw
		? resolve(workspaceRaw)
		: resolve(process.cwd(), "skills-workspace");

	const stageRoot = resolve(process.cwd());

	const harnessRaw = flag(argv, "harness") ?? "claude-code";
	if (harnessRaw !== "claude-code" && harnessRaw !== "antigravity") {
		die(
			`unknown --harness: ${harnessRaw}. Supported: claude-code, antigravity`,
		);
	}
	const harness = harnessRaw as Harness;

	const siblingSkillNames: string[] = [];
	for (const entry of readdirSync(skillDir)) {
		if (entry === skillName) continue;
		const sub = resolve(skillDir, entry);
		if (!statSync(sub).isDirectory()) continue;
		if (!existsSync(resolve(sub, "SKILL.md"))) continue;
		siblingSkillNames.push(entry);
	}

	return {
		skillDir,
		skillName,
		skillSubdir,
		siblingSkillNames,
		workspaceRoot,
		stageRoot,
		bootstrapPath,
		harness,
	};
}
