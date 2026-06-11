# Baseline — investigating-bugs

Committed reference output from a canonical eval run. Regenerate with
`eval-magic promote-baseline --skill investigating-bugs --iteration <N>` after aggregating. The ephemeral workspace (run records, timing,
dispatch files, produced outputs) stays gitignored under `skills-workspace/`
and is reclaimable by `eval-magic teardown` once promoted (this commit's marker).

| Field | Value |
|-------|-------|
| Mode | new-skill |
| Iteration | iteration-1 |
| Harness | claude-code |
| Agent model | unspecified |
| Judge model | unspecified |
| Conditions | with_skill, without_skill |
| Run timestamp | 2026-06-11T04:22:46.590Z |
| Label | issue-207 rename + pressure validation (Mode A, sonnet-4-6) |
| Promoted from commit | 37289e4 |

Files:
- `benchmark.json` — aggregate pass-rate / duration / token deltas.
- `grading/<eval-id>__<condition>.json` — per-run assertion results and judge rationales.

