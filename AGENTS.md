# Superslow — Contributor Guidelines

Superslow is a fork of [obra/superpowers](https://github.com/obra/superpowers)
that ships as a distinct product with its own release cadence. Upstream's
contributor guidance is preserved at
[`docs/superpowers/upstream-CLAUDE.md`](docs/superpowers/upstream-CLAUDE.md)
for historical reference.

## What lives here

This repo ships Superslow across five harnesses:

- `skills/` — Skills, assets, and cross-cutting tests
- `.claude-plugin/` — Claude Code plugin
- `.codex-plugin/` — OpenAI Codex plugin
- `.cursor-plugin/` — Cursor plugin
- `opencode/` — OpenCode plugin (`@slowdini/superslow-opencode`)
- `gemini-extension.json` + `gemini-instructions.md` — Gemini CLI extension (root-level)

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

## Local development

```bash
bun install
bun test
bun run check
```

`scripts/bump-version.js <version>` updates every manifest in lockstep.
See `docs/superpowers/specs/` for design history.
