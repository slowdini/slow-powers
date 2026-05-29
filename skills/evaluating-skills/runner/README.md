# Skill Evals Runner

Supporting code for the skill eval framework defined in `skills/evaluating-skills/`. This runner ships **with** the skill (it lives under the skill directory and is included in the published plugin), so plugin users can run evals on their own skills, not just slow-powers maintainers.

The methodology lives in `SKILL.md` and is harness-agnostic. This runner is Bun + Claude Code-aware: it knows how to translate Claude Code transcript shapes into the portable `run.json` format. Harness-specific operator instructions live in `../harness-details/<harness>.md`.

## The `--skill-dir` model

Every command takes two required flags:

- `--skill-dir <path>` — a directory that contains one or more skill folders (each with a `SKILL.md`). **This directory is the eval's test environment.** Every skill inside it is staged for the eval: the skill-under-test under a unique slug, every *other* skill under its natural name (so cross-references resolve).
- `--skill <name>` — the subdirectory of `--skill-dir` to evaluate.

Consequences of treating the directory as the environment:

- **Internal use** points `--skill-dir` at the repo's `./skills`, so the skill-under-test sees every other slow-powers skill as a sibling — the realistic install. The npm scripts bake this in (`--skill-dir ./skills`), so maintainers keep using `bun run evals -- --skill <name> --mode <mode>` unchanged.
- **A user evaluating one personal skill** points `--skill-dir` at the directory holding it. If that directory contains only their skill, the eval runs in isolation — no sibling skills are staged. To include slow-powers skills as siblings, the user copies or symlinks them into `--skill-dir`.

Other flags:

- `--bootstrap <path>` (optional) — a Markdown file prepended verbatim to every dispatch prompt inside `<session-start-context>`. Use it for product-specific framing (instruction priority, planning guidelines — anything a SessionStart hook would inject). Internal runs pass `--bootstrap ./bootstrap.md`. Omit it and dispatches carry only the auto-built staged-skills inventory.
- `--workspace-dir <path>` (optional) — where iteration artifacts are written. Defaults to `<CWD>/skills-workspace`.
- `--harness claude-code` (optional, default `claude-code`; the only supported harness).
- `--no-stage`, `--dry-run`, `--iteration <N>`, `--mode <new-skill|revision>`, `--baseline <label>`, `--label <label>` — as before.

Staging is written under the current working directory: `<CWD>/.claude/skills/`. A subagent dispatched from that CWD discovers the staged skills there. Run the commands from the directory you want to be the eval root (the repo root for internal use; your skill folder or its parent for personal use).

## Driving the loop

Every run produces both a `dispatch-manifest.md` (human-readable) and a `dispatch.json` (machine-readable). An agent in a session reads `dispatch.json`, dispatches each task itself, and writes the run/timing records to the paths in each task.

## Quickstart (internal / repo use)

Maintainers run from the repo root; the npm scripts supply `--skill-dir ./skills` and `--bootstrap ./bootstrap.md`.

### Mode A — Evaluate a new skill (with vs without)

