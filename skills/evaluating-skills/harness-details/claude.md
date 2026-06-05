# Running an eval on a skill — Claude Code

This is the Claude Code-specific walkthrough for `evaluating-skills`. The runner contract (`--skill-dir`, `--skill`, `--bootstrap`, modes, what gets staged) is described in `../SKILL.md`; this file tells you exactly how to drive it inside Claude Code.

Use this when a user, working from their own skill folder, asks to run an eval (e.g. "run an eval on this skill to check if a change reduces token usage").

## Isolating from installed plugins

**Read this first if the skill you're evaluating shares a name with one an installed, enabled plugin provides** — e.g. evaluating a slow-powers skill with the slow-powers plugin installed, or any user evaluating their own plugin's skills.

Eval subagents are dispatched via the **Task tool**, so they run in-process and inherit *this session's* enabled plugins and global skills. The runner stages the skill-under-test under a unique slug (`slow-powers-eval-…`) — that avoids an on-disk collision and lets the `__skill_invoked` meta-check find the staged copy — but it does **not** stop the installed plugin's own `<plugin>:<name>` copy from also being discoverable. When both copies are reachable:

- the with-skill arm can invoke the staged slug *and then* reach for the installed copy (redundant/leaked invocation), and
- the `without_skill` arm is **not truly skill-absent** — the installed copy is still discoverable, contaminating the baseline and shrinking the measured delta.

Plugins load at **session start** and the runner can't unload them mid-session, so it only *detects and warns* (a build-time "plugin-shadow" banner, also surfaced in `benchmark.json`'s `validity_warnings`). To actually isolate, **launch the session you run the eval from** one of these ways — subagents inherit it:

1. **Drop user-scope plugins, keep auth:** `claude --setting-sources project,local`. User-scope `enabledPlugins` (where user-installed plugins are enabled) isn't loaded, so they don't appear. Auth is unaffected. (Also drops your other user-scope settings/MCP for that session.)
2. **Disable the specific plugin, then restart:** set `"enabledPlugins": { "<plugin>@<marketplace>": false }` in a settings source that loads at startup (project `.claude/settings.json` or user `~/.claude/settings.json`) and start a fresh session. *(The slow-powers repo ships this for `slow-powers@slowdini` and `superpowers@claude-plugins-official` in its own `.claude/settings.json`.)*
3. **Clean config dir (strips everything):** `CLAUDE_CONFIG_DIR="$(mktemp -d)" claude`. No installed plugins or global skills load at all. **Auth caveat:** your OAuth session lives in `~/.claude.json`, which a relocated config dir may not carry — set `ANTHROPIC_API_KEY` or re-authenticate once in the fresh dir.

All three keep the eval working: project-local staged skills live in `<cwd>/.claude/skills/` (project scope, independent of installed plugins), so they still load and the meta-check still resolves the slug. A clean config dir (option 3) additionally means the real SessionStart bootstrap hook doesn't fire, so the only session-start framing present is whatever you pass via `--bootstrap` — which removes the separate "even a 1% chance → you MUST invoke" mandate that otherwise pins invocation at 100%.

**Verify before you run:** the installed twin should be gone — `/plugin` shows it disabled, or the runner's build step prints no plugin-shadow banner.

## Step 1 — Resolve the bundled runner

The runner ships inside the installed slow-powers plugin. Resolve its path once per session and reuse it. Use `find` rather than a shell glob so the command behaves the same under bash and zsh (a bare glob with no match errors under zsh):

```bash
SLOW_POWERS_RUNNER_ROOT="$(find ~/.claude/plugins/cache -maxdepth 6 -type d -path '*/slow-powers/*/skills/evaluating-skills/runner' 2>/dev/null | sort | tail -1)"
# Fallback for dev/marketplace installs:
[ -z "$SLOW_POWERS_RUNNER_ROOT" ] && SLOW_POWERS_RUNNER_ROOT="$(find ~/.claude/plugins/marketplaces -maxdepth 6 -type d -path '*/slow-powers/*/skills/evaluating-skills/runner' 2>/dev/null | sort | tail -1)"
echo "$SLOW_POWERS_RUNNER_ROOT"
```

(`sort | tail -1` prefers the lexically-latest version directory when several are installed.)

If this is empty, the plugin isn't installed at the canonical path. Tell the user to clone the slow-powers repo and run from there (`bun run evals -- --skill <name> --mode <mode>`), or to reinstall the plugin.

## Step 2 — Check the prerequisite

```bash
bun --version
```

