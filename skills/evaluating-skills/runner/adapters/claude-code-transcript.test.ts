import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  findByDescription,
  listSubagents,
  parseTranscript,
} from "./claude-code-transcript";

const FIXTURE_ROOT = join(tmpdir(), `claude-code-adapter-test-${process.pid}`);

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
  test("extracts tool_use blocks from assistant messages with ordinal and args", () => {
    const path = join(FIXTURE_ROOT, "simple.jsonl");
    writeFileSync(
      path,
      jsonl([
        {
          type: "user",
          message: { role: "user", content: "Run the tests" },
        },
        {
          type: "assistant",
          message: {
            role: "assistant",
            content: [
              { type: "text", text: "Running tests now." },
              {
                type: "tool_use",
                id: "toolu_001",
                name: "Bash",
                input: { command: "bun test" },
              },
            ],
          },
        },
        {
          type: "user",
          message: {
            role: "user",
            content: [
              {
                type: "tool_result",
                tool_use_id: "toolu_001",
                content: "2 pass\n0 fail",
              },
            ],
          },
        },
        {
          type: "assistant",
          message: {
            role: "assistant",
            content: [
              {
                type: "tool_use",
                id: "toolu_002",
                name: "Read",
                input: { file_path: "/tmp/x.txt" },
              },
            ],
          },
        },
      ]),
    );

    const result = parseTranscript(path);
    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      name: "Bash",
      ordinal: 0,
      args: { command: "bun test" },
      result: "2 pass\n0 fail",
    });
    expect(result[1]).toMatchObject({
      name: "Read",
      ordinal: 1,
      args: { file_path: "/tmp/x.txt" },
    });
    expect(result[1].result).toBeUndefined();
  });

  test("returns empty array when no tool_use blocks present", () => {
    const path = join(FIXTURE_ROOT, "no-tools.jsonl");
    writeFileSync(
      path,
      jsonl([
        { type: "user", message: { role: "user", content: "hi" } },
        {
          type: "assistant",
          message: {
            role: "assistant",
            content: [{ type: "text", text: "hello" }],
          },
        },
      ]),
    );
    expect(parseTranscript(path)).toEqual([]);
  });

  test("skips malformed JSONL lines without throwing", () => {
    const path = join(FIXTURE_ROOT, "malformed.jsonl");
    writeFileSync(
      path,
      [
        JSON.stringify({
          type: "assistant",
          message: {
            role: "assistant",
            content: [
              {
                type: "tool_use",
                id: "toolu_a",
                name: "Bash",
                input: { command: "ls" },
              },
            ],
          },
        }),
        "not valid json",
        JSON.stringify({
          type: "assistant",
          message: {
            role: "assistant",
            content: [
              {
                type: "tool_use",
                id: "toolu_b",
                name: "Read",
                input: { file_path: "/tmp" },
              },
            ],
          },
        }),
        "",
      ].join("\n"),
    );
    const result = parseTranscript(path);
    expect(result).toHaveLength(2);
    expect(result.map((r) => r.name)).toEqual(["Bash", "Read"]);
  });

  test("handles tool_result with array content", () => {
    const path = join(FIXTURE_ROOT, "array-result.jsonl");
    writeFileSync(
      path,
      jsonl([
        {
          type: "assistant",
          message: {
            role: "assistant",
            content: [
              {
                type: "tool_use",
                id: "toolu_x",
                name: "Bash",
                input: { command: "echo hi" },
              },
            ],
          },
        },
        {
          type: "user",
          message: {
            role: "user",
            content: [
              {
                type: "tool_result",
                tool_use_id: "toolu_x",
                content: [{ type: "text", text: "hi" }],
              },
            ],
          },
        },
      ]),
    );
    const result = parseTranscript(path);
    expect(result).toHaveLength(1);
    expect(result[0].result).toBe("hi");
  });
});

describe("listSubagents / findByDescription", () => {
  test("matches subagents by meta description", () => {
    const dir = join(FIXTURE_ROOT, "subagents");
    mkdirSync(dir, { recursive: true });

    writeFileSync(
      join(dir, "agent-aaa111.meta.json"),
      JSON.stringify({
        agentType: "general-purpose",
        description: "claim-without-running:with_skill",
        toolUseId: "toolu_p1",
      }),
    );
    writeFileSync(join(dir, "agent-aaa111.jsonl"), "");

    writeFileSync(
      join(dir, "agent-bbb222.meta.json"),
      JSON.stringify({
        agentType: "general-purpose",
        description: "claim-without-running:without_skill",
        toolUseId: "toolu_p2",
      }),
    );
    writeFileSync(join(dir, "agent-bbb222.jsonl"), "");

    expect(listSubagents(dir)).toHaveLength(2);

    const match = findByDescription(dir, "claim-without-running:with_skill");
    expect(match).not.toBeNull();
    expect(match?.meta.toolUseId).toBe("toolu_p1");

    const miss = findByDescription(dir, "no-such-eval:with_skill");
    expect(miss).toBeNull();
  });

  test("returns null when subagents dir does not exist", () => {
    expect(listSubagents(join(FIXTURE_ROOT, "does-not-exist"))).toEqual([]);
    expect(
      findByDescription(join(FIXTURE_ROOT, "does-not-exist"), "x"),
    ).toBeNull();
  });

  test("on duplicate descriptions, returns the most-recently-written transcript", () => {
    const dir = join(FIXTURE_ROOT, "dup-subagents");
    mkdirSync(dir, { recursive: true });

    // Older agent for this description.
    writeFileSync(
      join(dir, "agent-old.meta.json"),
      JSON.stringify({ description: "dup:with_skill", toolUseId: "toolu_old" }),
    );
    writeFileSync(join(dir, "agent-old.jsonl"), "");
    const old = new Date(Date.now() - 60_000);
    utimesSync(join(dir, "agent-old.jsonl"), old, old);

    // Newer agent with the same description (e.g. a retry within the same run).
    writeFileSync(
      join(dir, "agent-new.meta.json"),
      JSON.stringify({ description: "dup:with_skill", toolUseId: "toolu_new" }),
    );
    writeFileSync(join(dir, "agent-new.jsonl"), "");
    const recent = new Date();
    utimesSync(join(dir, "agent-new.jsonl"), recent, recent);

    const match = findByDescription(dir, "dup:with_skill");
    expect(match?.meta.toolUseId).toBe("toolu_new");
  });
});
