# Eval-Runner Harness Parity Check

You are an agent running inside one of Slow-powers's supported harnesses. This file walks you through auditing **which eval-runner features are wired up for your harness** and prepping to close one gap. Claude Code is the reference implementation; other harnesses adapt its patterns using their own native conventions.

This file covers the **skill-eval runner only** — the infrastructure under `skills/evaluating-skills/` that dispatches, records, and grades skill evals. Plugin-distribution parity (manifests, hooks, bootstrap injection, skill discovery) is audited separately by the root-level `harness-parity-check.md`. The eval runner is slated to move into its own project; this doc lives alongside it so it travels with the extraction.

Read the file end-to-end before acting. The categories in Step 4 are the source of truth for what "eval-runner parity" means today — when a new feature is added to the runner, that table is updated and this file stays evergreen.

---

## Step 1 — Identify your harness

Name the harness you are running in. You almost certainly already know — confirm by checking:

- Your invocation context and working directory
- The tool names available to you in this session
- Any session-start context block injected at the top of the conversation
- Top-level files or directories matching your harness (e.g. `.<harness>-plugin/`, `<harness>-instructions.md`)

The intended supported harnesses are: **Claude Code, Codex CLI, OpenCode**.

If the harness you are running in is not in that list, stop and ask the user before continuing.

---

## Step 2 — Read the reference materials

Read these files in order. Each one teaches you something specific you will need in Step 3. Paths are relative to the repository root.

| File | What to look for |
|------|------------------|
| `AGENTS.md` (or `CLAUDE.md`, which symlinks to it) | The Cross-Harness Compatibility rule, the canonical list of supported harnesses, the PR-scoping rule |
| `skills/evaluating-skills/runner/README.md` | Contains explicit **Cross-harness breadcrumbs** — sketches of how Codex and OpenCode would implement environment parity. Treat these as starting points, not specifications |
| `skills/evaluating-skills/runner/adapters/claude-code-transcript.ts` | The reference transcript adapter. A second harness would add its own adapter alongside this, translating that harness's transcript shape into the same `ToolInvocation[]` format |
| `skills/evaluating-skills/harness-details/claude.md` | The reference per-harness operator walkthrough. Other harnesses would each get their own file alongside this |

Do not skim. The parity report you produce in Step 4 is only as good as the reference you internalized here.

---

## Step 3 — Discover your harness's existing surface area

Enumerate, using ordinary file search, what already exists in the eval runner for your harness. Do not rely on memory or assumptions — search the working tree. Useful heuristics:

- The harness name anywhere inside `skills/evaluating-skills/runner/` (especially `context.ts`, `adapters/`, `profiles/`)
- A per-harness operator guide in `skills/evaluating-skills/harness-details/`
- Tests under `tests/` exercising the runner for the harness

Record every path you find. You will reference them in Step 4.

---

## Step 4 — Produce a parity report

For each category below, compare what Claude Code has against what your harness has. Categories are described as "what Claude does (reference)" so they survive renames — when something changes, this row of the table is updated and the rest of the file still applies.

| Category | What Claude Code does (reference) |
|----------|-----------------------------------|
| Skill-eval transcript adapter | `skills/evaluating-skills/runner/adapters/claude-code-transcript.ts` |
| Skill-eval auto-record (run/timing assembly) | `runner/record-runs.ts` assembles each task's `run.json` + `timing.json` from disk after dispatches: carry-over fields from `dispatch.json`, `final_message` from `outputs/final-message.md`, `tool_invocations`/tokens/duration from the persisted transcript (`parseTranscriptFull` — usage deduped by message id). Leans on transcript access, so it's a Claude-Code-tier acceleration like `fill-transcripts`; the portable contract (hand-authored records, `run-record.schema.json`) is unchanged. A harness closes this gap by extending its transcript adapter to supply the same three sources (final message, tool invocations, usage/timing) the recorder consumes |
| Realistic eval environment (skill staging) | `runner/run.ts` stages skills under `<stageRoot>/.claude/skills/`, wraps any `--bootstrap` content in a `<session-start-context>` block, and emits a separate available-skills block. That block is rendered in the harness's **native** skill-list presentation — Claude Code's lives in `runner/adapters/claude-code-session.ts` (`The following skills are available for use with the Skill tool:` / `- name: description`). Another harness adds its own renderer there so its dispatches read like a real session in that harness, not an eval |
| Eval subagent write enforcement | Opt-in `--guard` stages a `PreToolUse` hook (`runner/guard/`) that *denies* subagent writes/installs outside the eval sandbox while dispatches run. Portable fallback for every harness: the `evals:detect-stray-writes` post-pass (`runner/detect-stray-writes.ts`) flags out-of-bounds writes from the parsed transcript after the fact |
| Eval plan-mode operating context | Opt-in `--plan-mode` injects a harness-specific plan-mode procedure profile (`runner/profiles/<harness>/plan-mode.md`) as a `<system-reminder>` operating-context layer in every dispatch, rendered by `renderPlanModeContext` in the harness session adapter (`runner/adapters/claude-code-session.ts`). Only `profiles/claude-code/plan-mode.md` exists today; a harness adds its own profile (its native plan/research-mode procedure) + renderer alongside the Claude ones. A harness with no profile has no `--plan-mode` and an unchanged dispatch contract |
| Harness-details operator guide | `skills/evaluating-skills/harness-details/claude.md` |

