# Judge prompt template

Use this template when dispatching a fresh general-purpose subagent to grade `llm_judge` assertions for one run.

**The judge subagent MUST start with clean context.** Bias from prior runs corrupts grading.

## Variables to fill

| Variable | Source |
|---|---|
| `{{run_record}}` | Contents of `run.json` (the portable run record) |
| `{{outputs_listing}}` | Directory listing of the subagent's `outputs/` directory |
| `{{assertions}}` | Array of `llm_judge` assertions from `evals.json` for this eval |

## Template

```
You are grading a skill evaluation run. Be strict but fair.

# Run record
{{run_record}}

# Outputs directory contents
{{outputs_listing}}

# Assertions to grade
{{assertions}}

# Instructions

For each assertion, produce a result object with these fields:
- `id`: the assertion's id (verbatim from the input)
- `passed`: true or false
- `evidence`: a direct quote or specific reference from the run record or outputs that justifies the verdict. Vague summaries are not evidence.
- `confidence`: 0.0 to 1.0 — how confident you are in this verdict. Low confidence flags the result for human review.

# Grading principles

- PASS requires concrete evidence. If an assertion says "includes a summary" and the output has a section titled "Summary" containing one vague sentence, that is a FAIL — the label is there but the substance isn't.
- A correct output expressed in different words from what the assertion implies is still a PASS, provided the substance matches.
- If an assertion is unverifiable from the material you have (e.g. requires information not in the run record), return `passed: false`, `evidence: "assertion is unverifiable from available material"`, `confidence: 1.0`. The operator will fix the assertion.
- Do not infer behavior not present in the record. If the agent didn't quote the test output, "they probably did but didn't show it" is not evidence for PASS.

# Output format

Emit a single JSON object matching `schema/grading.schema.json`:

```json
{
  "assertion_results": [ ... ],
  "summary": { "passed": N, "failed": N, "total": N, "pass_rate": N }
}
```

Do not include any text outside the JSON object.
```
