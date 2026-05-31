# Baseline — hardening-plans

Committed reference output from a canonical eval run. Regenerate with
`bun run evals:promote-baseline -- --skill hardening-plans --iteration <N>` after aggregating. The ephemeral workspace (run records, timing,
dispatch files, produced outputs) stays gitignored under `skills-workspace/`.

| Field | Value |
|-------|-------|
| Mode | revision |
| Iteration | iteration-1 |
| Harness | claude-code |
| Agent model | claude-sonnet-4-6 |
| Judge model | claude-sonnet-4-6 |
| Conditions | old_skill, new_skill |
| Run timestamp | 2026-05-31T18:40:23.484Z |
| Label | 3b-fresh-eyes-review |
| Promoted from commit | bbca8ca |

Files:
- `benchmark.json` — aggregate pass-rate / duration / token deltas.
- `grading/<eval-id>__<condition>.json` — per-run assertion results and judge rationales.

