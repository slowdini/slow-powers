---
name: working-with-tdd
description: Use when implementing any feature, refactoring, or writing a bugfix.
---

# Test-driven development (TDD)

Write the test first. Watch it fail. Write minimal code to pass. Refactor.

> **THE IRON LAW:** NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST.

Write production code before the test? Delete it. Start over. Do not keep it for "reference" or "adapt" it. Delete means delete.

> **Violating the letter of the rules is violating the spirit of the rules.**

> **REQUIRED PREREQUISITE:** You must have already completed `slow-powers:working-in-isolation` — establish an isolated workspace before writing any test or production code.

> **REQUIRED NEXT SKILL:** You must complete `slow-powers:verifying-development-work` next, after the TDD implementation work is done and before claiming the task is complete or handing work back to the user.

---

## Red-green-refactor cycle

1. **RED — Write a failing test:**
   * Write one minimal, focused test showing what the behavior *should* do.
   * Use real code and real inputs; avoid mocks unless absolutely unavoidable.
     Before committing a test, scan it against the **Testing anti-patterns**
     table below; if it matches a row, read the named section of the
     [testing anti-patterns reference](references/testing-anti-patterns.md) first.
2. **Verify RED — Watch it fail:**
   * Run the test command: `npm test` / `pytest` / `go test`.
   * **MANDATORY:** Verify it fails for the expected reason (for example, a function is undefined or a value is incorrect), not because of a typo or build error.
3. **GREEN — Write minimal code:**
   * Write the simplest possible implementation to make the test pass.
   * Avoid over-engineering or speculative optimization.
4. **Verify GREEN — Watch it pass:**
   * Run the test suite. Verify the test passes, and no regressions are introduced.
5. **REFACTOR — Clean up:**
   * Clean up names, remove duplication, and extract helper methods.
   * Keep the test suite green. Do not add new behavior during refactoring.

---

## Example: code vs. mock testing

### Good (focuses on real behavior)
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

### Bad (focuses on mock implementation detail)
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

## Testing anti-patterns — scan before you commit a test

While writing or changing a test, check it against this table. If a row matches, read the named section of the [testing anti-patterns reference](references/testing-anti-patterns.md) before moving on — mocks are the most common source of these, but not the only one.

| If your test… | Anti-pattern | Section to read |
|---|---|---|
| asserts on a mock / `*-mock` element instead of real output | testing mock behavior | *Testing mock behavior* |
| needs a method on a production class that only tests call | test-only methods in production | *Test-only methods in production* |
| mocks a method without knowing its side effects | mocking without understanding | *Mocking without understanding* |
| uses a mock with only the fields you happen to need | incomplete mocks | *Incomplete mocks* |
| is written after the implementation, with no failing test first | tests as afterthought | *Tests as afterthought* |
| stubs by call order (`...Once` chains) or asserts "call N" / "the last call" | order-dependent mocks/assertions | *Order-dependent mocks and assertions* |
| has more mock setup than test logic | over-complex mocks | *When mocks become too complex* |

---

## Common rationalizations

| Excuse | Reality |
|--------|---------|
| "This is too simple to test" | Simple code breaks. Test takes 30 seconds. |
| "I'll test after to verify it works" | Tests passing immediately prove nothing. |
| "I already know what the code should look like" | Knowing the answer doesn't mean the requirement is specified. |
| "Testing this would be trivial" | Trivial tests are cheap; skipping them costs later. |
| "I'll add tests later, I promise" | Later never comes. The codebase drifts. |
| "The spirit of TDD is what matters, not the letter" | **Violating the letter is violating the spirit.** |

---

## Red flags — STOP and start over

- Code before test
- "I already manually tested it"
- "Tests after achieve the same purpose"
- "It's about spirit not ritual"
- "This is different because..."

All of these mean: delete code. Start over with TDD.
