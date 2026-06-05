// Claude Code-specific rendering of session-start context.
//
// The available-skills reminder is a *harness-specific* surface: Claude Code
// presents discoverable skills to an agent as "The following skills are
// available for use with the Skill tool:" followed by `- name: description`
// bullets. Other harnesses (Codex, OpenCode) surface their skills differently,
// so this rendering lives in an adapter rather than inline in the harness-
// agnostic orchestrator. A new harness adds its own renderer alongside this one
// (see ../../harness-parity.md).

import type { AvailableSkill } from "../types";

/**
 * Render the list of discoverable skills the way a real Claude Code session
 * surfaces them, so an eval dispatch mirrors a genuine session rather than
 * announcing itself as an eval. Returns an empty string when no skills are
 * staged (the caller omits the block entirely in that case).
 */
export function renderAvailableSkillsBlock(skills: AvailableSkill[]): string {
  if (skills.length === 0) return "";
  const sorted = [...skills].sort((a, b) => a.name.localeCompare(b.name));
  const lines = sorted.map((s) => `- ${s.name}: ${s.description}`);
  return [
    "The following skills are available for use with the Skill tool:",
    "",
    ...lines,
  ].join("\n");
}

/**
 * Render a plan-mode profile the way Claude Code injects an operating mode into
 * a live session: as a `<system-reminder>` block the agent is told it is
 * operating under, not prose it merely reads. The profile text (the verbatim
 * plan-mode procedure) lives in `../profiles/claude-code/plan-mode.md`; this
 * adapter owns only the harness-native framing, so a new harness adds its own
 * renderer + profile alongside this one (see ../../harness-parity.md). Returns
 * an empty string for empty input so the caller can omit the section entirely.
 */
export function renderPlanModeContext(profileText: string): string {
  const trimmed = profileText.trim();
  if (!trimmed) return "";
  return ["<system-reminder>", trimmed, "</system-reminder>"].join("\n");
}
