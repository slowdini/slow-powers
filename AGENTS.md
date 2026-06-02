# Slow-powers — Contributor Guidelines

Slow-powers is a fork of [obra/superpowers](https://github.com/obra/superpowers)
that ships as a distinct product with its own release cadence.

## What lives here

This repo ships Slow-powers across three harnesses:

- `skills/` — Skills, assets, and cross-cutting tests
- `.claude-plugin/` — Claude Code plugin
- `.codex-plugin/` — OpenAI Codex plugin
- `opencode/` — OpenCode plugin (`@slowdini/slow-powers-opencode`)

See the [feature support](README.md#feature-support) table in the README for current tier per harness.

## Editing the right files

Two file-confusion traps are common in this repo. Avoid both:

- **Write memory-file changes to `AGENTS.md`, the only real file.** `CLAUDE.md`
  (and any future harness-specific memory files) are symlinks to `AGENTS.md`.
  Edit `AGENTS.md` directly; the symlinks reflect it automatically. Never try to
  "fix up" the other names — there's nothing to fix.
- **Read and edit only files inside this repository, never the installed
  slow-powers plugin.** Your environment almost always has the slow-powers
  plugin installed (a stable release, e.g. under `~/.claude/plugins/`), while
  this repo is the bleeding-edge `dev` source. The two trees diverge, so an
  installed skill file is *not* the file you want. Every read and edit belongs to
  a path under this project directory.

  To stop the installed copy from shadowing source during work and skill evals,
  this repo **disables** the installed slow-powers (and upstream superpowers)
  plugins in `.claude/settings.json`, so their skills are not auto-loaded in a
  session opened here — see
  `skills/evaluating-skills/harness-details/claude.md` → *Isolating from installed
  plugins* for why this matters to eval validity. With the plugin off, **use the
  source skills directly**: open `skills/<name>/SKILL.md` when you need a
  slow-powers skill rather than relying on skill auto-discovery. The disable
  applies at session start, so restart once after pulling this setting.

## Cross-Harness Compatibility

Ensure all features work across supported harnesses, with at least a minimum level of compatibility. If a feature isn't supported in a harness, or has reduced or limited functionality, this should be clearly communicated. A feature MUST NOT break or degrade any harness functionality.

When closing gaps between harnesses, follow [`harness-parity-check.md`](./harness-parity-check.md) — it walks an agent through auditing its harness against Claude Code's reference implementation and prepping to close one gap.

## Pull Request Requirements

- One problem per PR. Bundled unrelated changes will be split or sent back.
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
- Run adversarial pressure testing across multiple sessions, not just the
  happy path.
- For behavior-shaping changes, show before/after eval results in the PR
  description. For deterministic changes (instruction-following the agent
  reliably does anyway), state the decision and reasoning to skip the eval
  instead — see "Choosing to test with evals" in `slow-powers:evaluating-skills`.
- Ensure skills are cross-harness compatible: avoid harness-specific tool or feature names.
- Our discipline-enforcing skills should carry at least one *seeded* eval case — one
  that embeds a short prior transcript so the skill is met mid-session under a
  competing attractor — because their real-world failures happen in-flight and a
  cold prompt alone under-measures them (see "Seeding conversation context" in
  `slow-powers:evaluating-skills`). `hardening-plans` is the reference example;
  `test-driven-development`, `verification-before-completion`, and
  `systematic-debugging` are currently cold-only and want seeded cases added.

## Local development

```bash
bun install   # also activates git hooks via the `prepare` script
bun test
bun run check
```

`bun install` runs the `prepare` script, which installs the git hooks
(pre-commit runs typecheck + lint-staged; pre-push runs the test suite). This is
safe for OpenCode consumers because we ship to OpenCode only as a published npm
package, and `prepare` never runs on a registry-tarball install — see
`tests/opencode/install-contract.test.ts`.

`bun scripts/bump-version.ts <version>` updates every manifest in lockstep.
