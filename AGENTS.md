# Superslow — Contributor Guidelines

Superslow is a fork of [obra/superpowers](https://github.com/obra/superpowers)
that ships as a distinct product with its own release cadence. Upstream's
contributor guidance is preserved at
[`docs/superpowers/upstream-CLAUDE.md`](docs/superpowers/upstream-CLAUDE.md)
for historical reference.

## What lives here

This repo ships Superslow across six harnesses (five implemented, one planned):

- `skills/` — Skills, assets, and cross-cutting tests
- `.claude-plugin/` — Claude Code plugin
- `.codex-plugin/` — OpenAI Codex plugin
- `.cursor-plugin/` — Cursor plugin
- `opencode/` — OpenCode plugin (`@slowdini/superslow-opencode`)
- `antigravity-extension.json` — Antigravity CLI plugin (root-level)
- Copilot CLI — *planned*, no plugin files yet

See the [feature support](README.md#feature-support) table in the README for current tier per harness.

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

- Use `superslow:writing-skills` to develop and test changes.
- Run adversarial pressure testing across multiple sessions, not just the
  happy path.
- Show before/after eval results in the PR description.
- Ensure skills are cross-harness compatible: avoid harness-specific tool or feature names.

## Local development

```bash
bun install
bun test
bun run check
```

`bun scripts/bump-version.ts <version>` updates every manifest in lockstep.
See `docs/superpowers/specs/` for design history.
