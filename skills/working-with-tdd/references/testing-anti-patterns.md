# Testing anti-patterns

**Load this reference when:** a test you're writing or changing matches one of the anti-patterns below — the `working-with-tdd` skill's "Testing anti-patterns" table points here — or any time you're adding mocks or other test scaffolding. Each anti-pattern carries a **gate**: check it before you commit the test.

## Overview

This is a catalog of recurring testing anti-patterns — the ways a test stops verifying real behavior, or quietly couples itself to test scaffolding instead of the code under test. Mocks are the most common source (anti-patterns 1, 3, 4, and 6 all involve them), but not the only one: test-only methods leak into production (2), and tests get added after the implementation (5).

**Core principle:** Test what the code does, not what your test scaffolding does. If a test passes because of how a mock, fixture, or helper is set up — rather than what the code under test actually does — it's verifying the wrong thing.

## The Iron Laws

```
1. Test real behavior, NEVER test scaffolding (mocks, fixtures, helpers)
2. NEVER add test-only methods to production classes
3. NEVER mock without understanding dependencies
```

## Anti-pattern 1: testing mock behavior

**The violation:**
```typescript
// ❌ BAD: Testing that the mock exists
test('renders sidebar', () => {
  render(<Page />);
  expect(screen.getByTestId('sidebar-mock')).toBeInTheDocument();
});
```

**Why this is wrong:** You're verifying the mock works, not the component. The test passes when the mock is present and fails when it's not — it tells you nothing about real behavior.

**The fix:**
```typescript
// ✅ GOOD: Test real component or don't mock it
test('renders sidebar', () => {
  render(<Page />);  // Don't mock sidebar
  expect(screen.getByRole('navigation')).toBeInTheDocument();
});

// OR if sidebar must be mocked for isolation:
// Don't assert on the mock - test Page's behavior with sidebar present
```

**Gate:** Before asserting on any mock element, ask "Am I testing real component behavior or just mock existence?" If the latter, delete the assertion or unmock the component.

## Anti-pattern 2: test-only methods in production

**The violation:**
```typescript
// ❌ BAD: destroy() only used in tests
class Session {
  async destroy() {  // Looks like production API!
    await this._workspaceManager?.destroyWorkspace(this.id);
    // ... cleanup
  }
}

// In tests
afterEach(() => session.destroy());
```

**Why this is wrong:** Production classes get polluted with test-only code that's dangerous if called for real. It violates YAGNI and separation of concerns, and confuses object lifecycle with entity lifecycle.

**The fix:**
```typescript
// ✅ GOOD: Test utilities handle test cleanup
// Session has no destroy() - it's stateless in production

// In test-utils/
export async function cleanupSession(session: Session) {
  const workspace = session.getWorkspaceInfo();
  if (workspace) {
    await workspaceManager.destroyWorkspace(workspace.id);
  }
}

// In tests
afterEach(() => cleanupSession(session));
```

**Gate:** Before adding any method to a production class, ask "Is this only used by tests?" — if so, put it in test utilities instead. Then ask "Does this class own this resource's lifecycle?" — if not, it's the wrong class for the method.

## Anti-pattern 3: mocking without understanding

**The violation:**
```typescript
// ❌ BAD: Mock breaks test logic
test('detects duplicate server', () => {
  // Mock prevents config write that test depends on!
  vi.mock('ToolCatalog', () => ({
    discoverAndCacheTools: vi.fn().mockResolvedValue(undefined)
  }));

  await addServer(config);
  await addServer(config);  // Should throw - but won't!
});
```

**Why this is wrong:** The mocked method had a side effect (writing config) the test depended on. Over-mocking "to be safe" breaks the actual behavior, so the test passes for the wrong reason or fails mysteriously.

**The fix:**
```typescript
// ✅ GOOD: Mock at correct level
test('detects duplicate server', () => {
  // Mock the slow part, preserve behavior test needs
  vi.mock('MCPServerManager'); // Just mock slow server startup

  await addServer(config);  // Config written
  await addServer(config);  // Duplicate detected ✓
});
```

**Gate:** Before mocking, ask what side effects the real method has and whether the test depends on any of them. If it does, mock at a lower level (the actual slow/external operation), not the high-level method the test relies on. If you're unsure what the test needs, run it against the real implementation first, observe what has to happen, then add minimal mocking at the right level.

## Anti-pattern 4: incomplete mocks

**The violation:**
```typescript
// ❌ BAD: Partial mock — only fields you think you need
const mockResponse = {
  status: 'success',
  data: { userId: '123', name: 'Alice' }
  // Missing: metadata that downstream code uses
};

// Later: breaks when code accesses response.metadata.requestId
```

