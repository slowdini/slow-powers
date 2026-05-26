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

# 4. For each completed run, write `run.json` (matching schema/run-record.schema.json,
#    with `tool_invocations: []` for now) and `timing.json` into the condition directory.

# 5. Fill tool_invocations from subagent transcripts:
#    On Claude Code:
bun run evals:fill-transcripts -- --skill <name> --iteration 1 \
  --subagents-dir ~/.claude/projects/<project-slug>/<parent-session-id>/subagents/
#    On Antigravity CLI (auto-detected, or pass --harness antigravity):
bun run evals:fill-transcripts -- --skill <name> --iteration 1 \
  --subagents-dir ~/.gemini/antigravity-cli/brain/

# 6. Grade:
bun run evals:grade -- --skill <name> --iteration 1
# (After judge subagents complete and their responses are written, finalize:)
bun run evals:grade -- --skill <name> --iteration 1 --finalize

# 7. Aggregate:
bun run evals:aggregate -- --skill <name> --iteration 1

# 8. Read skills-workspace/<name>/iteration-1/benchmark.json.
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

- `run.ts` — orchestrator; builds workspace tree, snapshots SKILL.md, emits dispatch manifest. On Claude Code (default), also stages each condition's snapshot at `<repoRoot>/.claude/skills/superslow-eval-<iteration>-<condition>__<skillName>/SKILL.md` so the subagent can discover and invoke it via the Skill tool, stages every *other* superslow skill at its natural name so cross-references resolve, and prepends `bootstrap.md` as `<session-start-context>` (see *Environment parity* below). Pass `--no-stage` to opt out and fall back to inlining the SKILL.md into the dispatch prompt. Also handles the `snapshot` subcommand.
- `grade.ts` — evaluates `transcript_check` assertions directly (regex against `tool_invocations`), emits judge-task files for `llm_judge` assertions, then finalizes by merging judge responses into per-run `grading.json`. The `__skill_invoked` meta-check is code-based on Claude Code when the staged-skill slug is known and `tool_invocations` is populated (deterministic scan for a `Skill` tool call with matching slug); it falls back to an LLM judge looking for behavioral fingerprints when either signal is missing.
- `aggregate.ts` — reads grading.json + timing.json from an iteration, writes `benchmark.json` with pass-rate / duration / token stats keyed by condition name.
- `fill-transcripts.ts` — walks the iteration tree, matches each `(eval, condition)` to a subagent transcript by description, parses the transcript with the appropriate adapter, populates `tool_invocations` in `run.json`.
- `adapters/claude-code-transcript.ts` — reads a Claude Code subagent JSONL and returns `ToolInvocation[]`. Also exposes `listSubagents` / `findByDescription` for the fill-transcripts CLI.
- `adapters/antigravity-transcript.ts` — reads an Antigravity subagent JSONL and returns `ToolInvocation[]`. Also exposes `listSubagents` / `findByDescription` for the fill-transcripts CLI.
- `types.ts` — shared TypeScript types matching `skills/evaluating-skills/schema/*.json`.
- `validate.ts` — minimal validator for `evals.json` against the JSON Schema rules.

## Environment parity

A subagent that runs an eval should start in an environment that mirrors a real install of the plugin under evaluation. Otherwise the result depends on the developer's local install state (whether they happen to have the plugin loaded into their parent session, which version, etc.) rather than the skill being measured. The runner is responsible for producing this parity explicitly so results reproduce on a clean checkout or in CI.

For this runner, "parity" means two things, both applied when `--no-stage` is NOT set and either `--harness claude-code` (the default) or `--harness antigravity` is in effect:

