# Skill revision prompt template

Use this template at the end of iteration N to feed eval signals into the next revision of SKILL.md.

## Variables to fill

| Variable | Source |
|---|---|
| `{{current_skill}}` | Current SKILL.md contents |
| `{{failed_assertions}}` | List of `(eval_id, assertion_id, evidence)` for assertions that failed in the `with_skill` / `new_skill` condition |
| `{{reviewer_feedback}}` | Per-eval notes from `feedback.json` (only the non-empty ones) |
| `{{notable_transcripts}}` | Brief excerpts from the most informative run records (focus on transcripts that revealed *why* an assertion failed) |
| `{{benchmark_summary}}` | Pass-rate delta and any anomalies (high stddev, time/token outliers) from `benchmark.json` |

## Template

```
You are improving a skill based on signals from a recent eval iteration.

# Current SKILL.md
{{current_skill}}

# Failed assertions
{{failed_assertions}}

# Reviewer feedback
{{reviewer_feedback}}

# Notable execution transcripts
{{notable_transcripts}}

# Benchmark summary
{{benchmark_summary}}

# Your task

Propose changes to the skill. Guidelines:

1. **Generalize from feedback.** The skill is used across many prompts, not just these test cases. Fixes should address underlying issues broadly, not patch specific failing examples.

2. **Keep the skill lean.** Fewer, better instructions outperform exhaustive rules. If transcripts show wasted work — unnecessary validation, unneeded intermediate outputs — remove those instructions. If pass rates plateau despite adding rules, try removing instructions and see if results hold or improve.

3. **Explain the why.** Reasoning-based instructions ("Do X because Y tends to cause Z") work better than rigid directives ("ALWAYS do X, NEVER do Y"). Models follow instructions more reliably when they understand the purpose.

4. **Bundle repeated work.** If multiple runs independently wrote a similar helper script (chart builder, data parser, lookup table), bundle it into the skill's `scripts/` directory and reference it from the skill.

5. **Do not just patch failing examples.** A change that fixes only the failing assertions is a regression risk if it doesn't address the underlying gap. Ask: "what is the smallest, most general rule that would have made these failures impossible?"

# Output

Either:
- A unified diff of proposed SKILL.md changes, OR
- A revised SKILL.md in full

Plus a short rationale (≤ 200 words) explaining the structural choices and which signals each change addresses.
```