**Why this is wrong:** Partial mocks hide structural assumptions — you only mock the fields you know about, so downstream code that depends on omitted fields fails silently. The test passes while integration breaks, giving false confidence.

**The Iron Rule:** Mock the COMPLETE data structure as it exists in reality, not just the fields your immediate test uses.

**The fix:**
```typescript
// ✅ GOOD: Mirror real API completeness
const mockResponse = {
  status: 'success',
  data: { userId: '123', name: 'Alice' },
  metadata: { requestId: 'req-789', timestamp: 1234567890 }
  // All fields real API returns
};
```

**Gate:** Before creating a mock response, check what fields the real API returns (docs/examples) and include all of them — if you're mocking it, you must understand the entire structure. When uncertain, include all documented fields.

## Anti-pattern 5: tests as afterthought

```
✅ Implementation complete
❌ No tests written
"Ready for testing"
```

Testing is part of implementation, not an optional follow-up — you can't claim complete without tests, and TDD would have caught this. Write the failing test first; see the [TDD cycle](../SKILL.md).

## Anti-pattern 6: order-dependent mocks and assertions

**The violation:**
```typescript
// ❌ BAD: a queue of return values keyed on call order
fetchUser
  .mockResolvedValueOnce(firstResult)
  .mockResolvedValueOnce(secondResult);

await renderComponent(); // may refetch, retry, or re-render — call count isn't fixed

// ...and an assertion that reads a specific call:
const lastCall = fetchUser.mock.calls.at(-1);
expect(lastCall[1]).toMatchObject({ page: 2 });
```

**Why this is wrong:** The code under test doesn't *guarantee* it calls the dependency exactly twice, in this order — retries, cache refetches/revalidation, re-renders, and effects firing on mount can add or reorder calls. When an extra call appears, the `Once` queue runs dry and the next real call gets the mock's default — usually `undefined` — which cascades into an error or empty state that looks like a product bug. Reading "the last call" or "call N" assumes that call is the one you care about, but an unmodeled refetch makes the assertion read the wrong one. The result is a test that passes or fails on timing — flaky. The same failure mode appears in any framework: Sinon `onCall(n)`, a Python `side_effect=[...]` list, consecutive Mockito `thenReturn(a, b)`.

**The fix:**
```typescript
// ✅ GOOD: stub by INPUT, never fall through to undefined
fetchUser.mockImplementation((_id, params) =>
  params?.page === 2 ? secondResult : firstResult
);

// ✅ GOOD: assert a matching call HAPPENED, not a fixed index
expect(fetchUser).toHaveBeenCalledWith(
  expect.anything(),
  expect.objectContaining({ page: 2 })
);
```

**Gate:** Before using a `...Once` queue, a per-call-index stub, or a "last call / call N" assertion, ask "Can the code under test call this a different number of times, or in a different order, than I expect?" (retries? cache refetch/revalidation? re-render? effect on mount? parallelism?) If yes — or you're unsure — stub by input: return the right value for any matching call and a sensible default for the rest, never letting the stub return `undefined` for a value the code consumes; and assert by matching (`toHaveBeenCalledWith` / `objectContaining`), not by index. Also reduce non-determinism at the source: in tests, disable retries and background revalidation, and control timers, so the call count is predictable.

When this failure mode surfaces as a flaky CI failure, use the `slow-powers:investigating-bugs` [flaky-test diagnostic](../../investigating-bugs/references/diagnosing-flaky-tests.md).

## When mocks become too complex

**Warning signs:** mock setup longer than the test logic, mocking everything to make the test pass, mocks missing methods the real components have, or tests that break when the mock changes.

**Consider:** integration tests with real components are often simpler than complex mocks.

## TDD prevents these anti-patterns

Writing the test first forces you to think about what you're actually testing; watching it fail confirms it tests real behavior, not mocks; a minimal implementation keeps test-only methods out of production; and using real dependencies shows you what the test actually needs before you mock. If you're testing mock behavior, you added mocks without watching the test fail against real code first — you violated TDD.

## Red flags

- Assertion checks for `*-mock` test IDs
- Methods only called in test files
- Mock setup is >50% of test
- Test fails when you remove mock
- Can't explain why mock is needed
- Mocking "just to be safe" or before understanding the dependency chain
- `mockReturnValueOnce`/`mockResolvedValueOnce` chains against code that can retry, refetch, or re-render
- Asserting on "the last call" or a fixed call index
- A mocked data function that can return `undefined` when its queue runs dry
