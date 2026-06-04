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

## Finishing: Review First, Then Verify

The Gate Function above is your discipline at *every* completion claim. When you believe the work itself is done, run this finishing sequence in order — review **before** the final verification, so the evidence you hand back covers the exact code being returned:

1. **Review the diff.** Run a review pass over the change following [`code-review.md`](code-review.md). Verification proves the work *runs*; review catches what running can't — silent regressions, missed edge cases, leftover debug code, reuse or simplification, and narrative comments that shouldn't reach a human reader. Size the review to the change: a quick check, not a second project.
2. **Address what it surfaces.** Fix or explicitly flag each finding. Any fix changes the code.
3. **Run the final verification last, on the result.** Now apply the Gate Function fresh to the post-review code and present *that* output as your evidence. Running verification before review would prove a version of the code you then changed — the check the user sees must be the check on the code the user gets.

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
| "Tests pass, so we're done here" | Verification is one step of finishing, not the whole sequence. Review the diff, then run the final check on the reviewed code. |
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
