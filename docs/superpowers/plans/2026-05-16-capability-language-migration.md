# Capability Language Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Claude-Code-specific tool-name references in skills with capability-based language and delete the three per-platform reference mapping files.

**Architecture:** Pure prose migration across 16 files. No code changes. Two load-bearing exceptions stand by name: the `Skill` concept (universal skill loader name) and the `persistent task tracker` property. Each task is one file's edits plus a commit. Final task is the verification gate.

**Tech Stack:** Markdown only. Tooling: `bun test` (Bun's test runner), `bun run check` (Biome + markdownlint-cli2), `git`, `Grep` for verification.

**Spec:** `docs/superpowers/specs/2026-05-16-capability-language-migration-design.md`
**Smoke test:** `docs/superpowers/specs/2026-05-16-capability-language-migration-smoke-test.md` (run manually post-merge)

---

## Task 1: Delete reference mapping files

Three files deleted in full. Combined ~152 lines. These mapping tables are the primary thing the migration removes.

**Files:**

- Delete: `skills/using-superpowers/references/gemini-tools.md`
- Delete: `skills/using-superpowers/references/copilot-tools.md`
- Delete: `skills/using-superpowers/references/codex-tools.md`

After this task, `skills/using-superpowers/references/` becomes empty.

- [ ] **Step 1: Confirm files exist before deletion**

Run:

```bash
ls skills/using-superpowers/references/
```

Expected output: `codex-tools.md  copilot-tools.md  gemini-tools.md`

- [ ] **Step 2: Delete all three files**

Run:

```bash
rm skills/using-superpowers/references/gemini-tools.md
rm skills/using-superpowers/references/copilot-tools.md
rm skills/using-superpowers/references/codex-tools.md
```

- [ ] **Step 3: Confirm references directory is now empty**

Run:

```bash
ls skills/using-superpowers/references/ 2>&1
```

Expected: empty output (no files listed).

- [ ] **Step 4: Run lint to confirm no broken markdown links to the deleted files**

Run:

```bash
bun run check
```

Expected: `0 error(s)`. If any markdown file links to the deleted references, the lint will flag it — that file would need to be fixed before continuing.

- [ ] **Step 5: Commit**

Run:

```bash
git add -A skills/using-superpowers/references/
git commit -m "refactor(skills): delete per-platform tool mapping files

Removing gemini-tools.md, copilot-tools.md, codex-tools.md. The capability
language migration trusts each platform's agent to use its native tools."
```

---

## Task 2: Rewrite using-superpowers/SKILL.md

Rewrites three sections: the frontmatter description, "How to Access Skills" (lines 28–36), and "Platform Adaptation" (lines 38–40). Also updates two flow-diagram nodes that reference `TodoWrite`.

**Files:**

- Modify: `skills/using-superpowers/SKILL.md`

- [ ] **Step 1: Verify current state of all five touchpoints**

Run:

```bash
grep -n "Skill tool invocation\|Use the \`Skill\` tool\|## How to Access Skills\|## Platform Adaptation\|TodoWrite todo per item\|Invoke Skill tool" skills/using-superpowers/SKILL.md
```

Expected output (line numbers and matched text):

```
3:description: Use when starting any conversation - establishes how to find and use skills, requiring Skill tool invocation before ANY response including clarifying questions
28:## How to Access Skills
30:**In Claude Code:** Use the `Skill` tool. When you invoke a skill, its content is loaded and presented to you—follow it directly. Never use the Read tool on skill files.
38:## Platform Adaptation
55:    "Invoke Skill tool" [shape=box];
58:    "Create TodoWrite todo per item" [shape=box];
68:    "Might any skill apply?" -> "Invoke Skill tool" [label="yes, even 1%"];
70:    "Invoke Skill tool" -> "Announce: 'Using [skill] to [purpose]'";
72:    "Has checklist?" -> "Create TodoWrite todo per item" [label="yes"];
74:    "Create TodoWrite todo per item" -> "Follow skill exactly";
```

- [ ] **Step 2: Update frontmatter description (line 3)**

The old description references "Skill tool invocation" — Claude-Code-specific. Replace with a platform-neutral version.

Use Edit to replace:

```
description: Use when starting any conversation - establishes how to find and use skills, requiring Skill tool invocation before ANY response including clarifying questions
```

With:

```
description: Use when starting any conversation - establishes how to find and use skills, requiring skill invocation before ANY response including clarifying questions
```

- [ ] **Step 3: Rewrite "How to Access Skills" + "Platform Adaptation" sections**

Replace lines 28–40 entirely. The current text spans from `## How to Access Skills` through the end of the `## Platform Adaptation` section.

Use Edit to replace this block:

```markdown
## How to Access Skills

**In Claude Code:** Use the `Skill` tool. When you invoke a skill, its content is loaded and presented to you—follow it directly. Never use the Read tool on skill files.

**In Copilot CLI:** Use the `skill` tool. Skills are auto-discovered from installed plugins. The `skill` tool works the same as Claude Code's `Skill` tool.

**In Gemini CLI:** Skills activate via the `activate_skill` tool. Gemini loads skill metadata at session start and activates the full content on demand.

**In other environments:** Check your platform's documentation for how skills are loaded.

## Platform Adaptation

Skills use Claude Code tool names. Non-CC platforms: see `references/copilot-tools.md` (Copilot CLI), `references/codex-tools.md` (Codex) for tool equivalents. Gemini CLI users get the tool mapping loaded automatically via GEMINI.md.
```

With this block:

```markdown
## How to Access Skills

Skills are invoked through your platform's dedicated skill mechanism — whatever your host exposes for loading a skill by name. Use it. **Do not open skill files as plain text** — the raw markdown bypasses the loader's framing, prerequisite chains, and session state.

## Tool Vocabulary

Skills describe capabilities, not tool names. Map each capability to whatever tool your platform provides. When a capability has a property that matters (persistence, hook-visibility, special loader), the skill names the property — that's the requirement, not the tool name.
```

- [ ] **Step 4: Update flow-diagram node label "Create TodoWrite todo per item"**

This text appears three times (line 58 as the node definition; lines 72 and 74 as edges referencing the node by its label). All three must change in lockstep, otherwise the dot graph breaks. Use Edit with `replace_all: true`.

Use Edit (`replace_all: true`) to replace:

```
Create TodoWrite todo per item
```

With:

```
Track each checklist item as a persistent task
```

- [ ] **Step 5: Verify post-state — no remaining tool names in the touchpoints**

Run:

```bash
grep -n "Skill tool invocation\|Use the \`Skill\` tool\|## Platform Adaptation\|TodoWrite todo per item" skills/using-superpowers/SKILL.md
```

Expected: empty output. The only `Skill` references remaining are intentional (the load-bearing concept name) — those are `"Invoke Skill tool"` flow-diagram nodes which we are KEEPING.

Then confirm the intentional `Skill` mentions still exist:

```bash
grep -n "Invoke Skill tool" skills/using-superpowers/SKILL.md
```

Expected: lines 55, 68, 70 still present (or whatever lines they now occupy after the rewrite).

- [ ] **Step 6: Run lint**

Run:

```bash
bun run check
```

Expected: `0 error(s)`.

- [ ] **Step 7: Commit**

Run:

```bash
git add skills/using-superpowers/SKILL.md
git commit -m "refactor(skills): rewrite using-superpowers in capability language

How to Access Skills + Platform Adaptation sections now describe the
platform's skill mechanism as a capability rather than naming the
Claude-Code Skill tool. Adds the Tool Vocabulary philosophy section.
Updates flow-diagram nodes referencing TodoWrite to property-based
'persistent task' language. Frontmatter description drops 'Skill tool'."
```

---

## Task 3: Add glossary + fix TodoWrite mention in writing-skills/SKILL.md

Adds the canonical glossary table near the top of writing-skills (the right audience: skill authors). Also replaces the one `TodoWrite` mention at line 598.

**Files:**

- Modify: `skills/writing-skills/SKILL.md`

- [ ] **Step 1: Verify current state**

Run:

```bash
grep -n "Use TodoWrite to create" skills/writing-skills/SKILL.md
```

Expected: `598:**IMPORTANT: Use TodoWrite to create todos for EACH checklist item below.**`

Also verify there's no existing glossary section:

```bash
grep -n "^## Vocabulary\|^## Glossary" skills/writing-skills/SKILL.md
```

Expected: empty output.

- [ ] **Step 2: Add the glossary section after the REQUIRED BACKGROUND line**

The glossary belongs near the top so skill authors hit it before writing prose. The natural anchor is after the existing "REQUIRED BACKGROUND" callout on line 18.

Use Edit to replace this block:

```markdown
**REQUIRED BACKGROUND:** You MUST understand superpowers:test-driven-development before using this skill. That skill defines the fundamental RED-GREEN-REFACTOR cycle. This skill adapts TDD to documentation.

**Official guidance:** For Anthropic's official skill authoring best practices, see anthropic-best-practices.md. This document provides additional patterns and guidelines that complement the TDD-focused approach in this skill.
```

With:

```markdown
**REQUIRED BACKGROUND:** You MUST understand superpowers:test-driven-development before using this skill. That skill defines the fundamental RED-GREEN-REFACTOR cycle. This skill adapts TDD to documentation.

**Official guidance:** For Anthropic's official skill authoring best practices, see anthropic-best-practices.md. This document provides additional patterns and guidelines that complement the TDD-focused approach in this skill.

## Vocabulary

Skills describe capabilities, not platform tool names. When you write a skill, use these terms. This is the canonical source — when a new load-bearing term is coined, add it here.

| Term | Means | Don't say |
|------|-------|-----------|
| **Skill mechanism** | The platform's dedicated skill loader | "Skill tool" (Claude-specific) |
| **Persistent task tracker** | A todo tool whose state survives subagent dispatches and context churn | "TodoWrite", "write_todos" |
| **General-purpose subagent** | A subagent without a specialized role | "Task tool", "@generalist" |
| **Capability** | A described action ("search file contents") | A platform tool name ("Grep") |
| **Load-bearing property** | A property a capability must have for the workflow to work | (no shorter form) |
```

- [ ] **Step 3: Replace the TodoWrite mention near line 598**

Use Edit to replace:

```markdown
**IMPORTANT: Use TodoWrite to create todos for EACH checklist item below.**
```

With:

```markdown
**IMPORTANT: Use your persistent task tracker to create a task for EACH checklist item below.**
```

- [ ] **Step 4: Verify post-state**

Run:

```bash
grep -n "TodoWrite\|## Vocabulary" skills/writing-skills/SKILL.md
```

Expected: one match for `## Vocabulary` (the new section heading). Zero matches for `TodoWrite`.

- [ ] **Step 5: Run lint**

Run:

```bash
bun run check
```

Expected: `0 error(s)`.

- [ ] **Step 6: Commit**

Run:

```bash
git add skills/writing-skills/SKILL.md
git commit -m "refactor(skills): add vocabulary glossary to writing-skills

Glossary is the canonical source of capability-language terminology for
skill authors. Lives in writing-skills because that's the audience that
needs it — anyone editing or creating a skill. Also replaces the
remaining TodoWrite mention with persistent-task-tracker phrasing."
```

---

## Task 4: Rewrite subagent-driven-development/SKILL.md

Updates the process flow diagram (lines 50, 53, 58, 71, 72) and the example workflow (line 125). The TodoWrite mentions in the diagram are node labels referenced by edges — they must be changed consistently.

**Files:**

- Modify: `skills/subagent-driven-development/SKILL.md`

- [ ] **Step 1: Verify current state**

Run:

```bash
grep -n "TodoWrite" skills/subagent-driven-development/SKILL.md
```

Expected:

```
50:        "Mark task complete in TodoWrite" [shape=box];
53:    "Read plan, extract all tasks with full text, note context, create TodoWrite" [shape=box];
58:    "Read plan, extract all tasks with full text, note context, create TodoWrite" -> "Dispatch implementer subagent (./implementer-prompt.md)";
71:    "Code quality reviewer subagent approves?" -> "Mark task complete in TodoWrite" [label="yes"];
72:    "Mark task complete in TodoWrite" -> "More tasks remain?";
125:[Create TodoWrite with all tasks]
```

- [ ] **Step 2: Update the "Mark task complete in TodoWrite" node label**

Lines 50, 71, 72 — all reference the same node by label. Change all three together.

Use Edit (`replace_all: true`) to replace:

```
Mark task complete in TodoWrite
```

With:

```
Mark task complete in your task tracker
```

- [ ] **Step 3: Update the "create TodoWrite" plan-reading node label**

Lines 53 and 58 — node definition plus edge reference. Change both together.

Use Edit (`replace_all: true`) to replace:

```
Read plan, extract all tasks with full text, note context, create TodoWrite
```

With:

```
Read plan, extract all tasks with full text, note context, populate persistent task tracker
```

- [ ] **Step 4: Update the example workflow line**

Use Edit to replace:

```
[Create TodoWrite with all tasks]
```

With:

```
[Populate persistent task tracker with all tasks]
```

- [ ] **Step 5: Verify post-state**

Run:

```bash
grep -n "TodoWrite" skills/subagent-driven-development/SKILL.md
```

Expected: empty output.

- [ ] **Step 6: Run lint**

Run:

```bash
bun run check
```

Expected: `0 error(s)`.

- [ ] **Step 7: Commit**

Run:

```bash
git add skills/subagent-driven-development/SKILL.md
git commit -m "refactor(skills): capability language in subagent-driven-development

Flow-diagram nodes and example workflow no longer name TodoWrite. The
persistence property is what matters for subagent-driven workflows —
state must survive dispatches — so the prose names the property."
```

---

## Task 5: Rewrite writing-skills/persuasion-principles.md

Three TodoWrite mentions: lines 36, 83, 84. All inside example tables or bullets demonstrating skill-design patterns. The capability rewrite preserves the example's pedagogical point while removing tool-specific naming.

**Files:**

- Modify: `skills/writing-skills/persuasion-principles.md`

- [ ] **Step 1: Verify current state**

Run:

```bash
grep -n "TodoWrite" skills/writing-skills/persuasion-principles.md
```

Expected:

```
36:- Use tracking: TodoWrite for checklists
83:✅ Checklists without TodoWrite tracking = steps get skipped. Every time.
84:❌ Some people find TodoWrite helpful for checklists.
```

- [ ] **Step 2: Update line 36**

Use Edit to replace:

```
- Use tracking: TodoWrite for checklists
```

With:

```
- Use tracking: a persistent task tracker for checklists
```

- [ ] **Step 3: Update line 83**

Use Edit to replace:

```
✅ Checklists without TodoWrite tracking = steps get skipped. Every time.
```

With:

```
✅ Checklists without a persistent task tracker = steps get skipped. Every time.
```

- [ ] **Step 4: Update line 84**

Use Edit to replace:

```
❌ Some people find TodoWrite helpful for checklists.
```

With:

```
❌ Some people find a task tracker helpful for checklists.
```

- [ ] **Step 5: Verify post-state**

Run:

```bash
grep -n "TodoWrite" skills/writing-skills/persuasion-principles.md
```

Expected: empty output.

- [ ] **Step 6: Run lint**

Run:

```bash
bun run check
```

Expected: `0 error(s)`.

- [ ] **Step 7: Commit**

Run:

```bash
git add skills/writing-skills/persuasion-principles.md
git commit -m "refactor(skills): capability language in persuasion-principles

Example tables previously cited TodoWrite by name. The pedagogical point
is about persistent task tracking as a discipline mechanism, not about
a specific tool, so the examples now name the property."
```

---

## Task 6: Rewrite brainstorming/visual-companion.md

Three tool-name mentions: two `Bash tool` references (lines 61 and 65) and one `Write tool` reference (line 100). The `Bash tool` mentions sit inside platform-specific guidance for launching the brainstorm server in the background. The capability rewrite keeps the platform-specific behavior intact but drops Claude-tool-name vocabulary.

**Files:**

- Modify: `skills/brainstorming/visual-companion.md`

- [ ] **Step 1: Verify current state**

Run:

```bash
grep -n "Bash tool\|Write tool" skills/brainstorming/visual-companion.md
```

Expected:

```
61:# Use run_in_background: true on the Bash tool call so the server survives
65:When calling this via the Bash tool, set `run_in_background: true`. Then read `$STATE_DIR/server-info` on the next turn to get the URL and port.
100:   - Use Write tool — **never use cat/heredoc** (dumps noise into terminal)
```

- [ ] **Step 2: Update the comment on line 61 (inside a bash code block)**

Use Edit to replace:

```
# Windows auto-detects and uses foreground mode, which blocks the tool call.
# Use run_in_background: true on the Bash tool call so the server survives
# across conversation turns.
```

With:

```
# Windows auto-detects and uses foreground mode, which blocks the tool call.
# Run the launcher in the background so the server survives across
# conversation turns (use your platform's background-execution flag).
```

- [ ] **Step 3: Update line 65 (prose below the code block)**

Use Edit to replace:

```
When calling this via the Bash tool, set `run_in_background: true`. Then read `$STATE_DIR/server-info` on the next turn to get the URL and port.
```

With:

```
When running this from a shell-execution capability, use your platform's background flag (e.g., `run_in_background: true` in Claude Code). Then read `$STATE_DIR/server-info` on the next turn to get the URL and port.
```

Note: this rewrite keeps the Claude-Code-specific example *as an example* because the platform-specific block it sits inside is already titled "Claude Code (Windows)". The capability framing is what's load-bearing; concrete examples per platform are fine inside platform-titled blocks.

- [ ] **Step 4: Update line 100 (Write tool reference)**

Use Edit to replace:

```
   - Use Write tool — **never use cat/heredoc** (dumps noise into terminal)
```

With:

```
   - Write the file directly — **never use cat/heredoc** (dumps noise into terminal)
```

- [ ] **Step 5: Verify post-state**

Run:

```bash
grep -n "Bash tool\|Write tool" skills/brainstorming/visual-companion.md
```

Expected: empty output.

- [ ] **Step 6: Run lint**

Run:

```bash
bun run check
```

Expected: `0 error(s)`.

- [ ] **Step 7: Commit**

Run:

```bash
git add skills/brainstorming/visual-companion.md
git commit -m "refactor(skills): capability language in visual-companion

Drops Bash tool and Write tool naming. Platform-specific code blocks
keep their concrete examples (Claude Code's run_in_background) but the
prose framing names the capability — shell execution with background
flag — rather than the Claude tool."
```

---

## Task 7: Rewrite requesting-code-review/SKILL.md

One mention at line 34 instructs the parent agent to "Use Task tool with `general-purpose` type". Capability rewrite applies Pattern 3 from the spec.

**Files:**

- Modify: `skills/requesting-code-review/SKILL.md`

- [ ] **Step 1: Verify current state**

Run:

```bash
grep -n "Task tool" skills/requesting-code-review/SKILL.md
```

Expected: `34:Use Task tool with \`general-purpose\` type, fill template at \`code-reviewer.md\``

- [ ] **Step 2: Update line 34**

Use Edit to replace:

```
Use Task tool with `general-purpose` type, fill template at `code-reviewer.md`
```

With:

```
Dispatch a general-purpose subagent — one without a specialized role — filling the template at `code-reviewer.md`
```

- [ ] **Step 3: Verify post-state**

Run:

```bash
grep -n "Task tool" skills/requesting-code-review/SKILL.md
```

Expected: empty output.

- [ ] **Step 4: Run lint**

Run:

```bash
bun run check
```

Expected: `0 error(s)`.

- [ ] **Step 5: Commit**

Run:

```bash
git add skills/requesting-code-review/SKILL.md
git commit -m "refactor(skills): capability language in requesting-code-review

Replaces the Claude-Code Task tool dispatch instruction with capability
phrasing that names the property that matters (general-purpose, not
specialist) for the dispatched subagent."
```

---

## Task 8: Rewrite the six subagent prompt templates

All six templates open with the same line — `Task tool (general-purpose):` — followed by `description:` and `prompt: |` fields formatted as a structured tool-call block. The capability rewrite replaces `Task tool (general-purpose):` with `Dispatch a general-purpose subagent:` while preserving the rest of the structured format. The implementer agent reading the template will then map the structured fields to its own platform's subagent-dispatch primitive.

**Files:**

- Modify: `skills/brainstorming/spec-document-reviewer-prompt.md` (line 10)
- Modify: `skills/writing-plans/plan-document-reviewer-prompt.md` (line 10)
- Modify: `skills/subagent-driven-development/implementer-prompt.md` (line 6)
- Modify: `skills/subagent-driven-development/spec-reviewer-prompt.md` (line 8)
- Modify: `skills/subagent-driven-development/code-quality-reviewer-prompt.md` (line 10)
- Modify: `skills/requesting-code-review/code-reviewer.md` (line 8)

- [ ] **Step 1: Verify current state across all six files**

Run:

```bash
grep -n "Task tool (general-purpose):" skills/brainstorming/spec-document-reviewer-prompt.md skills/writing-plans/plan-document-reviewer-prompt.md skills/subagent-driven-development/implementer-prompt.md skills/subagent-driven-development/spec-reviewer-prompt.md skills/subagent-driven-development/code-quality-reviewer-prompt.md skills/requesting-code-review/code-reviewer.md
```

Expected: one match per file, on the line numbers listed above.

- [ ] **Step 2: Apply the same edit to all six files**

The substitution is identical in every file. Each file has exactly one occurrence of the string `Task tool (general-purpose):` as a single-line header. Use Edit on each file to replace:

```
Task tool (general-purpose):
```

With:

```
Dispatch a general-purpose subagent:
```

Apply this edit to each of the six files listed above.

- [ ] **Step 3: Verify post-state**

Run:

```bash
grep -rn "Task tool" skills/
```

Expected: empty output. (Note: `Task tool` should be fully eliminated across the skills tree by this point. Tasks 7 and 8 together remove the last mentions.)

- [ ] **Step 4: Run lint**

Run:

```bash
bun run check
```

Expected: `0 error(s)`.

- [ ] **Step 5: Commit**

Run:

```bash
git add skills/brainstorming/spec-document-reviewer-prompt.md skills/writing-plans/plan-document-reviewer-prompt.md skills/subagent-driven-development/implementer-prompt.md skills/subagent-driven-development/spec-reviewer-prompt.md skills/subagent-driven-development/code-quality-reviewer-prompt.md skills/requesting-code-review/code-reviewer.md
git commit -m "refactor(skills): capability language in subagent prompt templates

All six prompt templates previously opened with 'Task tool (general-purpose):'.
The new header 'Dispatch a general-purpose subagent:' is platform-neutral and
names the property (general-purpose role) instead of the Claude tool."
```

---

## Task 9: Delete the "Tool mapping" section in opencode/INSTALL.md

The Tool mapping section lists Claude-tool-to-OpenCode-tool equivalents. Once skills no longer reference Claude tool names, the section is dead documentation.

**Files:**

- Modify: `opencode/INSTALL.md`

- [ ] **Step 1: Verify current state**

Run:

```bash
grep -n "^### Tool mapping\|^## Getting Help" opencode/INSTALL.md
```

Expected:

```
104:### Tool mapping
113:## Getting Help
```

The Tool mapping section spans lines 104–111 (inclusive) and is followed by a blank line before `## Getting Help` at 113.

- [ ] **Step 2: Delete the Tool mapping section**

Use Edit to replace this block:

```markdown
### Tool mapping

When skills reference Claude Code tools:

- `TodoWrite` -> `todowrite`
- `Task` with subagents -> `@mention` syntax
- `Skill` tool -> OpenCode's native `skill` tool
- File operations -> your native tools

## Getting Help
```

With:

```markdown
## Getting Help
```

- [ ] **Step 3: Verify post-state**

Run:

```bash
grep -n "^### Tool mapping\|TodoWrite\|^## Getting Help" opencode/INSTALL.md
```

Expected: one match for `^## Getting Help`. Zero matches for the Tool mapping heading or `TodoWrite`.

- [ ] **Step 4: Run lint**

Run:

```bash
bun run check
```

Expected: `0 error(s)`.

- [ ] **Step 5: Commit**

Run:

```bash
git add opencode/INSTALL.md
git commit -m "docs(opencode): delete dead Tool mapping section in INSTALL.md

The section translated Claude tool names (TodoWrite, Task, Skill) to
OpenCode equivalents. Skills no longer reference Claude tool names, so
the mapping has nothing to translate."
```

---

## Task 10: Verification gate

Run the full-repo verification described in the spec. This is the final gate before the PR is ready for review.

**Files:**

- No files modified. Verification only.

- [ ] **Step 1: Repo-wide grep for dead tokens**

Run:

```bash
grep -rn --include='*.md' --include='*.json' -E '\bTodoWrite\b|\bWebFetch\b|\bWebSearch\b|\bTask tool\b|\bBash tool\b|\bRead tool\b|\bWrite tool\b|\bEdit tool\b' . | grep -v node_modules | grep -v '\.worktrees/' | grep -v 'docs/superpowers/upstream-CLAUDE.md' | grep -v 'docs/superpowers/specs/2026-05-16-capability-language-migration' | grep -v 'docs/superpowers/plans/2026-05-16-capability-language-migration'
```

Expected: empty output.

If any hits surface, classify them:

- **In a quoted code example or shell output**: false positive, leave alone.
- **Inside a load-bearing exception** (a `Skill` mention that is intentional, like the `"Invoke Skill tool"` flow-diagram nodes in `using-superpowers/SKILL.md`): false positive, leave alone. Note: the grep above does NOT include `Skill tool` — that's intentional because `Skill` is load-bearing.
- **Otherwise**: missed during migration. Report as BLOCKED with the file:line.

- [ ] **Step 2: Confirm the load-bearing Skill mentions still exist**

Run:

```bash
grep -rn 'Invoke Skill tool' skills/using-superpowers/SKILL.md
```

Expected: at least 3 matches (the flow-diagram node definition plus two edge references). These are intentional and must remain.

- [ ] **Step 3: Run the full test suite**

Run:

```bash
bun test
```

Expected: all tests pass. (The repo has 31 WebSocket protocol tests; none of them touch skill content, but we run them anyway as a baseline-still-healthy check.)

- [ ] **Step 4: Run the lint/format gate**

Run:

```bash
bun run check
```

Expected: `0 error(s)`.

- [ ] **Step 5: Report verification result**

If all four steps above pass: report DONE.

If Step 1 surfaces a missed token: report BLOCKED with the file:line and the surrounding context, so the missed token can be addressed in a follow-up task.

- [ ] **Step 6: Manual smoke test (post-merge, run by user)**

This step is not part of the automated verification gate. The user will run the two prompts from `docs/superpowers/specs/2026-05-16-capability-language-migration-smoke-test.md` across at least Claude Code plus one other harness, then report observed behavior in the PR description.

The verification gate above is sufficient to mark the implementation complete. Smoke test results are an additional checkpoint that runs in the user's hands, not the implementer's.

---

## Self-Review Notes

Spec coverage check:

- Pattern 1 (Skill loader): Task 2.
- Pattern 2 (Persistent task tracker): Tasks 2, 3, 4, 5.
- Pattern 3 (Subagent dispatch): Tasks 7, 8.
- Pattern 4 (File/shell/search tools): Task 6.
- Pattern 5 (Platform adaptation deletion): Task 2.
- Glossary placement: Task 3.
- Reference file deletion: Task 1.
- Harness install doc: Task 9.
- Verification gate: Task 10.

Every spec deliverable maps to a task. The smoke-test doc is already written (committed alongside the spec) — Task 10 references it for user-driven post-merge testing.
