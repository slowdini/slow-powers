---
name: evaluating-skills
description: Use when testing whether a new skill improves agent behavior, or when validating a change to an existing skill's language.
---

# Evaluating Skills

## Overview

Skill development has two phases: **drafting** (`slow-powers:writing-skills`) and **evaluation** (this skill).

An eval is a structured measurement of whether a skill actually shifts behavior. Each test case is a realistic prompt; each run dispatches a fresh general-purpose subagent twice — once with the skill loaded, once without (or once with the prior version, once with the revised version) — and grades the outputs against assertions. Pass-rate deltas tell you whether the skill is worth shipping or the change is worth landing.

This skill is harness-agnostic. Run records use a portable JSON schema so evals authored on one harness (Claude Code, Codex, OpenCode) can be executed and graded on any other. See `schema/run-record.schema.json`.

## Two comparison modes

### Mode A — New skill comparison

Compares `with_skill/` vs `without_skill/`. Use when validating a brand-new skill actually beats baseline behavior with no skill loaded. This is the agentskills.io default.

### Mode B — Revision comparison

Compares `old_skill/` vs `new_skill/`. **This is the common case.** Use when testing a language change to an existing skill — snapshot the old SKILL.md as a baseline, then run both variants against the same prompts.

Mode B workflow (edit-first — the usual order):
1. Edit the skill (the new version is now in the working tree)
2. Snapshot the old version straight from git: `snapshot --label <tag> --ref HEAD` (any commit/tag/branch works; `--ref` reads git without touching the working tree)
3. Run the eval with `--mode revision --baseline <snapshot-label>`
4. Grade and aggregate; review the delta

If you snapshot *before* editing, omit `--ref` in step 2 (it reads the working tree) and do it ahead of step 1.

A negative or zero delta is a signal to revert the change — the new language did not improve behavior.

## Running an eval on a skill

The eval runner ships with this skill (under `runner/`), so you can evaluate any skill — including your own personal skills — not just the ones in this repo. The detailed steps depend on your harness:

- **Claude Code:** follow `harness-details/claude.md` end-to-end (resolving the bundled runner, dispatching subagents via the Task tool, locating transcripts, grading).
- **Other harnesses:** there's no detailed guide yet. The portable run-record schema (`schema/run-record.schema.json`) and the runner contract below still apply; you'll need to (a) locate the installed slow-powers plugin on disk, (b) dispatch subagents with your harness's primitive, and (c) supply a transcript adapter under `runner/adapters/` against the portable format if you want `transcript_check` assertions to grade. Otherwise author `run.json` and `timing.json` by hand per the schemas in `schema/`.

### The runner contract (all harnesses)

The runner takes two required flags:

- `--skill-dir <path>` — a directory containing one or more skill folders. **This directory is the eval's test environment.** Every skill in it is staged for the subagent: the skill-under-test under a unique slug, every *other* skill under its natural name.
- `--skill <name>` — which subdirectory of `--skill-dir` to evaluate.

