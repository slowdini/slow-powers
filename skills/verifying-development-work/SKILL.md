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
2. **ESTABLISH FRESH EVIDENCE:** Use fresh evidence you personally observed in the primary session, or run the command now. "Fresh" means the output proves the current code state: full relevant command, visible output, exit code known, and no behavior-changing edits since it ran.
3. **READ:** Review the full output, verify exit code is `0`, and check for warning logs.
4. **VERIFY:** Does the output confirm success?
   * **If NO:** Correct the code or tests. Repeat verification.
   * **If YES:** State your completion claim **and present the fresh verification output** as evidence to the user.

Current-session evidence can count. Do **not** rerun a passing check merely because this skill loaded after you already ran the right command and nothing behavior-changing happened afterward. Do rerun when the evidence is inherited, stale, incomplete, or separated from the returned code by later behavior changes.

---

## Core Verification Types

| Success Claim | What is Required | What is NOT Sufficient |
| :--- | :--- | :--- |
| **"Tests are passing"** | Current-session test output showing `0 failures` for the relevant suite. | "They should pass," someone else's paste, or a stale run. |
| **"Linter is clean"** | Current-session linter output showing `0 errors` and `0 warnings`. | Assumed clean because it compiled. |
| **"Build succeeds"** | Current-session compiler/build output exiting with code `0`. | Linter passing (compilation could still fail). |
| **"Bug is fixed"** | Consistently running the failing scenario showing it now succeeds. | The code change was made and "seems correct." |
| **"Requirements met"** | A checklist of the plan's requirements matched against code verification. | Tests pass, but product criteria were skipped. |

---

## When Existing Evidence Counts

Use already-produced evidence only when **all** of these are true:

- You ran or directly observed the command in the primary session.
- The output is visible enough to quote or summarize concretely.
- The command covers the success claim you are about to make.
- No behavior-changing edits happened after the command ran.

Evidence does **not** count when it came from the user, a teammate, a subagent, a prior session, a hidden/partial run, or a command that ran before later code changes. In those cases, run the appropriate command yourself before claiming success.

---

## Finishing: Review, Verify, Then Handoff

The Gate Function above is your discipline at *every* completion claim. When you believe the work itself is done, run these finishing phases **in order**. Review comes first so any fixes happen before the evidence you hand back; verification comes next so the claim covers the returned code; integration choices come last because they belong to the user.

1. **Review and fix the diff** — follow [`./code-review.md`](./code-review.md), including its comment-hygiene checks. Review catches what running can't: silent regressions, missed edge cases, leftover debug code, noisy comments, reuse or simplification. Fix or flag each finding. Once behavior-changing fixes are done, the code is frozen.
2. **Establish final verification evidence** — apply the Gate Function to the frozen code. If you already have qualifying current-session evidence and the review made no behavior-changing edits after it, reuse it and present that output. Otherwise run the command fresh and present that output.
3. **Surface integration options** — state that the work is reviewed and verified, then offer the user choices such as merge, push/open PR, leave as-is, or discard. Do not choose for them.

**Copy this checklist into your task tracker the moment you start finishing, and tick each box in order.** The ordering *is* the discipline — and an untracked checklist is one whose middle steps get skipped under momentum:

```
- [ ] Phase 1 — reviewed the diff against intent, including comments (per ./code-review.md), ranked findings, and fixed/flagged each; behavior is now frozen
- [ ] Phase 2 — established final verification evidence for the frozen code, reusing qualifying current-session output or running the command fresh, and presented that output as evidence
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
| "I ran the tests earlier and they passed" | Earlier counts only if you observed the full output in this session and no behavior-changing edits happened afterward. Otherwise rerun. |
| "The skill loaded after I verified, so I have to rerun everything" | Duplicate runs add heat, not light. Reuse qualifying current-session evidence when it still proves the claim. |
| "Tests pass — a teammate, subagent, or the user already said so" | An inherited claim is not evidence. The Gate Function requires primary-session output you observed yourself. |
| "It's obvious this is correct" | Obvious bugs are the most embarrassing. Reading code predicts behavior; only running it proves behavior. |
| "I'll verify after committing" | Verification after the claim is too late. |
| "The build should be fine" | "Should" is not evidence. |
| "Tests pass, so we're done here" | Verification is one phase of finishing, not the whole sequence — review the diff, verify the frozen result, then surface integration options. |
| "The user said ship it, so I'll just merge" | "Ship it" authorizes the user's choice, not a unilateral merge or push. |

---

## Red Flags — STOP and Verify

- "Should work now" / "probably fixed" / "seems correct" / "looks correct"
- Claiming completion before establishing verification evidence
- Relying on partial or scoped test runs that do not prove the claim
- "The code was updated successfully" without execution evidence
- About to write "committed", "pushed", "shipped", or "deployed" — did you actually run that command this session? Asserting an action that never happened is fabrication, the worst failure in this skill's domain
- Echoing a "tests pass" claim you did not directly observe in the primary session
- Tests run, but no review pass over the diff
- About to rerun an already-qualifying check just to satisfy ceremony
- About to merge, push, or discard without asking — or without qualifying verification evidence first

All of these mean: STOP. Establish qualifying evidence, read it, and present it before claiming success.
