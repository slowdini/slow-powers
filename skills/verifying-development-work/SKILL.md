---
name: verifying-development-work
description: Use before claiming any task is complete, fixed, or passing, and before handing finished work back to the user.
---

# Verifying Development Work

Claiming work is complete without verification is an assumption, not a fact. Always verify before presenting success.

> **THE IRON LAW:** NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE.

> **Violating the letter of the rules is violating the spirit of the rules.**

---

## The Gate Function

Before claiming any task is finished, making a success claim, or declaring a bug fixed:

1. **IDENTIFY:** What exact command or output proves this claim? (e.g., test command, compiler output, linter check).
2. **RUN:** Execute that command fresh and in full. Do not rely on previous runs or assume "nothing changed."
3. **READ:** Review the full output, verify exit code is `0`, and check for warning logs.
4. **VERIFY:** Does the output confirm success?
   * **If NO:** Correct the code or tests. Repeat verification.
   * **If YES:** State your completion claim **and present the fresh verification output** as evidence to the user.

---

## Core Verification Types

| Success Claim | What is Required | What is NOT Sufficient |
| :--- | :--- | :--- |
| **"Tests are passing"** | Fresh execution of the test suite showing `0 failures`. | "They should pass," or a test run from 15 minutes ago. |
| **"Linter is clean"** | Linter execution output showing `0 errors` and `0 warnings`. | Assumed clean because it compiled. |
| **"Build succeeds"** | Compiler/build output exiting with code `0`. | Linter passing (compilation could still fail). |
| **"Bug is fixed"** | Consistently running the failing scenario showing it now succeeds. | The code change was made and "seems correct." |
| **"Requirements met"** | A checklist of the plan's requirements matched against code verification. | Tests pass, but product criteria were skipped. |

---

## Finishing: Review Code, Verify, Then Review Comments

The Gate Function above is your discipline at *every* completion claim. When you believe the work itself is done, run these three finishing phases **in order**. The order is deliberate: every code change happens in phase 1, *before* the verification, so the evidence you hand back is guaranteed to cover the exact code being returned — and comment cleanup comes *after*, where it can't disturb that check.

1. **Review and fix the code** — follow [`code-review.md`](code-review.md). This is the only phase that changes behavior. Review catches what running can't — silent regressions, missed edge cases, leftover debug code, reuse or simplification — then you fix or flag each finding, and *the code is now frozen*. Size the review to the change: a quick check, not a second project. (Comments are **not** reviewed here — they get phase 3.)
2. **Run the final verification** — apply the Gate Function fresh to the now-frozen code and present *that* output as your evidence. Because all code changes happened in phase 1, this check covers exactly what the user gets.
3. **Review and clean the comments** — follow [`comment-review.md`](comment-review.md). This pass touches *only* comments, so it changes no behavior and needs **no re-verification**: delete narrative / step-by-step / ticket comments, keeping only true Explanation or exported-member Documentation, before the diff reaches a human.

**Copy this checklist into your task tracker the moment you start finishing, and tick each box in order.** The ordering *is* the discipline — and an untracked checklist is one whose middle steps get skipped under momentum:

```
- [ ] Phase 1 — reviewed the CODE against intent, ranked findings, fixed/flagged each (per code-review.md); code is now frozen
- [ ] Phase 2 — ran the final verification fresh on the frozen code, and presented that output as evidence
- [ ] Phase 3 — reviewed the COMMENTS (per comment-review.md): deleted narrative / step-by-step / ticket comments, kept only true Explanation or exported Documentation
- [ ] Surfaced integration options (merge / push+PR / leave as-is / discard) — did not merge or push on my own
```

The last box is its own gate; the section below is why it's never yours to skip.

---

## Don't Finish the Branch Unilaterally

Verified, reviewed work is still *your* checkpoint, not a decision to merge. Integrating, publishing, or discarding work is the user's call.

- **Never merge, push, open a PR, or delete a branch or worktree on your own initiative.** Surface the options and let the user choose.
- **Present the choices, don't pick one.** State that the work is verified and reviewed, then lay out what could happen next (merge, push/PR, leave as-is, discard) and ask which they want.
- **Never run a destructive or irreversible git action without explicit confirmation.** A discard that throws away work, a force action, anything you can't undo — name exactly what will be lost and wait for an unambiguous "yes" before doing it.

---

## Common Rationalizations

| Excuse | Reality |
|--------|---------|
| "I already manually tested it" | Manual testing is not reproducible verification. |
| "The change is too small to need verification" | Small changes break things all the time. |
| "I ran the tests earlier and they passed" | Earlier means a different codebase state. |
| "Tests pass — a prior turn, a teammate, or the user already said so" | An inherited claim is not evidence. The Gate Function requires fresh output *you* produced, this turn. |
| "It's obvious this is correct" | Obvious bugs are the most embarrassing. Reading code predicts behavior; only running it proves behavior. |
| "I'll verify after committing" | Verification after the claim is too late. |
| "The build should be fine" | "Should" is not evidence. |
| "Tests pass, so we're done here" | Verification is one phase of finishing, not the whole sequence — review and fix the code, verify the frozen result, then clean the comments. |
| "The user said ship it, so I'll just merge" | "Ship it" authorizes the user's choice, not a unilateral merge or push. |

---

## Red Flags — STOP and Verify

- "Should work now" / "probably fixed" / "seems correct" / "looks correct"
- Claiming completion before running verification
- Relying on partial or scoped test runs
- "The code was updated successfully" without execution evidence
- About to write "committed", "pushed", "shipped", or "deployed" — did you actually run that command this session? Asserting an action that never happened is fabrication, the worst failure in this skill's domain
- Echoing a "tests pass" you didn't produce with a fresh run
- Tests run, but no review pass over the diff
- About to merge, push, or discard without asking — or without a fresh test run first

All of these mean: STOP. Run the command, analyze the output, and present the evidence.