Optional flags: `--bootstrap <path>` (see *Bootstrap content* below), `--workspace-dir <path>` (defaults to `<cwd>/skills-workspace`), `--mode new-skill|revision`, `--baseline <label>`, `--only <id,...>` / `--skip <id,...>` (run only / all-but the named eval ids — for cost-conscious reduced-set runs without editing `evals.json`; mutually exclusive, errors on an unknown id), `--harness`, `--no-stage`, `--dry-run`, `--guard` (Claude Code only — arm the write guard; see *Sandboxing eval subagents*), `--plan-mode` (Claude Code only — inject the harness's verbatim plan-mode procedure as an operating-context layer; opt-in, for plan-mode-relevant skills only; see *Seeding conversation context (and its ceiling)*).

Each iteration lands under `<workspace-dir>/<skill>/iteration-N/` with the same tree described in *Workspace layout* below, plus a machine-readable `dispatch.json` and a human-readable `dispatch-manifest.md`. The end product is `benchmark.json`: read its `run_summary`, `delta`, and `validity_warnings`.

#### What gets staged

The runner stages every skill it finds under `--skill-dir`. The skill-under-test goes under a unique slug for the `__skill_invoked` meta-check; sibling skills stage under their natural names so cross-references resolve. **If your `--skill-dir` contains only your one skill, the eval runs in isolation** — references like "REQUIRED SUB-SKILL: `slow-powers:test-driven-development`" won't resolve, and your assertions must not depend on a sibling skill firing. To include other skills as siblings, copy or symlink them into `--skill-dir` before running.

#### Bootstrap content

Every dispatch prompt includes an available-skills block listing the skills staged for this eval (auto-built by the runner), rendered in the harness's native presentation so the dispatch reads like a real session rather than an eval. If you also want product-specific framing prepended — instruction priority rules, planning guidelines, anything you'd put in a SessionStart hook — author a Markdown file and pass it via `--bootstrap <path>`. The runner emits the file verbatim inside a `<session-start-context>` block, before the available-skills block. Omit `--bootstrap` and the dispatch carries only the available-skills block, nothing else.

## Designing test cases

A test case has three parts:

- **prompt**: a realistic user message — the kind a real user would actually type
- **expected_output**: a human-readable description of success
- **files** (optional): fixture files the prompt references
- **skill_should_trigger** (optional, default `true`): set `false` for a *negative* eval where correct behavior is the skill **not** firing (e.g. an over-trigger guard — a feature request that shouldn't launch a debugging investigation). Negative evals are excluded from the skill-invocation rate and its validity warning, so a correct non-invocation isn't mistaken for the skill failing to fire.

Stored in `<skill>/evals/evals.json`. See `templates/evals.json.example` and `examples/verifying-development-work-evals.json`.

Tips for writing good prompts:

- **Start with 2–3 test cases.** Don't over-invest before iteration 1.
- **Vary phrasing.** Mix casual ("hey can you check this") with precise ("Run `bun test`, quote the output").
- **Cover edge cases.** Include at least one boundary condition, malformed input, or ambiguous instruction.
- **Use realistic context.** Real users reference file paths, function names, personal context. "Process this data" is too vague to test anything useful.
- **For discipline-enforcing skills**, see `pressure-scenarios.md` for the pressure-scenario taxonomy (time pressure, sunk cost, authority, exhaustion, etc.).

**Don't write assertions yet.** You don't know what "good" looks like until you see what the first run produces.

### Testing by skill type

What "stresses the skill" depends on what kind of skill it is. The four types from `slow-powers:writing-skills` each need a different style of prompt:

- **Discipline-enforcing skills** (TDD, verifying-development-work). Test with pressure — academic prompts ("explain how TDD works") will pass without measuring anything useful. Combine multiple pressures (time + sunk cost + authority + exhaustion) and force a choice. See `pressure-scenarios.md` for the taxonomy. The wild failure for these skills is almost always *mid-session* — the agent is already committed to a skill-free approach when the trigger arrives — so a cold prompt under-measures them; pair each cold case with a **seeded** one (see *Seeding conversation context* below). Success = the rule holds under maximum pressure.
- **Technique skills** (condition-based-waiting, root-cause-tracing). Test application: hand the agent a new scenario where the technique applies and check it gets used correctly. Include at least one edge-case variation. Success = the technique transfers to a situation the skill didn't explicitly describe.
- **Pattern skills** (flatten-with-flags, information-hiding). Test recognition: include prompts where the pattern applies and prompts where it doesn't. Success = the agent applies the pattern when warranted and refrains when it isn't.
- **Reference skills** (API docs, syntax guides). Test retrieval: ask questions whose answers are in the reference, including a few that hit gaps you suspect. Success = the agent finds the right section and uses it correctly.

### Seeding conversation context (and its ceiling)

A cold prompt measures trigger-recognition *in isolation*. The harder, more realistic failure is trigger-recognition *under a competing attractor* — an agent already mid-session, committed to a skill-free approach, where loading the skill reads as redundant. Approximate that by **seeding**: embed prior `User:` / `Assistant:` turns directly in the `prompt` string (it is wrapped verbatim as the user request, so a multi-line transcript needs no schema change). Seed an `Assistant:` turn that has already produced work in a native, skill-free style, then a final `User:` turn carrying the real request. A seed can reproduce prior commitment / in-flight momentum, redundancy framing, sunk cost, and — usefully — a prior plan that *name-drops* a skill (e.g. a parenthetical "TDD — tests first") without actually following it, so you can test whether the agent makes the discipline load-bearing or treats the label as compliance. For a worked example, see the seeded cases in `hardening-plans/evals/`.

**When to seed.** Seed when the skill's real-world failure happens *mid-session under a competing attractor* — prior commitment to a skill-free approach, redundancy framing ("I'm already doing this"), sunk cost, exhaustion, or an in-flight workflow/mode that makes loading the skill feel like ceremony. A cold prompt is enough when all you need to know is whether the *description* triggers from a clean start. Discipline-enforcing skills almost always warrant at least one seeded case kept alongside a cold contrast case (the cold one isolates the description; the seeded one stresses the trigger under momentum). Technique, pattern, and reference skills usually don't need seeding unless their failure, too, is specifically a mid-session one.

Reusable seed scaffold — adapt the turns to your skill's attractor:

```
[The following is the conversation so far in this session. You are the
assistant; continue from the final user turn.]

User: <the original request that kicked off the work>

Assistant: <work already produced in a native, skill-free style — the
approach the skill is supposed to correct, optionally name-dropping the
skill's discipline as a label without following it>

User: <the turn that should trigger the skill — phrased so loading it now
reads as redundant or as duplicated effort>
```

Keep the seeded turns short and concrete; the point is to establish momentum, not to write a full session.

**The ceiling — state it plainly.** A seed is *text the subagent reads*, not a state it operates under. It cannot place the agent in a harness-injected mode — a real plan mode, an enforced multi-phase workflow, genuine context-window pressure — it can only *describe* one. So when the wild failure you're chasing was *caused* by such a mode (the documented case: an agent in plan mode that invoked **zero** skills because the mode's own procedure made loading them feel redundant), a text seed cannot fully reproduce it — the causal layer is exactly the one a prompt string can't inject. A seeded **pass is therefore necessary but not sufficient** — it under-estimates real-session difficulty — and a seed that *fails* to reproduce a known wild failure is usually hitting this ceiling, not testing a bad seed. Treat seeded results as a stronger-than-cold signal, not as ground truth, and don't let downstream work over-trust them. Faithfully reproducing a mode-caused failure needs a real harness mode the runner can't inject today — track that as a parity goal.

**Narrowing the gap — `--plan-mode`.** For the documented plan-mode case, the runner offers the highest-fidelity in-runner approximation: `--plan-mode` injects the harness's *verbatim* plan-mode procedure (its rigid multi-phase terminal rail) into every dispatch as an operating-context layer the subagent is told it is operating under — a `<system-reminder>` block after the session-start surfaces — rather than a paraphrase the agent merely reads in the seed prose. The profile is a per-harness asset (`runner/profiles/<harness>/plan-mode.md`); it is opt-in and meant only for plan-mode-relevant skills (a harness without a profile errors, leaving the portable contract unchanged). This narrows the gap (verbatim procedure > paraphrase) but does **not** close it: it is still text the agent reads, not an injected mode, so the necessary-not-sufficient ceiling above stands unchanged. Use it as the strongest in-runner signal and pair it with a paraphrase-seed arm to measure whether removing the invoke-hint lets `with_skill` invocation de-saturate.

## Pre-flight gate (required)

An eval run is not free. Each test case dispatches a fresh subagent **per condition** — an N-case suite is `2N` full agent sessions, plus a judge dispatch for every `llm_judge` assertion. That is real wall-clock time and real tokens, and a subagent under test can write outside its sandbox and pollute the real workspace. **Never kick off a run silently.**

Before building the workspace and dispatching anything, STOP and present the user a run summary, then wait for explicit confirmation:

- **Skill under test** — name and path
- **Mode** — `new-skill` (with vs without) or `revision` (old vs new), plus the baseline label for revision mode
- **Eval cases** — the count and a one-line list of the prompts (from `evals.json`)
- **Models** — the model that will run each subagent under test, and the judge model for `llm_judge` assertions. The runner never dispatches these itself, so it can't observe them — state them explicitly so the user can correct a wrong choice before tokens are spent.
- **Cost** — `2N` agent dispatches plus judge dispatches; call out that this is time- and token-intensive
- **Sandbox** — the guard status (see below)

Do not dispatch until the user confirms *this summary*. An earlier "run the eval" is not confirmation — the summary may reveal a wrong mode, the wrong model, or a missing guard the user never intended.

### Sandbox decision

A subagent under test runs the real skill, and some skills write to disk — the skill that triggered this gate, `working-in-isolation`, creates git worktrees in whatever repo it's pointed at. Without active enforcement those writes land in your working directory.

- **Guard available (Claude Code):** arming `--guard` is the default. If you are about to run without it, STOP. Proceed unguarded **only** when the user actively opts out — and warn them that stray writes will then only be **detected after the fact** by `detect-stray-writes`, never blocked or reverted, so anything a subagent writes outside its `outputs/` dir (worktrees, installed packages, edited repo files) persists and is theirs to clean up.
- **Guard unavailable (other harnesses):** there is no active write enforcement. Tell the user plainly: stray writes are detected and reported by `detect-stray-writes` but **not auto-cleaned** — they must review the report and remove anything that escaped. Harness-level write enforcement is tracked as a parity goal in `harness-parity-check.md`.

## Red Flags — STOP before dispatching

- About to dispatch subagents without showing the user the run summary first
- Running on a guard-capable harness without `--guard` and without an explicit opt-out from the user
- "The user already said run it" — they said it before seeing the cost, models, and guard status
- Spending tokens to "just see what happens" before the cases, mode, or models are confirmed

All of these mean: STOP. Present the pre-flight summary and wait for confirmation.

## Running evals

For each test case, dispatch fresh general-purpose subagents — one per condition. Each subagent receives:

- The prompt verbatim
- Any fixture files
- The output directory path
- (Conditionally) the path to the SKILL.md to load

Subagents MUST start with clean context. State leaking from previous runs invalidates the comparison.

Each run needs a portable **run record** (`run.json`, matching `schema/run-record.schema.json`) and a timing record (`timing.json`) holding:

- `total_tokens` and `duration_ms`
- The final user-facing message
- The tool invocations (best effort — see "Transcript access" below)

On a harness with persisted transcripts (Claude Code), `record-runs` assembles both records from disk after the dispatches — nothing is captured by hand. On a transcript-less harness, capture them manually when each subagent completes: tokens/duration come from the harness's task completion event (**these may not be persisted anywhere else; save them immediately**), and the record is written via that harness's adapter or by hand.

### Driving the eval loop

The agent itself drives the entire loop from inside a normal agent session:

1. The agent invokes the runner via Bash to build the workspace (same command as above).
2. The agent reads the generated `dispatch.json` (machine-readable sibling of the manifest). Each task object points at a `dispatch_prompt_path` (a file holding the full prompt), an `agent_description` to pass through as the dispatch description, and exact `run_record_path` and `timing_path` to write to. The prompt lives in a file rather than inline in `dispatch.json` so the agent never has to reproduce kilobytes of prompt text per dispatch. The `agent_description` is namespaced with the iteration and a per-run nonce (`<eval_id>:<condition>:i<N>-<nonce>`) so transcripts from different iterations sharing one session's subagents dir can't collide — **pass it verbatim; do not reconstruct it from the eval id and condition.**
3. For each task, the agent dispatches a fresh subagent using its host's primitive, instructing it to read the file at `dispatch_prompt_path` and follow it exactly, and passing `agent_description` verbatim as the dispatch `description`. Passing the description through unchanged is what lets the transcript adapter correlate transcripts to runs in step 4.
4. (Claude Code) After all dispatches return, the agent runs `bun run evals:record-runs` once — it assembles every task's `run.json` (carry-over fields from `dispatch.json`, `final_message` from the subagent's own `outputs/final-message.md`, `tool_invocations` from the persisted transcript) and backfills `timing.json` with transcript-derived tokens/duration (`"source": "transcript"`). It never clobbers a record that already exists.
5. (Other harnesses) When each subagent returns, the agent writes the portable run record to `run_record_path` and the timing record to `timing_path` by hand; without a transcript adapter, `tool_invocations` stays `[]` and `transcript_check` assertions grade as unverifiable.
6. (Optional, where transcripts were filled) The agent runs `bun run evals:detect-stray-writes --skill <name> --iteration <N>` to flag any subagent writes or installs that landed outside the run's `outputs/` dir. See *Sandboxing eval subagents* below.
7. The agent runs the grader (Bash) and then dispatches judge subagents for any `llm_judge` assertions — same pattern: read a tasks file, dispatch, write results back to a path.
8. The agent runs the aggregator.

