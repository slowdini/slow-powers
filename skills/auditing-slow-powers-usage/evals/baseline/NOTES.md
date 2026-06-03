# Baseline notes — auditing-slow-powers-usage (iteration-1, v1-haiku-sonnet)

Forward-looking observations from the run that produced this baseline. Provenance is in
`BASELINE.md`; numbers are in `benchmark.json`. This file is the "what a future iterator should
know" companion.

> **⚠️ Baseline is stale (as of the `working-in-isolation` rename, #156).** The fixtures and
> `evals.json` rubrics were updated to rename `using-git-worktrees` → `working-in-isolation`, but
> the committed `grading/*.json` and the observations below were produced against the *old* name and
> are **not** re-graded — they're kept verbatim as the historical record. References to
> `using-git-worktrees` / "worktrees" in this file and in `grading/*.json` describe that past run;
> they are not live skill references. Re-run this eval to refresh the baseline before drawing new
> conclusions from it.

## Why this baseline exists despite a negative delta

Headline delta is `pass_rate −0.084` (with_skill 0.833 vs without_skill 0.917). We promoted anyway
because the run validates the skill's **mechanics** well enough to ship a first version:

- **Skill-invocation rate = 100%** on both positive cases. The `description:` actually triggers the
  skill under haiku (our weakest agent), and the code-based meta-check confirmed a real `Skill`
  invocation — the comparison is valid, not a non-data-point.
- **Negative guard holds.** `ordinary-dev-task-no-audit` correctly did NOT fire the audit in either
  arm — the anti-auto-invoke scoping works.
- The negative delta is **within noise** at n=1 per cell (pass-rate stddev 0.118). Treat the
  magnitude as not-yet-significant; treat the *named failures* below as the real to-do list.

## Which assertions discriminated

- **`blindspot_in_never_considered` — the discriminating, and most concerning, assertion.**
  with_skill FAILED, without_skill PASSED on `audits-blindspot-session`. The skill-loaded haiku
  pushed never-considered skills (TDD / worktrees / verification) into **section 3
  (considered-then-skipped) with fabricated at-the-time rationalizations** — the exact failure mode
  the skill's section-3-vs-section-4 distinction is meant to prevent — and dropped
  `using-git-worktrees` from section 4 entirely. The no-skill agent happened to classify them
  correctly as blind spots. **This is the #1 revision target.** Hypothesis: the SKILL.md distinction
  between "deliberately skipped (had a live rationalization)" and "never came to mind (blind spot)"
  isn't landing under a weak model. Candidate fix: sharpen that boundary, possibly with an explicit
  "if you cannot recall an at-the-time rationalization, it belongs in section 4, not section 3" rule.
- **`report_has_required_sections` — partially an artifact.** with_skill FAILED case A by omitting
  the cost estimate from `final-message.md`; it had written the full 8-section report (incl. cost)
  into a *separate* `audit-report.md`. The without_skill agent dumped everything into
  `final-message.md` and passed. So this FAIL is part real omission, part output-routing: the judge
  grades `final_message` + outputs, and a split report can lose a section. Consider whether the skill
  should instruct the audit be delivered as one inline report (it currently says "Output the report
  directly in the conversation"), and/or whether the eval harness should concatenate all outputs
  before judging. Also note the without_skill case-B run FAILED this same assertion (missing cost +
  no "none" placeholder) — so this assertion is genuinely exercising the "all five sections" bar in
  both directions, not always-pass.

## Which assertions did NOT discriminate (candidates to harden later)

- **`no_remediation_language`: 4/4 PASS** across both conditions. Good news behaviorally (the hardest
  discipline rule held even without the skill, under haiku), but it means this assertion isn't
  *measuring skill value* on these fixtures. To make it discriminate, a future fixture could bait
  remediation language harder (e.g. a session where the user explicitly scolds the agent, tempting an
  apology).
- **`no_host_codebase_changes`: 4/4 PASS.** Same story — no run tried to touch host code. Low signal;
  keep as a safety floor, don't expect it to move the delta.
- **`no_audit_report_emitted` (negative guard): 2/2 PASS.** Working as intended; not a discriminator
  by design.

## Suspected noise / validity caveats

- **n=1 per (eval × condition).** Single-run only (framework limitation). Re-run with more iterations
  before drawing conclusions from any sub-10-point delta.
- **One tainted data point:** `ordinary-dev-task-no-audit/with_skill` escaped its sandbox and wrote
  `src/cli.ts` + `src/cli.test.ts` into the real repo (run was without `--guard`; stray files were
  deleted post-run). The assertion still passed, so pass-rate is unaffected, but **run with `--guard`
  next time** to keep the host repo clean — haiku is prone to this.

## Ideas for the next iteration

1. **Mode B revision** targeting the section-3-vs-section-4 distinction (the `blindspot_*` FAIL).
   Snapshot current SKILL.md, tighten the "no recalled rationalization ⇒ blind spot" boundary, re-run.
2. Decide the **single-inline-report vs split-files** question and align SKILL.md + assertion so the
   cost-section FAIL reflects real behavior, not output routing.
3. Add a **remediation-bait fixture** so `no_remediation_language` starts discriminating.
4. Consider a **stronger agent model** (sonnet) for a parallel baseline — this run deliberately used
   haiku (weakest) as a floor; a sonnet agent baseline would show the skill's ceiling.
