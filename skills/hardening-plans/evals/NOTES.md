# hardening-plans evals — pilot notes (issue 285)

**Status: corrected draft; exploratory historical evidence only.** No execution has used the
plan-only revision of `evals.json`. The earlier pilot ran one with/without pair on one
plan-then-act case. Its two command checks passed, but all five model-judged assertions
remained ungraded. Counts and results below describe that historical configuration, not
the corrected suite. This is not a validated baseline.

This suite was built as a pilot of the rewritten `slow-powers:evaluating-skills` guidance. The
subject skill was deliberately left unchanged.

## Historical pilot: what was measured

| | |
| --- | --- |
| Iteration | `2` (`~/.local/share/eval-magic/skills-7e57aa1a/hardening-plans/iteration-2`) |
| Mode | `new-skill` (with_skill vs without_skill) |
| Case | `pantry-staples-plan-mode` only |
| Runs | 1 per condition |
| Agent model | `claude-sonnet-5` |
| Judge model | `claude-opus-5` |
| Harness | `claude-code`, with `evals/harness/claude-code-isolated.toml` |
| Codebase | `eval-magic-fixture` (Weeknight) @ `b6d269c` |
| Shared layer | repo `bootstrap.md` inlined into both arms via `--bootstrap` |
| Skill staging | single-skill isolated — no sibling slow-powers skills staged |

One pair generates hypotheses. It does not establish reliability, and `--runs 1` cannot resolve
any effect: the run plan's own Fisher floor for this design is p = 1.0.

## Validity evidence (read before the outcomes)

- Both arms **completed**; 0 stopped, 0 timed out, 0 failed. Comparable rounds (plan presented in
  round 1, approved in round 2 in both) and comparable duration (9.5 min vs 10.6 min).
- **0 stray-write violations, 0 live-source reads.** The shadow preflight warned that the installed
  `slow-powers@slowdini` plugin ships `hardening-plans` and would load in *both* arms — which would
  have made the control arm not skill-free and invalidated the delta. The descriptor override in
  `evals/harness/claude-code-isolated.toml` adds `--setting-sources project,local` to the opening
  *and* resume templates; a smoke dispatch confirmed `plugins: []` and no slow-powers skills, and
  ingest confirmed no live-source reads. eval-magic cannot infer this from a shell template, so the
  preflight warning persists by design — it is answered by the ingest record, not by silencing it.
- **Skill invocation confirmed** for `with_skill`, transcript-based (no judge needed). The
  transcript shows the `Skill` tool invoked twice.
- **Guard denials were asymmetric: 2, both in `with_skill`.** `npm run format ... && npm run lint`
  was blocked because `format` is not in the auto-detected `language/javascript` profile, and a
  compound command needs every segment allowed; a `playwright` probe was also blocked. This
  prevented the treatment arm from linting. Fixed for future iterations by the config-level
  `guard` block in `evals.json` (`profiles` + `allow_commands: ["npm run format"]`). **The
  iteration-2 numbers below were produced under that asymmetry.**
- **Timing and tokens were recorded as `unavailable`** in the evidence bundles, so the cost side of
  the comparison could not be read for this pair.

## Outcome: no demonstrated plan-quality benefit at this tier on this case

| Goal | with_skill | without_skill | Verdict |
| --- | --- | --- | --- |
| G1 plan cites only real files | flagged "no existing settings page", named real files | flagged "there's no existing settings surface to extend" | tie |
| G2 spec coverage (six requirements) | all six covered | all six covered | tie |
| G3 decisions settled | separate storage key, justified | new field validated as optional, justified | tie |
| G8 project checks green | `npm test`/`typecheck`/`lint` pass | pass | tie |
| Held-out: legacy saved plans load | PASS | PASS | tie |

Both arms produced strong plans and faithfully implemented them, by different but defensible
designs: `with_skill` persisted staples under a separate key and never touched `planner.ts` /
`storage.ts`; `without_skill` extended `PlannerState` with a field validated as optional. Both
survive the held-out legacy-state check.

Historical review also recorded the literal next-skill identifier in the treatment plan
and its absence in the control plan. This establishes compliance with a mechanical
instruction, not plan-quality improvement. The
corrected suite removes G6 entirely rather than reporting it as a separate performance
metric. No downstream failure from omitting the identifier was demonstrated.

### Interpreting the tie

The pilot does not identify a cause for the tie. The fixture is small enough that checking
paths is inexpensive, and the request explicitly calls out matching and saved-state
compatibility. Those are plausible reasons to suspect an easy case, worth screening
before a larger run.

Native plan mode is the intended context for this measurement. Its existing exploration
and protections belong in both conditions; measuring additional value over them is the
point. The earlier recommendation to avoid plan mode to obtain a delta is withdrawn.
Sufficient evidence of redundancy could instead support simplifying the skill for this
population. One exploratory pair does not establish that conclusion either.

## Instrument defects found

