import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { recordRuns } from "./record-runs";
import type { RunRecord, TimingRecord } from "./types";

const ROOT = join(tmpdir(), `record-runs-test-${process.pid}`);

let iterationDir: string;
let subagentsDir: string;

function jsonl(lines: object[]): string {
  return `${lines.map((l) => JSON.stringify(l)).join("\n")}\n`;
}

/** A minimal transcript with usage, timestamps, one tool call, and final text. */
function transcriptLines(finalText: string): object[] {
  return [
    {
      type: "user",
      timestamp: "2026-06-04T10:00:00.000Z",
      message: { role: "user", content: "go" },
    },
    {
      type: "assistant",
      timestamp: "2026-06-04T10:00:10.000Z",
      message: {
        id: "msg_1",
        role: "assistant",
        usage: {
          input_tokens: 100,
          output_tokens: 20,
          cache_creation_input_tokens: 30,
          cache_read_input_tokens: 50,
        },
        content: [
          {
            type: "tool_use",
            id: "toolu_1",
            name: "Bash",
            input: { command: "ls" },
          },
        ],
      },
    },
    {
      type: "user",
      timestamp: "2026-06-04T10:00:12.000Z",
      message: {
        role: "user",
        content: [
          { type: "tool_result", tool_use_id: "toolu_1", content: "ok" },
        ],
      },
    },
    {
      type: "assistant",
      timestamp: "2026-06-04T10:01:00.000Z",
      message: {
        id: "msg_2",
        role: "assistant",
        usage: {
          input_tokens: 200,
          output_tokens: 40,
          cache_creation_input_tokens: 0,
          cache_read_input_tokens: 60,
        },
        content: [{ type: "text", text: finalText }],
      },
    },
  ];
}

// Token math for transcriptLines: msg_1 (100+20+30+50) + msg_2 (200+40+0+60) = 500.
const TRANSCRIPT_TOKENS = 500;
// 10:00:00.000 → 10:01:00.000
const TRANSCRIPT_DURATION_MS = 60_000;

function writeSubagent(name: string, description: string, lines: object[]) {
  writeFileSync(
    join(subagentsDir, `${name}.meta.json`),
    JSON.stringify({ agentType: "general-purpose", description }),
  );
  writeFileSync(join(subagentsDir, `${name}.jsonl`), jsonl(lines));
}

type FixtureTask = {
  eval_id: string;
  condition: string;
  finalMessage?: string; // written to outputs/final-message.md when present
};

/** Builds an iteration dir + dispatch.json shaped like run.ts serializes it. */
function writeIteration(tasks: FixtureTask[]) {
  const serialized = tasks.map((t) => {
    const condDir = join(iterationDir, `eval-${t.eval_id}`, t.condition);
    const outputsDir = join(condDir, "outputs");
    mkdirSync(outputsDir, { recursive: true });
    if (t.finalMessage !== undefined) {
      writeFileSync(join(outputsDir, "final-message.md"), t.finalMessage);
    }
    return {
      eval_id: t.eval_id,
      condition: t.condition,
      skill_path:
        t.condition === "without_skill" ? null : "/staged/skill/SKILL.md",
      staged_skill_slug: t.condition === "without_skill" ? null : "test-slug",
      user_prompt: `Do the ${t.eval_id} task`,
      fixtures: [join(condDir, "inputs", "fixture.txt")],
      outputs_dir: outputsDir,
      run_record_path: join(condDir, "run.json"),
      timing_path: join(condDir, "timing.json"),
      agent_description: `${t.eval_id}:${t.condition}:i1-nonce1`,
      dispatch_prompt_path: join(condDir, "dispatch-prompt.txt"),
    };
  });
  writeFileSync(
    join(iterationDir, "dispatch.json"),
    JSON.stringify({ run_nonce: "nonce1", tasks: serialized }, null, 2),
  );
  return serialized;
}

function readRun(evalId: string, condition: string): RunRecord {
  return JSON.parse(
    readFileSync(
      join(iterationDir, `eval-${evalId}`, condition, "run.json"),
      "utf8",
    ),
  );
}

function readTiming(evalId: string, condition: string): TimingRecord {
  return JSON.parse(
    readFileSync(
      join(iterationDir, `eval-${evalId}`, condition, "timing.json"),
      "utf8",
    ),
  );
}

beforeEach(() => {
  iterationDir = join(ROOT, `iter-${Math.random().toString(36).slice(2)}`);
  subagentsDir = join(ROOT, `sub-${Math.random().toString(36).slice(2)}`);
  mkdirSync(iterationDir, { recursive: true });
  mkdirSync(subagentsDir, { recursive: true });
});

afterEach(() => rmSync(ROOT, { recursive: true, force: true }));

