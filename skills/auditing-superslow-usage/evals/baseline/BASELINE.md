# Baseline — auditing-superslow-usage

Committed reference output from a canonical eval run. Regenerate with
`bun run evals:promote-baseline -- --skill auditing-superslow-usage --iteration <N>` after aggregating. The ephemeral workspace (run records, timing,
dispatch files, produced outputs) stays gitignored under `skills-workspace/`.

| Field | Value |
|-------|-------|
| Mode | new-skill |
| Iteration | iteration-1 |
| Harness | claude-code |
| Agent model | claude-haiku-4-5-20251001 |
| Judge model | claude-sonnet-4-6 |
| Conditions | with_skill, without_skill |
| Run timestamp | 2026-05-29T01:53:18.024Z |
| Label | v1-haiku-sonnet |
| Promoted from commit | 1149a95 |

Files:
- `benchmark.json` — aggregate pass-rate / duration / token deltas.
- `grading/<eval-id>__<condition>.json` — per-run assertion results and judge rationales.

