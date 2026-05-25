import { describe, expect, test } from "bun:test";
import { checkSkillInvokedFromTranscript } from "./grade";
import type { ToolInvocation } from "./types";

describe("checkSkillInvokedFromTranscript", () => {
	test("returns true when transcript contains a Skill call with input.skill matching the slug", () => {
		const slug = "superslow-eval-1-with_skill__verification-before-completion";
		const invocations: ToolInvocation[] = [
			{ name: "Bash", args: { command: "ls" }, ordinal: 0 },
			{ name: "Skill", args: { skill: slug }, ordinal: 1 },
			{ name: "Read", args: { file_path: "/tmp/x" }, ordinal: 2 },
		];
		expect(checkSkillInvokedFromTranscript(invocations, slug)).toBe(true);
	});

	test("returns false when transcript has no Skill calls", () => {
		const invocations: ToolInvocation[] = [
			{ name: "Bash", args: { command: "ls" }, ordinal: 0 },
			{ name: "Read", args: { file_path: "/tmp/x" }, ordinal: 1 },
		];
		expect(
			checkSkillInvokedFromTranscript(
				invocations,
				"superslow-eval-1-with_skill__foo",
			),
		).toBe(false);
	});

	test("returns false when Skill call references a different slug", () => {
		const slug = "superslow-eval-1-with_skill__verification-before-completion";
		const invocations: ToolInvocation[] = [
			{ name: "Skill", args: { skill: "superslow:writing-skills" }, ordinal: 0 },
			{
				name: "Skill",
				args: { skill: "superslow-eval-2-old_skill__other" },
				ordinal: 1,
			},
		];
		expect(checkSkillInvokedFromTranscript(invocations, slug)).toBe(false);
	});

	test("returns false on empty invocations array", () => {
		expect(checkSkillInvokedFromTranscript([], "anything")).toBe(false);
	});

	test("tolerates Skill invocations whose args are missing or malformed", () => {
		const slug = "superslow-eval-1-with_skill__foo";
		const invocations: ToolInvocation[] = [
			{ name: "Skill", ordinal: 0 },
			{ name: "Skill", args: "not-an-object", ordinal: 1 },
			{ name: "Skill", args: { other: "field" }, ordinal: 2 },
		];
		expect(checkSkillInvokedFromTranscript(invocations, slug)).toBe(false);
	});
});
