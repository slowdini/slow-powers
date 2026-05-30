---
name: writing-skills
description: Use when creating new skills or editing existing skills. Drafting only; see slow-powers:evaluating-skills for measuring whether the draft works.
---

# Writing Skills

## Overview

Skill development has two phases: **drafting** (this skill) and **evaluation** (`slow-powers:evaluating-skills`). Drafting covers naming, structure, vocabulary, anti-patterns, and rationalization-proofing. Evaluation covers measuring whether the words on the page actually shift agent behavior under realistic prompts.

A behavioral draft you didn't measure is a claim you didn't verify. After drafting, hand off to `slow-powers:evaluating-skills` to decide whether the change is behavior-shaping (measure it — the with/without comparison and iteration loop) or deterministic instruction-following (declare the decision and reasoning, then skip). New skills and edits alike route through that decision — see "Choosing to test with evals" in that skill. Default to measuring; the skip is a narrow, announced exception, not an escape hatch.

**Personal skills** live in your harness's user-skills directory. The path differs per harness; consult the harness's docs.

## Vocabulary

Skills describe capabilities, not platform tool names. When you write a skill, use these terms. This table is the canonical source — when a new load-bearing term is coined, add it here.

| Term | Means | Don't say |
|------|-------|-----------|
| **Skill mechanism** | The platform's dedicated skill loader | "Skill tool" (Claude-specific) |
| **Persistent task tracker** | A todo tool whose state survives subagent dispatches and context churn | "TodoWrite", "write_todos" |
| **General-purpose subagent** | A subagent without a specialized role | "Task tool", "@generalist" |
| **Capability** | A described action ("search file contents") | A platform tool name ("Grep") |
| **Load-bearing property** | A property a capability must have for the workflow to work | (no shorter form) |

## What is a skill?

A skill is a reference guide for proven techniques, patterns, or tools. Skills help future agents find and apply effective approaches.

**Skills are:** reusable techniques, patterns, tools, reference guides.
**Skills are not:** narratives about how you solved a problem once.

**Create a skill when:**
- The technique wasn't intuitively obvious
- You'd reference it again across projects
- The pattern applies broadly (not project-specific)

**Don't create one for:**
- One-off solutions
- Standard practices well-documented elsewhere
- Project-specific conventions (put those in CLAUDE.md / AGENTS.md)
- Mechanical constraints — if a regex or validation can enforce it, automate it instead

## Skill types

- **Technique** — concrete method with steps to follow (condition-based-waiting, root-cause-tracing)
- **Pattern** — way of thinking about problems (flatten-with-flags, test-invariants)
- **Reference** — API docs, syntax guides, tool documentation

## SKILL.md structure

```markdown
---
name: skill-name-with-hyphens
description: Use when [specific triggering conditions and symptoms]
---

# Skill Name

## Overview
What is this? Core principle in 1-2 sentences.

## When to use
Bullet list with symptoms and use cases. When NOT to use.

## Core pattern (techniques/patterns)
Before/after comparison.

## Quick reference
Table or bullets for scanning common operations.

## Implementation
Inline code for simple patterns; link to a file for heavy reference.

## Common mistakes
What goes wrong + fixes.
```