If `bun` is missing, the runner can't execute. Tell the user to install it: `curl -fsSL https://bun.sh/install | bash` (or `brew install bun`), then retry.

The runner depends on one package, `ajv` (runtime schema validation). `bun` auto-installs it on first run, so no manual step is normally needed. In an offline/airgapped environment where auto-install can't reach the registry, run `bun install` once (in the slow-powers repo, or wherever `package.json` lives) before the first eval.

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

Confirm these with the user before running. Remember: every skill inside `--skill-dir` is staged as a sibling. If the user wants their skill evaluated in isolation, `--skill-dir` should contain only that one skill (the common case). If they want slow-powers skills available as siblings, they must copy or symlink them into `--skill-dir` first.

## Step 5 — Author `evals/evals.json` (only if missing)

Read the template at `${SLOW_POWERS_RUNNER_ROOT}/../templates/evals.json.example` and walk the user through writing 2–3 realistic prompts, following the "Designing test cases" guidance in `../SKILL.md`. Save it to `<skill-folder>/evals/evals.json`. Don't write assertions yet — see the methodology.

## Step 6 — Gitignore the workspace

The runner writes artifacts to `<CWD>/skills-workspace/`. Keep it out of version control:

```bash
grep -qxF 'skills-workspace/' .gitignore 2>/dev/null || echo 'skills-workspace/' >> .gitignore
```

If the folder isn't a git repo, skip this and warn the user that artifacts will accumulate under `skills-workspace/`.

## Step 7 — Pre-flight confirmation & sandbox decision

This is a required gate (see *Pre-flight gate* in `../SKILL.md`). Do not run the build or dispatch anything until the user has confirmed.

1. Read `<skill-folder>/evals/evals.json` and assemble the run summary:
   - **Skill under test** — `<name>` and its path
   - **Mode** — `new-skill` or `revision` (+ baseline label)
   - **Eval cases** — count and a one-line list of the prompts
   - **Models** — the model you'll dispatch each subagent under test with (Step 9) and the judge model for `llm_judge` assertions (Step 10). State them explicitly; the runner can't observe them, so this is the user's chance to correct a wrong choice before tokens are spent.
   - **Cost** — `2 × <case count>` agent dispatches plus a judge dispatch per `llm_judge` assertion; flag it as time- and token-intensive.
   - **Sandbox** — you will arm `--guard` (the default on Claude Code).
2. Present the summary and **wait for explicit confirmation.** An earlier "run the eval" doesn't count — the summary may surface a wrong mode, model, or a guard the user didn't intend.
3. Default to `--guard`. Drop it **only** if the user actively opts out, and then warn them: without the guard, stray writes (e.g. worktrees a skill-under-test creates in this repo) are only *detected* post-hoc by `detect-stray-writes` in Step 10 — never blocked or reverted — and are theirs to clean up.

## Step 8 — Run the workspace build

Run from the skill folder (so `CWD` is the eval root and staging lands at `<CWD>/.claude/skills/`).

`--guard` is on in the commands below because it's the default posture (Step 7). It stages a `PreToolUse` hook into `.claude/settings.local.json` that *blocks* subagent writes/installs outside the eval sandbox (the workspace, the staged-skills dir, and `$TMPDIR`) while dispatches run. It denies out-of-bounds Write/Edit tool calls, and Bash that installs packages, mutates git (including **`git worktree add`**), redirects to a file, or creates paths under `.claude` / a bare `skills/`. The hook is gated by a marker that auto-expires after 6h and is torn down at the start of the next run; to remove just the guard immediately (e.g. mid-run), run `bun run "$SLOW_POWERS_RUNNER_ROOT/run.ts" teardown-guard --skill-dir <skill-dir> --skill <name>` (or `bun run evals:teardown-guard` in the slow-powers repo). The full end-of-run teardown — guard **and** staged skill set — is Step 12.

While armed, the hook fires on **your** tool calls too, not just subagents' — so hand-authoring files under the skill's own folder (e.g. `skills/<name>/evals/NOTES.md`) with Write/Edit is denied until you disarm it. Run `teardown-guard` (or the full Step 12 teardown) before any post-run hand-authoring; Bash-driven runner commands like `promote-baseline` are unaffected.

New-skill mode (with vs without):

```bash
bun run "$SLOW_POWERS_RUNNER_ROOT/run.ts" --skill-dir <skill-dir> --skill <name> --mode new-skill --guard
```

Revision mode (test a change to an existing skill). The usual order is edit-first — the
skill is already changed when the user asks to eval — so snapshot the *old* version
straight from git with `--ref`, which reads the object database without touching the
working tree:

