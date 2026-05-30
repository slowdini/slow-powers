---
name: auditing-slow-powers-usage
description: Use only when a slow-powers developer explicitly asks for a post-session audit of how slow-powers skills were used during the session just completed. A manual diagnostic for people working ON slow-powers — never relevant to ordinary development tasks; do not auto-invoke.
---

# Auditing Slow-powers Usage

## Why you're being asked this

A slow-powers developer is running a deliberate, manual diagnostic. The session you just spent
working, likely in **some other codebase** is the subject. They want to know how the slow-powers
skill set actually performed in a long, realistic, multi-turn session, something that's otherwise
difficult to measure.

This is a check on **slow-powers**, not on your work. You are not in trouble, the work is not being
reopened, and there is no "right answer" you're being graded against. Report honestly and
specifically. Your report seeds new pressure tests and live spot-checks of the plugin.

## Scope — stay inside these lines

**Do:**
- Report only on how slow-powers influenced the session that has already happened.
- Draw entirely on what's already in this conversation — your own decisions, what you read, what you skipped.

**Don't:**
- Read, explore, or grep the host codebase to "investigate" — the audit is about slow-powers, not the project.
- Touch the host project: no edits, no fixes, no commits, no files written into its working directory — not even the audit doc.
- Re-open, redo, second-guess, or "improve" the work you just delivered.
- Propose changes to the host project. That's out of scope even if you spot something.

**The one permitted write — and only this one:** persisting the audit doc (and, if opted in, a
transcript copy) under the operator's global `~/.super-slow-audits/` folder, as described in
*The report* below. That folder lives outside any host repo, so writing there never pollutes the
project under audit. Everything else above still holds: the global audit folder is allowed; the host
repo is forbidden. If the folder doesn't exist, you write nothing at all — report inline and stop.

## Reporting rules

These rules are the point of the audit. Follow them exactly.

- **Report what you decided and why, *at the time*.** The reasoning that was live when the work was
  happening — not a tidied-up version, not what you'd do differently.
- **No after-the-fact remediation or apology language.** Do not write "I should have…", "I'll
  remember next time", "going forward I'll…", "good catch, I'll fix my approach." You cannot
  remember anything next session; that text is pure noise and it pollutes the data. If you skipped a
  skill, state the rationalization you actually had — don't recant it.
- **Be honest about slow-powers's downsides.** Where a skill added friction, wasted tokens, was
  ignored, or wasn't worth its cost, say so plainly. A glowing report that hides cost is useless.
- **Mark uncertainty instead of fabricating.** If you can't reliably recall whether you read a skill
  in full or what triggered an invocation, say "uncertain" and why — never invent a clean specific.

## The report

Build the full report under these exact headings, in this order. Use "none" for any section that
doesn't apply rather than dropping the heading.

### Where the report goes

These audits are most valuable when they accumulate as durable artifacts, so the report can be
persisted — but only when the operator has opted in, and never inside the host repo.

Probe (read-only) whether the global folder `~/.super-slow-audits/` exists. **Do not create it** —
its absence is a deliberate "don't persist" signal, and creating it would be the kind of unrequested
write this skill forbids.

- **Folder absent (default):** output the full report inline in the conversation, exactly as the
  headings below describe. Write nothing to disk.
- **Folder present:** write the full report — every heading below, identical content — to
  `~/.super-slow-audits/audit-<YYYYMMDD-HHMMSS>-<repo-basename>.md` (use the host repo's directory
  name for `<repo-basename>`). Then, in the conversation, emit only a short pointer: the saved path
  plus the one-line session summary from section 1. Don't reprint the whole report inline — the doc
  is the artifact.

Either way the report content is the same; only its destination changes.

### Optionally attaching the session transcript

A persisted report is a summary; the raw session transcript is the highest-fidelity record of how
slow-powers actually competed for your attention. Capturing it is a **second, separate opt-in**,
because a real transcript contains host-codebase content that is otherwise outside this audit's scope
(slow-powers, not the host repo). Only do this when **both** of these are true:

1. `~/.super-slow-audits/` exists (report persistence is on), **and**
2. `~/.super-slow-audits/transcripts/` also exists (the operator has separately opted in to transcripts).

When both hold, **copy** your current session's transcript file as-is into
`~/.super-slow-audits/transcripts/audit-<YYYYMMDD-HHMMSS>-<repo-basename>.transcript.jsonl`, matching
the report doc's timestamp and repo name.

- **Copy the file on disk — never read it into your context.** A real transcript can be hundreds of
  KB or more, and reading your own in-progress session back into context is wasteful and recursive.
  A filesystem copy moves it without loading it. Reading it would defeat the point.
- **Harness-dependent; degrade gracefully.** This works only where your harness persists a readable
  session transcript file. If yours does not expose one, don't fail the audit — note it in the report
  (one line: `transcript: not captured — <reason>`) and carry on. The report itself is unaffected.

### 1. Session summary
One or two lines to orient the reader: what the work was, roughly how many turns, what kind of repo.
Orientation only — no analysis here.

### 2. Skills invoked
A table, one row per slow-powers skill you actually loaded:

| Skill | What inspired invoking it (the signal at the time) | Read in full? | Followed authentically? |
|-------|----------------------------------------------------|---------------|-------------------------|

- *What inspired it*: the concrete trigger — a user phrase, an error, a state you hit — not a
  generic "it seemed relevant."
- *Read in full*: yes / partial / no. Partial and no are fine and useful; report them honestly.
- *Followed authentically*: "yes", or "deviated — <how and why>". Describe deviations factually.

### 3. Skills considered but skipped
A table, one row per skill you thought about using and then chose not to:

| Skill | Why it came to mind | Rationalization for skipping (your actual reasoning at the time) |
|-------|---------------------|------------------------------------------------------------------|

Quote your live reasoning where you can. This is the most valuable section for building new pressure
tests — capture the real excuse, not a corrected one.

### 4. Relevant skills never considered
Skills that arguably applied to this session but never came to mind while you worked. Distinct from
section 3 — these are blind spots, not deliberate skips. Best effort; mark uncertainty.

### 5. Cost
Tokens and wall time attributable to slow-powers specifically: skill bodies loaded into context, plus
extra steps a skill made you take that you otherwise wouldn't have.

> Cross-harness note: if your harness exposes real token/timing figures, use them and say so. If it
> doesn't, give a clearly-labelled best estimate and state your method (e.g. "≈X skills loaded at
> ≈Y tokens each; +Z tool calls for the worktree setup").

### 6. Net usefulness verdict
Given that cost, was slow-powers worth it **for this session**? Don't hand-wave. Cite **specific
moments** where a skill steered you away from breaking one of its own requirements — state the
counterfactual: what you would have done without it. Then call out the neutral or net-negative
moments too. Land on a clear verdict.

### 7. Feature gaps (optional)
Moments you wanted guidance and no skill provided it. These are candidate new-skill ideas — include
only if real.

### 8. Confidence & caveats
Where your recall is shaky or a figure is a guess. Be specific about what you're unsure of.

## Example: a good section-3 row vs. a bad one

✅ Good — reports the live decision and reasoning:

> | test-driven-development | I was about to add a new parser branch | "The change is two lines and I can eyeball it; the user said the demo is in five minutes, so I wrote the code first and planned to backfill a test." |

❌ Bad — recants, apologizes, promises future behavior (do not do this):

> | test-driven-development | Adding a parser branch | "I skipped it, which was a mistake — I should have written the test first and I'll make sure to follow TDD next time." |

The good row is data we can turn into a pressure test. The bad row tells us nothing about what you
actually decided and adds a promise you can't keep.
