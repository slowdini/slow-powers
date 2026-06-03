---
name: writing-skills
description: Use when creating new skills or editing existing skills. Drafting only; see slow-powers:evaluating-skills for measuring whether the draft works.
---

# Writing Skills

## Overview

Skill development has two phases: **drafting** (this skill) and **evaluation**
(`slow-powers:evaluating-skills`). This skill is your template for authoring a new skill and
your checklist for auditing an existing one — it covers structure, building blocks, description
writing, and rationalization-proofing.

A behavioral draft you didn't measure is a claim you didn't verify. After drafting, hand off to
`slow-powers:evaluating-skills` to decide whether the change is behavior-shaping (measure it) or
deterministic instruction-following (declare the decision and reasoning, then skip). Default to
measuring; the skip is a narrow, announced exception, not an escape hatch.

## What is a skill?

A skill is a reusable reference guide for a proven technique, pattern, or tool — **not** a
narrative about how you solved a problem once ("In session 2025-10-03 we found…" is too tied to
a moment to reuse).

**Create a skill when:** the technique wasn't intuitively obvious, you'd reference it again
across projects, and the pattern applies broadly.

**Don't create one for:** one-off solutions, standard practices documented elsewhere,
project-specific conventions (put those in CLAUDE.md / AGENTS.md), or mechanical constraints a
regex or validation could enforce — automate those instead.

## Skill types

- **Technique** — concrete method with steps (condition-based-waiting, root-cause-tracing).
- **Pattern** — a way of thinking about problems (flatten-with-flags, test-invariants).
- **Reference** — API docs, syntax guides, tool documentation.

## Cross-harness vocabulary

Skills may ship across harnesses, so they should describe *capabilities*, not platform tool names.
Use these terms as the canonical vocabulary reference.

| Term | Means | Don't say |
|------|-------|-----------|
| **Skill mechanism** | The platform's dedicated skill loader | "Skill tool" (Claude-specific) |
| **Persistent task tracker** | A todo tool whose state survives subagent dispatches and context churn | "TodoWrite", "write_todos" |
| **General-purpose subagent** | A subagent without a specialized role | "Task tool", "@generalist" |
| **Capability** | A described action ("search file contents") | A platform tool name ("Grep") |
| **Load-bearing property** | A property a capability must have for the workflow to work | (no shorter form) |

## SKILL.md structure

```markdown
---
name: skill-name-with-hyphens
description: Use when [specific triggering conditions and symptoms]
---

# Skill Name

## Overview        — what is this? Core principle in 1-2 sentences.
## When to use     — symptoms and use cases; when NOT to use.
## Core pattern    — before/after comparison (techniques/patterns).
## Quick reference — table or bullets for scanning common operations.
## Implementation  — inline code for simple patterns; link a file for heavy reference.
## Common mistakes — what goes wrong + fixes.
```

**Frontmatter rules:**
- Two required fields, `name` and `description`, max 1024 characters total. See
  [agentskills.io/specification](https://agentskills.io/specification) for the full schema.
- `name`: lowercase letters, numbers, hyphens only.
- `description`: third person, triggering conditions only — see "Writing the description".

## Building blocks

The blocks below help structure a SKILL.md file. Use the ones that fit - not every skill
needs all of them. These aren't limiters, and your skill should contain the content it needs.

Each block does one job:

- **Gotchas** *(any skill)* — environment-specific facts that defy reasonable assumptions, so
  the agent reads them *before* hitting the trap. These correct factual mistakes, not motivation:

  > - The `users` table uses soft deletes — queries need `WHERE deleted_at IS NULL`.
  > - The ID is `user_id` in the DB, `uid` in auth, `accountId` in billing — same value.

  Keep gotchas inline; when an agent makes a mistake you have to correct, add it here.

- **Red flags / rationalization table** *(discipline skills only)* — these look like gotchas but
  are **not** the same: gotchas correct *facts*, red flags counter *motivated reasoning* under
  pressure, and they come from eval pressure-testing rather than domain knowledge. See
  "Rationalization-proofing" below for how to build them.

- **Quick-reference table** — for scanning common operations. Tables and lists, not prose.

- **Checklist** *(multi-step skills)* — when steps have dependencies or validation gates, give a
  checklist the agent copies into its task tracker and ticks off, so it can't skip a gate.

- **Code examples** — **one excellent example beats many mediocre ones.** Pick the language that
  fits the domain (testing → TS/JS, system debugging → shell/Python). A good example is
  complete, runnable, commented on the WHY, from a real scenario, ready to adapt. Don't
  reimplement it in five languages — agents port well, and multi-language dilution means
  mediocre quality everywhere plus maintenance burden on every change.

## Flowchart usage

Use a small inline flowchart **only** when the decision is non-obvious, there's a process loop
where you might stop too early, or it's an "A vs B" branch where the wrong choice has
consequences. Don't use flowcharts for reference material (use tables/lists), code (use code
blocks — `step1[import fs]` can't be copy-pasted), linear instructions (use numbered
lists), or labels without semantic meaning (`step1`, `helper2` — labels should carry meaning).

