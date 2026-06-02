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
| `{{staged_skill_slug}}` | Unique slug the runner staged the skill-under-test under, if the harness supports project-local skill discovery (e.g. Claude Code) |
| `{{bootstrap_content}}` | Plugin bootstrap / session-start text, injected to mirror what a real user sees when their session starts (optional; runners that don't have an equivalent leave this empty) |

## Template

```
{{#if bootstrap_content}}
<session-start-context>
The following guidelines were loaded at session start by the plugin under evaluation
(equivalent to the harness's session-start hook firing in a real user's environment):

{{bootstrap_content}}
</session-start-context>
{{/if}}
You are executing a single test case for a skill evaluation framework.
Treat this as a real user request — do NOT optimize your behavior for the eval.

{{#if staged_skill_slug}}
The `{{skill_name}}` skill is registered under the identifier
"{{staged_skill_slug}}" and is discoverable via the Skill tool. If you invoke it,
use that identifier.
{{else if skill_path}}
The following skill is loaded into your operating guidelines. Apply it where relevant.
<skill name="{{skill_name}}">
{{skill_content}}
</skill>
{{else if bootstrap_content}}
{{else}}
No skill is loaded. Respond as you naturally would.
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

`{{staged_skill_slug}}` and `{{bootstrap_content}}` are optional — they describe a *realistic-environment* dispatch where the runner has reproduced what a fresh plugin install would look like (siblings staged, bootstrap text prepended). A simpler runner can leave them empty and the conditional blocks degrade gracefully to the legacy inline / no-skill paths.

## After the subagent completes

The operator (or the runner) must capture:

1. The full transcript / tool invocations → convert via the harness adapter into `{{output_dir}}/../run.json` matching `schema/run-record.schema.json`.
2. `total_tokens` and `duration_ms` from the harness's task completion event → `{{output_dir}}/../timing.json`. **These values may not be persisted anywhere else — save them immediately.**
