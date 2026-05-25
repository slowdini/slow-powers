---
name: evaluating-skills
description: Use when testing whether a new skill improves agent behavior, or when validating a change to an existing skill's language. Defines test-case format, the with/without and old/new comparison protocols, the snapshot/revision mode, grading, and the iteration loop. Harness-agnostic.
---

# Evaluating Skills

## Overview

Skill development has two phases: **drafting** (`superslow:writing-skills`) and **evaluation** (this skill).

An eval is a structured measurement of whether a skill actually shifts behavior. Each test case is a realistic prompt; each run dispatches a fresh general-purpose subagent twice — once with the skill loaded, once without (or once with the prior version, once with the revised version) — and grades the outputs against assertions. Pass-rate deltas tell you whether the skill is worth shipping or the change is worth landing.

This skill is harness-agnostic. Run records use a portable JSON schema so evals authored on one harness (Claude Code, Codex, Cursor, OpenCode, Antigravity) can be executed and graded on any other. See `schema/run-record.schema.json`.

## Two comparison modes

### Mode A — New skill comparison

Compares `with_skill/` vs `without_skill/`. Use when validating a brand-new skill actually beats baseline behavior with no skill loaded. This is the agentskills.io default.

### Mode B — Revision comparison

Compares `old_skill/` vs `new_skill/`. **This is the common case.** Use when testing a language change to an existing skill — snapshot the current SKILL.md before editing, make changes, run both variants against the same prompts.

Mode B workflow:
1. Snapshot current SKILL.md (label the snapshot with a date or short tag)
2. Edit the skill
3. Run the eval with `--mode revision --baseline <snapshot-label>`
4. Grade and aggregate; review the delta

A negative or zero delta is a signal to revert the change — the new language did not improve behavior.

## Designing test cases

A test case has three parts:

- **prompt**: a realistic user message — the kind a real user would actually type
- **expected_output**: a human-readable description of success
- **files** (optional): fixture files the prompt references

Stored in `<skill>/evals/evals.json`. See `templates/evals.json.example` and `examples/verification-before-completion-evals.json`.

Tips for writing good prompts:

- **Start with 2–3 test cases.** Don't over-invest before iteration 1.
- **Vary phrasing.** Mix casual ("hey can you check this") with precise ("Run `bun test`, quote the output").
- **Cover edge cases.** Include at least one boundary condition, malformed input, or ambiguous instruction.
- **Use realistic context.** Real users reference file paths, function names, personal context. "Process this data" is too vague to test anything useful.
- **For discipline-enforcing skills**, see `pressure-scenarios.md` for the pressure-scenario taxonomy (time pressure, sunk cost, authority, exhaustion, etc.).

**Don't write assertions yet.** You don't know what "good" looks like until you see what the first run produces.

## Running evals

For each test case, dispatch fresh general-purpose subagents — one per condition. Each subagent receives:

- The prompt verbatim
- Any fixture files
- The output directory path
- (Conditionally) the path to the SKILL.md to load

Subagents MUST start with clean context. State leaking from previous runs invalidates the comparison.

When a subagent completes, capture:

- `total_tokens` and `duration_ms` from the harness's task completion event — **these may not be persisted anywhere else; save them immediately**
- The final user-facing message
- The tool invocations (best effort — see "Transcript access" below)

Convert these into a portable **run record** (`run.json`) using `schema/run-record.schema.json`. Each harness has its own adapter — Claude Code's lives in the runner repo at `tests/skill-evals/adapters/`; other harnesses write their own or fill the record manually.

### Two modes of operation

The same workspace tree supports two ways of driving the loop. Pick based on where you're working.

**CLI / manual mode.** Run `bun run evals -- --skill <name> --mode <new-skill|revision>` (or the harness-equivalent command) to build the workspace. Open the generated `dispatch-manifest.md` and feed each dispatch into your subagent primitive one at a time. After each, write `run.json` and `timing.json` to the paths shown in the manifest. This is useful when you want a slow, deliberate run with eyes on each output.

**Agent-driven mode.** From inside a normal agent session, the agent itself drives the entire loop:

