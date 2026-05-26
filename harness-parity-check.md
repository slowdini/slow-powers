# Harness Parity Check

You are an agent running inside one of Superslow's supported harnesses. This file walks you through auditing **which Superslow features are wired up for your harness** and prepping to close one gap. Claude Code is the reference implementation; other harnesses adapt its patterns using their own native conventions.

Read the file end-to-end before acting. The categories in Step 4 are the source of truth for what "parity" means today — when a new feature is added to Superslow, that table is updated and this file stays evergreen.

---

## Step 1 — Identify your harness

Name the harness you are running in. You almost certainly already know — confirm by checking:

- Your invocation context and working directory
- The tool names available to you in this session
- Any session-start context block injected at the top of the conversation
- Top-level files or directories matching your harness (e.g. `.<harness>-plugin/`, `<harness>-instructions.md`)

The intended supported harnesses are: **Claude Code, Antigravity CLI, Codex CLI, Cursor, OpenCode, Copilot CLI**.

If the harness you are running in is not in that list, stop and ask the user before continuing.

---

## Step 2 — Read the reference materials

Read these files in order. Each one teaches you something specific you will need in Step 3.

| File | What to look for |
|------|------------------|
| `AGENTS.md` (or `CLAUDE.md`, which symlinks to it) | The Cross-Harness Compatibility rule, the canonical list of supported harnesses, the PR-scoping rule |
| `README.md` | Per-harness install instructions, the feature-support tier table |
| `bootstrap.md` | The universal payload every harness must deliver into a session (instruction priority + Active Skills Directory) |
| `.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json` | Claude's reference manifest shape — what fields a harness manifest typically carries |
| `hooks/hooks.json` | Claude's `SessionStart` hook that injects `bootstrap.md`. Compare with `hooks/hooks-cursor.json` for the Cursor variant |
| `skills/evaluating-skills/runner/README.md` | Contains explicit **Cross-harness breadcrumbs** — sketches of how Codex, Cursor, OpenCode would implement environment parity. Treat these as starting points, not specifications |
| `skills/evaluating-skills/runner/adapters/claude-code-transcript.ts` | The reference transcript adapter. Compare with `antigravity-transcript.ts` in the same directory to see how the same job looks in a second harness |
| `skills/evaluating-skills/harness-details/claude.md` | The reference per-harness operator walkthrough. Antigravity and others would each get their own file alongside this |
| `scripts/bump-version.js` | The list of manifest files kept in version lockstep — every harness with its own manifest needs an entry here |

Do not skim. The parity report you produce in Step 4 is only as good as the reference you internalized here.

---

## Step 3 — Discover your harness's existing surface area

Enumerate, using ordinary file search, what already exists in this repo for your harness. Do not rely on memory or assumptions — search the working tree. Useful heuristics:

- Top-level directories matching `.<harness>-plugin/` or `<harness>/`
- Root-level files matching `<harness>-*.{json,md}` or `<HARNESS>.md`
- Entries in `scripts/bump-version.js` that mention the harness
- The harness name anywhere inside `skills/evaluating-skills/runner/` (especially `context.ts`, `adapters/`, `harness-details/`)
- Hook files in `hooks/` targeting the harness
- Tests under `tests/` for the harness
- An installation section in `README.md` for the harness

Record every path you find. You will reference them in Step 4.

---

## Step 4 — Produce a parity report

For each category below, compare what Claude Code has against what your harness has. Categories are described as "what Claude does (reference)" so they survive renames — when something changes, this row of the table is updated and the rest of the file still applies.

| Category | What Claude Code does (reference) |
|----------|-----------------------------------|
| Plugin / extension manifest | `.claude-plugin/plugin.json` — pure metadata (name, version, author, license). Claude Code auto-discovers `skills/` and `hooks/hooks.json` at the plugin root by convention, so the manifest does not declare those paths. Other harnesses (Codex, Cursor) instead declare `"skills"` and `"hooks"` fields explicitly |
| Marketplace or distribution channel | `.claude-plugin/marketplace.json` registers the plugin; installed via `/plugin marketplace add` |
| Bootstrap injection | `hooks/hooks.json` `SessionStart` hook runs `hooks/run-hook.cmd session-start`, which executes `hooks/session-start` (bash) — that script reads `bootstrap.md` and emits a JSON `additionalContext` payload Claude injects into the session |
| Skill discovery | Auto-discovered: Claude Code scans the conventional `skills/` directory at the plugin root, no manifest field required. Harnesses without convention-based discovery declare the path in their manifest instead |
| Hook system / session start | `hooks/hooks.json` with matcher `startup\|resume\|clear\|compact` |
| Skill-eval transcript adapter | `skills/evaluating-skills/runner/adapters/claude-code-transcript.ts` |
| Realistic eval environment (skill staging) | `runner/run.ts` stages skills under `<stageRoot>/.claude/skills/` and builds a `<session-start-context>` inventory block |
| Harness-details operator guide | `skills/evaluating-skills/harness-details/claude.md` |
| Installation docs | README section titled `### Claude Code` |
| Version-sync registration | `.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json` are listed in `scripts/bump-version.js` |
| CI coverage | Harness-relevant entries in `tests/` and `.github/workflows/` |

Surface your findings inline using this template:

```
## Parity Report: <harness>
Reference: Claude Code

- **Plugin / extension manifest** — ✅ Implemented / ⚠️ Partial / ❌ Missing / N/A
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
- **N/A** — the category doesn't translate (e.g. a harness with no marketplace concept). State why

The agent reports inline by default. If the user asks for a persistent artifact, write the report to `docs/parity-reports/<harness>.md` (create the directory if missing).

---

## Step 5 — Pick a gap and prep to close it

Surface the report to the user and propose **one or two** gaps worth closing this session. Bias toward the smallest gap with the highest user impact — typically a transcript adapter or a harness-details guide, not a wholesale plugin rewrite.

Once the user picks a gap:

1. Re-read Claude's reference implementation for that specific feature in detail. Note the *shape* of what it does — inputs, outputs, side effects — separately from the *Claude-specific mechanism* it uses.
2. **Consult your harness's own documentation, MCP servers, or built-in references** before proposing harness-specific changes. Do not guess at hook schemas, plugin manifest fields, or native tool names. If a `context7` or equivalent docs-fetch server is available, prefer it over your training data — assume your knowledge of the harness may be stale.
3. Propose an adaptation that copies Claude's shape while using your harness's native conventions. State explicitly what you are copying and what you are adapting.
4. Confirm with the user before writing code.
5. If your gap involves creating or modifying a skill, load `superslow:writing-skills` first.

---

## Guardrails

- **Cross-Harness Compatibility is enforced.** A change for your harness MUST NOT break or degrade any other harness. Re-read the Cross-Harness Compatibility section of `AGENTS.md`.
- **One problem per PR.** Per `AGENTS.md`, do not bundle unrelated changes. A parity-closing PR should add one feature for one harness.
- **Do not edit `bootstrap.md` or shared skills as part of parity work.** Those are cross-cutting; changes need their own PRs with their own evidence.
- **Do not fabricate features that don't exist in any harness yet.** Parity means "catch up to Claude," not "invent something new."
- **Do not guess at harness-specific details.** If your harness's docs don't confirm something, ask the user before proceeding.
- **Keep this file evergreen.** If you add a new feature category to Superslow, add a row to the Step 4 table here and to the tier table in `README.md` in the same PR.
