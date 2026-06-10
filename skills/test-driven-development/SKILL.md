---
name: test-driven-development
description: Use when implementing any feature, refactoring, or writing a bugfix.
---

# Test-Driven Development (TDD)

Write the test first. Watch it fail. Write minimal code to pass. Refactor.

> **THE IRON LAW:** NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST.

Write production code before the test? Delete it. Start over. Do not keep it for "reference" or "adapt" it. Delete means delete.

> **Violating the letter of the rules is violating the spirit of the rules.**

> **REQUIRED PREREQUISITE:** You must have already completed `slow-powers:working-in-isolation` — establish an isolated workspace before writing any test or production code.

> **REQUIRED NEXT SKILL:** You must complete `slow-powers:verifying-development-work` next, after the TDD implementation work is done and before claiming the task is complete or handing work back to the user.

---

## Red-Green-Refactor Cycle

1. **RED — Write a Failing Test:**
   * Write one minimal, focused test showing what the behavior *should* do.
   * Use real code and real inputs; avoid mocks unless absolutely unavoidable.
2. **Verify RED — Watch It Fail:**
   * Run the test command: `npm test` / `pytest` / `go test`.
   * **MANDATORY:** Verify it fails for the expected reason (e.g., function not defined, value incorrect), not due to a typo or build error.
3. **GREEN — Write Minimal Code:**
   * Write the simplest possible implementation to make the test pass.
   * Avoid over-engineering or speculative optimization (YAGNI).
4. **Verify GREEN — Watch It Pass:**
   * Run the test suite. Verify the test passes, and no regressions are introduced.
5. **REFACTOR — Clean Up:**
   * Clean up names, remove duplication, and extract helper methods.
   * Keep the test suite green. Do not add new behavior during refactoring.

---

## Example: Code vs. Mock Testing

### Good (Focuses on real behavior):
```typescript
test('retries failed operations 3 times', async () => {
  let attempts = 0;
  const operation = async () => {
    attempts++;
    if (attempts < 3) throw new Error('fail');
    return 'success';
  };
  const result = await retryOperation(operation);
  expect(result).toBe('success');
  expect(attempts).toBe(3);
});
```

### Bad (Focuses on mock implementation detail):
```typescript
test('retry works', async () => {
  const mock = jest.fn()
    .mockRejectedValueOnce(new Error())
    .mockRejectedValueOnce(new Error())
    .mockResolvedValueOnce('success');
  await retryOperation(mock);
  expect(mock).toHaveBeenCalledTimes(3);
});
```

---

## Common Rationalizations

> **Note:** The rationalizations below are prospective — they represent likely excuses an agent might produce under pressure, but they have not yet been validated through actual eval runs. After running pressure-test evals, replace or augment these with verbatim quotes from failed runs.

| Excuse | Reality |
|--------|---------|
| "This is too simple to test" | Simple code breaks. Test takes 30 seconds. |
| "I'll test after to verify it works" | Tests passing immediately prove nothing. |
| "I already know what the code should look like" | Knowing the answer doesn't mean the requirement is specified. |
| "Testing this would be trivial" | Trivial tests are cheap; skipping them costs later. |
| "I'll add tests later, I promise" | Later never comes. The codebase drifts. |
| "The spirit of TDD is what matters, not the letter" | **Violating the letter is violating the spirit.** |

---

## Red Flags — STOP and start over

> **Note:** The red flags below are prospective — they represent likely warning signs, but they have not yet been validated through actual eval runs.

- Code before test
- "I already manually tested it"
- "Tests after achieve the same purpose"
- "It's about spirit not ritual"
- "This is different because..."

All of these mean: delete code. Start over with TDD.