**Note on the transcript adapter (raised bar).** Slow-powers's baseline eval suite
now uses `transcript_check` assertions — deterministic regex checks against a
run's tool invocations (e.g. "a test command ran", "the sibling skill was
loaded"). These only grade when a transcript adapter exists for your harness.
A harness without one still functions: those assertions grade as *unverifiable*
and the `llm_judge` assertions carry the substantive measurement, the same way
Codex/OpenCode work today. But adapter richness is now an explicit parity
target, not optional polish — a harness that adds or extends an adapter under
`skills/evaluating-skills/runner/adapters/` lets more of the baseline suite grade
mechanically. Treat the transcript-adapter row above as a goal to aim at, not a
box already checked.

**Note on write enforcement (parity goal).** Eval subagents are instructed to
write only inside their `outputs/` dir, but nothing in the portable contract
*enforces* it — a misbehaving subagent can edit the real repo or install
packages, silently tainting the run. Two layers address this: the portable
`detect-stray-writes` post-pass (available to every harness, since it works off
the same parsed transcript the adapters already produce) and, on Claude Code, an
opt-in `--guard` that stages a native `PreToolUse` hook to *block* the write
before it happens. **Harness-level tool enforcement — denying out-of-bounds
subagent writes using the harness's own permission/hook primitive — is an
explicit parity goal, not optional polish.** A harness that can express a
pre-tool guard (a hook, a permission rule, a sandboxed cwd) should wire one up so
its eval runs are as self-contained as Claude Code's; until then, the
`detect-stray-writes` report is the honest fallback. Treat the write-enforcement
row above as a goal to aim at, with detection as the baseline every harness meets.

**Note on plan-mode fidelity (residual parity goal).** `--plan-mode` injects a
harness's *verbatim* plan-mode procedure as operating context, which is the
closest a harness's eval runner can get to reproducing the wild failure where a
real plan mode makes loading a skill feel redundant. It is **not** the real mode:
it is still text the dispatched subagent reads, not a state the harness places it
under, so a pass remains necessary-not-sufficient (see *Seeding conversation
context (and its ceiling)* in `skills/evaluating-skills/SKILL.md`). A harness that
can actually dispatch an eval subagent *into* its own plan/research mode — not
merely describe it — would close this gap; that real-mode injection is the
residual parity goal, with `--plan-mode` (a profile + renderer) as the approximation
every harness can reach in the meantime.

Surface your findings inline using this template:

```
## Eval-Runner Parity Report: <harness>
Reference: Claude Code

- **Skill-eval transcript adapter** — ✅ Implemented / ⚠️ Partial / ❌ Missing / N/A
  - Where: <path or "would live at <path>">
  - Gap: <one sentence, only if Partial/Missing>

(... one block per category ...)

## Summary
- Strongest area: <category>
- Highest-leverage gap: <category> — <why>
- Suggested next gap to close this session: <category>
```

Status meanings:

- **✅ Implemented** — fully wired up; feature works the same way Claude's does (using whatever native primitive the harness provides)
- **⚠️ Partial** — some scaffolding exists but the feature isn't end-to-end functional
- **❌ Missing** — no implementation; users of this harness do not get this feature
- **N/A** — the category doesn't translate. State why

The agent reports inline by default. If the user asks for a persistent artifact, write the report to `docs/parity-reports/<harness>-evals.md` (create the directory if missing).

---

## Step 5 — Pick a gap and prep to close it

Surface the report to the user and propose **one or two** gaps worth closing this session. Bias toward the smallest gap with the highest user impact — typically a transcript adapter or a harness-details guide, not a wholesale runner rework.

Once the user picks a gap:

1. Re-read Claude's reference implementation for that specific feature in detail. Note the *shape* of what it does — inputs, outputs, side effects — separately from the *Claude-specific mechanism* it uses.
2. **Consult your harness's own documentation, MCP servers, or built-in references** before proposing harness-specific changes. Do not guess at hook schemas, transcript formats, or native tool names. If a `context7` or equivalent docs-fetch server is available, prefer it over your training data — assume your knowledge of the harness may be stale.
3. Propose an adaptation that copies Claude's shape while using your harness's native conventions. State explicitly what you are copying and what you are adapting.
4. Confirm with the user before writing code.
5. If your gap involves creating or modifying a skill, load `slow-powers:writing-skills` first.

---

## Guardrails

- **Cross-Harness Compatibility is enforced.** A change for your harness MUST NOT break or degrade any other harness. Re-read the Cross-Harness Compatibility section of `AGENTS.md`.
- **One problem per PR.** Per `AGENTS.md`, do not bundle unrelated changes. A parity-closing PR should add one feature for one harness.
- **Do not edit `bootstrap.md` or shared skills as part of parity work.** Those are cross-cutting; changes need their own PRs with their own evidence.
- **Do not fabricate features that don't exist in any harness yet.** Parity means "catch up to Claude," not "invent something new."
- **Do not guess at harness-specific details.** If your harness's docs don't confirm something, ask the user before proceeding.
- **Keep this file evergreen.** If you add a new feature category to the eval runner, add a row to the Step 4 table here and to the eval-runner tier table in `README.md` in the same PR. Distribution-side categories (manifests, hooks, bootstrap, docs) belong in the root `harness-parity-check.md` instead.
