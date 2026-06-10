# Baseline — hardening-plans

Committed reference output from a canonical eval run. Regenerate with
`eval-magic promote-baseline --skill hardening-plans --iteration <N>` after aggregating. The ephemeral workspace (run records, timing,
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
| Run timestamp | 2026-06-07T04:07:44.660Z |
| Label | next-step-named-handoff |
| Promoted from commit | 7dc77dd |

`old_skill` = `next-step-v1` (commit `b62c4cd`, the next-step flowchart **without**
the named-hand-off requirement). `new_skill` = the working tree at promotion
(`7dc77dd`, flowchart **with** the named-hand-off requirement).

Files:
- `benchmark.json` — aggregate pass-rate / duration / token deltas.
- `grading/<eval-id>__<condition>.json` — per-run assertion results and judge rationales.