```bash
# ...the edited SKILL.md is already in the working tree...
bun run "$SLOW_POWERS_RUNNER_ROOT/run.ts" snapshot --skill-dir <skill-dir> --skill <name> --label baseline --ref HEAD
bun run "$SLOW_POWERS_RUNNER_ROOT/run.ts" --skill-dir <skill-dir> --skill <name> --mode revision --baseline baseline --guard
```

`--ref` takes any commit/tag/branch. If instead you snapshot *before* editing, drop
`--ref HEAD` (the snapshot then reads the working tree) and run it ahead of the edit.

Add `--stage-name <name>` to stage the skill-under-test under a verbatim name instead of the conspicuous `slow-powers-eval-…` slug (built for the issue #144 name-confound experiments: A/B a natural name against the eval slug). It applies only when exactly one condition stages the skill (e.g. `--mode new-skill`) — the runner rejects it in revision mode, where both conditions stage — and refuses to clobber an existing dir of that name. The custom dir is registered for cleanup at the next run.

Add `--bootstrap <path>` if the user has authored a framing file they want prepended to every dispatch. Without it, dispatches carry only the auto-built available-skills block (rendered the way Claude Code surfaces discoverable skills, so the dispatch reads like a real session).

For a **plan-mode-relevant skill** (e.g. `hardening-plans`), add `--plan-mode` to inject Claude Code's verbatim plan-mode procedure as a `<system-reminder>` operating-context layer in every dispatch — the highest-fidelity in-runner approximation of a real plan mode (issue #142). Use it as the verbatim-procedure arm of an A/B against a plain paraphrase-seed run (no flag) to measure whether `with_skill` invocation de-saturates. It is still text the agent reads, not an injected mode, so treat any de-saturation as a stronger-than-cold signal, not ground truth (see *Seeding conversation context (and its ceiling)* in `../SKILL.md`).

**The live ExitPlanMode → hardening-plans hook is not exercised here.** The shipped Claude plugin gates plan hand-off with a `PreToolUse` hook on `ExitPlanMode` (`hooks/exit-plan-mode`) that denies the first plan-exit and steers the agent through `hardening-plans` before the plan is presented. The runner only *simulates* plan mode as injected `<system-reminder>` text and dispatches single agent turns — it never emits a real `ExitPlanMode` tool call nor runs `PreToolUse` hooks, so that gate is structurally outside what the eval harness can exercise. This is the standing reason a `hardening-plans` invocation-rate delta *from the hook* can't be exhibited in-runner, independent of the #119 invocation-hint gate and the plan-mode-simulation ceiling.

Only when the user has opted out of the guard, drop `--guard` from the command above and rely on the post-hoc `detect-stray-writes` step in Step 10 instead — it reports stray writes but does not clean them up.

## Step 9 — Drive the dispatches

Read `<CWD>/skills-workspace/<name>/iteration-<N>/dispatch.json`. For each task object:

1. Dispatch a fresh subagent via the **Task tool** with the prompt `Read the file at <dispatch_prompt_path> and follow its instructions exactly.` (substituting the task's `dispatch_prompt_path`), and pass `agent_description` verbatim as the description. The full prompt lives in that file rather than inline in `dispatch.json`, so you never reproduce ~KB of text per dispatch. The description is namespaced with the iteration and a per-run nonce (`<eval_id>:<condition>:i<N>-<nonce>`) — pass it through unchanged; do not reconstruct it. Passing it verbatim is what lets transcript correlation work in Step 10 without cross-matching an agent from another iteration.
2. That's it — you do **not** write `run.json` or `timing.json` yourself. The subagent writes its own `outputs/final-message.md` (the dispatch prompt instructs it to), and `record-runs` in Step 10 assembles both records from disk. Optional, higher-fidelity timing: if you want billing-grade numbers, write `{ "total_tokens": <n>, "duration_ms": <n>, "source": "completion-event" }` from the Task tool's completion event to `timing_path` right after each dispatch — `record-runs` never overwrites an existing `timing.json`, so completion-event numbers always win over its transcript-derived backfill (which includes cache accounting — a different metric).

## Step 10 — Ingest, judge, finalize

Claude Code persists subagent transcripts under `~/.claude/projects/<project-slug>/<parent-session-id>/subagents/`. Find that directory for the current session, then run the post-dispatch chain as one command:

```bash
# record-runs → fill-transcripts → detect-stray-writes → grade, in fixed order.
# Assembles run.json + timing.json for every task from dispatch.json,
# outputs/final-message.md, and the persisted transcripts; existing records are
# never clobbered. Stops on the first failure (re-running after a fix is safe —
# every sub-step skips work that's already done).
bun run "$SLOW_POWERS_RUNNER_ROOT/run.ts" ingest --skill-dir <skill-dir> --skill <name> --iteration <N> \
  --subagents-dir ~/.claude/projects/<project-slug>/<parent-session-id>/subagents/

# Dispatch a fresh judge subagent for each judge task ingest listed — prompt it
# with `Read the file at <dispatch_prompt_path> and follow its instructions
# exactly.` (the prompt tells the judge where to write its response). Then:
bun run "$SLOW_POWERS_RUNNER_ROOT/run.ts" finalize --skill-dir <skill-dir> --skill <name> --iteration <N>
```

`finalize` runs `grade --finalize` then `aggregate` and prints the benchmark. With Step 9's dispatches, the whole loop is three runner calls around the two dispatch batches: build (Step 8) → dispatch agents → `ingest` → dispatch judges → `finalize`.

Besides out-of-bounds writes, `detect-stray-writes` also flags **live-source reads**: any arm whose subagent read the live `skills/<name>/` source instead of its staged copy. That usually means the Skill tool couldn't resolve the staged slug yet (skills staged mid-session race against the registry, which is built at session start) and the agent improvised — fatal in revision mode, where the old_skill arm then sees new-skill content. The findings land in `stray-writes.json` and surface as `validity_warnings` in `benchmark.json`; treat a flagged cell's arm as contaminated.

The chained steps remain independently callable for inspection or recovery — `record-runs.ts`, `fill-transcripts.ts`, `detect-stray-writes.ts`, `grade.ts` (`--finalize`), `aggregate.ts`, each taking the same `--skill-dir`/`--skill`/`--iteration` flags (plus `--subagents-dir` for the two transcript readers). `record-runs` subsumes `fill-transcripts` for runner-built iterations — it writes `tool_invocations` as part of assembling each record; `fill-transcripts` remains the tool for a pre-existing `run.json` that `record-runs` won't touch (hand-authored, or written by the agent at dispatch time) whose `tool_invocations` you want populated after the fact.

## Step 11 — Present results

Read `<CWD>/skills-workspace/<name>/iteration-<N>/benchmark.json`. Surface to the user:

- `run_summary` per condition (pass rate, tokens, duration)
- `delta` (what the skill/change costs and what it buys — for a token-reduction eval, focus on `delta.total_tokens` alongside `delta.pass_rate`)
- `validity_warnings` (read these before trusting the delta — a low skill-invocation rate means the result may not reflect the skill at all)

## Step 12 — Tear down

A run stages the full skill set into `<CWD>/.claude/skills/` (project-scope, required for discovery) and — under `--guard` — a `PreToolUse` hook in `.claude/settings.local.json`. These persist after dispatch, so the run isn't complete until you remove them. This is the normal end of every run, not an optional cleanup:

```bash
bun run "$SLOW_POWERS_RUNNER_ROOT/run.ts" teardown --skill-dir <skill-dir> --skill <name>
# or, in the slow-powers repo:
bun run evals:teardown --skill <name>
```

`teardown` disarms the guard, removes the staged skill set, **and** reclaims the skill's `skills-workspace/` artifacts. When the runner created `<CWD>/.claude/skills/` for this run it removes the whole tree (and prunes a `.claude` it emptied); a `.claude/skills` that pre-existed (your own project skills) keeps its contents, and `.claude/settings.json` is never touched.

Workspace reclamation is conservative — a completed run leaves behind nothing that wasn't meant to be committed, but it never destroys results you haven't moved into version control:

- **Iterations** whose results are committed are removed. Teardown keys off the `.promoted.json` marker `promote-baseline` writes into the iteration. An iteration that still holds uncommitted results (a `benchmark.json`, run record, or grading with no marker — e.g. a graded run you never promoted) is **kept**, and teardown warns you, naming it and the `evals:promote-baseline` command to commit it (or delete `skills-workspace/<name>/` manually to discard). Iterations holding only reproducible scaffolding (a `--dry-run`, or a run staged but never dispatched) are removed.
- **Snapshots** materialized from a git ref (`snapshot --ref`) are removed — they regenerate on demand. Working-tree snapshots (no `--ref`), which can't be regenerated, are kept.

If you ran with a custom `--workspace-dir`, pass the same value to `teardown` so it reclaims the right tree.
