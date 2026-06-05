# Reviewing the Code

This is **phase 1** of the finishing sequence in [`SKILL.md`](SKILL.md) — the
code review. Review and fix the *code* here. This is the only phase that changes
behavior, so once you finish it the code is frozen.

---

## Size the review to the change

Review depth matches the size and risk of the diff. A one-line fix gets a careful
read and a moment's thought about what it could break; a new subsystem gets more.
Don't run a heavyweight audit over a trivial change to look thorough — a review
that's louder than the change it covers is the failure this guidance exists to
prevent.

Do the review however your harness makes natural — read the diff inline, or
dispatch it to a general purpose subagent.

---

## Read the diff against intent

Read the actual diff — not your memory of what you changed — against the plan or
the request. Cite findings by `file:line` so each one is checkable. Look for:

- **Intent alignment** — does the change do what was asked? Are deviations
  deliberate improvements, or drift?
- **Correctness** — bugs, off-by-ones, wrong conditions, mishandled `null`/empty.
- **Error & edge cases** — failure paths, boundaries, and inputs the happy path skips.
- **Reuse & simplification** — existing helpers ignored, needless abstraction,
  code that could be plainer.
- **Leftover scaffolding** — debug prints, commented-out code, dead branches,
  silent regressions to nearby behavior.
- **Tests** — do they exercise real behavior, and do they cover what changed?

This is not an exhaustive checklist to march through — it's where real problems
tend to hide. Spend attention where this particular diff warrants it.

---

## Rank, then return only the top findings

Sort what you found by severity and report only the few that matter. The point of
ranking is to *drop* noise, not to pad a list.

| Severity | What belongs here |
|----------|-------------------|
| **Critical — must fix** | Bugs, security holes, data loss, broken functionality. |
| **Important — should fix** | Missing behavior, weak error handling, test gaps, architecture problems. |
| **Minor — nice to have** | Style, micro-optimizations, polish. |

Report the most important handful. **Drop Minor nitpicks unless nothing more
serious exists** — a pile of trivia buries the one finding that mattered and
trains the reader to skim past your review. Don't manufacture findings to fill the
tiers; "nothing critical, one important thing" is a complete and good result.
Close with a one-line verdict.

---

## Then: address the findings — and freeze the code

Fix or explicitly flag each code finding you kept. Any fix changes the code — so
make all of those changes *now*, in this phase. When you're done, the code is
**frozen**: nothing in the remaining phases touches behavior. Return to the
finishing sequence in [`SKILL.md`](SKILL.md) and run the **final verification**
(phase 2) on this frozen result — the check you hand back is then guaranteed to
cover the exact code being returned.
