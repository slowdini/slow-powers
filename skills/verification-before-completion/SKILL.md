---
name: verification-before-completion
description: Use before claiming any task is complete, fixed, or passing. Enforces running actual verification commands and reporting the output.
---

# Verification Before Completion

Claiming work is complete without verification is an assumption, not a fact. Always verify before presenting success.

> **THE IRON LAW:** NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE.

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

## Red Flags - STOP and Verify

* Using speculative language like *"should work now"*, *"probably fixed"*, or *"seems correct."*
* Stating a task is complete before running the test or build commands.
* Relying on partial or scoped test runs instead of verifying the full suite.
* Claiming success because "the code was updated successfully" without verifying execution.

**If you catch yourself making a claim without running the verification command: STOP. Run the command, analyze the output, and present the evidence.**
