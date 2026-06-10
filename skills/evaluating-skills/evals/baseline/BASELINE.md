# Baseline — evaluating-skills

Committed reference output from a canonical eval run. Regenerate with
`eval-magic promote-baseline --skill evaluating-skills --iteration <N>` after aggregating. The ephemeral workspace (run records, timing,
dispatch files, produced outputs) stays gitignored under `skills-workspace/`
and is reclaimable by `eval-magic teardown` once promoted (this commit's marker).

| Field | Value |
|-------|-------|
| Mode | revision |
| Iteration | iteration-2 |
| Harness | claude-code |
| Agent model | claude-sonnet-4-6 |
| Judge model | claude-sonnet-4-6 |
| Conditions | old_skill, new_skill |
| Run timestamp | 2026-06-06T05:25:05.900Z |
| Label | split-no-regression |
| Promoted from commit | 42fa415 |

Files:
- `benchmark.json` — aggregate pass-rate / duration / token deltas.
- `grading/<eval-id>__<condition>.json` — per-run assertion results and judge rationales.
