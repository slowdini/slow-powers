# Baseline notes — working-in-isolation

Forward-looking observations from the canonical run (`new-skill`, iteration-3,
`claude-sonnet-4-6` agent + judge). Provenance is in `BASELINE.md`; headline
numbers are in `benchmark.json`. This file is the "what a future iterator should
know" companion.

## Headline

`with_skill` 0.80 vs `without_skill` 0.20 → **+0.60 pass-rate delta**, skill
invocation **100% (5/5)**, **0 validity warnings**. Cost: +8.2s, +1.2k tokens.

## Which cases discriminated

| Case | with | without | Notes |
|------|------|---------|-------|
| `base-branch-checkout` | 100% | 0% | The most important check (never edit on `main`). Clean +100%. |
| `dirty-tree-worktree` | 100% | 0% | +100% **this run**. The `without` arm did *not* isolate here — see variance note. |
| `seeded-on-main-momentum` | 100% | 0% | +100%. Both seeded assertions passed (stops editing on `main` AND names the base-branch hard rule). |
| `feature-branch-in-place` | 100% | 100% | Non-discriminating — the "work in place" case is easy enough that baseline gets it too. Candidate for a harder variant. |
| `typo-no-worktree` | 0% | 0% | Non-discriminating + environment-confounded — see below. |

## Caveats a re-runner must know

- **`typo-no-worktree` is confounded by the real repo's branch state.** The
  prompt says "On my working branch `docs-cleanup`", but the eval runs in the
  actual slow-powers repo, which has no `docs-cleanup` branch and is on a
  different branch. Agents that introspect real git state (both arms) discover
  the branch is missing and propose creating it — graded as "isolation
  ceremony" → both FAIL, delta 0. This is **symmetric** (hurts both arms
  equally), so it doesn't bias the delta, but it means the case currently
  measures nothing. To make it discriminating, either (a) state the full git
  context in the prompt the way `base-branch-checkout` does ("you are on
  `docs-cleanup`, clean tree"), or (b) give each subagent an isolated throwaway
  repo whose real state matches the prompt.

- **Iteration-2 vs iteration-3 — why the delta jumped (+0.30 → +0.60).**
  Iteration-2 dispatched all 10 subagents *in parallel against this one shared,
  dirty repo*. Per the skill's own Rule 2 ("dirty tree **or** worktrees already
  exist → worktree"), agents that ran real `git status`/`git worktree list` saw
  (a) the repo's then-uncommitted #156 changes and (b) worktrees other parallel
  siblings had just created, and so isolated when the case wanted work-in-place
  — contaminating `typo` and depressing the measured delta. Iteration-3 fixed
  this by **committing the tree clean first** and **dispatching sequentially
  with `.worktrees/` cleanup between each dispatch**, so no agent sees another's
  git state. Lesson for any git-state-dependent skill: do **not** run its eval
  subagents concurrently in one shared repo.

- **The write guard does not block worktree creation.** `runner/sandbox-policy.ts`
  `BASH_MUTATION_PATTERNS` matches `git (commit|add|push|checkout|reset|restore|merge|rebase)`
  — **not** `git worktree`. So `--guard` lets subagents `git worktree add` real
  worktrees into the repo; `detect-stray-writes` only flags them post-hoc. We
  cleaned them by hand both runs. Conveniently this also means the orchestrator's
  own `git worktree remove` between-dispatch cleanup is allowed under the armed
  guard. If we want the guard to actually sandbox this skill's behavior, add
  `worktree` to the mutation pattern (track as an eval-harness parity item).

## Variance / next-iteration ideas

- `without_skill` on `dirty-tree-worktree` is **unstable**: iteration-2 it
  isolated (PASS), iteration-3 it didn't (FAIL). The explicit "don't disturb my
  in-progress changes" phrasing sometimes elicits isolation even with no skill.
  Add runs (n>1 per condition) before trusting that case's delta.
- `feature-branch-in-place` passes in both arms — replace or harden it (e.g.
  add a competing attractor) so it earns its slot.
- Consider a second seeded case where the cleaner correction is a **worktree**
  rather than `switch -c`, to cover the other branch of the hard rule.