- **The captured plan artifact is not reliably the plan.** `ExitPlanMode` is not registered in
  headless `claude -p` dispatches, so agents improvise plan presentation. In `with_skill` the agent
  hand-wrote its plan via `Write` to `~/.claude/plans/…md` (8369 B) and made its final message a
  summary; eval-magic saved that 2412-byte summary as `outputs/plan.md` while recording
  `signal: plan_file`. In `without_skill` the artifact is byte-identical to its plan file. So the
  two arms' evidence bundles **differ in kind**, and a rubric reading "the approved plan" would have
  scored the treatment arm FAIL on G6 — a behavior it demonstrably performed in the real plan.
  The historical `next-skill-handoff` rubric tried to compensate by searching the whole
  bundle. That rubric is removed. The corrected suite requires comparable complete plan
  artifacts; moving the task out of native plan mode is not a capture remedy. The runner
  changes below do not repair the historical artifacts retroactively.
- **Parallel arms share `~/.claude/plans/`.** Both dispatches write plan files into one host
  directory. Nothing went wrong here (filenames differed), but it is a cross-arm hazard for
  higher `--runs` or `--jobs`.
- **The historical `setup_files` had no `files_root`.** Its held-out source therefore lived
  at its destination path beneath `evals/src/test/`. It is retained as
  [fixtures/legacy-state.holdout.tsx](fixtures/legacy-state.holdout.tsx) after retiring that
  assertion, with a filename that does not enter this repository's Bun test discovery.

## Grader calibration

The historical `legacy-state.holdout.test.tsx` and `command_check` graders were calibrated
against real output, not just designed:

- **A first draft failed both valid solutions.** It used `getByText`, which also matches the
  `<option>` entries every day's recipe `<select>` renders, so it errored on ambiguity even though
  the plan had loaded correctly. Re-queried by link role, both arms pass. Had this shipped
  unexamined it would have read as a dramatic two-arm regression that never happened.
- **Rejects the failure it exists to catch.** Injecting the naive migration — a *required*
  `pantryStaples` field added to the strict validator — turns it red, because legacy payloads then
  fail validation and the saved plan is discarded.
- **Fails closed.** Missing holdout file, missing `PlanPage.tsx`, or missing `package.json` each
  emit `GRADER_VERDICT: FAIL …`; every check asserts on the `GRADER_VERDICT: PASS` marker rather
  than on an exit code alone, so diagnostic output cannot satisfy a passing assertion.

Both `command_check` assertions were executed by the runner against both arms and passed.

## Unfinished historical measurement

- All 10 model-judge dispatches (5 rubrics × 2 conditions) failed with HTTP 429, an
  operator-account session limit. The goal-level observations above come from human
  review, plus the two executed command checks; they are not model-graded pass rates.
- `revise-favorites-plan-seeded` and `mechanical-aria-label-fix` were never dispatched.
- The old pending judge tasks include rejected criteria and reference imperfect artifacts.
  Do not resume them as a validation of the corrected suite. Any historical regrading must
  identify its purpose, evidence repairs and rubric version; it would be calibration data.
- No baseline has been promoted.

## Corrected suite and runner requirements

The positive cases use `plan_mode: "plan_only"`. The seeded prompt requests a complete
reviewed plan under prior commitment and time pressure; both cases stay in native plan
mode. Their assertions grade substantive plan properties and accept silent corrections
and alternative valid designs. Citation and standalone rereading checks are removed, as
are implementation requirements and command checks on those cases. The mechanical
non-invocation case retains its direct-action checks.

[eval-magic PR #325](https://github.com/slowdini/eval-magic/pull/325), merged as
`83f80d9e2f061a9539a2b108f2c94f316f08cd21`, supplies plan-only execution and instructs the
agent to return the full plan. The isolated Claude descriptor no longer overrides that
with a closing-summary instruction; its initial and resume isolation settings remain.
Use that runner revision or a successor with those capabilities. A version string alone
is insufficient: the merge commit still identifies itself as 0.10.0, while the published
0.10.0 release predates the feature.

Inspect `outputs/plan.md` and the corresponding evidence for both conditions. Confirm the
complete presented plan, its capture provenance, and the absence of an approval/act round
on a plan-only run. A fallback `plan.signal: "final_message"` may capture a question or
summary. Artifact existence is not evidence of usable content. Preserve source isolation
on every dispatch round and inspect validity before scores.

This repo's CI installs eval-magic from the latest release. Its release must contain
plan-only support before this suite can pass that CI validation; do not change the suite
back to plan-then-act merely to satisfy an older schema.

## Next verification

1. Validate the configuration and dry-run it using the required runner and isolated
   Claude descriptor. Establish run settings and the concrete model budget before dispatch.
2. Calibrate the revised plan rubrics against complete plans, known defective examples,
   and missing/summary-only evidence. Preserve the historical pair's guard and artifact
   limitations when using it for calibration.
3. Measure the frozen revision across fresh sessions, including the seeded and boundary
   cases. Record quality, cost, validity and uncertainty without requiring a positive delta.
4. Separately verify whether the revised evaluating-skills and writing-skills guidance
   helps an author make these decisions. A result about hardening-plans is not a measured
   result about the guidance used to author its suite.
