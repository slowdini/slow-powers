# Reviewing the Code

This is **phase 1** of the finishing sequence in [`./SKILL.md`](./SKILL.md) —
the diff review. Review code and comments here, fix or flag the findings that
matter, then freeze behavior before final verification.

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
- **Comments** — ticket/time narrative, step-by-step narration, comments that
  restate the next line, or mixed comments whose one useful kernel should be
  extracted.
- **Tests** — do they exercise real behavior, and do they cover what changed?

This is not an exhaustive checklist to march through — it's where real problems
tend to hide. Spend attention where this particular diff warrants it.

---

## Check for files your change made long

After reading the diff, check whether any file you added to is now over 500 lines.
If one is, it must go through the long-file review in
[`./long-files.md`](./long-files.md) before you finish — one file at a time. That's a
mandate to *review*, which can conclude "no change needed"; what it forbids is handing
back a newly-grown long file silently. Files you didn't grow are out of scope.

This is the one place the "size the review to the change" rule above gives way: a line
count is an explicit trigger, so even a small change that crosses it earns a structured
look — though the change you make in response stays minimal and in-scope.

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

## Clean the comments while reviewing

Comments are part of the diff. Keep only comments that earn their place:

- **Keep exported documentation** such as concise jsdoc or equivalent docs that
  appear in generated docs or editor hints.
- **Keep rare evergreen explanations** for non-obvious constraints, algorithms,
  or deliberate departures from the usual pattern.
- **Delete narrative**: ticket numbers, incident dates, "we changed this
  because...", or any time-sensitive story that belongs in the PR.
- **Delete restatement**: step-by-step narration and comments that merely say
  what the next line already says.
- **Extract the kernel** from mixed comments: keep the one non-obvious reason,
  rewritten tightly if needed, and delete the surrounding narration.

Comment-only edits do not change behavior. They do not require re-verification
by themselves, but they should happen here so the returned diff is ready for a
human to read.

---

## Then: address the findings — and freeze behavior

Fix or explicitly flag each finding you kept. Any behavior fix changes the code — so
make all behavior-changing fixes *now*, in this phase. When you're done,
behavior is **frozen**: nothing after this phase changes runtime behavior. Return
to the finishing sequence in [`./SKILL.md`](./SKILL.md) and establish final
verification evidence for this frozen result. If qualifying verification evidence
already exists and this review made no behavior-changing edits after it, reuse
that evidence instead of rerunning ceremony.
