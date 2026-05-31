import {
  classifyBash,
  isUnderAny,
  pathArg,
  WRITE_TOOLS,
} from "../sandbox-policy";

/**
 * The marker file (`<stageRoot>/.claude/skills/.slow-powers-eval-guard.json`)
 * that arms the guard. The guard is a no-op unless this file exists, is active,
 * and has not expired — so a crashed run that never tore the hook down can't
 * silently block writes in the user's next interactive session.
 */
export type GuardMarker = {
  active?: boolean;
  allowedRoots?: string[];
  expiresAt?: string;
};

export type GuardDecision = { allow: boolean; reason?: string };

const ALLOW: GuardDecision = { allow: true };

function armed(marker: GuardMarker | null, now: number): boolean {
  if (marker?.active !== true) return false;
  if (marker.expiresAt && Date.parse(marker.expiresAt) <= now) return false;
  return true;
}

/**
 * Decide whether a tool call should be allowed while the eval guard is armed.
 *
 * Write tools targeting a path outside every allowed root are denied; Bash
 * commands matching a mutation pattern (install/git/sed -i/redirection) that
 * aren't scoped to an allowed root are denied. Everything else — including all
 * read-only tools and the orchestrator's own writes under the workspace — is
 * allowed. When the guard is not armed, every call is allowed.
 */
export function decide(
  toolName: string,
  toolInput: unknown,
  marker: GuardMarker | null,
  now: number = Date.now(),
): GuardDecision {
  if (!armed(marker, now)) return ALLOW;
  const roots = marker?.allowedRoots ?? [];
  const repoRoot = process.cwd();

  if (WRITE_TOOLS.has(toolName)) {
    const p = pathArg(toolInput);
    if (p && !isUnderAny(p, roots, repoRoot)) {
      return {
        allow: false,
        reason: `eval guard: ${toolName} to ${p} is outside the eval sandbox (allowed: ${roots.join(", ")})`,
      };
    }
    return ALLOW;
  }

  if (toolName === "Bash") {
    const command =
      toolInput && typeof toolInput === "object"
        ? String((toolInput as Record<string, unknown>).command ?? "")
        : "";
    const reason = classifyBash(command, roots);
    if (reason)
      return {
        allow: false,
        reason: `eval guard: blocked Bash (${reason}) — runs outside the eval sandbox`,
      };
  }

  return ALLOW;
}
