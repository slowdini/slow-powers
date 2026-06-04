# Reviewing the Diff

This is the review step of the finishing sequence in
[`SKILL.md`](SKILL.md) — run it *before* the final verification, so the evidence
you hand back covers the exact code being returned.

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

## The comment-hygiene pass

Before the diff goes back to a human, review **every comment the change adds**
with one goal: **delete as many as possible.**

This runs against your own instinct. Writing a comment feels like preserving the
narrative — why this approach, what was tried, which ticket it traces to. But a
human reading code finds it *very hard* to skip a comment; every one they hit,
they stop and read. Narrative comments tax every future reader to record a story
that belongs in the commit message or the PR, not the source. Left in, they
become the thing the user has to delete by hand before merging — so delete them
now, on their behalf.

A comment survives only if it fits one of two categories **and** meets its bar:

1. **Explanation.** Code that is genuinely hard to follow from reading it — a
   subtle algorithm, a deliberate break from the usual pattern, a non-obvious
   constraint. The comment fills the gap with an *evergreen* reason (true a year
   from now, not "fixes the bug from Tuesday"). These are **extremely rare**:
   well-written code is self-commenting, and a reader fluent in code can follow
   even sophisticated paths when the code itself is clear. If the right fix is to
   make the code clearer, do that instead of explaining unclear code.
2. **Documentation.** A concise doc-style comment (jsdoc and equivalents) on an
   **exported** member, where the text is surfaced by doc generators and editor
   hints to readers who *don't* have the source in front of them. These almost
   always earn their place. Keep them concise and evergreen, matching the
   surrounding style; they may describe usage more freely since that's their job.

**Everything else gets deleted — about 99.9% of the time.** Narrative
("first we… then we…"), time-sensitive (ticket numbers, "the previous solution…",
"changed this because…"), and comments that merely restate the code all go. A
comment that fits neither category, or fits one but misses its bar, is noise.
**When in doubt, delete it.** A truly unique case might warrant a truly unusual
comment — but treat that as the rare exception it is, not the default.

---

## Then: address, and verify last

Fix or explicitly flag each finding you kept, and apply the comment-hygiene
deletions. This might change the code — which is exactly why review comes
*before* the final verification. Return to the finishing sequence in
[`SKILL.md`](SKILL.md) and run the Gate Function fresh on the reviewed result, so
the evidence you present is the check on the code the user actually gets.
