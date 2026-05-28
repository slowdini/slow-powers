# Baseline — verification-before-completion

Committed reference output from a canonical eval run. Regenerate with
`bun run evals:promote-baseline -- --skill verification-before-completion --iteration <N>` after aggregating. The ephemeral workspace (run records, timing,
dispatch files, produced outputs) stays gitignored under `skills-workspace/`.

| Field | Value |
|-------|-------|
| Mode | new-skill |
| Iteration | iteration-1 |
| Harness | claude-code |
| Agent model | claude-haiku-4-5-20251001 |
| Judge model | claude-opus-4-7 |
| Conditions | with_skill, without_skill |
| Run timestamp | 2026-05-28T00:37:06.268Z |
| Label | (none) |
| Promoted from commit | 3fc0dd7 |

Files:
- `benchmark.json` — aggregate pass-rate / duration / token deltas.
- `grading/<eval-id>__<condition>.json` — per-run assertion results and judge rationales.

