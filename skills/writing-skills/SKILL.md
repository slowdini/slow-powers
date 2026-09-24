---
name: writing-skills
description: Use when creating new skills or editing existing skills. Drafting only; see slow-powers:evaluating-skills for measuring whether the draft works.
---

# Writing skills

## Overview

Skill development connects **drafting** (this skill) with **evaluation**
(`slow-powers:evaluating-skills`). Start with the problem the skill should solve and the
outcomes that would make it useful. Draft the guidance and design its eval coverage against
those same goals. This skill covers structure, building blocks, description writing, and
rationalization-proofing; evaluating-skills owns measurement.

A behavioral draft you didn't measure is a claim you didn't verify. Build a reusable suite
with a new skill, and reuse it when revising the prose. Define new cases when goals change
or evidence reveals a coverage gap or defective grader. Deterministic edits can skip
behavioral measurement with a stated reason; see "When to run" in
`slow-powers:evaluating-skills`. Mark draft or exploratory work as such until measured.

## Validation checklist

Use your persistent task tracker — one task per item. Works for authoring a new skill or
auditing an existing one — copy it into your tracker before you start, then work through the
rest of this skill against it.

**Draft:**
- [ ] State the motivating problem, intended goals, and observable success before drafting prose
- [ ] Name uses only lowercase letters, numbers, hyphens
- [ ] Frontmatter has `name` and `description` (under 1024 chars total)
- [ ] Description starts with "Use when…", is third person, includes triggers/symptoms, and
      contains NO workflow summary
- [ ] Body keeps to one excellent example per concept; no narrative-of-one-session content
- [ ] Companion files use the correct directory from "Skill directory layout"; principles stay inline
- [ ] Flowcharts only for non-obvious decisions/loops/branches; semantic labels, no code
- [ ] Any checklist sits near the top of the body, before the procedural sections it gates
- [ ] Body is lean (≤200 lines preferred, 500 max)

**Validate** (handoff to `slow-powers:evaluating-skills`):
- [ ] Decide whether the change is behavior-shaping or deterministic, and announce the decision
      and reasoning (see "When to run"). Default to behavior-shaping when unsure.
- [ ] Reuse a trustworthy suite; for an uncovered goal, explore realistic work and author
      cases in `evals/evals.json`, with a goal-based `COVERAGE.md` beside it
- [ ] For discipline-enforcing skills, include realistic pressure and at least one **seeded**
      case (embeds a prior transcript) alongside a cold contrast case
- [ ] Calibrate new or revised graders, then measure the frozen suite across fresh sessions;
      report regressions, benefits, cost, and uncertainty against the goals

**Deploy:**
- [ ] Commit the skill (and its `evals/evals.json`, when authored) together
- [ ] In the PR, include before/after eval evidence and its limitations — or, for a deterministic
      change, the stated decision and reasoning to skip; label unfinished measurement explicitly

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

## `SKILL.md` structure

