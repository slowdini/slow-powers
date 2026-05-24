---
name: systematic-debugging
description: Use when encountering any bug, test failure, build error, or unexpected behavior. Enforces finding the root cause before attempting any fixes.
---

# Systematic Debugging

Avoid "guess-and-check" coding. Always identify the root cause before making changes.

> **THE IRON LAW:** NO FIXES WITHOUT ROOT CAUSE INVESTIGATION FIRST.

---

## Phase 1: Root Cause Investigation

Before changing any code:
1. **Read Error Messages and Stack Traces:** Read every line of the error. Note the exact file, line number, and error codes.
2. **Reproduce Consistently:** Identify the exact steps, inputs, or environment needed to trigger the bug. If it cannot be reproduced, gather more logs instead of guessing.
3. **Check Recent Changes:** Run a git diff. Analyze recent commits, dependency additions, or config changes.
4. **Gather Evidence (Multi-Component Systems):**
   * Log inputs and outputs at every component boundary.
   * Instrument the layers step-by-step (e.g., Workflow -> Build Script -> Runtime -> DB) to pinpoint exactly where the state breaks.
5. **Trace Data Flow:** Trace variables backward from the failure point to their source. Fix the bug at the source, not the symptom.

---

## Phase 2: Pattern Analysis

1. **Find Working Examples:** Search the codebase for similar logic that functions correctly.
2. **Compare Implementations:** Identify every difference between the working version and the failing version. Do not assume "that difference doesn't matter."
3. **Verify Dependencies & Configs:** Ensure all required modules, configurations, and environment variables are present and correctly configured.

---

## Phase 3: Hypothesis and Testing

1. **Formulate a Single Hypothesis:** Write down a clear statement: *"I think X is the root cause because Y."*
2. **Test Minimally:** Make the smallest possible change to verify the hypothesis (e.g., add a log, change one value).
3. **Verify & Re-evaluate:** Did the test prove your hypothesis?
   * **Yes:** Proceed to Phase 4.
   * **No:** Revert the test change completely and formulate a *new* hypothesis. Never stack guess-on-guess.

---

## Phase 4: Implementation & Verification

1. **Write a Failing Test Case:** Create an automated test or simple script that consistently triggers the bug. Verify it fails.
2. **Implement the Fix:** Make a single, targeted change that directly addresses the root cause. Do not bundle unrelated refactoring.
3. **Verify the Fix:** Run the test suite. Ensure the new test passes and no regressions are introduced.
4. **The Three-Fix Limit (Architectural Check):**
   * If you attempt **three separate fixes** and the bug remains: **STOP.**
   * This is a strong signal that the issue is architectural (e.g., wrong model assumptions, coupled state, race conditions).
   * Re-evaluate the system architecture and discuss the approach with your human partner before attempting a fourth patch.

---

## Red Flags - STOP and Reset

* Attempting to write a fix before reproducing the bug or reading the full stack trace.
* Thinking "let's just try changing X to see if it works."
* Stacking multiple speculative fixes on top of each other.
* Claiming a bug is fixed without running the verification test suite.
* Each "fix" you implement only shifts the bug to a new location.
