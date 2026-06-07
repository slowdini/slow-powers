// Behavioral tests for the hooks/codex-stop-plan-mode Stop hook script.
// Codex has no ExitPlanMode tool. Instead, this hook uses Codex's Stop event
// to continue a plan-mode turn when the assistant is about to leave behind an
// unhardened <proposed_plan> block.
import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { REPO_ROOT } from "./spec";

const HOOK_SCRIPT = path.join(REPO_ROOT, "hooks/codex-stop-plan-mode");

interface HookResult {
  status: number;
  stdout: string;
  stderr: string;
}

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
  return fs.mkdtempSync(path.join(os.tmpdir(), "codex-stop-hook-"));
}

const proposedPlan = `<proposed_plan>
# Codex Hook Plan

## Summary

Add a Stop hook.
</proposed_plan>`;

const stopPayload = (
  turnId: string,
  overrides: Record<string, unknown> = {},
) => ({
  hook_event_name: "Stop",
  permission_mode: "plan",
  session_id: "sess-codex-plan",
  turn_id: turnId,
  stop_hook_active: false,
  transcript_path: "/tmp/whatever/transcript.jsonl",
  last_assistant_message: proposedPlan,
  ...overrides,
});

describe("codex-stop-plan-mode hook", () => {
  test("no-ops outside plan mode", () => {
    const tmp = freshTmp();
    const { status, stdout } = runHook(
      stopPayload("turn-non-plan", { permission_mode: "default" }),
      tmp,
    );

    expect(status).toBe(0);
    expect(stdout.trim()).toBe("");
  });

  test("no-ops when the assistant did not emit a proposed plan", () => {
    const tmp = freshTmp();
    const { status, stdout } = runHook(
      stopPayload("turn-chat", {
        last_assistant_message: "I found the likely files. Continuing.",
      }),
      tmp,
    );

    expect(status).toBe(0);
    expect(stdout.trim()).toBe("");
  });

  test("blocks the first plan-mode Stop with a proposed plan and points at hardening-plans", () => {
    const tmp = freshTmp();
    const { status, stdout } = runHook(stopPayload("turn-block"), tmp);

    expect(status).toBe(0);
    const out = JSON.parse(stdout);
    expect(out.decision).toBe("block");
    expect(out.reason).toContain("slow-powers:hardening-plans");
    expect(out.reason).toContain("<proposed_plan>");
  });

  test("allows the same turn after the deny-once marker exists", () => {
    const tmp = freshTmp();
    const first = runHook(stopPayload("turn-once"), tmp);
    expect(JSON.parse(first.stdout).decision).toBe("block");

    const second = runHook(stopPayload("turn-once"), tmp);
    expect(second.status).toBe(0);
    expect(second.stdout.trim()).toBe("");
  });

  test("treats distinct turns independently", () => {
    const tmp = freshTmp();
    runHook(stopPayload("turn-A"), tmp);

    const otherTurn = runHook(stopPayload("turn-B"), tmp);
    expect(JSON.parse(otherTurn.stdout).decision).toBe("block");
  });

  test("allows when Codex reports the Stop hook is already active", () => {
    const tmp = freshTmp();
    const { status, stdout } = runHook(
      stopPayload("turn-active", { stop_hook_active: true }),
      tmp,
    );

    expect(status).toBe(0);
    expect(stdout.trim()).toBe("");
  });

  test("allows when the transcript shows hardening-plans was actually loaded", () => {
    const tmp = freshTmp();
    const transcript = path.join(tmp, "transcript.jsonl");
    fs.writeFileSync(
      transcript,
      `${JSON.stringify({
        type: "assistant",
        tool: {
          name: "exec_command",
          input: {
            cmd: "sed -n '1,220p' skills/hardening-plans/SKILL.md",
          },
        },
      })}\n`,
    );

    const { status, stdout } = runHook(
      stopPayload("turn-hardened", { transcript_path: transcript }),
      tmp,
    );

    expect(status).toBe(0);
    expect(stdout.trim()).toBe("");
  });

  test("does not false-positive on prose that merely mentions hardening-plans", () => {
    const tmp = freshTmp();
    const transcript = path.join(tmp, "transcript.jsonl");
    fs.writeFileSync(
      transcript,
      `${JSON.stringify({
        type: "user",
        message:
          "Before presenting, use the slow-powers:hardening-plans skill.",
      })}\n`,
    );

    const { stdout } = runHook(
      stopPayload("turn-prose-only", { transcript_path: transcript }),
      tmp,
    );

    expect(JSON.parse(stdout).decision).toBe("block");
  });
});