**Frontmatter rules:**
- Two required fields: `name` and `description`. Max 1024 characters total. See [agentskills.io/specification](https://agentskills.io/specification) for the full schema.
- `name`: letters, numbers, hyphens only — no parentheses or special chars.
- `description`: third person; describes ONLY when to use. See the next section for why "what it does" is the wrong content for this field.

## Skill discovery

The description field is how agents (and the harness's skill mechanism) decide whether to load your skill. Make it answer one question: *should I read this skill right now?*

### Description = WHEN, not WHAT

Do not summarize the skill's workflow in the description. Testing has repeatedly shown that when the description summarizes the process, agents follow the description instead of reading the full skill. A description saying "code review between tasks" caused an agent to do ONE review even though the skill body clearly described TWO reviews. Changing the description to just "Use when executing implementation plans with independent tasks" — no workflow summary — produced the correct two-stage behavior.

The trap is that workflow summaries create a shortcut the agent will take. The skill body becomes documentation the agent skips.

```yaml
# ❌ Summarizes workflow — agent may follow this instead of reading the skill
description: Use when executing plans — dispatches subagent per task with code review between tasks

# ✅ Triggering conditions only
description: Use when executing implementation plans with independent tasks in the current session
```

Other description rules:
- Start with "Use when..." to focus on triggering conditions.
- Write in third person — descriptions are injected into the system prompt.
- Describe the *problem* (race conditions, timing dependencies) not *language-specific symptoms* (setTimeout, sleep) unless the skill is technology-specific.

### Keyword coverage

Use words an agent would actually search for: error messages ("Hook timed out", "ENOTEMPTY"), symptoms ("flaky", "hanging", "pollution"), synonyms ("timeout / hang / freeze"), and real tool names where the skill is technology-specific.

### Naming

Active voice, verb-first. Gerunds (-ing) work well for processes.

- ✅ `creating-skills`, `condition-based-waiting`, `root-cause-tracing`
- ❌ `skill-creation`, `async-test-helpers`, `debugging-techniques`

Name by what you DO or the core insight, not the surface category.

### Token efficiency

Once a skill is loaded, every token in it competes with conversation history. For frequently-loaded skills, aim for under 200 words total; for other skills, keep the body lean and offload heavy reference to separate files.

Techniques:
- **Move details to tool help.** "Run `<tool> --help` for filter flags" beats listing every flag.
- **Use cross-references.** Don't repeat what another skill says — link to it.
- **Compress examples.** One good before/after pair is enough; cut the surrounding prose.

### Cross-referencing other skills

Use the skill's qualified name with an explicit requirement marker:

- ✅ `**REQUIRED SUB-SKILL:** Use slow-powers:test-driven-development`
- ✅ `**REQUIRED BACKGROUND:** You must understand slow-powers:systematic-debugging`
- ❌ `See skills/testing/test-driven-development` — unclear if required, harness-specific path
- ❌ `@skills/testing/test-driven-development/SKILL.md` — force-loads, burns context

The `@` prefix force-loads the file on session start, consuming context before you need it.

## Flowchart usage

Use a small inline flowchart **only** when:
- The decision is non-obvious
- There's a process loop where you might stop too early
- It's an "A vs B" branch where the wrong choice has consequences

Don't use flowcharts for:
- Reference material — use tables or lists
- Code examples — use markdown code blocks
- Linear instructions — use numbered lists
- Labels without semantic meaning (`step1`, `helper2`)

See `graphviz-conventions.dot` for the style rules used across this skill set.

To preview a skill's flowcharts as SVG, run `./scripts/render-graphs.js ../some-skill` from the `writing-skills/` directory (or pass `--combine` to merge all diagrams into one). Requires graphviz.

## Code examples

**One excellent example beats many mediocre ones.**

Choose the most relevant language for the skill's domain — testing techniques tend to land best in TypeScript/JavaScript, system debugging in shell or Python, data processing in Python.

A good example is:
- Complete and runnable
- Well-commented on the WHY, not the WHAT
- From a real scenario
- Ready to adapt, not a fill-in-the-blank template

Don't implement the same example in five languages. Agents are good at porting — one excellent example is enough.

## File organization

Keep most skills self-contained in a single SKILL.md. Add supporting files only when one of these is true:

```
self-contained/        # SKILL.md only — everything fits inline
  SKILL.md

with-reusable-tool/    # SKILL.md + working code to adapt
  SKILL.md
  example.ts

with-heavy-reference/  # SKILL.md + bulky reference docs
  SKILL.md
  api-reference.md     # 500+ lines of API docs
  scripts/             # executable utilities
```

Separate files are warranted for:
1. Heavy reference (100+ lines) — API docs, comprehensive syntax tables
2. Reusable executable tools — scripts that adapt across projects

Otherwise keep content inline. Principles, concepts, code patterns under ~50 lines — all inline.

## Rationalization-proofing for discipline skills

Skills that enforce discipline (TDD, verification-before-completion, designing-before-coding) need to survive pressure. Agents are smart and find loopholes when under time, sunk-cost, or authority pressure. Drafting an enforceable rule is different from drafting a guideline.

The research backs this up: persuasion techniques more than double LLM compliance rates under pressure. See `persuasion-principles.md` (in this skill) for the seven principles, when each applies, and citations (Cialdini, 2021; Meincke et al., 2025).

### Close every loophole explicitly

State the rule, then forbid the specific workarounds you can predict. The agent will reach for the ambiguity under pressure — rule it out by name.

```markdown
❌ Write code before test? Delete it.

✅ Write code before test? Delete it. Start over.

   No exceptions:
   - Don't keep it as "reference"
   - Don't "adapt" it while writing tests
   - Delete means delete.
```

### Address "spirit vs letter" arguments

State the foundational principle early, before the agent reaches for it:

> **Violating the letter of the rules is violating the spirit of the rules.**

This single sentence cuts off an entire class of "I'm following the spirit" rationalizations.

### Build a rationalization table and a red-flags list

These tables and lists come *from* the eval iteration loop — they're not something you can write up front. The eval surfaces the specific excuses an agent reaches for when the rule fails under pressure. Capture them verbatim and bake them back into the skill:

```markdown
| Excuse | Reality |
|--------|---------|
| "Too simple to test" | Simple code breaks. Test takes 30 seconds. |
| "I'll test after" | Tests passing immediately prove nothing. |
| "Tests after achieve the same goals" | Tests-after = "what does this do?" Tests-first = "what should this do?" |
```

```markdown
## Red flags — STOP and start over

- Code before test
- "I already manually tested it"
- "Tests after achieve the same purpose"
- "It's about spirit not ritual"
- "This is different because..."

All of these mean: delete code. Start over with TDD.
```

See `slow-powers:evaluating-skills` and its `pressure-scenarios.md` for the pressure-type taxonomy and how to write prompts that actually stress the rule (rather than letting the agent recite the skill and "pass" without proving anything).

## Anti-patterns

### ❌ Narrative example
> "In session 2025-10-03, we found empty projectDir caused..."

Too specific to a moment in time. Not reusable.

### ❌ Multi-language dilution
`example-js.js`, `example-py.py`, `example-go.go`

Mediocre quality across all of them, maintenance burden on every change.

### ❌ Code in flowcharts
```
step1 [label="import fs"];
step2 [label="read file"];
```

Can't copy-paste; hard to read. Use markdown code blocks instead.

### ❌ Generic labels
`helper1`, `helper2`, `step3`, `pattern4`

Labels should carry semantic meaning.

## Skill creation checklist

Use your persistent task tracker — one task per item.

**Draft:**
- [ ] Name uses only letters, numbers, hyphens
- [ ] YAML frontmatter has `name` and `description` (under 1024 chars total)
- [ ] Description starts with "Use when..." and includes triggers / symptoms
- [ ] Description is third person and contains NO workflow summary
- [ ] Body keeps to one excellent example per concept, not many mediocre ones
- [ ] Heavy reference and reusable tools live in separate files; principles stay inline
- [ ] Cross-references use `slow-powers:<skill-name>`, not file paths or `@` imports

**Validate** (handoff to `slow-powers:evaluating-skills`):
- [ ] Decide whether the change is behavior-shaping or deterministic, and announce the decision and reasoning to the user (see "Choosing to test with evals" in that skill). Default to behavior-shaping when unsure.
- [ ] If behavior-shaping (or the user opts in): author `evals/evals.json` with 2–3 realistic prompts
- [ ] For discipline-enforcing skills, write pressure prompts with multiple combined pressures (see `pressure-scenarios.md` in that skill)
- [ ] Run the eval. Iterate until the with-skill pass rate is materially higher than the without-skill baseline.

**Deploy:**
- [ ] Commit the skill (and its `evals/evals.json`, when one was authored) together
- [ ] In the PR description, include before/after eval results — or, for a deterministic change, the stated decision and reasoning to skip (per repo CLAUDE.md)

## Further reading

- `slow-powers:evaluating-skills` — phase 2: measuring whether the draft works
- `persuasion-principles.md` (in this skill) — research foundation for discipline-enforcing language
- `graphviz-conventions.dot` (in this skill) — flowchart style rules
- [agentskills.io/skill-creation/best-practices](https://agentskills.io/skill-creation/best-practices) — harness-agnostic best-practices reference; read when you want more depth than this skill provides
