# Diagnosing flaky tests

## Overview

A flaky test passes sometimes and fails other times on unchanged code. The failure is almost
always **non-determinism** — the test, or the code under it, does something whose order, count,
or timing isn't fixed — not "CI being weird." Treat it as a real defect in the test's contract
with the code, and find the mechanism before changing anything.

**Core principle:** A test may only assume what the code under test actually guarantees.
Flakiness is the gap between the two.

## Diagnostic method

Work these in order, before proposing a fix:

1. **Classify: infra vs. test-code vs. product.** Run the test several ways: (a) locally in
   isolation, repeated 10–50×; (b) under CPU/IO load (saturate cores); (c) via the *exact* CI
   command — coverage instrumentation and parallel workers change timing and are often what tips
   a latent race over the edge; (d) in varied order and in-suite — run the whole file/suite,
   shuffle the seed, run it after its neighbors, not just alone. A test that is deterministic in
   isolation but flips with **execution context** (order, neighbor-test state, in-suite vs. alone)
   is flaky on state leaked across tests, not on rerun-to-rerun chance — so "I reran it and it
   passed" clears nothing; vary order and context. Passes in isolation but fails under load, in a
   particular order, or only in CI ⇒ non-determinism in the test or product, **not** infra.
2. **Read the failure's literal signature before theorizing.** The error usually names the
   mechanism:
   * A value that "can never be undefined/null" *is* → a stub ran out of queued values, or an
     unmodeled extra call hit a default. See "Non-deterministic call count/order" below.
   * An assertion sees a *stale* or *reset* value → a later state update, refetch, or re-render
     landed between act and assert.
   * Intermittent "X is not a function" / "called 0 times" → an ordering or setup race in
     fixtures/mocks.
3. **Check history for prior "flaky" patches.** A commit like `fix: flaky test X` on the *same*
   test is a red flag, not reassurance — it papered over the symptom and the real non-determinism
   is still live. Read what it changed; it points at the mechanism.
4. **Reproduce the non-determinism deterministically — don't rerun-until-green.** Identify the
   non-deterministic source (a timer, debounce, cache refetch/revalidation, retry, background
   work, parallel worker, unordered collection), then *force* it: control the clock / fake timers,
   await the real condition, or drive the extra call on purpose, so the failure reproduces 100% on
   demand. Proving the fix means first proving you can make it fail at will.

> A rerun that turns green tells you nothing about root cause. You have not found the cause until
> you can make the test fail on demand.

## Cause catalog

| Cause class | How to recognize it | Where the fix lives |
|---|---|---|
| Timing guesses (arbitrary `sleep`/`setTimeout`) | Passes fast, fails under load/CI; fixed-delay waits in the test | [Condition-based waiting](./condition-based-waiting.md) |
| Non-deterministic call count/order vs. order-dependent stubs/assertions | A mocked function returns `undefined`/its default mid-test; an assertion reads "the last call" / "call N" and gets the wrong one | "Non-deterministic call count/order" (below) + the `slow-powers:working-with-tdd` skill's [testing anti-patterns reference](../../working-with-tdd/references/testing-anti-patterns.md) → *Order-dependent mocks and assertions* |
| Cross-test state pollution | Passes alone, fails in-suite or under a particular order — depends on a neighbor test's leftover state | Reset or isolate shared state per test (mocks, module/global singletons, DB, fake timers); make setup and teardown order-independent |

### Non-deterministic call count / order

**Mechanism:** The code under test calls a dependency a number of times, or in an order, that
isn't fixed — retries, cache refetches/revalidation, re-renders, a debounced effect firing on
mount, parallel work. The test stubs that dependency with an **order-dependent queue**
(`mockResolvedValueOnce(a).mockResolvedValueOnce(b)`; Sinon `onCall(n)`; a Python
`side_effect=[...]` list; consecutive Mockito `thenReturn`) and/or asserts against a **fixed call
index** ("the last call had these params"). When an extra or reordered call appears, the queue
runs dry — the next real call gets the library default (often `undefined`), which cascades into an
error/empty state — or the indexed assertion reads the wrong call. Both depend on timing → flaky.

**Recognize it by:** an "impossible" `undefined`/null from a mocked function in the failure log;
or an assertion that received a plausible-but-wrong value (the value from a *different* call than
the one intended).

**Prevention:** the `slow-powers:working-with-tdd` skill's [testing anti-patterns reference](../../working-with-tdd/references/testing-anti-patterns.md) → *Order-dependent mocks and assertions*. In short: stub by **input** (return the right value for any matching call, a sensible default otherwise, never fall through to `undefined`), and assert a matching call **happened** rather than reading a fixed index.