1. The agent invokes the runner via Bash to build the workspace (same command as above).
2. The agent reads the generated `dispatch.json` (machine-readable sibling of the manifest). Each task object has a ready-to-use `dispatch_prompt` plus exact `run_record_path` and `timing_path` to write to.
3. For each task, the agent dispatches a fresh subagent using its host's primitive, passing the `dispatch_prompt` verbatim.
4. When the subagent returns, the agent writes the portable run record to `run_record_path` and the timing record to `timing_path`. The agent may use a harness adapter to convert a native transcript, or populate the record from what the subagent surfaced.
5. The agent runs the grader (Bash) and then dispatches judge subagents for any `llm_judge` assertions — same pattern: read a tasks file, dispatch, write results back to a path.
6. The agent runs the aggregator.

Agent-driven mode is the common case because the framework is most useful from inside the harness where the skill is being iterated. Use it when you want a single in-session "run the eval and report the delta" flow.

### Transcript access

`transcript_check` assertions match patterns against a run's `tool_invocations`. Filling that list well depends on what the harness exposes:

- **Claude Code (parent agent can access subagent transcripts via the filesystem):** use the adapter at `tests/skill-evals/adapters/claude-code-transcript.ts` after the subagent completes.
- **Harnesses where the parent only sees the subagent's final message:** the agent records only the final message; `transcript_check` assertions will be skipped (graded as "unverifiable") and you rely on `llm_judge` assertions instead. This is an honest limitation, not a bug.
- **Operator-driven mode on any harness:** the operator can use the adapter after the fact, since they have filesystem access to whatever transcript the harness persisted.

Design your assertions accordingly. For maximally portable evals, lean on `llm_judge` for the substantive checks and use `transcript_check` for cheap mechanical signals where the adapter is available.

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

The framework injects this check (reserved id `__skill_invoked`) into the judge task list for every condition whose `skill_path` is non-null. It does **not** count toward the substantive `pass_rate`; results land in `grading.json` under `meta_results` and `meta_summary`, and the benchmark surfaces an `invocation_rate` per condition.

Why this matters: a run where the skill wasn't actually invoked is a non-data-point. If `with_skill` scores poorly but the meta-check shows the skill wasn't applied, that's not evidence the skill is bad — it's evidence the prompt didn't trigger the skill's applicability. Conversely, a clean invocation rate validates that substantive pass-rate deltas reflect skill effectiveness.

The judge rubric looks for behavioral fingerprints of the skill — distinctive vocabulary, named sections, procedural steps that mirror the skill's phrasing — by comparing the agent's `final_message` against the SKILL.md content embedded in the run record. It does **not** require the agent to explicitly cite the skill (that would taint the eval). Skills with generic best-practice content may be hard to detect, which is itself a finding: a skill indistinguishable from baseline behavior may not be worth shipping.

The aggregator emits a `validity_warnings` array when any with-skill condition has an invocation rate below 100%. Read those before interpreting the substantive delta.

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

## The Iron Law

**No skill shipped without passing evals. No language change landed without a positive revision delta.**

- Not for "simple additions"
- Not for "just adding a section"
- Not for "documentation updates"
- Not for "obviously the same as before"

If you can't measure the change, you don't know if it's an improvement. Tuning skill language without a benchmark drifts the skill — sometimes silently — toward worse behavior under pressure.

## Common rationalizations

| Excuse | Reality |
|--------|---------|
| "Change is obviously an improvement" | Then proving it is fast. Run the eval. |
| "Existing skill works fine" | Until pressure-test scenario X. Run the eval. |
| "No time to author test cases" | The cost of shipping a regression is higher than 30 minutes of eval design. |
| "It's just rewording" | Wording IS the skill. Reword = changed skill. Run the eval. |
| "Eval results are noisy" | Then add runs, not skip the eval. |
| "Pass rate was already 100%" | Then the assertion is too easy. Replace it. |

## Bundled assets

- `schema/evals.schema.json` — validate `evals.json` shape
- `schema/grading.schema.json` — validate `grading.json` shape
- `schema/run-record.schema.json` — portable run record format (cross-harness key)
- `templates/evals.json.example` — reference eval definition
- `templates/eval-task-prompt.md` — scaffold for dispatching a subagent to execute a test case
- `templates/judge-prompt.md` — scaffold for dispatching a judge subagent
- `templates/revise-skill-prompt.md` — scaffold for the iteration step
- `examples/verification-before-completion-evals.json` — committed real example
- `pressure-scenarios.md` — pressure-scenario taxonomy for authoring prompts that stress discipline-enforcing skills

## See also

- `superslow:writing-skills` — drafting a skill (Phase 1)
- agentskills.io/skill-creation/evaluating-skills — the methodology this skill is derived from
