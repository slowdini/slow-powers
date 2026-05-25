import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { cleanupStagedSkills, stageSkillForCC, STAGED_SKILL_PREFIX } from "./run";

const FIXTURE_ROOT = join(tmpdir(), `superslow-run-test-${process.pid}`);

beforeAll(() => {
	mkdirSync(FIXTURE_ROOT, { recursive: true });
});

afterAll(() => {
	rmSync(FIXTURE_ROOT, { recursive: true, force: true });
});

describe("stageSkillForCC", () => {
	test("writes SKILL.md to <repoRoot>/.claude/skills/<slug>/SKILL.md and returns the slug", () => {
		const repoRoot = join(FIXTURE_ROOT, "stage-basic");
		mkdirSync(repoRoot, { recursive: true });
		const content = "---\nname: example\ndescription: example skill\n---\n\nbody\n";

		const slug = stageSkillForCC({
			content,
			iteration: 3,
			condition: "with_skill",
			skillName: "verification-before-completion",
			repoRoot,
		});

		expect(slug).toBe(
			`${STAGED_SKILL_PREFIX}3-with_skill__verification-before-completion`,
		);
		const stagedPath = join(repoRoot, ".claude", "skills", slug, "SKILL.md");
		expect(existsSync(stagedPath)).toBe(true);
		expect(readFileSync(stagedPath, "utf8")).toBe(content);
	});

	test("overwrites an existing staged skill at the same slug", () => {
		const repoRoot = join(FIXTURE_ROOT, "stage-overwrite");
		mkdirSync(repoRoot, { recursive: true });

		stageSkillForCC({
			content: "first",
			iteration: 1,
			condition: "with_skill",
			skillName: "s",
			repoRoot,
		});
		const slug = stageSkillForCC({
			content: "second",
			iteration: 1,
			condition: "with_skill",
			skillName: "s",
			repoRoot,
		});

		const stagedPath = join(repoRoot, ".claude", "skills", slug, "SKILL.md");
		expect(readFileSync(stagedPath, "utf8")).toBe("second");
	});
});

describe("cleanupStagedSkills", () => {
	test("removes only directories with the staged-skill prefix under .claude/skills", () => {
		const repoRoot = join(FIXTURE_ROOT, "cleanup");
		const skillsDir = join(repoRoot, ".claude", "skills");
		mkdirSync(skillsDir, { recursive: true });

		const stagedA = join(skillsDir, `${STAGED_SKILL_PREFIX}1-with_skill__foo`);
		const stagedB = join(skillsDir, `${STAGED_SKILL_PREFIX}1-new_skill__bar`);
		const productionLike = join(skillsDir, "user-custom-skill");
		mkdirSync(stagedA, { recursive: true });
		mkdirSync(stagedB, { recursive: true });
		mkdirSync(productionLike, { recursive: true });

		cleanupStagedSkills(repoRoot);

		expect(existsSync(stagedA)).toBe(false);
		expect(existsSync(stagedB)).toBe(false);
		expect(existsSync(productionLike)).toBe(true);
	});

	test("is a no-op when .claude/skills does not exist", () => {
		const repoRoot = join(FIXTURE_ROOT, "cleanup-empty");
		mkdirSync(repoRoot, { recursive: true });
		expect(() => cleanupStagedSkills(repoRoot)).not.toThrow();
	});
});
