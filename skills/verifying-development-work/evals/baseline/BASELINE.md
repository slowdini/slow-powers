# Baseline — verifying-development-work

Committed reference output from a canonical eval run. Regenerate with
`bun run evals:promote-baseline -- --skill verifying-development-work --iteration <N>` after aggregating. The ephemeral workspace (run records, timing,
dispatch files, produced outputs) stays gitignored under `skills-workspace/`.

| Field | Value |
|-------|-------|
| Mode | new-skill |
| Iteration | iteration-1 |
| Harness | claude-code |
| Agent model | claude-sonnet-4-6 |
| Judge model | claude-sonnet-4-6 |
| Conditions | with_skill, without_skill |
| Run timestamp | 2026-06-04T02:41:18.475Z |
| Label | (none) |
| Promoted from commit | 63629b4 |

Files:
- `benchmark.json` — aggregate pass-rate / duration / token deltas.
- `grading/<eval-id>__<condition>.json` — per-run assertion results and judge rationales.

