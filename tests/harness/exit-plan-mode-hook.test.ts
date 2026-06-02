// Behavioral tests for the hooks/exit-plan-mode PreToolUse hook script.
// The script gates ExitPlanMode on Claude: it denies the FIRST exit attempt of
// a plan-mode session (steering the agent through hardening-plans) and allows
// the re-submission once a per-session marker exists. We drive the real bash
// script through child_process with an isolated TMPDIR so its marker files
// never touch the developer's real temp dir.
import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { REPO_ROOT } from "./spec";

const HOOK_SCRIPT = path.join(REPO_ROOT, "hooks/exit-plan-mode");

interface HookResult {
  status: number;
  stdout: string;
  stderr: string;
}

/** Run the hook with the given PreToolUse payload on stdin, isolated TMPDIR. */
function runHook(payload: unknown, tmp: string): HookResult {
  const result = spawnSync("bash", [HOOK_SCRIPT], {
    input: JSON.stringify(payload),
    encoding: "utf8",
    env: { ...process.env, TMPDIR: tmp },
  });
  return {
    status: result.status ?? -1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

function freshTmp(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "exit-plan-hook-"));
}

const planPayload = (sessionId: string) => ({
  hook_event_name: "PreToolUse",
  tool_name: "ExitPlanMode",
  session_id: sessionId,
  transcript_path: "/tmp/whatever/transcript.jsonl",
  tool_input: { plan: "do the thing" },
});

describe("exit-plan-mode hook", () => {
  test("denies the first ExitPlanMode and points at hardening-plans", () => {
    const tmp = freshTmp();
    const { status, stdout } = runHook(planPayload("sess-A"), tmp);

    expect(status).toBe(0);
    const out = JSON.parse(stdout);
    expect(out.hookSpecificOutput.hookEventName).toBe("PreToolUse");
    expect(out.hookSpecificOutput.permissionDecision).toBe("deny");
    expect(out.hookSpecificOutput.permissionDecisionReason).toContain(
      "hardening-plans",
    );
  });

  test("allows the re-submitted ExitPlanMode (marker present, same session)", () => {
    const tmp = freshTmp();
    const first = runHook(planPayload("sess-B"), tmp);
    expect(first.stdout).toContain("deny");

    const second = runHook(planPayload("sess-B"), tmp);
    expect(second.status).toBe(0);
    expect(second.stdout.trim()).toBe("");
  });

  test("treats distinct sessions independently", () => {
    const tmp = freshTmp();
    runHook(planPayload("sess-C"), tmp); // first call for C -> deny + marker
    const otherSession = runHook(planPayload("sess-D"), tmp);
    // D has never been seen, even though C's marker exists in the same TMPDIR.
    expect(otherSession.stdout).toContain("deny");
  });

  test("still denies-once when session_id is absent (no crash)", () => {
    const tmp = freshTmp();
    const payload = {
      hook_event_name: "PreToolUse",
      tool_name: "ExitPlanMode",
      transcript_path: "/tmp/whatever/transcript.jsonl",
    };
    const first = runHook(payload, tmp);
    expect(first.status).toBe(0);
    expect(first.stdout).toContain("deny");

    const second = runHook(payload, tmp);
    expect(second.stdout.trim()).toBe("");
  });
});
