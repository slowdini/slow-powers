# Skill Evals Runner

Repo-internal tooling for running the skill eval framework defined in `skills/evaluating-skills/`.

This is the **runner**; the methodology lives in the skill. Skill content is harness-agnostic; this runner is Bun + Claude Code-aware (it knows how to translate Claude Code transcript shapes into the portable `run.json` format).

## Two modes

Every run produces both a `dispatch-manifest.md` (human-readable) and a `dispatch.json` (machine-readable). Pick:

- **CLI / manual mode** — operator reads the manifest, manually feeds each dispatch into their subagent primitive, writes `run.json` + `timing.json` by hand.
- **Agent-driven mode** — an agent in a session reads `dispatch.json`, dispatches each task itself, writes the run/timing records to the paths in each task. The common case.

The runner script is identical for both. Only the consumer differs.

## Quickstart

### Mode A — Evaluate a new skill (with vs without)

```bash
# 1. Author skills/<name>/evals/evals.json with 2-3 prompts.

# 2. Build the iteration-1 workspace.
bun run evals -- --skill <name> --mode new-skill

# 3. Open skills-workspace/<name>/iteration-1/dispatch-manifest.md and
#    dispatch each entry as a fresh general-purpose subagent.

# 4. For each completed run, write `run.json` (matching schema/run-record.schema.json)
#    and `timing.json` into the condition directory.

# 5. Grade (added in step 5):
bun run evals:grade -- --skill <name> --iteration 1

# 6. Aggregate:
bun run evals:aggregate -- --skill <name> --iteration 1

# 7. Read skills-workspace/<name>/iteration-1/benchmark.json.
```

### Mode B — Evaluate a language change to an existing skill

```bash
# 1. Snapshot current SKILL.md before editing.
bun run evals:snapshot -- --skill <name> --label baseline-2026-05-24

# 2. Edit skills/<name>/SKILL.md.

# 3. Build the iteration-N workspace, comparing snapshot vs current.
bun run evals -- --skill <name> --mode revision --baseline baseline-2026-05-24

# 4-7. Same as Mode A.
```

### Dry run (workspace prep only)

```bash
bun run evals -- --skill <name> --mode new-skill --dry-run
```

## Layout

- `run.ts` — orchestrator; builds workspace tree, snapshots SKILL.md, emits dispatch manifest. Also handles the `snapshot` subcommand.
- `aggregate.ts` — reads grading.json + timing.json from an iteration, writes `benchmark.json` with pass-rate / duration / token stats keyed by condition name.
- `types.ts` — shared TypeScript types matching `skills/evaluating-skills/schema/*.json`.
- `validate.ts` — minimal validator for `evals.json` against the JSON Schema rules.

Coming in later steps:

- `grade.ts` — runs transcript_check modules and dispatches llm_judge subagents; produces `grading.json` per run.
- `transcript-checks/` — registered transcript-check modules (e.g., `ran-verification-command.ts`).
- `adapters/claude-code-transcript.ts` — converts Claude Code transcript JSON into the portable run-record schema.

## Why this lives in `tests/`

The framework is a second pillar of testing alongside the existing `tests/codex/` and `tests/opencode/` packaging tests. Operating as a sibling makes that visible; it also signals that the runner is repo-internal infrastructure, not a skill end users adopt verbatim. The portable run-record schema is the abstraction that lets the methodology work across harnesses.

## Caveats

- v1 ships the Claude Code transcript adapter only. Other harnesses must produce `run.json` manually or write their own adapter.
- v1 grading dispatch is operator-driven (host agent dispatches judge subagents per the manifest). v2 will add an SDK-backed headless grader.
- Single-run evals only in v1; the schema supports multi-run later.
- Snapshot retention is manual — operator deletes `skills-workspace/<skill>/snapshots/<label>/` when no longer needed.
