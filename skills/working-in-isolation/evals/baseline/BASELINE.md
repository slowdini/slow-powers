# Baseline — working-in-isolation

Committed reference output from a canonical eval run. Regenerate with
`bun run evals:promote-baseline -- --skill working-in-isolation --iteration <N>` after aggregating. The ephemeral workspace (run records, timing,
dispatch files, produced outputs) stays gitignored under `skills-workspace/`.

| Field | Value |
|-------|-------|
| Mode | new-skill |
| Iteration | iteration-3 |
| Harness | claude-code |
| Agent model | claude-sonnet-4-6 |
| Judge model | claude-sonnet-4-6 |
| Conditions | with_skill, without_skill |
| Run timestamp | 2026-06-03T07:33:13.084Z |
| Label | (none) |
| Promoted from commit | e428b0e |

Files:
- `benchmark.json` — aggregate pass-rate / duration / token deltas.
- `grading/<eval-id>__<condition>.json` — per-run assertion results and judge rationales.

