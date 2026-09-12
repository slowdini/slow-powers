# hardening-plans — goal coverage

Status: **corrected draft suite; no executions of this revision.** The earlier pilot ran
one with/without pair on the pantry case in plan-then-act mode. It informs case design,
but does not validate these plan-only prompts or rubrics. Historical observations and
instrument limitations are in [NOTES.md](NOTES.md).

## The problem and intended use

Plans can reach a reviewer or implementer with nonexistent file references, omitted
requirements, unresolved decisions, contradictory names, and unrelated tasks. Successful
assistance produces a concrete plan the reader can use without first correcting those
defects. The positive cases exercise that goal in the harness's native plan mode, with
its normal protections and shared guidance present in both conditions. The comparison
measures the skill's additional value in that intended context.

## Goals and designed coverage

Goal IDs are retained for comparison with the historical notes; gaps in numbering reflect
retired criteria. Every assertion in this revision awaits calibration and fresh measurement.

| Goal | Situation and cases | Evidence that establishes success |
| --- | --- | --- |
| G1 — Ground file references | `pantry-staples-plan-mode` implies a nonexistent settings surface; `revise-favorites-plan-seeded` inherits nonexistent file references | The presented plan modifies real files and gives any new files concrete homes. A valid replacement design also passes |
| G2 — Cover the request | Pantry staples has several connected requirements; the inherited favorites draft omits the nav count badge | The complete plan accounts for the request, exposing unresolved requirements rather than silently dropping them; the seeded case must supply the missing badge work |
| G3 — Settle consequential decisions | Both features require persistence without losing saved planner state | The plan specifies a sound storage and compatibility mechanism. A list of forbidden words is not the criterion |
| G4 — Keep the plan internally consistent | The seeded draft disagrees on action and state-field names; both plans connect UI, state and storage | Names and data shapes agree, and their connections contain enough information to implement. Silent corrections and valid alternative names pass |
| G5 — Keep work relevant | The seeded draft carries an unrelated ingredient-rounding audit; either plan may accumulate filler | Each implementation step contributes to the requested feature or its verification; the unrelated audit is removed |
| G7 — Avoid unnecessary ceremony | `mechanical-aria-label-fix` requests a small direct edit outside plan mode | The requested label and corresponding test change are made directly, tests pass, and the diff stays small |

Both positive cases require a usable, complete presented plan. Neither requires feature
implementation, project test execution, editing the inherited plan file, review narration,
or a particular skill identifier. Native plan mode supplies the permission boundary;
plan quality is established from the presented plan and relevant repository evidence.

**The former G6 citation criterion is excluded entirely from performance coverage.** Its
historical observation remains in the notes, but it is neither a goal nor a separate
performance metric. There is no evidence here that omitting the literal identifier causes
a downstream failure. The subject skill's unsupported enforcement remains an authoring
issue for separate work; the pilot does not change that skill.

**The former G8 implementation checks are outside this revision's measurement.** The
plan-only cases cannot establish runtime correctness. Their historical checks and the
[legacy-state holdout](fixtures/legacy-state.holdout.tsx) remain calibration evidence for
the earlier plan-then-act pilot, not active checks on a presented plan.

## Interpretation and limits

- The pantry pilot found no demonstrated plan-quality benefit on that case and population.
  The tiny fixture and explicit request may have made important checks easy; one pair
  cannot establish why the conditions tied. Native plan mode is part of intended use,
  not a defect to remove. Redundant skill guidance is one possible finding to investigate.
- The seeded case supplies an inherited defective plan under prior commitment and a short
  deadline. Those are plausible incentives to carry defects forward, not proof the case
  will separate conditions. It stays in native plan mode.
- Pantry is a cold request and favorites is seeded, but they concern different features.
  Comparing their scores cannot isolate the effect of the text seed. A matched cold
  version would be needed for that question.
- The mechanical case is an intended non-invocation boundary, not an attempt to measure
  positive plan-hardening behavior outside plan mode.
- Single-skill staging omits sibling slow-powers skills. Both conditions retain the shared
  bootstrap. The suite measures plan quality, not whether a downstream skill chain runs.
- Use a runner containing eval-magic PR #325 for `plan_mode: "plan_only"`; confirm complete
  plan artifacts and source isolation before interpreting results. See the runner and
  evidence requirements in [NOTES.md](NOTES.md).