Agent-driven mode is the common case because the framework is most useful from inside the harness where the skill is being iterated. Use it when you want a single in-session "run the eval and report the delta" flow.

### Transcript access

`transcript_check` assertions match regex patterns against a run's `tool_invocations`. Filling that list depends on what the harness exposes:

- **Claude Code:** subagent transcripts are persisted to `~/.claude/projects/<project-slug>/<parent-session-id>/subagents/agent-<id>.jsonl`, with a sibling `.meta.json` recording the dispatch description. The runner emits a unique `agent_description` (`<eval_id>:<condition>:i<N>-<nonce>`) field on each task; pass that string verbatim as the Agent tool's `description` when dispatching. The nonce namespaces the description per run, so `fill-transcripts` reads each task's `agent_description` straight from `dispatch.json` and can't cross-match a colliding agent from another iteration. After all dispatches complete, run `bun run evals:fill-transcripts --skill <name> --iteration <N> --subagents-dir <path>` to populate `tool_invocations` on every run record via the adapter at `runner/adapters/claude-code-transcript.ts`.
- **Other harnesses (no transcript access):** the agent records only `final_message`; `tool_invocations` stays empty and `transcript_check` assertions grade as `unverifiable`. Lean on `llm_judge` for substantive checks. This is an honest limitation, not a bug.
- **Operator-driven mode on Claude Code:** the operator can run `evals:fill-transcripts` after the fact, since they have filesystem access to the persisted transcripts.

