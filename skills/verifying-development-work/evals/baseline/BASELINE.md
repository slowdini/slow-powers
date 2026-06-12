# Baseline — verifying-development-work

Committed reference output from a canonical eval run. Regenerate with
`eval-magic promote-baseline --skill verifying-development-work --iteration <N>` after aggregating. The ephemeral workspace (run records, timing,
dispatch files, produced outputs) stays gitignored under `skills-workspace/`
and is reclaimable by `eval-magic teardown` once promoted (this commit's marker).

| Field | Value |
|-------|-------|
| Mode | revision |
| Iteration | iteration-2 |
| Harness | claude-code |
| Agent model | unspecified |
| Judge model | unspecified |
| Conditions | old_skill, new_skill |
| Run timestamp | 2026-06-12T07:12:25.739Z |
| Label | (none) |
| Promoted from commit | 6f42170 |

Files:
- `benchmark.json` — aggregate pass-rate / duration / token deltas.
- `grading/<eval-id>__<condition>.json` — per-run assertion results and judge rationales.

