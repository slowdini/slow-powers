#!/usr/bin/env bun
// Claude Code PreToolUse hook. Installed (opt-in, via run.ts --guard) to block
// eval subagents from writing outside their sandbox. Reads the hook payload on
// stdin and the guard marker path from argv[2]; emits a `deny` decision for
// out-of-bounds writes/installs. Fails open on any error so it can never brick
// a session.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { decide, type GuardMarker } from "./policy";

function readMarker(path: string): GuardMarker | null {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as GuardMarker;
  } catch {
    return null;
  }
}

if (import.meta.main) {
  try {
    const markerPath =
      Bun.argv[2] ??
      join(process.cwd(), ".claude", "skills", ".superslow-eval-guard.json");
    const payload = JSON.parse((await Bun.stdin.text()) || "{}") as {
      tool_name?: string;
      tool_input?: unknown;
    };
    const decision = decide(
      payload.tool_name ?? "",
      payload.tool_input,
      readMarker(markerPath),
    );
    if (!decision.allow) {
      process.stdout.write(
        JSON.stringify({
          hookSpecificOutput: {
            hookEventName: "PreToolUse",
            permissionDecision: "deny",
            permissionDecisionReason: decision.reason,
          },
        }),
      );
    }
  } catch {
    // fail open — never block a session because the guard itself errored
  }
  process.exit(0);
}
