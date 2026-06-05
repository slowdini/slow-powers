# Harness Parity Check

You are an agent running inside one of Slow-powers's supported harnesses. This file walks you through auditing **which Slow-powers features are wired up for your harness** and prepping to close one gap. Claude Code is the reference implementation; other harnesses adapt its patterns using their own native conventions.

This file covers **plugin distribution** — how Slow-powers reaches a user's session: manifests, marketplace/registry, bootstrap injection, skill discovery, hooks, installation docs, version lockstep, and CI. The skill-eval runner has its own parity surface, audited separately by `skills/evaluating-skills/harness-parity.md` (it lives with the runner, which is slated to move into its own project).

Read the file end-to-end before acting. The categories in Step 4 are the source of truth for what "parity" means today — when a new feature is added to Slow-powers, that table is updated and this file stays evergreen.

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

Read these files in order. Each one teaches you something specific you will need in Step 3.

| File | What to look for |
|------|------------------|
| `AGENTS.md` (or `CLAUDE.md`, which symlinks to it) | The Cross-Harness Compatibility rule, the canonical list of supported harnesses, the PR-scoping rule |
| `README.md` | Per-harness install instructions, the feature-support tier tables (distribution + eval runner) |
| `bootstrap.md` | The universal payload every harness must deliver into a session (instruction priority + the gate-wrapping framing for skills) |
| `.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json` | Claude's reference manifest shape — what fields a harness manifest typically carries |
| `hooks/hooks.json` | Claude's `SessionStart` hook that injects `bootstrap.md`. Codex reuses this same matcher-style manifest |
| `scripts/manifest-files.ts` | The list of manifest files kept in version lockstep (consumed by `scripts/bump-version.ts` and the harness test suite) — every harness with its own manifest needs an entry here |
| `tests/harness/spec.ts` and `tests/harness/manifests.test.ts` | The cross-harness test descriptor table and the parameterized suite that holds every harness to the standard checks — every harness needs an entry in `spec.ts` |

Do not skim. The parity report you produce in Step 4 is only as good as the reference you internalized here.

---

## Step 3 — Discover your harness's existing surface area

Enumerate, using ordinary file search, what already exists in this repo for your harness. Do not rely on memory or assumptions — search the working tree. Useful heuristics:

- Top-level directories matching `.<harness>-plugin/` or `<harness>/`
- Root-level files matching `<harness>-*.{json,md}` or `<HARNESS>.md`
- Entries in `scripts/manifest-files.ts` (version lockstep) and `tests/harness/spec.ts` (test descriptor) that mention the harness
- Hook files in `hooks/` targeting the harness
- Tests under `tests/` for the harness, and the harness's entry in `tests/harness/spec.ts`
- An installation section in `README.md` for the harness

Record every path you find. You will reference them in Step 4.

---

## Step 4 — Produce a parity report

For each category below, compare what Claude Code has against what your harness has. Categories are described as "what Claude does (reference)" so they survive renames — when something changes, this row of the table is updated and the rest of the file still applies.

