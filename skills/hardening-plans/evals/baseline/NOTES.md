# Notes — hardening-plans 3b baseline (iteration-1)

Forward-looking observations from the run that produced this baseline. Read these
before trusting the headline `benchmark.json` aggregate.

## Read the per-case deltas, not the aggregate

The aggregate `delta.pass_rate` is **−22pp (new_skill below old_skill)**, but that
number is misleading on its own — it is dragged entirely by one confounded
negative case (see below). The per-case picture:

| Case | old | new | note |
|------|-----|-----|------|
| `concrete-todo-app-plan` | 100% | 100% | no discrimination (both pass) |
| `seeded-review-catches-defects` | 67% | **100%** | **the headline: +33pp** |
| `csv-parser-bug-no-plan` (negative) | 100% | **0%** | confounded regression, see below |

## The headline behavioral delta is clean

`seeded-review-catches-defects` is the case the 3b reframe targets. The
discriminating assertion is **`catches_hallucinated_file`**: old_skill **FAIL**
(carried `src/hooks/useLocalStorage.ts` forward as "Already exists; verify
signature") → new_skill **PASS** (flagged it as unconfirmed, reworded to
"create or extend"). Invocation rate 100% in both arms, no `validity_warnings` —
so the delta reflects the skill, not a trigger artifact. `catches_irrelevant_step`
(Redux) and `hands_off_to_tdd` passed in *both* arms, so they don't discriminate
here; `catches_hallucinated_file` is the load-bearing one.

## The csv-parser regression is explained and orthogonal to the reframe

On the negative over-trigger guard, new_skill loaded `hardening-plans` and drafted
+ hardened a plan instead of routing to `systematic-debugging` (old_skill routed
correctly). **Confirmed proximate cause:** the pre-3b "When NOT to Use" section
carried an explicit signpost —

> * The task is debugging — load `slow-powers:systematic-debugging` instead.

— and the 3b rewrite **dropped that line**. The old arm matched it and routed; the
new arm had no such signpost and fell through to plan-then-harden. This is a *real*
side effect of a 3b text change, **not** N=1 noise.

Ruled out: plan-mode framing. `csv-parser-bug-no-plan` is a **cold** prompt — it
injects no plan-mode context (only the seeded cases do). So the
"debugging-request-in-plan-mode" philosophical wrinkle (tracked separately as an
internal eval-framing issue) does **not** explain this failure; the dropped line
does.

## Suggested follow-up (not done here)

Re-adding the one-line debugging route to "When NOT to Use" would very likely
restore the negative guard at near-zero risk to the reframe. Deferred as a
separate change so 3b stays one-problem-per-PR; left to the maintainer's call.

## Provenance / scope

3-case cost-conscious subset (the runner has no per-case selector — tracked as a
follow-up issue; the full 6-case suite was temporarily reduced for this run and
restored afterward). Agent + judge both `claude-sonnet-4-6`.
