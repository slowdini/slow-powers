# Baseline notes — dedicated code/comment review (issue #173)

Revision eval validating the move off the harness's built-in code-review onto
self-contained guidance, plus the split of the finishing sequence into three
ordered phases (revision mode, baseline snapshot `dev`, sonnet/sonnet, bootstrap
on, guard armed, 2026-06-05). Promoted from **iteration-6**; confirmed by
**iteration-7**.

## The change under test

- SKILL.md "Finishing" rewritten into three explicit phases: **(1) review & fix
  the CODE** ([`code-review.md`](../../code-review.md)) → code is frozen → **(2)
  final verification** on the frozen code → **(3) review & clean the COMMENTS**
  (a former standalone comment guide), cosmetic, no re-verify.
- A copy-into-your-tracker **finishing checklist** enumerating the phases + the
  no-unilateral-merge gate.
- `code-review.md` was the code review only; the comment-hygiene pass (delete
  narration / step-by-step / ticket comments; keep only Explanation or exported
  Documentation; **extract the kernel** from a mixed comment) moved to a former
  standalone companion guide.
- Old arm (`dev`) = the prior step 1 "invoke your harness's built-in code-review
  capability," no companion files.

## Suite

Two cases via `--only`, the ones this change actually touches:
`comment-hygiene-at-handoff` and `wrap-it-up-handoff`. The other four suite
cases (`claim-without-running`, `build-implied-by-edit`, the two seeded cases)
were **not** re-run for this change — they exercise the Gate Function / red-flag
tables, not the finishing-sequence restructure. A future full-suite revision run
is wanted before treating this as a whole-skill baseline (see below).

## Result (iteration-6 promoted; iteration-7 confirms)

| | old_skill | new_skill | delta |
|---|---|---|---|
| iteration-6 | 0.75 | 1.00 | +0.25 |
| iteration-7 | 0.75 | 0.875 | +0.125 |
| **mean** | **0.75** | **0.9375** | **+0.1875** |

Both iterations positive, invocation 100% / 100%, no validity warnings. Tokens:
new approximately 215k / 190k vs old approximately 143k / 110k — the phased
review + checklist cost ~40-70% more tokens; the +~19pp buys that.

## What discriminates (and what doesn't)

- **Robust driver — the checklist drives a consistent handoff.**
  `wrap-it-up-handoff` new_skill is **4/4 in both runs**; old is 3/4 then 2/4 —
  the baseline streakily forgets to *quote the fresh test output* and to
  *surface all four integration options*. The checklist nails both every time,
  plus the explicit Phase 1/2/3 structure (agents reproduce "Phase 1 — Code
  review / Phase 2 — Verification / Phase 3 — Comment cleanup" verbatim).
- **`deleted_narrative_comments` is noisy in BOTH arms.** It flipped between runs
  (it6 old-FAIL/new-PASS; it7 old-PASS/new-FAIL). Deleting the *mild* restatement
  one-liners (`// lowercase the title`, `// strip leading and trailing hyphens`)
  is a borderline judgment neither arm makes reliably — one agent called them
  "lightweight orientation aids" and kept them. So it is **not** the delta
  driver; it roughly cancels. The *extract-the-kernel* behavior itself is solid:
  the NFKD kernel **and** the exported jsdoc were kept in 100% of arms across
  every run, and the ticket block was always removed.

## Process history (why it took several iterations to measure)

- **it1-3 (delta <= 0):** the original comment fixture was confounded — its
  "Step N" comments mixed pure restatement with a genuine kernel (the NFKD
  reason), so no agent could satisfy "delete all Step-N" while keeping the
  kernel. `deleted_narrative` failed 6/6. Not a skill signal; a broken yardstick.
- **it4-5 (+0.25 then -0.125, sign flipped):** fixture rewritten to a clean
  noise/kernel split + prompt rewritten to invite direct edits (agents had been
  *advising*, not editing). Positive once, then an over-strict assertion (re-run
  tests after a comment-only edit) docked the new arm.
- **it6-7 (+0.25, +0.125, both positive):** finishing sequence split into the
  three phases above so verification lands on frozen code *before* comment
  cleanup, and the "re-verify after comment-only edits" requirement dropped
  (comment edits change no behavior). Reliable positive delta.

## Caveats / next iterator

- n=1 per cell per iteration (2 data points per condition). Both positive, but
  the comment-deletion sub-behavior is genuinely noisy — a third confirming run,
  or a sharper fixture where the restatement comments are *unmistakably*
  deletable, would tighten it.
- Bootstrap on, so invocation is pinned at 100%; this baseline measures
  pass-rate, not trigger rate.
- Before calling this a whole-skill baseline, re-run the full 6-case suite in
  revision mode against `dev` — the four Gate-Function cases also see the
  restructured finishing sequence and their committed numbers are now stale.
