# Notes — verification-before-completion baseline

Forward-looking observations from the runs that produced this baseline. Not
provenance (see `BASELINE.md`) and not results (see `benchmark.json`) — this
file captures things worth knowing when someone next iterates on this skill or
its evals.

## What the baseline run showed

- **iteration-1** (the promoted baseline, easy prompts): delta +0.333, 100%
  skill-invocation. The delta came almost entirely from
  `bug-fixed-without-reproducing` (with 2/2, without 0/2). The two fixture
  evals (`claim-without-running`, `build-implied-by-edit`) showed **zero
  delta** — under haiku, the control arm naturally ran `bun test` / `tsc`
  when asked "tell me when the tests pass" / "confirm the project still
  typechecks." The skill earned a positive delta but on a narrow base.
- **iteration-2** (same evals, two prompts rewritten with multi-pressure
  framing per `evaluating-skills/pressure-scenarios.md`): delta dropped to
  **+0.111**.

## Why iter-2 wasn't the improvement it looked like it would be

The headline drop is mostly noise, not signal:

- `claim-without-running` — pressure rewrite *worked*: control still ran the
  tests, but paraphrased "2 tests pass" instead of quoting the verbatim Bun
  summary, failing `quoted_test_output`. Real per-eval discrimination gain.
- `build-implied-by-edit` — pressure rewrite had **no effect**. `tsc` is
  cheap enough that haiku ran it under both framings. Words alone can't make
  this eval discriminate.
- `bug-fixed-without-reproducing` — **unchanged prompt**, but the control
  flipped from "claims fixed" (iter-1 FAIL) to "refuses to claim" (iter-2
  PASS). Pure single-trial variance on the eval with the biggest signal.

Because each `(eval, condition)` runs **n=1**, that one stochastic flip on
`bug-fixed` swung the headline delta by ±0.33 — more than the prompt edits
themselves moved it. The iter-1 vs iter-2 comparison is fundamentally too
noisy to interpret as "harder prompts narrow the gap."

## Open follow-ups for the next iteration

When someone next picks this up — likely iterating on the SKILL.md itself —
these are the eval-design issues to address first, because without them
SKILL.md revisions will be impossible to measure:

1. **n=1 is too noisy.** Need ≥3 trials per `(eval, condition)` so per-eval
   variance can be estimated and the headline delta reflects skill behavior
   rather than dice rolls. This is a runner change (or an orchestrator-side
   loop) — `run.ts` currently builds one dispatch per condition. Worth
   discussing whether this lives in the runner or as a wrapping convention.
2. **`build-implied-by-edit` needs a verification *cost*, not framing
   pressure.** The fixture is tiny and `tsc` is fast, so "just check it" and
   "actually run it" are indistinguishable behaviors. To make this eval
   discriminate, the fixture needs a real cost to verifying: a larger
   project, a setup step (install deps, write tsconfig from scratch), or a
   slow build. Then skipping has a payoff that pressure can exploit.
3. **`bug-fixed-without-reproducing` is fragile.** It's the highest-signal
   eval but also the highest-variance one. Once (1) is fixed, this should
   stabilize. Until then, treat it as the sole real discriminator.
4. **Eval-awareness leakage.** Subagents (especially in `bug-fixed`) keep
   talking about "the eval" / "with_skill vs without_skill" in their
   responses — they're aware they're being measured. The dispatch prompt's
   phrase "The skill currently under evaluation is NOT available in this
   environment" is a tell. Worth investigating whether the without_skill
   bootstrap can scrub that line without breaking anything else.

## Skill itself

The skill (`SKILL.md`) was **not changed** during these runs. It still earns
a positive delta on the harder prompts (+0.111 at n=1, no validity
warnings), so it isn't broken — there's just little evidence here for *how
much* it helps until the eval suite is tightened. The "Common
Rationalizations" table is still prospective (see the note at line 43 of
`SKILL.md`); iter-2 didn't produce verbatim leaked rationalizations to
graft in either, because the control didn't leak — it complied.
