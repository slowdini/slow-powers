# Eval task dispatch template

Use this template when dispatching a fresh general-purpose subagent to execute a single eval test case.

**The subagent MUST start with clean context.** State from previous runs invalidates the comparison.

## Variables to fill

| Variable | Source |
|---|---|
| `{{eval_id}}` | The eval's `id` from `evals.json` |
| `{{condition}}` | `with_skill`, `without_skill`, `old_skill`, or `new_skill` |
| `{{prompt}}` | The eval's `prompt`, verbatim |
| `{{files}}` | Fixture paths the subagent can read (or "none") |
| `{{output_dir}}` | The workspace directory the subagent writes to |
| `{{skill_path}}` | Path to SKILL.md to load — omit entirely for `without_skill` |

## Template

```
You are executing a single test case for a skill evaluation framework.
Treat this as a real user request — do NOT optimize your behavior for the eval.

{{#if skill_path}}
Reference skill (load and follow if applicable): {{skill_path}}
{{/if}}

Available fixture files: {{files}}
Output directory: {{output_dir}}

Instructions:
- Write any files you produce into the output directory.
- After completing the task, write your final user-facing response to {{output_dir}}/final-message.md.
- Do not write anything outside the output directory.

User request:
{{prompt}}
```

## After the subagent completes

The operator (or the runner) must capture:

1. The full transcript / tool invocations → convert via the harness adapter into `{{output_dir}}/../run.json` matching `schema/run-record.schema.json`.
2. `total_tokens` and `duration_ms` from the harness's task completion event → `{{output_dir}}/../timing.json`. **These values may not be persisted anywhere else — save them immediately.**
