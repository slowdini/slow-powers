# Superslow

Superslow gives your agent superpowers. It's a complete software development
methodology for coding agents — a set of composable skills plus a bootstrap
that ensures the agent reaches for them at the right moments.

## About this fork

Superslow is a fork of [obra/superpowers](https://github.com/obra/superpowers)
at v5.1.0. We preserve the overall workflow of superpowers, while fixing bugs
and clarifying skill content.

Upstream's full release history is archived at
[`UPSTREAM-RELEASE-NOTES.md`](./UPSTREAM-RELEASE-NOTES.md). Superslow's own
release notes live in [`CHANGELOG.md`](./CHANGELOG.md).

## Quickstart

Give your agent superpowers with superslow: [Claude Code](#claude-code) · [Copilot CLI](#copilot-cli) · [Codex CLI](#codex-cli) · [Cursor](#cursor) · [OpenCode](#opencode) · [Gemini CLI](#gemini-cli).

## How it works

Superslow steps in before code gets written, providing workflows for
professional development work. It teases out a spec through conversation,
presents it in digestible chunks, then writes an implementation plan clear
enough for a junior engineer to follow. It enforces red/green TDD, YAGNI, and DRY,
and dispatches subagents per task with two-stage review. Skills trigger
automatically — you don't have to invoke them manually.

## Installation

Installation differs by harness. If you use more than one, install
Superslow separately for each.

### Claude Code

```
/plugin marketplace add slowdini/superslow
/plugin install superpowers@superslow
```

### Copilot CLI

```bash
copilot plugin marketplace add slowdini/superslow
copilot plugin install superslow@slowdini
```

### Codex CLI

```bash
codex plugin marketplace add slowdini/superslow
```

Then install the `superpowers` plugin from the `superslow` marketplace
through Codex's plugin interface.

To enable automatic `SessionStart` bootstrap in current Codex releases, add this to `~/.codex/config.toml` and restart Codex:

```toml
[features]
plugin_hooks = true
```

### Cursor

Cursor has no native git-install path. The Superslow installer clones the
repo (or reuses an existing checkout) and symlinks the plugin into Cursor's
local plugin directory.

```bash
curl -fsSL https://raw.githubusercontent.com/slowdini/superslow/main/.cursor-plugin/install.sh | sh
```

Review the script before running if you prefer:
<https://github.com/slowdini/superslow/blob/main/.cursor-plugin/install.sh>

Restart Cursor after install.

### OpenCode

Tell OpenCode:

```
Fetch and follow instructions from https://raw.githubusercontent.com/slowdini/superslow/refs/heads/main/opencode/INSTALL.md
```

Detailed docs: [`opencode/INSTALL.md`](opencode/INSTALL.md).

### Gemini CLI

```bash
gemini extensions install https://github.com/slowdini/superslow
```

To update:

```bash
gemini extensions update superpowers
```

## The Basic Workflow

1. **brainstorming** — refines rough ideas through questions, explores
   alternatives, presents the design in sections for validation.
2. **using-git-worktrees** — creates an isolated workspace on a new branch
   after design approval.
3. **writing-plans** — breaks the work into bite-sized tasks with exact
   file paths and complete code.
4. **subagent-driven-development** — dispatches a fresh subagent per task
   with two-stage review (spec compliance, then code quality).
5. **test-driven-development** — enforces RED-GREEN-REFACTOR.
6. **requesting-code-review** — reviews against the plan, reports issues
   by severity; critical issues block progress.
7. **finishing-a-development-branch** — verifies tests, presents options
   (merge, PR, keep, discard), cleans up the worktree.

The agent checks for relevant skills before any task. These are mandatory
workflows, not suggestions.

## What's inside

**Testing** — `test-driven-development`

**Debugging** — `systematic-debugging`, `verification-before-completion`

**Collaboration** — `brainstorming`, `writing-plans`,
`dispatching-parallel-agents`, `requesting-code-review`,
`receiving-code-review`, `using-git-worktrees`,
`finishing-a-development-branch`, `subagent-driven-development`

**Meta** — `writing-skills`

## Philosophy

- Test-Driven Development — write tests first, always
- Systematic over ad-hoc — process over guessing
- Complexity reduction — simplicity as a primary goal
- Evidence over claims — verify before declaring success

## Repository structure

Flat layout — skills and assets live at root, harness-specific integration lives in top-level directories:

- `skills/` — All superpowers skills
- `assets/` — Icons and images shared across harnesses
- `tests/` — Cross-cutting and harness-specific tests
- `.claude-plugin/` — Claude Code plugin manifest and hooks
- `.codex-plugin/` — OpenAI Codex plugin manifest
- `.cursor-plugin/` — Cursor plugin manifest, hooks, and install script
- `opencode/` — OpenCode plugin and installation docs
- `gemini-extension.json` + `gemini-instructions.md` — Gemini CLI extension
- `.claude-plugin/marketplace.json` — Claude Code marketplace registry
- `package.json` — OpenCode plugin manifest + dev tooling

## Contributing

See [`CLAUDE.md`](./CLAUDE.md) for contributor guidelines. Issues live at
<https://github.com/slowdini/superslow/issues>.

## Releasing

Releases are cut from `dev` and tagged from `main`:

1. Merge feature PRs into `dev` after CI passes.
2. When ready to ship, trigger the **Release PR** workflow with the next
   version number. It bumps every manifest via `scripts/bump-version.js`,
   commits to `dev`, and opens a `dev → main` PR.
3. Review the release PR (full test matrix runs on it) and merge.
4. Merging to `main` automatically tags `vX.Y.Z` and creates the GitHub
   release. Notes come from the release PR body, or auto-generated if empty.

See `.github/workflows/` for the workflow definitions.

## License

MIT — see [`LICENSE`](./LICENSE).
