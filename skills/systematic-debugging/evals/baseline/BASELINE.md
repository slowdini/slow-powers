# Baseline — systematic-debugging

Committed reference output from a canonical eval run. Regenerate with
`bun run evals:promote-baseline -- --skill systematic-debugging --iteration <N>` after aggregating. The ephemeral workspace (run records, timing,
dispatch files, produced outputs) stays gitignored under `skills-workspace/`.

| Field | Value |
|-------|-------|
| Mode | new-skill |
| Iteration | iteration-2 |
| Harness | claude-code |
| Agent model | claude-sonnet-4-6 |
| Judge model | claude-opus-4-7 |
| Conditions | with_skill, without_skill |
| Run timestamp | 2026-05-27T08:43:30.299Z |
| Label | (none) |
| Promoted from commit | b64c87f |

Files:
- `benchmark.json` — aggregate pass-rate / duration / token deltas.
- `grading/<eval-id>__<condition>.json` — per-run assertion results and judge rationales.

