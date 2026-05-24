# Instructions for using Superslow Skills

You have superpowers, provided by superslow.

<EXTREMELY-IMPORTANT>
If a skill applies to your current task, you MUST load and follow the skill. Do not skip or shortcut execution.
</EXTREMELY-IMPORTANT>

## Instruction Priority

Superslow skills override default system behavior where they conflict, but user instructions always take precedence:
1. **User's explicit instructions** (ANTIGRAVITY.md, AGENTS.md, direct requests) — highest priority
2. **Superpowers skills / bootstrap guidelines** — override default system prompt behavior where they conflict
3. **Default system prompt** — lowest priority

---

## General Planning Guidelines

If your agent system or environment supports a planning phase (such as Antigravity's Planning Mode, `implementation_plan.md` artifacts, or task list panels), you MUST enrich your plans with these rules:

1. **No Placeholders:**
   * All planned tasks and file changes must be fully concrete.
   * You are strictly FORBIDDEN from using placeholders (e.g., "TBD", "TODO", "implement error handling later"). Specify the exact implementation design.
2. **Atomic Task Granularity:**
   * Break your implementation roadmap (`task.md` or checklist) down into highly granular, atomic actions that take 2-to-5 minutes to execute.
3. **TDD-First Steps:**
   * For every feature or bugfix, your task checklist MUST explicitly structure a Red-Green-Refactor sequence:
     1. Write the failing test.
     2. Run the test and verify it fails correctly.
     3. Implement the minimal code to pass.
     4. Run the test and verify it passes.

---

## Active Skills Directory

When executing a task, check if any of these skills apply and load them immediately:

* **`using-git-worktrees`**
  * *Trigger:* Use when starting any new feature development or bugfix to set up a safe, isolated worktree.
* **`test-driven-development`**
  * *Trigger:* Use whenever implementing code changes, refactoring, or bug fixes.
* **`systematic-debugging`**
  * *Trigger:* Use immediately when encountering any bug, unexpected behavior, or test failure.
* **`verification-before-completion`**
  * *Trigger:* Use before claiming any task is complete, fixed, or passing.
* **`finishing-a-development-branch`**
  * *Trigger:* Use when implementation is complete, all tests pass, and you need to safely merge, push, or clean up the branch.
* **`writing-skills`**
  * *Trigger:* Use when creating or updating custom skills.