describe("recordRuns", () => {
  test("assembles run.json and timing.json for every task from disk", () => {
    writeIteration([
      { eval_id: "crash", condition: "with_skill", finalMessage: "Fixed it." },
      {
        eval_id: "crash",
        condition: "without_skill",
        finalMessage: "Done, I think.",
      },
    ]);
    writeSubagent(
      "agent-a",
      "crash:with_skill:i1-nonce1",
      transcriptLines("unused"),
    );
    writeSubagent(
      "agent-b",
      "crash:without_skill:i1-nonce1",
      transcriptLines("unused"),
    );

    const result = recordRuns({ iterationDir, subagentsDir });
    expect(result.recorded).toBe(2);
    expect(result.missingTranscript).toBe(0);

    const run = readRun("crash", "with_skill");
    expect(run.eval_id).toBe("crash");
    expect(run.condition).toBe("with_skill");
    expect(run.skill_path).toBe("/staged/skill/SKILL.md");
    expect(run.prompt).toBe("Do the crash task");
    expect(run.files).toHaveLength(1);
    expect(run.final_message).toBe("Fixed it.");
    expect(run.tool_invocations).toHaveLength(1);
    expect(run.tool_invocations[0]).toMatchObject({ name: "Bash", ordinal: 0 });

    expect(readRun("crash", "without_skill").skill_path).toBeNull();

    const timing = readTiming("crash", "with_skill");
    expect(timing.total_tokens).toBe(TRANSCRIPT_TOKENS);
    expect(timing.duration_ms).toBe(TRANSCRIPT_DURATION_MS);
    expect(timing.source).toBe("transcript");
  });

  test("skips existing run.json without --overwrite, replaces with it", () => {
    const [task] = writeIteration([
      { eval_id: "crash", condition: "with_skill", finalMessage: "New." },
    ]);
    writeSubagent(
      "agent-a",
      "crash:with_skill:i1-nonce1",
      transcriptLines("unused"),
    );
    const handWritten = {
      eval_id: "crash",
      condition: "with_skill",
      skill_path: "/staged/skill/SKILL.md",
      prompt: "Do the crash task",
      files: [],
      final_message: "Agent-authored.",
      tool_invocations: [],
    };
    writeFileSync(task.run_record_path, JSON.stringify(handWritten));

    const skipped = recordRuns({ iterationDir, subagentsDir });
    expect(skipped.recorded).toBe(0);
    expect(skipped.skippedExisting).toBe(1);
    expect(readRun("crash", "with_skill").final_message).toBe(
      "Agent-authored.",
    );

    const replaced = recordRuns({
      iterationDir,
      subagentsDir,
      overwrite: true,
    });
    expect(replaced.recorded).toBe(1);
    expect(readRun("crash", "with_skill").final_message).toBe("New.");
  });

  test("backfills timing.json only when absent", () => {
    const [task] = writeIteration([
      { eval_id: "crash", condition: "with_skill", finalMessage: "Done." },
    ]);
    writeSubagent(
      "agent-a",
      "crash:with_skill:i1-nonce1",
      transcriptLines("unused"),
    );
    writeFileSync(
      task.timing_path,
      JSON.stringify({ total_tokens: 12345, duration_ms: 9000 }),
    );

    recordRuns({ iterationDir, subagentsDir });

    // Agent-captured completion-event timing wins; not overwritten.
    const timing = readTiming("crash", "with_skill");
    expect(timing.total_tokens).toBe(12345);
    expect(timing.duration_ms).toBe(9000);
    expect(timing.source).toBeUndefined();
  });

  test("falls back to the transcript's final assistant text when final-message.md is missing", () => {
    writeIteration([{ eval_id: "crash", condition: "with_skill" }]);
    writeSubagent(
      "agent-a",
      "crash:with_skill:i1-nonce1",
      transcriptLines("Closing summary from transcript."),
    );

    const result = recordRuns({ iterationDir, subagentsDir });
    expect(result.recorded).toBe(1);
    expect(readRun("crash", "with_skill").final_message).toBe(
      "Closing summary from transcript.",
    );
  });

  test("skips the slot entirely when no final-message source exists", () => {
    writeIteration([{ eval_id: "crash", condition: "with_skill" }]);
    // No final-message.md, no transcript.

    const result = recordRuns({ iterationDir, subagentsDir });
    expect(result.recorded).toBe(0);
    expect(result.skippedNoFinalMessage).toBe(1);
    expect(
      existsSync(join(iterationDir, "eval-crash", "with_skill", "run.json")),
    ).toBe(false);
    expect(
      existsSync(join(iterationDir, "eval-crash", "with_skill", "timing.json")),
    ).toBe(false);
  });

  test("writes run.json with empty invocations and no timing.json when the transcript is missing", () => {
    writeIteration([
      { eval_id: "crash", condition: "with_skill", finalMessage: "Done." },
    ]);
    // final-message.md exists but no subagent transcript matches.

    const result = recordRuns({ iterationDir, subagentsDir });
    expect(result.recorded).toBe(1);
    expect(result.missingTranscript).toBe(1);

    const run = readRun("crash", "with_skill");
    expect(run.final_message).toBe("Done.");
    expect(run.tool_invocations).toEqual([]);
    expect(
      existsSync(join(iterationDir, "eval-crash", "with_skill", "timing.json")),
    ).toBe(false);
  });

  test("throws when dispatch.json is absent", () => {
    // Hand-authored/operator runs have no dispatch.json — the manual path owns them.
    expect(() => recordRuns({ iterationDir, subagentsDir })).toThrow(
      /dispatch\.json/,
    );
  });
});
