# Instructions for using Slow-powers Skills

You have superpowers, provided by slow-powers.

<EXTREMELY-IMPORTANT>
If a skill applies to your current task, you MUST load and follow the skill. Do not skip or shortcut execution.
</EXTREMELY-IMPORTANT>

## Instruction Priority

Slow-powers skills override default system behavior where they conflict, but user instructions always take precedence:
1. **User's explicit instructions** (CLAUDE.md, AGENTS.md, direct requests) — highest priority
2. **Slow-powers skills / bootstrap guidelines** — override default system prompt behavior where they conflict
3. **Default system prompt** — lowest priority

---

## Active Skills Directory

When executing a task, check if any of these skills apply and load them immediately:

* **`using-git-worktrees`**
  * *Trigger:* Use when starting any new feature development or bugfix to set up a safe, isolated worktree.
* **`hardening-plans`**
  * *Trigger:* Use when you've committed to producing or revising a plan, task breakdown, or design doc before any code is written — e.g. you're in a harness plan mode, or the user asked to see the steps first.
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
* **`evaluating-skills`**
  * *Trigger:* Use when testing whether a new skill improves agent behavior, or when validating a change to an existing skill's language.