Design your assertions accordingly. For maximally portable evals, lean on `llm_judge` for the substantive checks and use `transcript_check` for cheap mechanical signals where the adapter is available.

## Sandboxing eval subagents

The dispatch prompt tells each subagent to write only inside its `outputs/` dir, but nothing in the portable contract *enforces* that — a misbehaving subagent can edit the real repo or run `npm install` against the repo root, silently corrupting the very runner it's being measured by. Two layers guard against this:

- **Detection (all harnesses).** After `fill-transcripts` populates `tool_invocations`, run `bun run evals:detect-stray-writes --skill <name> --iteration <N>`. It reads each task's `outputs_dir` from `dispatch.json` and scans the invocations for **violations** (`Write`/`Edit`/`MultiEdit`/`NotebookEdit` whose path resolves outside the run's `outputs/`) and **warnings** (Bash commands matching install/`git`/`sed -i`/redirection patterns that don't reference `outputs/`). Findings land in `stray-writes.json`; the aggregator turns each run with violations into a `validity_warnings` entry, so a tainted data point is flagged the same way a missed skill invocation is. This is portable because it works off the same transcripts the adapters already parse — but it only *reports*, after the fact; it never reverts what a subagent wrote.
- **Hard guard (Claude Code, default posture).** `--guard` stages a `PreToolUse` hook that actively *blocks* out-of-bounds writes and installs while the subagents run — including `git worktree add` and Bash that creates files under `.claude` or a bare `skills/`. On Claude Code it is the default — the *Pre-flight gate* requires you to arm it unless the user explicitly opts out. It's Claude-Code-specific; see `harness-details/claude.md`. Harness-level write enforcement is tracked as a parity goal in `harness-parity-check.md`.

A run ends with teardown (`bun run evals:teardown --skill <name>`, or the `teardown` runner command): it disarms the guard, removes the staged skill set the runner created under `<cwd>/.claude/skills/`, **and** reclaims the skill's `skills-workspace/` artifacts, so a completed run leaves nothing behind that wasn't meant to be committed. Pre-existing project skills and `.claude/settings.json` are left intact. Teardown only deletes what's safe: iterations whose results are committed (it keys off the `.promoted.json` marker `promote-baseline` drops) and snapshots reproducible from a git ref. Iterations with results you haven't promoted, and working-tree snapshots, are **preserved** with a warning telling you to promote or discard them. Pass the same `--workspace-dir` you ran with if you used a custom one.

## Workspace layout

Per skill being evaluated:

```
<skill>-workspace/                       # outside the skill directory
  snapshots/                             # Mode B baselines, persist across iterations
    <label>/SKILL.md
  iteration-N/
    eval-<id>/
      <condition-a>/                     # e.g. with_skill, old_skill
        outputs/                         # files the subagent produced
        run.json                         # portable run record
        timing.json                      # tokens + duration
        grading.json                     # assertion results
      <condition-b>/                     # e.g. without_skill, new_skill
        outputs/
        run.json
        timing.json
        grading.json
    conditions.json                      # what each condition is, which SKILL.md it loaded
    benchmark.json                       # aggregate stats
    skill-snapshot.md                    # frozen SKILL.md at run time
```

The only file you author by hand is `<skill>/evals/evals.json`. Everything in the workspace tree is produced by the runner or by grading.

## Writing assertions

After iteration 1, you've seen what the outputs look like. Now write **assertions**: verifiable statements about correctness. Add them to `evals.json` and re-grade existing outputs without re-dispatching.

Two assertion types:

### `transcript_check` — mechanical

Match patterns in tool invocations. Fast, deterministic, cheap. Use for "did the agent run X" or "did file Y get written."

```json
{
  "id": "ran_test_command",
  "type": "transcript_check",
  "check": "tool_invocation_matches",
  "pattern": "bun (test|run test)"
}
```

### `llm_judge` — judged

Soft criteria a model evaluates. Use for "did the response quote actual evidence" or "did the agent refuse to claim success without proof."

```json
{
  "id": "quoted_test_output",
  "type": "llm_judge",
  "rubric": "Did the final message include actual test runner output (e.g., '1 pass', checkmarks, file:line indicators), or did it just say 'tests pass' without quoting evidence?"
}
```

`model` is an optional override. By default, use whatever model the harness operator has configured for judge dispatches.

### Principles

- **PASS requires concrete evidence.** "Includes a summary" + a one-liner labeled "Summary" = FAIL. The label is there but the substance isn't.
- **Specific and observable.** "The output is good" is too vague. "Both axes are labeled" is gradable.
- **Not too brittle.** "Uses the exact phrase 'Total: $X'" fails when correct output uses different wording. Reserve mechanical exactness for actually-mechanical things.
- **Review the assertions while grading.** Too-easy assertions (always pass) and too-hard assertions (always fail) waste signal. Fix them before the next iteration.

## Skill-invocation meta-check

Every run with a skill loaded gets an automatic meta-assertion: **did the skill actually influence behavior, or would the response look identical without it?**

The framework injects this check (reserved id `__skill_invoked`) for every condition whose `skill_path` is non-null — **except** evals marked `skill_should_trigger: false`, where the skill is *supposed* not to fire and a non-invocation is the correct outcome. It does **not** count toward the substantive `pass_rate`; results land in `grading.json` under `meta_results` and `meta_summary`, and the benchmark surfaces an `invocation_rate` per condition.

Why this matters: a run where the skill wasn't actually invoked is a non-data-point. If `with_skill` scores poorly but the meta-check shows the skill wasn't applied, that's not evidence the skill is bad — it's evidence the prompt didn't trigger the skill's applicability. Conversely, a clean invocation rate validates that substantive pass-rate deltas reflect skill effectiveness.

The check has two tiers, chosen automatically per run:

- **Code-based (Claude Code).** On harnesses that persist subagent transcripts with discrete `Skill` tool calls, the framework parses the transcript and checks for a `Skill` invocation whose `input.skill` matches the eval-staged slug. This is deterministic, free, and cannot be fooled by superficial vocabulary in the response.
- **LLM-judge fallback (other harnesses).** Where transcripts aren't available or the harness injects skills via system-prompt hooks rather than a tool call (Codex, OpenCode), a judge subagent compares the agent's `final_message` against the SKILL.md content embedded in the run record, looking for behavioral fingerprints — distinctive vocabulary, named sections, procedural steps that mirror the skill's phrasing. It does **not** require the agent to explicitly cite the skill (that would taint the eval).

To enable the code-based check on Claude Code, the runner stages each condition's SKILL.md snapshot at `<repoRoot>/.claude/skills/slow-powers-eval-<iteration>-<condition>__<skillName>/SKILL.md`. The unique slug prevents collisions with already-installed production skills (relevant when evaluating skills in a repo where the same skills are also installed) and is what the code-based check looks for in the transcript. The slug prevents an on-disk *collision*, not runtime *discovery*: if the same skill is also provided by an installed, **enabled** plugin, the subagent can still discover and invoke that copy — contaminating both arms (the control arm is no longer skill-absent). On Claude Code the runner flags this at build time (a "plugin-shadow" warning, also surfaced in `benchmark.json`'s `validity_warnings`), but cannot unload a live plugin; to remove the installed copy, run the eval from a plugin-isolated session — see `harness-details/claude.md` → *Isolating from installed plugins*. The dispatch prompt deliberately omits any inline `<skill>...</skill>` block so the subagent must discover and invoke the staged skill naturally — this measures whether the skill's `description:` actually triggers it. Stale staged skills are swept at the start of each fresh run. Pass `--no-stage` to opt out (e.g., when running the same eval against a harness that doesn't support project-local skill discovery); the runner will fall back to inlining the SKILL.md text in the dispatch prompt, and the LLM-judge meta-check will be used.

