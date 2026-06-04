#!/usr/bin/env bun
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  findByDescription,
  parseTranscriptFull,
} from "./adapters/claude-code-transcript";
import { detectRunContext } from "./context";
import type { RunRecord, TimingRecord } from "./types";
import { validateAgainstSchema } from "./validate-schema";

function die(msg: string): never {
  console.error(`error: ${msg}`);
  process.exit(1);
}

/** The dispatch.json task shape record-runs consumes (see DispatchTask in
 * run.ts — `dispatch_prompt` is stripped from the serialized file). */
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
};

export type RecordRunsResult = {
  recorded: number;
  skippedExisting: number;
  skippedNoFinalMessage: number;
  missingTranscript: number;
};

/**
 * Assembles a schema-valid `run.json` (and backfills `timing.json`) for every
 * task in the iteration's `dispatch.json`, from sources already on disk:
 *
 * - carry-over fields (`prompt` ← `user_prompt`, `files` ← `fixtures`,
 *   `eval_id`/`condition`/`skill_path`) from `dispatch.json`;
 * - `final_message` from `<outputs_dir>/final-message.md` (the dispatch prompt
 *   instructs the subagent to write it), falling back to the transcript's last
 *   assistant text;
 * - `tool_invocations`, tokens, and duration from the persisted Claude Code
 *   transcript (Claude-Code-tier, like fill-transcripts — transcript-less
 *   harnesses keep hand-authoring these records).
 *
 * Existing records always win: an agent/operator-written `run.json` is skipped
 * without `overwrite`, and `timing.json` is backfill-only — completion-event
 * numbers captured at dispatch time are never replaced by transcript-derived
 * ones, which include cache accounting and are not comparable 1:1.
 */
export function recordRuns(opts: {
  iterationDir: string;
  subagentsDir: string;
  overwrite?: boolean;
}): RecordRunsResult {
  const { iterationDir, subagentsDir, overwrite = false } = opts;

  const dispatchPath = join(iterationDir, "dispatch.json");
  if (!existsSync(dispatchPath)) {
    throw new Error(
      `${dispatchPath} not found — record-runs assembles records from dispatch.json and only supports runner-built iterations. For hand-authored runs, write run.json + timing.json manually (see schema/run-record.schema.json).`,
    );
  }
  const dispatch = JSON.parse(readFileSync(dispatchPath, "utf8")) as {
    tasks?: DispatchTask[];
  };
  const tasks = dispatch.tasks ?? [];

  const result: RecordRunsResult = {
    recorded: 0,
    skippedExisting: 0,
    skippedNoFinalMessage: 0,
    missingTranscript: 0,
  };

  for (const task of tasks) {
    const slot = `${task.eval_id}/${task.condition}`;

    const subagent = findByDescription(subagentsDir, task.agent_description);
    const summary = subagent ? parseTranscriptFull(subagent.jsonlPath) : null;
    if (!subagent) {
      console.warn(
        `miss ${slot}: no subagent transcript with description='${task.agent_description}'`,
      );
      result.missingTranscript++;
    }

    // run.json — skip if the agent/operator already wrote one.
    if (existsSync(task.run_record_path) && !overwrite) {
      console.log(
        `skip ${slot}: run.json already exists (use --overwrite to replace)`,
      );
      result.skippedExisting++;
    } else {
      const finalMessagePath = join(task.outputs_dir, "final-message.md");
      let finalMessage: string | null = null;
      if (existsSync(finalMessagePath)) {
        finalMessage = readFileSync(finalMessagePath, "utf8").trim();
      } else if (summary?.final_text) {
        console.warn(
          `warn ${slot}: ${finalMessagePath} missing — using the transcript's last assistant text as final_message`,
        );
        finalMessage = summary.final_text;
      }
      if (finalMessage === null) {
        console.warn(
          `skip ${slot}: no final-message.md and no transcript text — was this task dispatched? Not writing a blank record.`,
        );
        result.skippedNoFinalMessage++;
        continue;
      }

      const record: RunRecord = {
        eval_id: task.eval_id,
        condition: task.condition,
        skill_path: task.skill_path,
        prompt: task.user_prompt,
        files: task.fixtures,
        final_message: finalMessage,
        tool_invocations: summary?.tool_invocations ?? [],
        // Timing lives in timing.json; run.json never carries it.
        total_tokens: null,
        duration_ms: null,
      };
      validateAgainstSchema<RunRecord>(
        "run-record",
        record,
        task.run_record_path,
      );
      writeFileSync(
        task.run_record_path,
        `${JSON.stringify(record, null, 2)}\n`,
      );
      console.log(
        `record ${slot}: wrote run.json with ${record.tool_invocations.length} tool_invocations`,
      );
      result.recorded++;
    }

    // timing.json — backfill only; completion-event numbers always win.
    const timingExists = existsSync(task.timing_path);
    if (summary && (!timingExists || overwrite)) {
      const timing: TimingRecord = {
        total_tokens: summary.total_tokens,
        duration_ms: summary.duration_ms,
        source: "transcript",
      };
      writeFileSync(task.timing_path, `${JSON.stringify(timing, null, 2)}\n`);
    }
  }

  return result;
}

function parseArgs(argv: string[]) {
  const flag = (name: string): string | undefined => {
    const i = argv.indexOf(`--${name}`);
    if (i === -1) return undefined;
    return argv[i + 1];
  };
  const iteration = flag("iteration");
  const subagentsDir = flag("subagents-dir");
  const overwrite = argv.includes("--overwrite");
  if (!iteration) die("missing --iteration");
  if (!subagentsDir)
    die(
      "missing --subagents-dir (e.g. ~/.claude/projects/<project-slug>/<parent-session-id>/subagents/)",
    );
  return { iteration, subagentsDir, overwrite };
}

if (import.meta.main) {
  const argv = Bun.argv.slice(2);
  const { iteration, subagentsDir, overwrite } = parseArgs(argv);
  const ctx = detectRunContext(argv);

  if (!existsSync(subagentsDir))
    die(`subagents-dir not found: ${subagentsDir}`);

  const iterationDir = join(
    ctx.workspaceRoot,
    ctx.skillName,
    `iteration-${iteration}`,
  );
  if (!existsSync(iterationDir)) die(`not found: ${iterationDir}`);

  let result: RecordRunsResult;
  try {
    result = recordRuns({ iterationDir, subagentsDir, overwrite });
  } catch (err) {
    die(err instanceof Error ? err.message : String(err));
  }

  console.log(
    `\nRecorded: ${result.recorded}, skipped (existing run.json): ${result.skippedExisting}, skipped (no final message): ${result.skippedNoFinalMessage}, missing transcript: ${result.missingTranscript}`,
  );
  if (result.missingTranscript > 0)
    console.warn(
      "Missing transcripts mean the dispatching agent's dispatch `description` did not match the task's `agent_description` in dispatch.json. Those slots got empty tool_invocations (transcript_check assertions will grade unverifiable) and no transcript-derived timing.",
    );
  console.log(
    `\nNext: bun run evals:detect-stray-writes -- --skill ${ctx.skillName} --iteration ${iteration}\nThen: bun run evals:grade -- --skill ${ctx.skillName} --iteration ${iteration}`,
  );
}
