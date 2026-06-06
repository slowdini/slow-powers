# Notes — forward-looking observations

Author-maintained companion to the baseline. Not provenance (see `BASELINE.md`)
and not results (see `benchmark.json`). These are observations for whoever
iterates next.

## The `seeded-mid-implementation-momentum` case and what it can't yet measure

`seeded-mid-implementation-momentum` was added (per the CLAUDE.md directive that
TDD carry a seeded case) and was also used as the measurement vehicle for the
**bootstrap capability→gate-wrapping reframe** (issue: reframe bootstrap from
capability-invocation toward gate-wrapping). That reframe was measured with a
two-bootstrap A/B: the *same* seeded scenario run under the OLD bootstrap
(capability framing + "Active Skills Directory" enumeration) vs the NEW bootstrap
(gate-wrapping, no enumeration), via the runner's `--bootstrap` flag, `new-skill`
mode, N=3 replicas, Sonnet 4.6 agent + judge.

**Result: null delta.** Invocation rate was **100% (3/3) under BOTH bootstraps**;
tests-first substantive pass rate was identical (~0.83) in both. No
`validity_warnings`.

A null delta here is **not** evidence the reframe failed (the eval-seeding issue
says so explicitly). It is two stacked measurement ceilings:

1. **The runner over-promotes invocation.** `buildDispatchTask` in
   `@slowdini/eval-runner`'s `src/run.ts` puts a *constant* instruction in the
   `with_skill` arm: *"the skill … is staged under the unique slug … — invoke that
   slug … if the skill applies."* That hint is identical across both `--bootstrap`
   variants, so it cancels in the delta but pins the invocation floor near 100%.
   For a broad-trigger skill like TDD ("any feature implementation"), the agent
   invokes regardless of bootstrap framing — the framing never gets to be the
   deciding factor.
2. **A text seed can't inject the real suppression.** The wild failure this
   reframe targets happens mid-session under an *active harness workflow* (e.g.
   plan mode) where loading a skill reads as redundant ceremony. A prompt-string
   seed can *describe* that state but not place the agent *in* it — the documented
   ceiling in `slow-powers:evaluating-skills` ("Seeding conversation context (and
   its ceiling)"). The seed's "no need for tests" pressure was not enough to drop
   OLD-bootstrap invocation below 100%, so there was no gap for the new framing to
   close.

So the acceptance criterion ("positive invocation-rate delta on seeded evals where
a skill should fire but currently doesn't") could not be *exhibited*: the
"currently doesn't fire" precondition never reproduced in-harness.

## Ideas for a future run that could surface a real, failing-then-passing delta

Roughly in increasing order of effort / payoff:

1. **Harder adversarial seed.** Mirror `hardening-plans/evals/`'s adversarial
   case: seed an `Assistant:` turn that *explicitly rationalizes not loading the
   skill* ("I'm already mid-implementation, a TDD skill would just duplicate what
   I'm doing"). May still lose to the runner's slug-invoke hint, but worth a cheap
   try.
2. **Runner option: stage-for-discovery-without-instructing-invocation.** Add a
   flag so the skill is discoverable (so the code-based `__skill_invoked`
   meta-check still works) but the dispatch does **not** tell the agent to invoke
   the staged slug. Then whether the agent invokes becomes a genuine choice the
   bootstrap framing can influence — the single change most likely to make this
   class of eval measurable. This is the high-value framework improvement.
3. **Real harness-mode injection.** Reproduce the plan-mode suppression by running
   the eval subagent *inside* a real plan mode rather than a described one. Tracked
   as a parity goal in the `@slowdini/eval-runner` docs (`docs/harness-parity.md`); the biggest lift.

## Bigger-picture testing strategy (from the maintainer)

For hard-to-test framing changes like this, a zero delta is an acceptable baseline
for now. The durable path to *testable* pressure scenarios is **live-session
audits** (`slow-powers:auditing-slow-powers-usage`): once we reach consistent live
skill compliance, the real-world failures we still see become the focused,
reproducible scenarios these evals currently can't manufacture cold. Until then,
don't expect the harness to manufacture the suppression on its own.

See also the project memory note `bootstrap-ab-invocation-ceiling`.