The aggregator emits a `validity_warnings` array when any with-skill condition has an invocation rate below 100%. Read those before interpreting the substantive delta. The rate is computed only over evals where the skill *should* fire; negative evals (`skill_should_trigger: false`) are excluded so a correct non-trigger never depresses the rate or raises a spurious warning.

## Grading

For each `(eval × condition)`, produce `grading.json`:

```json
{
  "assertion_results": [
    { "id": "ran_test_command", "passed": true, "evidence": "Bash invocation at ordinal 4: 'bun test'", "confidence": 1.0 },
    { "id": "quoted_test_output", "passed": false, "evidence": "Final message says 'tests pass' but does not include any test runner output.", "confidence": 0.9 }
  ],
  "summary": { "passed": 1, "failed": 1, "total": 2, "pass_rate": 0.5 }
}
```

`transcript_check` results come from a script. `llm_judge` results come from dispatching a fresh judge subagent with the rubric + run record + outputs — see `templates/judge-prompt.md`.

## Aggregating

Once every run is graded, compute `benchmark.json`:

```json
{
  "run_summary": {
    "with_skill":    { "pass_rate": { "mean": 0.83 }, "duration_ms": { "mean": 45000 }, "total_tokens": { "mean": 3800 } },
    "without_skill": { "pass_rate": { "mean": 0.33 }, "duration_ms": { "mean": 32000 }, "total_tokens": { "mean": 2100 } },
    "delta": { "pass_rate": 0.50, "duration_ms": 13000, "total_tokens": 1700 }
  }
}
```

