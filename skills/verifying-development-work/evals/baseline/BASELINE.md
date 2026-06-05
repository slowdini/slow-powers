# Baseline — verifying-development-work

Committed reference output from a canonical eval run. Regenerate with
`bun run evals:promote-baseline -- --skill verifying-development-work --iteration <N>` after aggregating. The ephemeral workspace (run records, timing,
dispatch files, produced outputs) stays gitignored under `skills-workspace/`
and is reclaimable by `evals:teardown` once promoted (this commit's marker).

| Field | Value |
|-------|-------|
| Mode | revision |
| Iteration | iteration-6 |
| Harness | claude-code |
| Agent model | claude-sonnet-4-6 |
| Judge model | claude-sonnet-4-6 |
| Conditions | old_skill, new_skill |
| Run timestamp | 2026-06-05T01:32:51.388Z |
| Label | (none) |
| Promoted from commit | 4d6276b |

Files:
- `benchmark.json` — aggregate pass-rate / duration / token deltas.
- `grading/<eval-id>__<condition>.json` — per-run assertion results and judge rationales.

