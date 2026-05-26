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
| `{{staged_skill_slug}}` | Unique slug the runner staged the skill-under-test under (Claude Code only) |
| `{{bootstrap_content}}` | Plugin's bootstrap.md content, injected to mirror a real install (Claude Code only) |

## Template

```
{{#if bootstrap_content}}
<session-start-context>
The following guidelines were loaded at session start by the superslow plugin
(equivalent to the SessionStart hook firing in a real user's environment):

{{bootstrap_content}}
</session-start-context>
{{/if}}
You are executing a single test case for a skill evaluation framework.
Treat this as a real user request — do NOT optimize your behavior for the eval.

{{#if staged_skill_slug}}
Your environment has the superslow plugin loaded. All superslow skills are
discoverable via the Skill tool. The skill currently under evaluation is
staged under the unique slug "{{staged_skill_slug}}" — invoke that slug rather
than the natural name if the skill applies to the user's request.
{{else if skill_path}}
The following skill is loaded into your operating guidelines. Apply it where relevant.
<skill name="{{skill_name}}">
{{skill_content}}
</skill>
{{else if bootstrap_content}}
The skill currently under evaluation is NOT available in this environment.
Other superslow skills remain discoverable via the Skill tool; apply any
that fit the user's request.
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

**Environment parity (Claude Code):** when `--no-stage` is NOT set, the runner additionally stages every *other* superslow skill at `<repoRoot>/.claude/skills/<name>/` (natural name, full content minus `evals/`) so cross-references like `superslow:test-driven-development` resolve, and prepends `bootstrap.md` as `<session-start-context>`. The runner records what it created in `<repoRoot>/.claude/skills/.superslow-eval-manifest.json` so cleanup is reversible — any pre-existing entry with a colliding name is backed up and restored. See `SKILL.md` § Environment parity for the cross-harness picture.

## After the subagent completes

The operator (or the runner) must capture:

1. The full transcript / tool invocations → convert via the harness adapter into `{{output_dir}}/../run.json` matching `schema/run-record.schema.json`.
2. `total_tokens` and `duration_ms` from the harness's task completion event → `{{output_dir}}/../timing.json`. **These values may not be persisted anywhere else — save them immediately.**