The delta tells you what the skill costs and what it buys. A skill that adds 13 seconds and 1700 tokens but improves pass rate by 50 percentage points is probably worth it. A skill that doubles tokens for a 2-point improvement is probably not.

For Mode B, the `run_summary` keys are `old_skill` and `new_skill`. The same logic applies — positive `delta.pass_rate` means the revision is an improvement.

## Version-controlled baselines

The full workspace tree is ephemeral and gitignored — it churns on every run. But two parts of a *canonical* run are worth keeping under version control: the `benchmark.json` delta (the headline "this skill earns its place" number) and the per-run `grading.json` rationales (why each assertion passed or failed, useful to reference when iterating later). Promote those into the skill's tracked `evals/baseline/` directory:

```bash
bun run evals:promote-baseline -- --skill <name> --iteration <N> [--label <tag>] [--agent-model <id>] [--judge-model <id>]
```

This copies `benchmark.json` and each `eval-<id>/<condition>/grading.json` (as `grading/<eval-id>__<condition>.json`) into `<skill>/evals/baseline/`, and writes a `BASELINE.md` recording the mode, iteration, harness, and run timestamp. Everything else in the workspace stays out of git.

The runner never dispatches the agent or judge itself, so it can't observe which models ran. Pass `--agent-model` (the model that ran the agent-under-test) and `--judge-model` (the model that graded `llm_judge` assertions) to record them as provenance rows in `BASELINE.md`; both default to `unspecified` when omitted. Record the resolved id you actually used (e.g. `claude-haiku-4-5-20251001`), even if your harness only let you pick a coarse `haiku`/`opus`/`sonnet` tier at dispatch.

