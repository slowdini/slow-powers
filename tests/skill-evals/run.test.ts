import {
	existsSync,
	mkdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import {
	buildDispatchTask,
	cleanupStagedSkills,
	stageSiblingSkills,
	stageSkillForCC,
	STAGED_SIBLING_MANIFEST,
	STAGED_SKILL_PREFIX,
} from "./run";

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

describe("stageSiblingSkills", () => {
	function buildSourceSkills(root: string): string {
		const src = join(root, "src-skills");
		mkdirSync(join(src, "alpha", "evals"), { recursive: true });
		writeFileSync(join(src, "alpha", "SKILL.md"), "alpha content");
		writeFileSync(join(src, "alpha", "helper.md"), "alpha helper");
		writeFileSync(join(src, "alpha", "evals", "evals.json"), "{}");
		mkdirSync(join(src, "beta"), { recursive: true });
		writeFileSync(join(src, "beta", "SKILL.md"), "beta content");
		mkdirSync(join(src, "gamma"), { recursive: true });
		writeFileSync(join(src, "gamma", "SKILL.md"), "gamma content");
		return src;
	}

	test("stages each sibling at .claude/skills/<name>/ with full content minus evals/", () => {
		const root = join(FIXTURE_ROOT, "sibling-basic");
		mkdirSync(root, { recursive: true });
		const src = buildSourceSkills(root);

		stageSiblingSkills({
			skillUnderTest: "gamma",
			skillsSourceDir: src,
			repoRoot: root,
		});

		const skillsDir = join(root, ".claude", "skills");
		expect(readFileSync(join(skillsDir, "alpha", "SKILL.md"), "utf8")).toBe(
			"alpha content",
		);
		expect(readFileSync(join(skillsDir, "alpha", "helper.md"), "utf8")).toBe(
			"alpha helper",
		);
		expect(existsSync(join(skillsDir, "alpha", "evals"))).toBe(false);
		expect(readFileSync(join(skillsDir, "beta", "SKILL.md"), "utf8")).toBe(
			"beta content",
		);
		expect(existsSync(join(skillsDir, "gamma"))).toBe(false);

		const manifestPath = join(skillsDir, STAGED_SIBLING_MANIFEST);
		expect(existsSync(manifestPath)).toBe(true);
		const written = JSON.parse(readFileSync(manifestPath, "utf8")) as {
			created_entries: Array<{ name: string; preexisting: boolean }>;
		};
		expect(written.created_entries.map((e) => e.name).sort()).toEqual([
			"alpha",
			"beta",
		]);
		for (const e of written.created_entries) {
			expect(e.preexisting).toBe(false);
		}
	});

	test("backs up colliding pre-existing entries and records them in the manifest", () => {
		const root = join(FIXTURE_ROOT, "sibling-collide");
		mkdirSync(root, { recursive: true });
		const src = buildSourceSkills(root);

		const skillsDir = join(root, ".claude", "skills");
		mkdirSync(join(skillsDir, "alpha"), { recursive: true });
		writeFileSync(join(skillsDir, "alpha", "SKILL.md"), "USER OWNED");

		stageSiblingSkills({
			skillUnderTest: "gamma",
			skillsSourceDir: src,
			repoRoot: root,
		});

		expect(readFileSync(join(skillsDir, "alpha", "SKILL.md"), "utf8")).toBe(
			"alpha content",
		);
		const manifest = JSON.parse(
			readFileSync(join(skillsDir, STAGED_SIBLING_MANIFEST), "utf8"),
		) as {
			created_entries: Array<{
				name: string;
				preexisting: boolean;
				backup_path?: string;
			}>;
		};
		const alphaEntry = manifest.created_entries.find((e) => e.name === "alpha");
		expect(alphaEntry).toBeDefined();
		expect(alphaEntry?.preexisting).toBe(true);
		expect(alphaEntry?.backup_path).toBeDefined();
		const backupPath = alphaEntry?.backup_path as string;
		expect(existsSync(backupPath)).toBe(true);
		expect(readFileSync(join(backupPath, "SKILL.md"), "utf8")).toBe(
			"USER OWNED",
		);
	});

	test("skips the skill-under-test even if it appears in the source skills dir", () => {
		const root = join(FIXTURE_ROOT, "sibling-skip-under-test");
		mkdirSync(root, { recursive: true });
		const src = buildSourceSkills(root);

		stageSiblingSkills({
			skillUnderTest: "alpha",
			skillsSourceDir: src,
			repoRoot: root,
		});

		const skillsDir = join(root, ".claude", "skills");
		expect(existsSync(join(skillsDir, "alpha"))).toBe(false);
		expect(existsSync(join(skillsDir, "beta"))).toBe(true);
		expect(existsSync(join(skillsDir, "gamma"))).toBe(true);
	});
});

describe("cleanupStagedSkills (manifest-aware)", () => {
	test("removes manifest-listed sibling entries and restores backed-up pre-existing content", () => {
		const root = join(FIXTURE_ROOT, "cleanup-restore");
		mkdirSync(root, { recursive: true });
		const src = join(root, "src-skills");
		mkdirSync(join(src, "alpha"), { recursive: true });
		writeFileSync(join(src, "alpha", "SKILL.md"), "new alpha");
		mkdirSync(join(src, "beta"), { recursive: true });
		writeFileSync(join(src, "beta", "SKILL.md"), "new beta");

		const skillsDir = join(root, ".claude", "skills");
		mkdirSync(join(skillsDir, "alpha"), { recursive: true });
		writeFileSync(join(skillsDir, "alpha", "SKILL.md"), "USER ALPHA");

		stageSiblingSkills({
			skillUnderTest: "x",
			skillsSourceDir: src,
			repoRoot: root,
		});
		expect(readFileSync(join(skillsDir, "alpha", "SKILL.md"), "utf8")).toBe(
			"new alpha",
		);
		expect(readFileSync(join(skillsDir, "beta", "SKILL.md"), "utf8")).toBe(
			"new beta",
		);

		cleanupStagedSkills(root);

		expect(readFileSync(join(skillsDir, "alpha", "SKILL.md"), "utf8")).toBe(
			"USER ALPHA",
		);
		expect(existsSync(join(skillsDir, "beta"))).toBe(false);
		expect(existsSync(join(skillsDir, STAGED_SIBLING_MANIFEST))).toBe(false);
	});

	test("still sweeps prefix-staged entries when no manifest is present", () => {
		const root = join(FIXTURE_ROOT, "cleanup-legacy");
		const skillsDir = join(root, ".claude", "skills");
		mkdirSync(skillsDir, { recursive: true });
		mkdirSync(join(skillsDir, `${STAGED_SKILL_PREFIX}1-with_skill__foo`), {
			recursive: true,
		});
		mkdirSync(join(skillsDir, "user-custom"), { recursive: true });

		cleanupStagedSkills(root);

		expect(
			existsSync(join(skillsDir, `${STAGED_SKILL_PREFIX}1-with_skill__foo`)),
		).toBe(false);
		expect(existsSync(join(skillsDir, "user-custom"))).toBe(true);
	});
});

describe("buildDispatchTask bootstrap injection", () => {
	const baseOpts = {
		evalId: "e1",
		condition: "with_skill",
		skillPath: null,
		stagedSkillSlug: "superslow-eval-1-with_skill__foo" as string | null,
		userPrompt: "do the thing",
		fixtures: [] as string[],
		outputsDir: "/tmp/out",
		condDir: "/tmp/cond",
	};

	test("prepends <session-start-context> for claude-code when bootstrapContent is provided", () => {
		const task = buildDispatchTask({
			...baseOpts,
			harness: "claude-code",
			bootstrapContent: "BOOT-LOADED",
		});
		expect(task.dispatch_prompt.startsWith("<session-start-context>")).toBe(
			true,
		);
		expect(task.dispatch_prompt).toContain("BOOT-LOADED");
		expect(task.dispatch_prompt).toContain("</session-start-context>");
	});

	test("omits <session-start-context> when bootstrapContent is null", () => {
		const task = buildDispatchTask({
			...baseOpts,
			harness: "claude-code",
			bootstrapContent: null,
		});
		expect(task.dispatch_prompt).not.toContain("<session-start-context>");
	});

	test("references staged slug in skill block for claude-code", () => {
		const task = buildDispatchTask({
			...baseOpts,
			harness: "claude-code",
			bootstrapContent: "BOOT-LOADED",
		});
		expect(task.dispatch_prompt).toContain(
			"superslow-eval-1-with_skill__foo",
		);
	});

	test("without-skill condition under realistic env reflects 'this skill removed, others available' rather than 'no skill loaded'", () => {
		const task = buildDispatchTask({
			...baseOpts,
			skillPath: null,
			stagedSkillSlug: null,
			harness: "claude-code",
			bootstrapContent: "BOOT-LOADED",
		});
		expect(task.dispatch_prompt).not.toContain("No skill is loaded");
		expect(task.dispatch_prompt.toLowerCase()).toContain("not available");
	});

	test("without-skill condition without bootstrap (e.g. --no-stage) keeps the legacy 'No skill is loaded' wording", () => {
		const task = buildDispatchTask({
			...baseOpts,
			skillPath: null,
			stagedSkillSlug: null,
			harness: "claude-code",
			bootstrapContent: null,
		});
		expect(task.dispatch_prompt).toContain("No skill is loaded");
	});
});
