# Running an eval on a skill — Claude Code

This is the Claude Code-specific walkthrough for `evaluating-skills`. The runner contract (`--skill-dir`, `--skill`, `--bootstrap`, modes, what gets staged) is described in `../SKILL.md`; this file tells you exactly how to drive it inside Claude Code.

Use this when a user, working from their own skill folder, asks to run an eval (e.g. "run an eval on this skill to check if a change reduces token usage").

## Step 1 — Resolve the bundled runner

The runner ships inside the installed superslow plugin. Resolve its path once per session and reuse it. Use `find` rather than a shell glob so the command behaves the same under bash and zsh (a bare glob with no match errors under zsh):

```bash
SUPERSLOW_RUNNER_ROOT="$(find ~/.claude/plugins/cache -maxdepth 6 -type d -path '*/superslow/*/skills/evaluating-skills/runner' 2>/dev/null | sort | tail -1)"
# Fallback for dev/marketplace installs:
[ -z "$SUPERSLOW_RUNNER_ROOT" ] && SUPERSLOW_RUNNER_ROOT="$(find ~/.claude/plugins/marketplaces -maxdepth 6 -type d -path '*/superslow/*/skills/evaluating-skills/runner' 2>/dev/null | sort | tail -1)"
echo "$SUPERSLOW_RUNNER_ROOT"
```

(`sort | tail -1` prefers the lexically-latest version directory when several are installed.)

If this is empty, the plugin isn't installed at the canonical path. Tell the user to clone the superslow repo and run from there (`bun run evals -- --skill <name> --mode <mode>`), or to reinstall the plugin.

## Step 2 — Check the prerequisite

```bash
bun --version
```

If `bun` is missing, the runner can't execute. Tell the user to install it: `curl -fsSL https://bun.sh/install | bash` (or `brew install bun`), then retry.

## Step 3 — Detect the skill folder

The user typically opens Claude Code inside their skill folder. Confirm it:

```bash
ls SKILL.md evals/evals.json 2>/dev/null
```

- No `SKILL.md`: ask the user for the path to their skill folder.
- No `evals/evals.json`: go to Step 5 to author one.

## Step 4 — Derive `--skill-dir` and `--skill`

`--skill-dir` is the **parent** directory that holds skill folders; `--skill` is the skill folder's name. If the current directory is the skill folder itself:

- `--skill` = the basename of the current directory (e.g. `mr-review`)
- `--skill-dir` = the parent directory

Confirm these with the user before running. Remember: every skill inside `--skill-dir` is staged as a sibling. If the user wants their skill evaluated in isolation, `--skill-dir` should contain only that one skill (the common case). If they want superslow skills available as siblings, they must copy or symlink them into `--skill-dir` first.

## Step 5 — Author `evals/evals.json` (only if missing)

Read the template at `${SUPERSLOW_RUNNER_ROOT}/../templates/evals.json.example` and walk the user through writing 2–3 realistic prompts, following the "Designing test cases" guidance in `../SKILL.md`. Save it to `<skill-folder>/evals/evals.json`. Don't write assertions yet — see the methodology.

## Step 6 — Gitignore the workspace

The runner writes artifacts to `<CWD>/skills-workspace/`. Keep it out of version control:

```bash
grep -qxF 'skills-workspace/' .gitignore 2>/dev/null || echo 'skills-workspace/' >> .gitignore
```

If the folder isn't a git repo, skip this and warn the user that artifacts will accumulate under `skills-workspace/`.

## Step 7 — Run the workspace build

Run from the skill folder (so `CWD` is the eval root and staging lands at `<CWD>/.claude/skills/`).

New-skill mode (with vs without):

```bash
bun run "$SUPERSLOW_RUNNER_ROOT/run.ts" --skill-dir <skill-dir> --skill <name> --mode new-skill
```

Revision mode (test a change to an existing skill):

```bash
bun run "$SUPERSLOW_RUNNER_ROOT/run.ts" snapshot --skill-dir <skill-dir> --skill <name> --label baseline
# ...edit the SKILL.md...
bun run "$SUPERSLOW_RUNNER_ROOT/run.ts" --skill-dir <skill-dir> --skill <name> --mode revision --baseline baseline
```

Add `--bootstrap <path>` if the user has authored a framing file they want prepended to every dispatch. Without it, dispatches carry only the auto-built staged-skills inventory.

## Step 8 — Drive the dispatches

Read `<CWD>/skills-workspace/<name>/iteration-<N>/dispatch.json`. For each task object:

1. Dispatch a fresh subagent via the **Task tool**, passing `dispatch_prompt` verbatim as the prompt and `agent_description` verbatim as the description. The description is namespaced with the iteration and a per-run nonce (`<eval_id>:<condition>:i<N>-<nonce>`) — pass it through unchanged; do not reconstruct it. Passing it verbatim is what lets transcript correlation work in Step 9 without cross-matching an agent from another iteration.
2. When the subagent returns, write the portable run record to `run_record_path` (with `tool_invocations: []`) and the timing record (`{ "total_tokens": <n>, "duration_ms": <n>}`) to `timing_path`. Capture tokens/duration from the task completion event — they may not be persisted elsewhere.

## Step 9 — Fill transcripts, grade, aggregate

Claude Code persists subagent transcripts under `~/.claude/projects/<project-slug>/<parent-session-id>/subagents/`. Find that directory for the current session, then:

```bash
bun run "$SUPERSLOW_RUNNER_ROOT/fill-transcripts.ts" --skill-dir <skill-dir> --skill <name> --iteration <N> \
  --subagents-dir ~/.claude/projects/<project-slug>/<parent-session-id>/subagents/

bun run "$SUPERSLOW_RUNNER_ROOT/grade.ts" --skill-dir <skill-dir> --skill <name> --iteration <N>
# Dispatch a fresh judge subagent for each emitted judge task, writing each response to the path the task specifies, then:
bun run "$SUPERSLOW_RUNNER_ROOT/grade.ts" --skill-dir <skill-dir> --skill <name> --iteration <N> --finalize

bun run "$SUPERSLOW_RUNNER_ROOT/aggregate.ts" --skill-dir <skill-dir> --skill <name> --iteration <N>
```

## Step 10 — Present results

Read `<CWD>/skills-workspace/<name>/iteration-<N>/benchmark.json`. Surface to the user:

- `run_summary` per condition (pass rate, tokens, duration)
- `delta` (what the skill/change costs and what it buys — for a token-reduction eval, focus on `delta.total_tokens` alongside `delta.pass_rate`)
- `validity_warnings` (read these before trusting the delta — a low skill-invocation rate means the result may not reflect the skill at all)