Write flowcharts as **mermaid** (` ```mermaid ` blocks) — it renders natively in GitHub and most
editors, so no tooling or dependency is needed to preview. Shape carries meaning:

| Meaning | Mermaid |
|---|---|
| Question / decision | `id{Label}` |
| Action | `id[Label]` |
| State / situation | `id(Label)` |
| Warning / STOP | `id{{Label}}` (hexagon) |
| Entry / exit | `id([Label])` (stadium) |
| Edge with label | `A -->\|x\| B` |
| Trigger / dotted edge | `A -.->\|x\| B` |

Quote any label containing `[ ] : ( ) /` or `'` with `"..."`, e.g.
`done(["Respond (including clarifications)"])`.

## Writing the description

The description is how agents (and the skill mechanism) decide whether to load your skill. Make
it answer one question: *should I read this skill right now?*

**Description = WHEN, not WHAT.** Do not summarize the skill's workflow. Testing has repeatedly
shown that when the description summarizes the process, agents follow the description instead of
reading the skill. A description saying "code review between tasks" caused an agent to do ONE
review even though the skill body described TWO; changing it to "Use when executing
implementation plans with independent tasks" — no workflow summary — produced the correct
two-stage behavior. The trap: workflow summaries create a shortcut, and the skill body becomes
documentation the agent skips.

```yaml
# ❌ Summarizes workflow — agent may follow this instead of reading the skill
description: Use when executing plans — dispatches subagent per task with code review between tasks

# ✅ Triggering conditions only
description: Use when executing implementation plans with independent tasks in the current session
```

Other rules:
- Start with "Use when…" and write in third person — descriptions are injected into the system
  prompt.
- Describe the *problem* (race conditions, timing dependencies), not language-specific symptoms
  (`setTimeout`, `sleep`) unless the skill is technology-specific.
- **Keyword coverage:** use words an agent would actually search for — error messages ("Hook
  timed out", "ENOTEMPTY"), symptoms ("flaky", "hanging"), synonyms ("timeout / hang / freeze").

> **Note — this is a deliberate house stance.** External sources disagree on descriptions:
> Anthropic says include *what the skill does* plus when; agentskills favors imperative,
> user-intent phrasing. Because there's no shared standard, we maintain our WHEN-not-WHAT rule.
> The load-bearing part is **no workflow summary**.

### Naming

Active voice, verb-first; gerunds (-ing) work well for processes. Name by what you DO or the
core insight, not the surface category.

- ✅ `creating-skills`, `condition-based-waiting`, `root-cause-tracing`
- ❌ `skill-creation`, `async-test-helpers`, `debugging-techniques`

## Cross-referencing other skills

Use the skill's qualified name with an explicit requirement marker:

- ✅ `**REQUIRED SUB-SKILL:** Use slow-powers:test-driven-development`
- ✅ `**REQUIRED BACKGROUND:** You must understand slow-powers:systematic-debugging`
- ✅ `**REQUIRED PREREQUISITE:** You must have already completed slow-powers:systematic-debugging`
- ✅ `**REQUIRED NEXT SKILL:** You must complete slow-powers:systematic-debugging next`
- ❌ `See skills/testing/test-driven-development` — unclear if required, harness-specific path
- ❌ `@skills/testing/test-driven-development/SKILL.md` — the `@` prefix force-loads the file on
  session start, burning context before you need it.

Don't repeat what another skill says — link to it.

## Conciseness & file organization

Once a skill loads, every token competes with conversation history. Keep the body lean: aim for
**≤200 lines** for frequently-loaded internal skills, and treat **500 lines / 5,000 tokens** as
the hard ceiling for any skill. Move details to tool help ("Run `<tool> --help` for flags" beats
listing every flag), cross-reference instead of repeating, and compress examples to one good
pair.

Use progressive disclosure for anything heavy: SKILL.md is the always-loaded overview; bulky
material lives in separate files the agent loads on demand. Tell the agent *when* to load each
("Read `api-reference.md` if the API returns non-200") rather than a generic "see references/".

```
self-contained/      with-reusable-tool/   with-heavy-reference/
  SKILL.md             SKILL.md               SKILL.md
                       example.ts             api-reference.md   # 100+ lines of API docs
                                              scripts/           # executable utilities
```

Separate files are warranted only for **heavy reference (100+ lines)** or **reusable executable
tools**. Principles, concepts, and code patterns under ~50 lines stay inline.

## Rationalization-proofing for discipline skills

Skills that enforce discipline (TDD, verification-before-completion, designing-before-coding)
must survive pressure — agents find loopholes under time, sunk-cost, or authority pressure.
Drafting an enforceable rule differs from drafting a guideline. The research backs this up:
persuasion techniques more than double LLM compliance under pressure. See
`persuasion-principles.md` for the seven principles, when each applies, and citations (Cialdini,
2021; Meincke et al., 2025).

**Close every loophole explicitly.** State the rule, then forbid the specific workarounds you
can predict — the agent will reach for the ambiguity under pressure.

```markdown
✅ Write code before test? Delete it. Start over.
   No exceptions: don't keep it as "reference", don't "adapt" it while writing tests.
   Delete means delete.
```

**Address "spirit vs letter" early**, before the agent reaches for it:

> **Violating the letter of the rules is violating the spirit of the rules.**

**Build the rationalization table and red-flags list *from* the eval loop** — they aren't
something you write up front. The eval surfaces the specific excuses an agent reaches for; capture
them verbatim and bake them back in:

```markdown
| Excuse | Reality |
|--------|---------|
| "Too simple to test" | Simple code breaks. Test takes 30 seconds. |
| "I'll test after" | Tests passing immediately prove nothing. |

## Red flags — STOP and start over
- Code before test
- "I already manually tested it"
- "This is different because…"
```

The mid-session rationalizations that belong here surface most reliably from *seeded* eval cases
— ones that embed a prior transcript so the agent meets the rule already committed to skipping
it. See `slow-powers:evaluating-skills` (`pressure-scenarios.md` and "Seeding conversation
context") for the pressure taxonomy.

## Validation checklist

Use your persistent task tracker — one task per item. Works for authoring a new skill or
auditing an existing one.

**Draft:**
- [ ] Name uses only lowercase letters, numbers, hyphens
- [ ] Frontmatter has `name` and `description` (under 1024 chars total)
- [ ] Description starts with "Use when…", is third person, includes triggers/symptoms, and
      contains NO workflow summary
- [ ] Body keeps to one excellent example per concept; no narrative-of-one-session content
- [ ] Heavy reference (100+ lines) and reusable tools live in separate files; principles inline
- [ ] Flowcharts only for non-obvious decisions/loops/branches; semantic labels, no code
- [ ] Cross-references use `slow-powers:<skill-name>`, not file paths or `@` imports
- [ ] Body is lean (≤200 lines preferred, 500 max)

**Validate** (handoff to `slow-powers:evaluating-skills`):
- [ ] Decide whether the change is behavior-shaping or deterministic, and announce the decision
      and reasoning (see "Choosing to test with evals"). Default to behavior-shaping when unsure.
- [ ] If behavior-shaping (or the user opts in): author `evals/evals.json` with 2–3 realistic
      prompts
- [ ] For discipline-enforcing skills, write pressure prompts combining multiple pressures, plus
      at least one **seeded** case (embeds a prior transcript) alongside a cold contrast case
- [ ] Run the eval. Iterate until the with-skill pass rate is materially higher than baseline.

**Deploy:**
- [ ] Commit the skill (and its `evals/evals.json`, when authored) together
- [ ] In the PR, include before/after eval results — or, for a deterministic change, the stated
      decision and reasoning to skip (per repo CLAUDE.md)

## Further reading

- `slow-powers:evaluating-skills` — phase 2: measuring whether the draft works
- `persuasion-principles.md` (in this skill) — research foundation for discipline language
- [agentskills.io best-practices](https://agentskills.io/skill-creation/best-practices) and
  [optimizing-descriptions](https://agentskills.io/skill-creation/optimizing-descriptions) —
  harness-agnostic depth on patterns and description testing
- [Anthropic Agent Skills best practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices)
  — degrees-of-freedom, progressive disclosure, and script-bundling depth
