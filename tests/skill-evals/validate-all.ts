#!/usr/bin/env bun
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { validateEvalsConfig } from "./validate";

const REPO_ROOT = resolve(import.meta.dir, "../..");
const SKILLS_DIR = join(REPO_ROOT, "skills");

if (!existsSync(SKILLS_DIR)) {
	console.error(`skills dir not found: ${SKILLS_DIR}`);
	process.exit(1);
}

const skills = readdirSync(SKILLS_DIR).filter((d) => {
	const path = join(SKILLS_DIR, d);
	return statSync(path).isDirectory();
});

let validated = 0;
let failed = 0;
const errors: string[] = [];

for (const skill of skills) {
	const evalsPath = join(SKILLS_DIR, skill, "evals", "evals.json");
	if (!existsSync(evalsPath)) continue;

	try {
		const raw = JSON.parse(readFileSync(evalsPath, "utf8"));
		validateEvalsConfig(raw, evalsPath);
		console.log(`✓ ${skill}/evals/evals.json`);
		validated++;
	} catch (err) {
		console.error(`✗ ${skill}/evals/evals.json: ${(err as Error).message}`);
		errors.push(`${skill}: ${(err as Error).message}`);
		failed++;
	}
}

console.log(`\nValidated ${validated} evals.json file(s); ${failed} failed.`);
if (failed > 0) {
	console.error("\nFailures:");
	for (const e of errors) console.error(`  - ${e}`);
	process.exit(1);
}