```bash
# 1. Author skills/<name>/evals/evals.json with 2-3 prompts.

# 2. Build the iteration-1 workspace.
bun run evals -- --skill <name> --mode new-skill

# 3. Read skills-workspace/<name>/iteration-1/dispatch.json and dispatch each
#    task as a fresh general-purpose subagent, writing run.json + timing.json
#    to the paths in each task.

# 4. Fill tool_invocations from subagent transcripts:
bun run evals:fill-transcripts -- --skill <name> --iteration 1 \
  --subagents-dir ~/.claude/projects/<project-slug>/<parent-session-id>/subagents/

# 5. Grade:
bun run evals:grade -- --skill <name> --iteration 1
# (After judge subagents complete and their responses are written, finalize:)
bun run evals:grade -- --skill <name> --iteration 1 --finalize

# 6. Aggregate:
bun run evals:aggregate -- --skill <name> --iteration 1

# 7. Read skills-workspace/<name>/iteration-1/benchmark.json.

# 8. (Optional) Promote this run's benchmark + judge rationales into the
#    skill's version-controlled evals/baseline/ directory:
bun run evals:promote-baseline -- --skill <name> --iteration 1
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

## Quickstart (running an eval on your own skill)

If you have the slow-powers plugin installed and a personal skill, you do **not** run the npm scripts. The skill's `SKILL.md` routes you to `../harness-details/<harness>.md`, which gives the full command sequence (resolving the installed runner path, invoking `run.ts` directly with `--skill-dir`/`--skill`, dispatching subagents, grading). On Claude Code, see `../harness-details/claude.md`.

## Layout

- `context.ts` — `detectRunContext(argv)` builds the `RunContext` every command shares: resolves `--skill-dir`/`--skill`, enumerates sibling skills, resolves `--bootstrap`/`--workspace-dir`, and derives `stageRoot` (CWD) and `workspaceRoot`.
- `run.ts` — orchestrator; builds workspace tree, snapshots SKILL.md, emits dispatch manifest. On Claude Code (default), also stages each condition's snapshot at `<stageRoot>/.claude/skills/slow-powers-eval-<iteration>-<condition>__<skillName>/SKILL.md` so the subagent can discover and invoke it via the Skill tool, stages every *other* skill found in `--skill-dir` at its natural name so cross-references resolve, and builds the `<session-start-context>` block (see *Environment parity* below). Pass `--no-stage` to opt out and fall back to inlining the SKILL.md into the dispatch prompt. Also handles the `snapshot` subcommand.
- `grade.ts` — evaluates `transcript_check` assertions directly (regex against `tool_invocations`), emits judge-task files for `llm_judge` assertions, then finalizes by merging judge responses into per-run `grading.json`. The `__skill_invoked` meta-check is code-based on Claude Code when the staged-skill slug is known and `tool_invocations` is populated (deterministic scan for a `Skill` tool call with matching slug); it falls back to an LLM judge looking for behavioral fingerprints when either signal is missing.
- `aggregate.ts` — reads grading.json + timing.json from an iteration, writes `benchmark.json` with pass-rate / duration / token stats keyed by condition name.
- `promote-baseline.ts` — copies the durable subset of an iteration (`benchmark.json` + each run's `grading.json` + a `BASELINE.md` provenance file) into the skill's version-controlled `evals/baseline/`. Flags: `--skill-dir`/`--skill` (as everywhere), `--iteration <N>` (required), `--label <tag>` (optional, recorded in provenance). Everything else in the workspace stays gitignored.
- `fill-transcripts.ts` — walks the iteration tree, matches each `(eval, condition)` to a subagent transcript by description, parses the transcript with the appropriate adapter, populates `tool_invocations` in `run.json`.
- `adapters/claude-code-transcript.ts` — reads a Claude Code subagent JSONL and returns `ToolInvocation[]`. Also exposes `listSubagents` / `findByDescription` for the fill-transcripts CLI.
- `types.ts` — shared TypeScript types matching `../schema/*.json`.
- `validate.ts` / `validate-all.ts` — validator for `evals.json` against the JSON Schema rules. `validate-all.ts` takes `--skill-dir` and validates every skill's `evals.json` in it.

## Environment parity

A subagent that runs an eval should start in an environment that mirrors a real install of the plugin under evaluation. Otherwise the result depends on the operator's local install state (whether they happen to have the plugin loaded into their parent session, which version, etc.) rather than the skill being measured. The runner produces this parity explicitly so results reproduce on a clean checkout or in CI.

Parity has two parts, both applied when `--no-stage` is NOT set (the default `--harness claude-code`):

1. **A staged-skills inventory is built into every dispatch prompt.** The runner lists the skills actually staged for the eval — the skill-under-test plus the siblings found in `--skill-dir` — inside the `<session-start-context>` block as a Markdown bullet list. This tells the subagent what is discoverable, independent of any `--bootstrap` file.
2. **Every skill in `--skill-dir` is staged.** The skill-under-test is staged under its unique slug (`<stageRoot>/.claude/skills/slow-powers-eval-<iteration>-<condition>__<skillName>/`); every *other* skill in `--skill-dir` is copied to `<stageRoot>/.claude/skills/<name>/` at its natural name (excluding each skill's `evals/` subdir). Natural names matter because cross-references inside skill bodies (e.g. "REQUIRED SUB-SKILL: Use `slow-powers:test-driven-development`") only resolve cleanly to natural-name entries.

`--bootstrap` is **separate** from parity. It injects product-specific framing (the file's verbatim contents) ahead of the staged-skills inventory. Internal runs pass `./bootstrap.md`; that file contains its own "Active Skills Directory" list, which overlaps the auto-built inventory. That small duplication is intentional — it avoids maintaining a second bootstrap file in lockstep with the runner.

The runner records what it staged in `<stageRoot>/.claude/skills/.slow-powers-eval-manifest.json` so cleanup is reversible. Any pre-existing entry with a colliding name is backed up to a temp directory (recorded in the manifest) before being overwritten, and restored on the next `cleanupStagedSkills()` call. The prefix sweep (`slow-powers-eval-*` entries) still runs first so a crashed prior run is recovered even if the manifest itself was never written.

The skill-under-test is **not** staged under its natural name — only under its unique slug. This preserves the `__skill_invoked` meta-check semantics: the check matches `Skill` invocations against the unique slug, so a `Skill` call to a natural-name sibling never false-positives as "the skill under test was invoked."

For the **`without_skill` / baseline condition** in this realistic environment, the subagent's dispatch block reflects "this skill is unavailable, others remain" rather than the legacy "no skill is loaded." The baseline measures the incremental value of the skill-under-test on top of the rest of the environment — not its absolute value vs. no skills at all. With `--no-stage` (or a `--skill-dir` containing only the skill-under-test and no `--bootstrap`), the legacy "no skill is loaded" wording is preserved.

**Cross-harness breadcrumbs.** Environment parity is implemented for Claude Code. Other harnesses have their own skill-discovery mechanisms; their maintainers know them best. Sketches:

- **Codex / Cursor.** Both declare `"skills": "./skills/"` in their `plugin.json`, so the harness scans a directory at start-up. Sibling staging would write to whatever staging path that harness reads from — analogous to `stageSiblingSkills()` but pointed at the right directory. Bootstrap can be prepended to the dispatch prompt the same way.
- **OpenCode.** Installed via npm package; the package's own directory is the discoverable surface. Sibling staging would copy into that directory, or — if the harness loads from `node_modules` directly — into a parallel staging path the harness is configured to scan.
- **General fallback.** Harnesses without project-local discovery should keep using `--no-stage`; the inline `<skill>` block in the dispatch prompt is the only skill the subagent sees. Bootstrap is omitted in this mode because its references to other skills would mislead the agent.

The committed per-skill baselines (`skills/<skill>/evals/baseline/`) plus the `transcript_check` assertions in the baseline eval suite give other harnesses a concrete target to reproduce: a harness whose adapter populates `tool_invocations` faithfully should be able to re-run a skill's eval and land close to the committed `benchmark.json` delta. See `harness-parity-check.md` — the transcript adapter is a parity target, and evals are not production functionality, so a harness can aim high here without risking user-facing behavior.

**Operational notes.** Do not run two `run.ts` invocations concurrently against the same CWD — they race on `<stageRoot>/.claude/skills/` and the manifest.

## Why this lives in the skill

The runner is bundled as a [supporting file](https://code.claude.com/docs/en/skills#add-supporting-files) of `evaluating-skills` so it ships in the published plugin. Methodology (the SKILL.md prose and the portable schemas) and the orchestration code that executes it travel together; a plugin user can run an eval on their own skill without cloning this repo. The portable run-record schema remains the abstraction that lets the methodology work across harnesses, while this runner stays Bun + Claude-Code-aware.

## Caveats

- Ships a Claude Code transcript adapter. Other harnesses must populate `tool_invocations` manually or write their own adapter against `../schema/run-record.schema.json`. Without an adapter, `transcript_check` assertions grade as `unverifiable` and the `__skill_invoked` meta-check falls back to the LLM judge.
- Skill staging writes to `<stageRoot>/.claude/skills/slow-powers-eval-*/`. The runner sweeps these directories at the start of each fresh run; a crashed run may leave stale entries that the next run will reap.
- Grading dispatch is operator/agent-driven (the host dispatches judge subagents per the manifest).
- Single-run evals only for now; the schema supports multi-run later.
- Snapshot retention is manual — delete `<workspace>/<skill>/snapshots/<label>/` when no longer needed.
