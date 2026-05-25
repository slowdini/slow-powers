---
name: writing-plans
description: Use when in planning mode, or preparing to write or update an implementation plan
---

# Writing Concrete Plans

A plan is not a checklist of vague steps; it is a concrete, atomic blueprint of verified actions. 

> **THE IRON LAW:** NO CODE CHURN WITHOUT AN APPROVED, PLACEHOLDER-FREE PLAN.

---

## When to Use
* Immediately upon entering planning mode.
* When asked to draft or update an `implementation_plan.md` or `task.md` file.
* Before implementing any feature, bugfix, or structural refactoring.

## When NOT to Use
* When performing purely investigatory research (e.g., searching codebase or reading logs).
* For trivially simple, mechanical actions (e.g., fixing a single typo or updating a git ignore file).

---

## Core Pattern: Side-by-Side Planning

### ❌ BAD (Vague, placeholder-ridden, non-atomic)
```markdown
1. Write checkout logic (TBD)
2. Add some tests
3. Implement error handling later
```
*Why it fails:* It defers critical design decisions to the coding phase, uses placeholders, and lacks specific verification steps.

### ✅ GOOD (Concrete, atomic, TDD-ready)
```markdown
1. Create `checkout.test.ts` to assert that `processCheckout()` throws an error when cart is empty
2. Run test to verify it fails with expected error
3. Add empty-check in `checkout.ts` to pass the test
4. Create test asserting checkout returns transaction ID on success
5. Run test to verify it fails
6. Implement checkout success logic in `checkout.ts` to pass the test
```
*Why it succeeds:* Zero placeholders. Tasks are highly granular (2-5 minutes) and explicitly structured to leverage the `test-driven-development` skill.

---

## Discipline Rules

1. **Strictly No Placeholders:** All tasks must be fully concrete. You are strictly FORBIDDEN from using "TBD", "TODO", "implement error handling later", or "details to follow." Decouple decision-making from coding by resolving designs now.
2. **Atomic Task Granularity:** Break down your tasks into highly granular actions that take 2-to-5 minutes to execute. If a task is larger, decompose it.
3. **Reference the TDD Skill:** Do not duplicate full TDD instructions. Instead, explicitly direct the implementation agent to follow and load the TDD skill for every coding task.
   * **REQUIRED SUB-SKILL:** Use `superslow:test-driven-development`

---

## Red Flags — STOP and Reset
* Your plan contains "TBD", "TODO", "later", or "if needed".
* A single task represents more than 10 minutes of execution time.
* You do not explicitly checklist the Red-Green-Refactor steps in your tasks.
* You think "this change is too trivial to plan."

**If you hit a Red Flag: Stop. Rewrite your plan until it is concrete and atomic before requesting approval.**

---

## Common Rationalizations

| Excuse | Reality |
|--------|---------|
| "The bug is simple, a plan is overkill." | "Simple" fixes frequently cause regressions. A concrete plan exposes assumptions. |
| "I'll decide the implementation details while coding." | Coding under pressure leads to poor design. Decide the design now; write it later. |
| "I don't need to specify tests, I'll write them anyway." | Omitting test steps from your task list makes it easy to skip them when tired or rushed. |
