# Reviewing the Comments

This is **phase 3** — the last step of the finishing sequence in [`SKILL.md`](SKILL.md).
By now the code has been reviewed (phase 1), and verified (phase 2). The code is frozen;
**this pass touches only comments.** That is the whole reason it comes last: a
comment edit can't change behavior, so it can't invalidate the verification you
just ran — there is nothing here to re-test. Do it as the final polish before the
handoff.

---

## The comment-hygiene pass

Review **every comment in the changed code** with one goal: **delete as many as
possible.**

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

**Everything else gets deleted — about 99.9% of the time.** The most common
offender, and the one that feels most defensible, is **step-by-step narration**
that walks through what the code already says — `// Step 1: lowercase`,
`// now strip the accents`, `// finally, trim the dashes`. It reads as helpful
structure, and *that feeling is the trap*: the numbered steps restate control
flow the reader can already see in the code, so most such comments carry no
information the line below them doesn't — they only add something else to read.
"The steps make it easier to follow" is the rationalization to delete *through*,
not act on; the code is the structure. Strip the narration and nothing is lost.
The same goes for prose narrative ("first we… then we…"), time-sensitive comments
(ticket numbers, "the previous solution…", "changed this because…"), and any
comment that merely restates its line. A comment that fits neither surviving
category, or fits one but misses its bar, is noise. **When in doubt, delete it.**
A truly unique case might warrant a truly unusual comment — but treat that as the
rare exception it is, not the default.

```ts
// BEFORE — every comment restates the line under it
// Step 1: lowercase the title
const lower = title.toLowerCase();
// Step 2: replace whitespace runs with a single hyphen
const hyphenated = lower.replace(/\s+/g, "-");

// AFTER — the code already says all of that
const lower = title.toLowerCase();
const hyphenated = lower.replace(/\s+/g, "-");
```

**A kernel of value doesn't save the comment around it.** The hardest case is
the *mixed* comment — mostly narration, with one genuinely useful clause buried
in it (a real constraint, a non-obvious *why*). Keeping the whole block "because
part of it is useful" is exactly how noise survives review: a reader will keep a
comment that's 90% restatement for the sake of the 10% that matters. Don't.
**Extract the useful part, delete the rest, and if what remains earns a comment,
write it as a tight standalone one** — the kernel alone, not the narration that
carried it. A four-line "Step 1… / Step 2 *(the one real reason)* / Step 3… /
Step 4…" block collapses to a single comment stating that one reason, and the
numbered narration is gone.

---

## Then: hand it back

These were comment-only edits — they change no behavior, so there is **nothing to
re-verify**: the verification from phase 2 still covers the code being returned.
Return to the finishing sequence in [`SKILL.md`](SKILL.md) for the handoff.