1. **`bootstrap.md` is prepended to every dispatch prompt.** The runner reads `<repoRoot>/bootstrap.md` once at startup and wraps it in a `<session-start-context>` block at the top of each subagent's prompt. This is the same text the `SessionStart` hook would inject for a real user; subagents don't fire session-start hooks, so the runner does the injection itself.
2. **Every other superslow skill is staged at its natural name.** Beyond the existing unique-slug stage of the skill-under-test (`<repoRoot>/.claude/skills/superslow-eval-<iteration>-<condition>__<skillName>/`), the runner copies each *other* skill from `skills/*/` into `<repoRoot>/.claude/skills/<skillName>/` (excluding each skill's `evals/` subdir). Natural names matter because cross-references inside skill bodies (e.g. "REQUIRED SUB-SKILL: Use `superslow:test-driven-development`") only resolve cleanly to natural-name entries.

The runner records what it staged in `<repoRoot>/.claude/skills/.superslow-eval-manifest.json` so cleanup is reversible. Any pre-existing entry with a colliding name is backed up to a temp directory (recorded in the manifest) before being overwritten, and restored on the next `cleanupStagedSkills()` call. The legacy prefix sweep (`superslow-eval-*` entries) still runs first so a crashed prior run is recovered even if the manifest itself was never written.

The skill-under-test is **not** staged under its natural name — only under its unique slug. This preserves the `__skill_invoked` meta-check semantics: the check matches `Skill` invocations against the unique slug, so a `Skill` call to the natural-name version of a sibling skill never false-positives as "the skill under test was invoked."

For the **`without_skill` / baseline condition** in this realistic environment, the subagent's dispatch block reflects "this skill is unavailable, others remain" rather than the legacy "no skill is loaded." The baseline measures the incremental value of the skill-under-test on top of the rest of the plugin — not its absolute value vs. no skills at all. With `--no-stage`, the legacy "no skill is loaded" wording is preserved.

**Cross-harness breadcrumbs.** Environment parity is implemented for Claude Code and Antigravity. Other harnesses have their own skill-discovery mechanisms; their maintainers know them best. Sketches:

- **Codex / Cursor.** Both declare `"skills": "./skills/"` in their `plugin.json`, so the harness scans a directory at start-up. Sibling staging would write to whatever staging path that harness reads from — analogous to `stageSiblingSkills()` but pointed at the right directory. Bootstrap can be prepended to the dispatch prompt the same way.
- **OpenCode.** Installed via npm package; the package's own directory is the discoverable surface. Sibling staging would copy into that directory, or — if the harness loads from `node_modules` directly — into a parallel staging path the harness is configured to scan.
- **Antigravity.** Fully supported. Surfaces skills via `view_file` on absolute paths and emits a `<skills>` block listing all available SKILL.md files (including sibling skills and, if active, the skill under test) sorted alphabetically. Bootstrap-equivalent content from `bootstrap.md` is automatically wrapped in a `<session-start-context>` block and prepended to the dispatch prompt, emulating how `antigravity-instructions.md` loads the bootstrap guidelines in a real installation.
- **General fallback.** Harnesses without project-local discovery should keep using `--no-stage`; the inline `<skill>` block in the dispatch prompt is the only skill the subagent sees. Bootstrap is omitted in this mode because its references to other skills would mislead the agent.

**Operational notes.** Do not run two `bun run evals` invocations concurrently against the same checkout — they race on `<repoRoot>/.claude/skills/` and the manifest.

## Why this lives in `tests/`

The framework is a second pillar of testing alongside the existing `tests/codex/` and `tests/opencode/` packaging tests. Operating as a sibling makes that visible; it also signals that the runner is repo-internal infrastructure, not a skill end users adopt verbatim. The portable run-record schema is the abstraction that lets the methodology work across harnesses.

## Caveats

- v1.1 ships both Claude Code and Antigravity transcript adapters. Other harnesses must populate `tool_invocations` manually or write their own adapter against `schema/run-record.schema.json`. Without an adapter, `transcript_check` assertions grade as `unverifiable` and the `__skill_invoked` meta-check falls back to the LLM judge.
- Skill staging writes to `<repoRoot>/.claude/skills/superslow-eval-*/`. The runner sweeps these directories at the start of each fresh run; a crashed run may leave stale entries that the next run will reap.
- v1 grading dispatch is operator-driven (host agent dispatches judge subagents per the manifest). v2 will add an SDK-backed headless grader.
- Single-run evals only in v1; the schema supports multi-run later.
- Snapshot retention is manual — operator deletes `skills-workspace/<skill>/snapshots/<label>/` when no longer needed.
