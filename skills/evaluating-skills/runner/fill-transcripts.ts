#!/usr/bin/env bun
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import * as claudeAdapter from "./adapters/claude-code-transcript";
import { detectRunContext } from "./context";
import type { ConditionsRecord, RunRecord } from "./types";

function die(msg: string): never {
  console.error(`error: ${msg}`);
  process.exit(1);
}

type DispatchTaskRef = {
  eval_id: string;
  condition: string;
  agent_description?: string;
};

/**
 * The canonical dispatch description for an (eval, condition) run.
 *
 * The runner writes a unique `agent_description` per task into `dispatch.json`
 * (namespaced with the iteration + run nonce). Reading it back — rather than
 * reconstructing `<eval_id>:<condition>` — is what binds each run to the exact
 * agent that produced it, even when one parent session's shared subagents dir
 * holds colliding descriptions from other iterations. Falls back to the legacy
 * reconstruction when dispatch.json is absent (hand-authored/operator runs).
 */
export function resolveAgentDescription(
  iterationDir: string,
  evalId: string,
  condition: string,
): string {
  const dispatchPath = join(iterationDir, "dispatch.json");
  if (existsSync(dispatchPath)) {
    try {
      const dispatch = JSON.parse(readFileSync(dispatchPath, "utf8")) as {
        tasks?: DispatchTaskRef[];
      };
      const task = dispatch.tasks?.find(
        (t) => t.eval_id === evalId && t.condition === condition,
      );
      if (task?.agent_description) return task.agent_description;
    } catch {
      // fall through to legacy reconstruction
    }
  }
  return `${evalId}:${condition}`;
}

function parseArgs(argv: string[]) {
  const flag = (name: string): string | undefined => {
    const i = argv.indexOf(`--${name}`);
    if (i === -1) return undefined;
    return argv[i + 1];
  };
  const has = (name: string) => argv.includes(`--${name}`);
  const iteration = flag("iteration");
  const subagentsDir = flag("subagents-dir");
  const overwrite = has("overwrite");
  if (!iteration) die("missing --iteration");
  if (!subagentsDir)
    die(
      "missing --subagents-dir (e.g. ~/.claude/projects/<project-slug>/<parent-session-id>/subagents/)",
    );
  return { iteration, subagentsDir, overwrite };
}

if (import.meta.main) {
  const fillArgv = Bun.argv.slice(2);
  const { iteration, subagentsDir, overwrite } = parseArgs(fillArgv);
  const fillCtx = detectRunContext(fillArgv);
  const skill = fillCtx.skillName;

  if (!existsSync(subagentsDir))
    die(`subagents-dir not found: ${subagentsDir}`);

  const adapter = claudeAdapter;
  console.log("Using harness transcript adapter: claude-code");

  const iterationDir = join(
    fillCtx.workspaceRoot,
    skill,
    `iteration-${iteration}`,
  );
  if (!existsSync(iterationDir)) die(`not found: ${iterationDir}`);

  const conditionsPath = join(iterationDir, "conditions.json");
  if (!existsSync(conditionsPath)) die(`missing: ${conditionsPath}`);
  const conditions: ConditionsRecord = JSON.parse(
    readFileSync(conditionsPath, "utf8"),
  );
  const conditionNames = conditions.conditions.map((c) => c.name);

  const evalDirs = readdirSync(iterationDir).filter((d) =>
    d.startsWith("eval-"),
  );

  let filled = 0;
  let skipped = 0;
  let missing = 0;

  for (const evalDir of evalDirs) {
    const evalId = evalDir.replace(/^eval-/, "");
    for (const cond of conditionNames) {
      const condDir = join(iterationDir, evalDir, cond);
      const runPath = join(condDir, "run.json");
      if (!existsSync(runPath)) continue;

      const run: RunRecord = JSON.parse(readFileSync(runPath, "utf8"));
      const existing = Array.isArray(run.tool_invocations)
        ? run.tool_invocations
        : [];
      if (existing.length > 0 && !overwrite) {
        console.log(
          `skip ${evalId}/${cond}: already has ${existing.length} tool_invocations (use --overwrite to replace)`,
        );
        skipped++;
        continue;
      }

      const description = resolveAgentDescription(iterationDir, evalId, cond);
      const subagent = adapter.findByDescription(subagentsDir, description);
      if (!subagent) {
        console.warn(
          `miss ${evalId}/${cond}: no subagent transcript with description='${description}'`,
        );
        missing++;
        continue;
      }

      const invocations = adapter.parseTranscript(subagent.jsonlPath);
      run.tool_invocations = invocations;
      writeFileSync(runPath, `${JSON.stringify(run, null, 2)}\n`);
      console.log(
        `fill ${evalId}/${cond}: wrote ${invocations.length} tool_invocations from ${subagent.jsonlPath}`,
      );
      filled++;
    }
  }

  console.log(
    `\nFilled: ${filled}, skipped (already populated): ${skipped}, missing transcript: ${missing}`,
  );
  if (missing > 0)
    console.warn(
      "Missing transcripts mean the dispatching agent's dispatch `description` did not match the task's `agent_description` in dispatch.json (or dispatch.json is absent and the legacy `eval-id:condition` reconstruction found no match). transcript_check assertions for those runs will be graded unverifiable.",
    );
}