| Category | What Claude Code does (reference) |
|----------|-----------------------------------|
| Plugin / extension manifest | `.claude-plugin/plugin.json` — pure metadata (name, version, author, license). Claude Code auto-discovers `skills/` and `hooks/hooks.json` at the plugin root by convention, so the manifest does not declare those paths. Other harnesses (Codex) instead declare `"skills"` and `"hooks"` fields explicitly |
| Marketplace or distribution channel | `.claude-plugin/marketplace.json` registers the plugin; installed via `/plugin marketplace add` |
| Bootstrap injection | `hooks/hooks.json` `SessionStart` hook runs `hooks/run-hook.cmd session-start`, which executes `hooks/session-start` (bash) — that script reads `bootstrap.md` and emits a JSON `additionalContext` payload Claude injects into the session |
| Skill discovery | Auto-discovered: Claude Code scans the conventional `skills/` directory at the plugin root, no manifest field required. Harnesses without convention-based discovery declare the path in their manifest instead |
| Hook system / session start | `hooks/hooks.json` with matcher `startup\|resume\|clear\|compact` |
| Plan hand-off enforcement (Claude-native) | `hooks/hooks.json` `PreToolUse` hook matching `ExitPlanMode` runs `hooks/run-hook.cmd exit-plan-mode` → `hooks/exit-plan-mode`, which denies the *first* plan-exit per session and steers the agent through `hardening-plans` before the plan is presented (it re-submits and is allowed). `ExitPlanMode` is a Claude tool — a harness with no equivalent "about to present a plan" lifecycle event reports **N/A**, not Missing: the matcher in the shared `hooks.json` is inert there (never fires, clean no-op), so nothing is broken or degraded. An analogous lifecycle event on Codex/OpenCode is **deferred** (issue #141, avenue 3) and does not block declaring full distribution parity |
| Installation docs | README section titled `### Claude Code` |
| Version-sync registration | `.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json` are listed in `scripts/manifest-files.ts` (the shared lockstep list) |
| CI coverage | A descriptor entry in `tests/harness/spec.ts` drives the parameterized `tests/harness/manifests.test.ts` suite (the Standard harness test cases below); the whole suite runs via `bun test` in `.github/workflows/ci.yml` |

Surface your findings inline using this template:

```
## Distribution Parity Report: <harness>
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

## Standard harness test cases

`tests/harness/manifests.test.ts` holds **every** harness to the same contract, driven by its entry in `tests/harness/spec.ts`. A harness is wired up correctly when it passes all of these (the suite runs under `bun test`):

1. **Valid manifest** — the harness's manifest parses as JSON and carries its required fields (at minimum `name` and `version`; OpenCode reuses `package.json` and its `main` entry).
2. **Version lockstep** — the manifest's version (and any `plugins[].version`) equals `package.json`'s, for every file in `scripts/manifest-files.ts`.
3. **Declared paths resolve** — every path-typed manifest field (skills dir, hooks file, icons, `contextFileName`, …) points at an existing file/dir and does not escape the repo root.
4. **Bootstrap present** — `bootstrap.md` exists, leads with the Slow-powers instructions marker, and advertises the core skills.
5. **Skills discoverable** — `skills/` is populated and each `SKILL.md` declares `name` + `description` frontmatter.
6. **Hook wiring** (harnesses with a hooks manifest) — the hooks JSON is valid, defines a SessionStart hook that calls `run-hook.cmd`, and the `run-hook.cmd` + `session-start` scripts exist. Matcher-style hooks (`hooks.json`) must include `startup`/`resume`/`clear`.

Harness-specific runtime behaviour (e.g. the OpenCode plugin's bootstrap injection/caching, or its published-package contents) lives in sibling suites under `tests/<harness>/`.

---

## Step 5 — Pick a gap and prep to close it

Surface the report to the user and propose **one or two** gaps worth closing this session. Bias toward the smallest gap with the highest user impact — typically a hook wiring or an installation-docs section, not a wholesale plugin rewrite.

Once the user picks a gap:

1. Re-read Claude's reference implementation for that specific feature in detail. Note the *shape* of what it does — inputs, outputs, side effects — separately from the *Claude-specific mechanism* it uses.
2. **Consult your harness's own documentation, MCP servers, or built-in references** before proposing harness-specific changes. Do not guess at hook schemas, plugin manifest fields, or native tool names. If a `context7` or equivalent docs-fetch server is available, prefer it over your training data — assume your knowledge of the harness may be stale.
3. Propose an adaptation that copies Claude's shape while using your harness's native conventions. State explicitly what you are copying and what you are adapting.
4. Confirm with the user before writing code.
5. If your gap involves creating or modifying a skill, load `slow-powers:writing-skills` first.
6. Make sure your harness is held to the **Standard harness test cases** above: add or extend its entry in `tests/harness/spec.ts` (and register any new manifest in `scripts/manifest-files.ts`) so the parameterized suite covers it.

---

## Guardrails

- **Cross-Harness Compatibility is enforced.** A change for your harness MUST NOT break or degrade any other harness. Re-read the Cross-Harness Compatibility section of `AGENTS.md`.
- **One problem per PR.** Per `AGENTS.md`, do not bundle unrelated changes. A parity-closing PR should add one feature for one harness.
- **Do not edit `bootstrap.md` or shared skills as part of parity work.** Those are cross-cutting; changes need their own PRs with their own evidence.
- **Do not fabricate features that don't exist in any harness yet.** Parity means "catch up to Claude," not "invent something new."
- **Do not guess at harness-specific details.** If your harness's docs don't confirm something, ask the user before proceeding.
- **Keep this file evergreen.** If you add a new distribution-side feature category to Slow-powers, add a row to the Step 4 table here and to the distribution tier table in `README.md` in the same PR. Eval-runner categories belong in `skills/evaluating-skills/harness-parity.md` instead.
