---
name: writing-plans
description: Use when drafting or revising an implementation plan — e.g. in a harness plan mode, or when the user explicitly asks for a written plan before code is written
---

# Writing Concrete Plans

A plan is a concrete, atomic blueprint of verified actions — not a checklist of vague intentions.

This skill applies **once you're committed to writing a plan**. It does not push you into planning when the user wants direct action.

---

## When to Use

* You're in a harness plan mode (you've been told the user wants a plan before changes).
* The user explicitly asks for a plan, task breakdown, or design doc.
* You're updating an existing plan file (`implementation.md`, `implementation_plan.md`, `task.md`, or equivalent).

## When NOT to Use

* The user asked to "just build", "go fix", or "implement" something — trust the intent.
* You're investigating, reading code, or gathering context.
* The change is mechanical (typo, rename, single-line config tweak).
* The task is debugging — load `superslow:systematic-debugging` instead.

---

## Map File Structure First

Before decomposing into tasks, list the files that will be created or modified and what each is responsible for. Decomposition decisions get locked in here — fix them now, not mid-task.

* Each file should have one clear responsibility.
* Files that change together should live together.
* In existing codebases, follow established patterns. Don't unilaterally restructure.

---

## Core Pattern: Concrete, Atomic Tasks

### ❌ BAD (vague, placeholder-ridden, non-atomic)
```markdown
1. Write checkout logic (TBD)
2. Add some tests
3. Implement error handling later
```
*Why it fails:* defers design to coding time, uses placeholders, no verification.

### ✅ GOOD (concrete, atomic, TDD-ready)
```markdown
1. Create `checkout.test.ts` asserting `processCheckout()` throws on empty cart
2. Run test, verify failure with "function not defined"
3. Add empty-check in `checkout.ts` to pass the test
4. Create test asserting `processCheckout()` returns a transaction ID on success
5. Run test, verify failure with "transaction ID undefined"
6. Implement success path in `checkout.ts` to pass the test
```
*Why it works:* zero placeholders, each step is 2–5 minutes, Red-Green-Refactor is visible to the engineer reading the plan.

---

## Discipline Rules

1. **No Placeholders.** All tasks are fully concrete. No "TBD", "TODO", "implement error handling later", "details to follow". The engineer reads the plan, not your mind — decide the design now.
2. **Atomic Granularity.** Each task is 2–5 minutes of execution. Larger → decompose.
3. **Concrete, not prescriptive.** Each task names the file(s), the function or symbol involved, and the observable outcome — error message, return shape, command output. Include code snippets or example output only when prose can't carry the intent (e.g. an exact error format, a tricky regex, a non-obvious config value). Trust the implementer to write idiomatic code from a clear contract. Never back-reference ("similar to Task 3") — the engineer may read tasks out of order; restate the relevant detail.
4. **Reference TDD, Don't Duplicate It.** For features and bugfixes, structure each task list as Red-Green-Refactor. Don't restate TDD steps inline — point at the skill.
   * **REQUIRED SUB-SKILL:** Use `superslow:test-driven-development`

---

## Self-Review Before Approval

Before handing the plan off, scan your own draft:

* **Spec coverage:** Every requirement in the spec maps to at least one task. List any gaps and add tasks for them.
* **Placeholder scan:** Search the plan for "TBD", "TODO", "later", "if needed", "appropriate error handling", "handle edge cases", "etc."
* **Name consistency:** A function `clearLayers()` in Task 3 and `clearFullLayers()` in Task 7 is a bug, not a typo.

Fix any findings inline. No re-review pass — fix and move on.

---

## Red Flags — Stop and Rewrite

* The plan contains "TBD", "TODO", "later", "if needed", "appropriate", or "etc."
* A single task represents more than 10 minutes of execution.
* You did not explicitly checklist Red-Green-Refactor for code-writing tasks.
* You wrote "similar to Task N" instead of repeating the content.

If you hit a Red Flag: stop and rewrite. Approval comes from concreteness, not optimism.

---

## Common Rationalizations

| Excuse | Reality |
|--------|---------|
| "I'll decide the details while coding." | Decisions under coding pressure are worse. Decide now; write later. |
| "I don't need to specify tests — I'll write them anyway." | Omitting test steps makes them easy to skip when rushed. |
| "Repeating context across similar tasks is wasteful." | The engineer may read tasks out of order. Restate the relevant detail. |
