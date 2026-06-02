import { describe, expect, test } from "bun:test";
import type { AvailableSkill } from "../types";
import { renderAvailableSkillsBlock } from "./claude-code-session";

const skill = (name: string, description: string): AvailableSkill => ({
  name,
  path: `/x/${name}/SKILL.md`,
  description,
});

describe("renderAvailableSkillsBlock", () => {
  test("uses the harness-native header and one `- name: description` bullet per skill", () => {
    const block = renderAvailableSkillsBlock([skill("foo", "the foo skill")]);
    expect(block).toContain(
      "The following skills are available for use with the Skill tool:",
    );
    expect(block).toContain("- foo: the foo skill");
    // The eval-flavored wording and custom format must be gone.
    expect(block).not.toContain("staged and discoverable");
    expect(block).not.toContain("*Trigger:*");
  });

  test("sorts skills by name", () => {
    const block = renderAvailableSkillsBlock([
      skill("zebra", "z"),
      skill("alpha", "a"),
    ]);
    expect(block.indexOf("- alpha:")).toBeLessThan(block.indexOf("- zebra:"));
  });

  test("returns an empty string for an empty list", () => {
    expect(renderAvailableSkillsBlock([])).toBe("");
  });
});
