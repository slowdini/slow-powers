# Slow-powers

Slow-powers is a set of software development methodology skills and meta skill-writing guidance.

## What lives here

This repo ships Slow-powers across four harnesses:

- `skills/` — Skills, assets, and cross-cutting tests
- `.claude-plugin/` — Claude Code plugin
- `.codex-plugin/` — OpenAI Codex plugin
- `opencode/` — OpenCode plugin (`@slowdini/slow-powers-opencode`)
- `cline/` — Cline plugin (CLI/SDK/Kanban only; declared via the `cline`
  field in `package.json`, with `skills/` auto-discovered from the package
  root)

Cline-specific setup for working on this repo also lives at root:

- `.clinerules/` — Cline rules (the Memory Bank custom instructions), tracked
- `memory-bank/` — Cline Memory Bank contents. Gitignored: each developer
  keeps their own local bank; only the rule in `.clinerules/` is shared

## Editing the right files

Two file-confusion traps are common in this repo. Avoid both:

- **Write memory-file changes to `AGENTS.md`, the only real file.** `CLAUDE.md`
  (and any future harness-specific memory files) are symlinks to `AGENTS.md`.
  Edit `AGENTS.md` directly; the symlinks reflect it automatically. Never try to
  "fix up" the other names — there's nothing to fix.
- **Read and edit only files inside this repository, never the installed
  slow-powers plugin.** Your environment almost always has the slow-powers
  plugin installed while this repo is the bleeding-edge `dev` source. The two trees
  diverge, so an installed skill file is *not* the file you want. Every read and
  edit belongs to a path under this project directory.

## Cross-Harness Compatibility

All skills MUST use cross-harness vocabulary, as described in `slow-powers/writing-skills`.

## Pull Request Requirements

- Read existing skills before proposing changes to skill content. Skill
  prose has been tuned over many iterations upstream and downstream; changes
  to behavior-shaping content (Red Flags tables, rationalization lists,
  "human partner" language) need evidence the change is an improvement.
- Test your change on at least one harness and note which one in the PR
  description. If your change touches harness-specific infrastructure,
  test that harness.

## Skill Changes

If you modify skill content:

- Use `slow-powers:writing-skills` to develop and test changes.
- Define coverage against the skill's intended goals. Reuse the suite for prose
  revisions; change cases for changed goals, uncovered failures, or defective grading.
- Run adversarial pressure testing across multiple sessions, not just the
  happy path.
- For behavior-shaping changes, show before/after eval results in the PR
  description. For deterministic changes (instruction-following the agent
  reliably does anyway), state the decision and reasoning to skip the eval
  instead — see "When to run" in `slow-powers:evaluating-skills`. Label exploratory
  evidence and unfinished measurement explicitly.
- Ensure skills are cross-harness compatible: avoid harness-specific tool or feature names.
- Our discipline-enforcing skills should carry at least one *seeded* eval case — one
  that embeds a short prior transcript so the skill is met mid-session under a
  competing attractor — because their real-world failures happen in-flight and a
  cold prompt alone under-measures them. Keep a cold contrast and see "Seeding
  conversation context" in the [pressure-scenarios reference](skills/evaluating-skills/references/pressure-scenarios.md).

## Local development

```bash
bun install   # also activates git hooks via the `prepare` script
bun test
bun run check
```

`bun install` runs the `prepare` script, which installs the git hooks
(pre-commit runs typecheck + lint-staged; pre-push runs the test suite).

`bun scripts/bump-version.ts <version>` updates every manifest in lockstep.

To test the Cline integration live: `cline plugin install ./ --cwd <scratch-dir>`,
run a Cline session in the scratch dir, then
`cline plugin uninstall slow-powers --cwd <scratch-dir>` when done.
