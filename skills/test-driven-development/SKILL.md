---
name: test-driven-development
description: Use when implementing any feature, refactoring, or writing a bugfix. Enforces the Red-Green-Refactor test-first cycle.
---

# Test-Driven Development (TDD)

Write the test first. Watch it fail. Write minimal code to pass. Refactor.

> **THE IRON LAW:** NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST.

Write production code before the test? Delete it. Start over. Do not keep it for "reference" or "adapt" it. Delete means delete.

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

## Red Flags - STOP and Reset

* Writing implementation code before writing the test.
* Writing the test after implementation "just to verify it works."
* A test passes immediately on the first run (means it isn't testing new behavior).
* Relying on manual ad-hoc testing instead of writing automated verification.
* Thinking "deleting this un-tested code is wasteful" (Sunk Cost Fallacy).

**If you hit a Red Flag: Delete the un-tested code. Start over with TDD.**