```
skills/<skill>/evals/baseline/
  BASELINE.md                          # provenance
  benchmark.json                       # the committed delta
  grading/<eval-id>__<condition>.json  # judge rationales per run
  NOTES.md                             # optional — forward-looking observations
```

`NOTES.md` is an **optional** companion file for forward-looking observations from the runs that produced this baseline: which evals discriminated and which didn't, suspected variance/noise, ideas for the next iteration (skill changes or eval-suite changes), and any context a future iterator would want before re-running. It is not provenance (that belongs in `BASELINE.md`) and not results (those belong in `benchmark.json`). `promote-baseline` does not generate it and does not overwrite an existing one — author it by hand alongside the promoted baseline when there's something worth carrying forward; otherwise omit it.

This works the same for a personal skill: point `--skill-dir` at your skill's parent, run a canonical eval, then promote — you get a committed reference of what "passing" looked like for your skill, equivalent to the baselines slow-powers ships for its own skills.

## Analyzing patterns

After aggregating:

- **Replace assertions that always pass in both conditions.** They don't measure skill value. They inflate the with-skill pass rate without reflecting actual skill contribution.
- **Investigate assertions that always fail in both conditions.** Either the assertion is broken, the test case is too hard, or the assertion checks the wrong thing. Fix before next iteration.
- **Study assertions that pass with the skill but fail without it.** This is where the skill is adding value. Understand *why* — which instructions made the difference?
- **Tighten instructions when results are inconsistent.** High stddev = ambiguous instructions or model variability. Add examples or more specific guidance.
- **Read time/token outliers.** If one run is 3× longer than others, read its transcript for the bottleneck.

## Human review

Assertion grading catches what you wrote assertions for. A human reviewer catches everything else — issues you didn't anticipate, outputs that are technically correct but miss the point, problems hard to express as pass/fail.

Save per-eval reviewer notes in `feedback.json`:

```json
{
  "eval-claim-without-running": "Output ran `bun test` correctly but the final message hedged ('looks like it passes') instead of quoting the actual output.",
  "eval-build-implied-by-edit": ""
}
```

Empty string = output looked fine. Focus the next iteration's improvements on the test cases where you had specific complaints.

## Iterating

After iteration N, you have three signals:

- **Failed assertions** → specific gaps (missing instruction, unclear rule, uncovered case)
- **Reviewer feedback** → broader quality issues (wrong approach, poor structure)
- **Execution transcripts** → why things went wrong (which instructions were ignored, where time was wasted)

Feed all three plus the current SKILL.md to an LLM using `templates/revise-skill-prompt.md`. Then rerun in `iteration-N+1`.

### Guidance for revision

- **Generalize from feedback.** The skill is used across many prompts, not just these test cases. Fixes should address underlying issues broadly, not patch specific examples.
- **Keep the skill lean.** Fewer, better instructions outperform exhaustive rules. If pass rates plateau despite more rules, try removing instructions.
- **Explain the why.** Reasoning-based instructions ("Do X because Y") outperform rigid directives ("ALWAYS do X"). Models follow instructions more reliably when they understand the purpose.
- **Bundle repeated work.** If every run independently wrote a similar helper script, bundle it into the skill's `scripts/` directory.

### When to stop

- Pass rates are satisfactory and reviewer feedback is consistently empty
- Iteration deltas have plateaued (no meaningful improvement between iterations)
- You've identified a more fundamental issue (skill scope is wrong, prompts don't represent real use)