```markdown
---
name: skill-name-with-hyphens
description: Use when [specific triggering conditions and symptoms]
---

# Skill name

## Overview        — what is this? Core principle in 1-2 sentences.
## When to use     — symptoms and use cases; when not to use.
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

The blocks below help structure a `SKILL.md` file. Use the ones that fit — not every skill
needs all of them. These aren't limiters, and your skill should contain the content it needs.

Each block does one job:

- **Gotchas** *(any skill)* — environment-specific facts that defy reasonable assumptions, so
  the agent reads them *before* hitting the trap. These correct factual mistakes, not motivation:

  > - The `users` table uses soft deletes — queries need `WHERE deleted_at IS NULL`.
  > - The ID is `user_id` in the DB, `uid` in auth, `accountId` in billing — same value.

  Keep gotchas inline; when an agent makes a mistake you have to correct, add it here.

- **Red flags / rationalization table** *(discipline skills only)* — these look like gotchas but
  are **not** the same: gotchas correct *facts*, red flags counter *motivated reasoning* under
  pressure, and they come from observed failures in real work or eval pressure-testing. See
  "Rationalization-proofing" below for how to build them.

- **Quick-reference table** — for scanning common operations. Tables and lists, not prose.

- **Checklist** *(multi-step skills)* — when steps have dependencies or validation gates, give a
  checklist the agent copies into its task tracker and ticks off, so it can't skip a gate.
  Place the checklist **near the top of the body**: the agent must adopt it into its tracker
  *before* following the rest of the skill, and a checklist buried below the procedural prose
  is met mid-flow — after the agent has already started executing the steps it was meant to gate.

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

- ✅ `**REQUIRED BACKGROUND:** You must understand slow-powers:working-with-tdd`
- ✅ `**REQUIRED PREREQUISITE:** You must have already completed slow-powers:investigating-bugs`
- ✅ `**REQUIRED NEXT SKILL:** You must complete slow-powers:investigating-bugs next`
- ❌ `See skills/testing/working-with-tdd` — unclear if required, harness-specific path
- ❌ `@skills/testing/working-with-tdd/SKILL.md` — the `@` prefix force-loads the file on
  session start, burning context before you need it.

Don't repeat what another skill says — link to it.

## Conciseness and file organization

Once a skill loads, every token competes with conversation history. Keep the body lean: aim for
**≤200 lines** for frequently-loaded internal skills, and treat **500 lines / 5,000 tokens** as
the hard ceiling for any skill. Move details to tool help ("Run `<tool> --help` for flags" beats
listing every flag), cross-reference instead of repeating, and compress examples to one good
pair.

Use progressive disclosure for anything heavy: the `SKILL.md` file is the always-loaded overview; bulky
material lives in separate files the agent loads on demand. Tell the agent *when* to load each
("Read `references/api-errors.md` if the API returns non-200") rather than a generic "see references/".

### Skill directory layout

A skill always has a `SKILL.md` file. Add any of these peer directories when their contents are needed:

| Directory | Put here | Guidance |
|---|---|---|
| `references/` | Documentation and non-standalone code examples | Keep each file focused; link primary references from `SKILL.md` with the condition for reading them. |
| `scripts/` | Executable helpers | Make them self-contained or document dependencies; include useful errors and handle edge cases. |
| `assets/` | Templates, images, schemas, and static data | Use them as inputs or output resources; explain when the workflow needs them. |
| `evals/` | Eval cases, fixtures, grading artifacts, and baselines | Keep `evals.json` and its supporting evaluation material together. |

Make every companion file reachable from `SKILL.md` through local links. A link in `SKILL.md` is relative to the skill root (`references/guide.md`, `scripts/check.sh`, `assets/template.md`, `evals/evals.json`); links inside companion files are relative to the file containing the link. Keep primary resources one level below the skill root. A secondary resource may be one more hop away when it is useful only after reading the primary resource; avoid deeper discovery chains.

```text
skill-name/
├── SKILL.md
├── references/
├── scripts/
├── assets/
└── evals/
```

Create companion files when they serve one of the roles above, not merely to shorten `SKILL.md`. Principles, concepts, and short code patterns stay inline.

## Rationalization-proofing for discipline skills

Skills that enforce discipline (TDD, verifying-development-work, hardening-plans)
must survive pressure — agents find loopholes under time, sunk-cost, or authority pressure.
Drafting an enforceable rule differs from drafting a guideline. In one controlled study, persuasion cues more than doubled compliance for the tested model and prompts. See the [persuasion principles](references/persuasion-principles.md) for the seven principles, when each applies, the study's limits, and citations (Cialdini, 2021; Meincke et al., 2026).

**Close the loopholes behind observed failures.** State the rule and counter the workarounds
that evidence connects to a failed goal. Ordinary mechanical instructions, such as naming a
next skill verbatim, do not merit red flags, repeated enforcement, or performance eval cases
merely because the skill requires them. If real work or eval evidence shows an apparently
mechanical step actually fails, targeted coverage and stronger guidance can be warranted.

```markdown
✅ Write code before test? Delete it. Start over.
   No exceptions: don't keep it as "reference", don't "adapt" it while writing tests.
   Delete means delete.
```

**Address "spirit vs letter" early**, before the agent reaches for it:

> **Violating the letter of the rules is violating the spirit of the rules.**

**Build the rationalization table and red-flags list from failure evidence** — they aren't
an inventory of instructions to reinforce up front. Capture relevant excuses verbatim from
real work or evals, then check them against the agent's actions. Add a counter when the
evidence points to a gap in the guidance, and measure
the revision on the same cases:

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

Use *seeded* eval cases to investigate mid-session rationalizations: embed a short prior
transcript so the agent meets the decision already committed to an approach. Check explanations
against actions and outcomes before adding a counter. See the [pressure-scenarios reference](../evaluating-skills/references/pressure-scenarios.md)
for realistic context and the limits of text seeds.

Evaluation can also reveal guidance the base agent or intended harness already supplies.
When the evidence supports that conclusion, simplify or narrow the skill for that
population and remeasure. Do not demand a harder case or stronger enforcement just to
produce a benefit; `slow-powers:evaluating-skills` owns that interpretation.

## Further reading

- `slow-powers:evaluating-skills` — goal coverage, suite authoring, and measurement
- `slow-powers:writing-technical-docs` — the general technical-writing skill
  (comments, PR descriptions, READMEs, design docs). This skill is the doc-type
  authority for skills: it owns skill structure, frontmatter, and skill-specific
  prose conventions. Where this skill is silent about the prose itself — clarity,
  concision, sentence construction — writing-technical-docs' style principles apply.
  On any conflict, this skill wins.
- [Persuasion principles](references/persuasion-principles.md) — research foundation for discipline language
- [agentskills.io best-practices](https://agentskills.io/skill-creation/best-practices) and
  [optimizing-descriptions](https://agentskills.io/skill-creation/optimizing-descriptions) —
  harness-agnostic depth on patterns and description testing
- [Anthropic Agent Skills best practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices)
  — degrees-of-freedom, progressive disclosure, and script-bundling depth
