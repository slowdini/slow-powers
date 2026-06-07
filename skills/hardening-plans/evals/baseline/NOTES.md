# Notes — hardening-plans next-step baseline (iteration-2)

Forward-looking observations from the run that produced this baseline. Read these
before trusting the headline `benchmark.json` aggregate.

## What this baseline measures

Revision (Mode B), sonnet agent + sonnet judge, 8 cases, N=1 per case/condition:

- **`old_skill` = `next-step-v1`** (commit `b62c4cd`): the next-step *flowchart*
  (functional → TDD, non-mechanical/non-functional → working-in-isolation,
  informational/trivial → no skill) **without** an explicit instruction to emit a
  *named* hand-off.
- **`new_skill`** (commit `7dc77dd`): same flowchart **plus** "close your hand-off
  by naming the required next skill verbatim, even on a cold draft", the canonical
  "You must complete … next" cross-references, and a red-flag + rationalization
  closing the spirit-vs-letter loophole.

This is the **second** iteration of the issue #188 work. Iteration-1 compared the
flowchart (`b62c4cd`) against the *pre-flowchart* single-TDD-gate (`dev`); see the
"iteration-1 context" section below for why iteration-2 exists.

## Headline: clean sweep, but read the flakiness caveat

`new_skill` passed **8/8 cases, stddev 0** (100%) vs `old_skill` **87.5%**
(delta **+12.5pp** toward new). Both arms invoked the skill 100%; no
`validity_warnings`. `new_skill` also used slightly fewer tokens on average.

The two `old_skill` misses were the noisy fresh-eyes assertions, not routing:
`seeded-plan-mode-todo-app-adversarial/no_placeholders` and
`oauth-task-breakdown-cold/hands_off_to_tdd`. `new_skill` passed both — the
strengthened "You must complete … next" phrasing plausibly firmed up the
functional TDD hand-off too — but at N=1 these are within run-to-run noise.

## The structural-refactor-cold caveat (the important one)

`structural-refactor-cold` is the case the iteration-2 edit targeted, and it is
**flaky at N=1**. The `routes_to_working_in_isolation` assertion on the
*identical* `b62c4cd` content flipped across runs:

| skill content | run | routes_to_working_in_isolation |
|---|---|---|
| `b62c4cd` (no named-hand-off line) | iteration-1 `new_skill` | **FAIL** (gave generic "set up an isolated branch" advice, never named the skill) |
| `b62c4cd` (no named-hand-off line) | iteration-2 `old_skill` | **PASS** (named the skill on its own) |
| `7dc77dd` (named-hand-off line)    | iteration-2 `new_skill` | **PASS** (explicit "REQUIRED NEXT SKILL: `slow-powers:working-in-isolation`") |

So this single run does **not** cleanly attribute the cold-structural pass to the
edit: `old_skill` happened to pass it too. What the run *does* show is that
`new_skill` is **≥ `old_skill` on every case, swept 8/8 with zero variance, and
emitted the named hand-off on the cold draft** — with no regressions. Treat the
+12.5pp as "at least as good, and reliably named" rather than proof the edit beats
v1 *specifically on the flaky case*. **If you revisit this, replicate
`structural-refactor-cold` a few times per condition** (the runner has no per-case
run multiplier — use repeated `--only structural-refactor-cold` iterations) to
firm up the attribution.

## Iteration-1 context (why iteration-2 exists)

Iteration-1 (`dev` single-TDD-gate vs `b62c4cd` flowchart) showed the flowchart's
**clean win on the seeded #188 case**: `docs-refactor-plan-mode` — old talked
itself out of isolation (the audited #188 bug), new routed to
`slow-powers:working-in-isolation`. But it also exposed the gap this baseline
closes: on the **cold** `structural-refactor-cold` draft, the flowchart produced
isolation advice *in spirit* without *naming* the skill, failing the assertion.
That gap motivated the named-hand-off edit measured here.

## Noisy assertions to distrust at N=1

`no_placeholders` and `hands_off_to_tdd` scatter PASS/FAIL across both conditions
run-to-run; they are fresh-eyes/quality checks, not tests of the routing change.
Don't read a single-run flip on either as signal. The routing assertions
(`routes_to_working_in_isolation`, `does_not_force_tdd`, `no_forced_next_skill`)
are the ones this baseline exists to track.

## Provenance / scope

8-case full suite. Plan-mode injection **off** (the seeded cases carry plan
framing in prose; the `*-cold` and research cases are deliberately cold). Agent +
judge both `claude-sonnet-4-6`.