## Choosing to test with evals

Before you build an eval, decide whether this change needs one. An eval measures whether words on a page shift **contingent** behavior — what the agent does when the outcome is genuinely in doubt: under pressure, with ambiguity, or against a competing goal. That is where measurement earns its cost.

A **deterministic** change doesn't move that needle. Removing a one-line "announce out loud that you're using this skill" instruction, fixing a typo, or shipping a manually-invoked, testing-only procedure changes what the agent is told, not whether it complies under pressure. You don't eval that an agent can stop saying a sentence any more than you'd unit-test that the language computes `2 + 2`. Following an unambiguous instruction is the runtime contract; evals test the contingent logic built on top of it.

**The question for every skill change:** does it alter contingent behavior, or is it deterministic instruction-following?

- **Contingent → eval (this is the default).** Renaming `writing-plans` so its trigger fires reliably, editing a discipline-enforcing skill's rationalization table, changing the wording that decides a pressured choice — the agent might behave differently, and you can't know which way without measuring.
- **Deterministic → declare and skip.** State the decision and your reasoning to the user, then skip the eval. The reasoning is not optional: a silent skip is indistinguishable from dodging the work.

**Either way, announce the decision and why** — "deterministic instruction removal, no eval" or "this changes pressured compliance, I'll run an eval." A visible decision is one the user can override; a silent one is a rationalization waiting to happen. **The door stays open:** if the user wants an eval anyway, run a worthwhile one — design real cases, don't phone it in to confirm a foregone conclusion.

**Skill type is a fast read, not a verdict.** Reference and manually-invoked procedural changes *often* land deterministic; discipline, technique, and pattern changes *often* carry contingency (`pressure-scenarios.md` draws the same line under "When to use" / "Don't use them for"). Use type to orient your first guess — never as the answer. The decision is per *change*, not per type: a deterministic typo fix in a discipline-enforcing skill still skips, and restructuring a reference doc because the agent kept missing a section is contingent and earns an eval.

## The Iron Law

**No skill shipped without passing evals. No behavior-shaping change landed without a positive revision delta.**

Once you've judged a change behavior-shaping, the law is absolute — these are not exemptions:

- Not for "simple additions"
- Not for "just adding a section"
- Not for "documentation updates"
- Not for "obviously the same as before"

If you can't measure a behavioral change, you don't know if it's an improvement. Tuning behavior-shaping language without a benchmark drifts the skill — sometimes silently — toward worse behavior under pressure. (The narrow, declared exception for deterministic changes is above; "deterministic" is a judgment you announce and defend, not a backdoor around this law.)

## Common rationalizations

Excuses for skipping an eval on a change you've already judged behavior-shaping. None of them hold.

| Excuse | Reality |
|--------|---------|
| "Change is obviously an improvement" | Then proving it is fast. Run the eval. |
| "Existing skill works fine" | Until pressure-test scenario X. Run the eval. |
| "No time to author test cases" | The cost of shipping a regression is higher than 30 minutes of eval design. |
| "It's just rewording" | Wording IS the skill. Reword = changed skill. Run the eval. |
| "Eval results are noisy" | Then add runs, not skip the eval. |
| "Pass rate was already 100%" | Then the assertion is too easy. Replace it. |
| "I'll just call it deterministic" | Deterministic means the agent's compliance isn't in doubt — not that you'd rather not measure. If the wording could change a pressured choice, it's behavioral. Run the eval. |

## Bundled assets

- `schema/evals.schema.json` — validate `evals.json` shape
- `schema/grading.schema.json` — validate `grading.json` shape
- `schema/run-record.schema.json` — portable run record format (cross-harness key)
- `schema/stray-writes.schema.json` — validate the `evals:detect-stray-writes` report shape
- `templates/evals.json.example` — reference eval definition
- `templates/eval-task-prompt.md` — scaffold for dispatching a subagent to execute a test case
- `templates/judge-prompt.md` — scaffold for dispatching a judge subagent
- `templates/revise-skill-prompt.md` — scaffold for the iteration step
- `examples/verifying-development-work-evals.json` — committed real example
- `pressure-scenarios.md` — pressure-scenario taxonomy for authoring prompts that stress discipline-enforcing skills
- `runner/` — the Bun eval runner (orchestrator, grader, aggregator, transcript adapters) that executes the methodology; ships with the skill so users can run evals on their own skills
- `harness-details/claude.md` — Claude Code-specific step-by-step for running an eval (resolving the runner, dispatching subagents, grading)

## See also

- `slow-powers:writing-skills` — drafting a skill (Phase 1)
- agentskills.io/skill-creation/evaluating-skills — the methodology this skill is derived from
