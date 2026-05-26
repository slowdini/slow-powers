---
name: verification-before-completion
description: Use before claiming any task is complete, fixed, or passing.
---

# Verification Before Completion

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

## Common Rationalizations

> **Note:** The rationalizations below are prospective — they represent likely excuses an agent might produce under pressure, but they have not yet been validated through actual eval runs. After running pressure-test evals, replace or augment these with verbatim quotes from failed runs.

| Excuse | Reality |
|--------|---------|
| "I already manually tested it" | Manual testing is not reproducible verification. |
| "The change is too small to need verification" | Small changes break things all the time. |
| "I ran the tests earlier and they passed" | Earlier means a different codebase state. |
| "It's obvious this is correct" | Obvious bugs are the most embarrassing. |
| "I'll verify after committing" | Verification after the claim is too late. |
| "The build should be fine" | "Should" is not evidence. |

---

## Red Flags — STOP and Verify

> **Note:** The red flags below are prospective — they represent likely warning signs, but they have not yet been validated through actual eval runs.

- "Should work now" / "probably fixed" / "seems correct"
- Claiming completion before running verification
- Relying on partial or scoped test runs
- "The code was updated successfully" without execution evidence

All of these mean: STOP. Run the command, analyze the output, and present the evidence.
