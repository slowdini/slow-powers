import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import {
	findByDescription,
	listSubagents,
	parseTranscript,
} from "./antigravity-transcript";

const FIXTURE_ROOT = join(tmpdir(), `antigravity-adapter-test-${process.pid}`);

function jsonl(lines: object[]): string {
	return `${lines.map((l) => JSON.stringify(l)).join("\n")}\n`;
}

beforeAll(() => {
	mkdirSync(FIXTURE_ROOT, { recursive: true });
});

afterAll(() => {
	rmSync(FIXTURE_ROOT, { recursive: true, force: true });
});

describe("parseTranscript", () => {
	test("extracts tool_calls from PLANNER_RESPONSE and matches sequential result steps", () => {
		const path = join(FIXTURE_ROOT, "simple.jsonl");
		writeFileSync(
			path,
			jsonl([
				{
					step_index: 0,
					source: "USER_EXPLICIT",
					type: "USER_INPUT",
					content: "Hello",
				},
				{
					step_index: 1,
					source: "MODEL",
					type: "PLANNER_RESPONSE",
					content: "I will view a file.",
					tool_calls: [
						{
							name: "view_file",
							args: {
								AbsolutePath: '"/Users/user/file.txt"',
								IsSkillFile: '"true"',
							},
						},
					],
				},
				{
					step_index: 2,
					source: "MODEL",
					type: "VIEW_FILE",
					status: "DONE",
					content: "file content here",
				},
				{
					step_index: 3,
					source: "MODEL",
					type: "PLANNER_RESPONSE",
					content: "I will run a command.",
					tool_calls: [
						{
							name: "run_command",
							args: {
								CommandLine: '"bun test"',
								WaitMsBeforeAsync: '"3000"',
							},
						},
					],
				},
				{
					step_index: 4,
					source: "MODEL",
					type: "RUN_COMMAND",
					status: "DONE",
					content: "tests passed successfully",
				},
			]),
		);

		const result = parseTranscript(path);
		expect(result).toHaveLength(2);
		expect(result[0]).toMatchObject({
			name: "view_file",
			ordinal: 0,
			args: {
				AbsolutePath: "/Users/user/file.txt",
				IsSkillFile: true,
			},
			result: "file content here",
		});
		expect(result[1]).toMatchObject({
			name: "run_command",
			ordinal: 1,
			args: {
				CommandLine: "bun test",
				WaitMsBeforeAsync: 3000,
			},
			result: "tests passed successfully",
		});
	});

	test("gracefully handles skipped or malformed lines", () => {
		const path = join(FIXTURE_ROOT, "malformed.jsonl");
		writeFileSync(
			path,
			[
				JSON.stringify({
					step_index: 1,
					source: "MODEL",
					type: "PLANNER_RESPONSE",
					tool_calls: [{ name: "ls", args: {} }],
				}),
				"malformed json line",
				JSON.stringify({
					step_index: 2,
					source: "MODEL",
					type: "LS",
					content: "some list",
				}),
			].join("\n"),
		);

		const result = parseTranscript(path);
		expect(result).toHaveLength(1);
		expect(result[0]).toMatchObject({
			name: "ls",
			ordinal: 0,
			result: "some list",
		});
	});

	test("cleans nested and complex arguments", () => {
		const path = join(FIXTURE_ROOT, "nested-args.jsonl");
		writeFileSync(
			path,
			jsonl([
				{
					step_index: 1,
					source: "MODEL",
					type: "PLANNER_RESPONSE",
					tool_calls: [
						{
							name: "custom_tool",
							args: {
								nestedObj: {
									nestedKey: '"nestedValue"',
									nestedNum: '"123"',
								},
								nestedArr: ['"item1"', '"item2"'],
							},
						},
					],
				},
			]),
		);

		const result = parseTranscript(path);
		expect(result).toHaveLength(1);
		expect(result[0].args).toEqual({
			nestedObj: {
				nestedKey: "nestedValue",
				nestedNum: 123,
			},
			nestedArr: ["item1", "item2"],
		});
	});
});

describe("listSubagents / findByDescription", () => {
	test("discovers subagents by parsing parent invoke_subagent tool calls and UUIDs", () => {
		const brainDir = join(FIXTURE_ROOT, "brain");
		const parentId = "9691651a-3437-4775-9b41-70971ba9b4b3";
		const subagentId1 = "1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d";
		const subagentId2 = "2a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d";

		const parentLogsDir = join(brainDir, parentId, ".system_generated", "logs");
		const sub1LogsDir = join(brainDir, subagentId1, ".system_generated", "logs");
		const sub2LogsDir = join(brainDir, subagentId2, ".system_generated", "logs");

		mkdirSync(parentLogsDir, { recursive: true });
		mkdirSync(sub1LogsDir, { recursive: true });
		mkdirSync(sub2LogsDir, { recursive: true });

		// Write parent transcript spawning two subagents (one with specific Role, one with TypeName)
		writeFileSync(
			join(parentLogsDir, "transcript.jsonl"),
			jsonl([
				{
					step_index: 0,
					source: "MODEL",
					type: "PLANNER_RESPONSE",
					tool_calls: [
						{
							name: "invoke_subagent",
							args: {
								Subagents: [
									{
										TypeName: "self",
										Role: "eval-1:with_skill",
										Prompt: "Do task 1",
									},
								],
							},
						},
					],
				},
				{
					step_index: 1,
					source: "MODEL",
					type: "INVOKE_SUBAGENT",
					content: `Spawned subagent successfully with conversationID: ${subagentId1}`,
				},
				{
					step_index: 2,
					source: "MODEL",
					type: "PLANNER_RESPONSE",
					tool_calls: [
						{
							name: "invoke_subagent",
							args: {
								Subagents: [
									{
										TypeName: "research",
										Prompt: "Do research",
									},
								],
							},
						},
					],
				},
				{
					step_index: 3,
					source: "MODEL",
					type: "INVOKE_SUBAGENT",
					content: `Spawned subagent successfully with conversationID: ${subagentId2}`,
				},
			]),
		);

		// Write subagent transcripts
		writeFileSync(join(sub1LogsDir, "transcript.jsonl"), jsonl([]));
		writeFileSync(join(sub2LogsDir, "transcript.jsonl"), jsonl([]));

		const subagents = listSubagents(brainDir);
		expect(subagents).toHaveLength(2);

		const match1 = findByDescription(brainDir, "eval-1:with_skill");
		expect(match1).not.toBeNull();
		expect(match1?.jsonlPath).toBe(join(sub1LogsDir, "transcript.jsonl"));

		const match2 = findByDescription(brainDir, "Do research");
		expect(match2).not.toBeNull();
		expect(match2?.jsonlPath).toBe(join(sub2LogsDir, "transcript.jsonl"));
	});
});
