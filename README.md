# Superslow

Superslow gives your agent superpowers. It's a complete software development
methodology for coding agents — a set of composable skills plus a bootstrap
that ensures the agent reaches for them at the right moments.

## About this fork

Superslow is a fork of [obra/superpowers](https://github.com/obra/superpowers)
at v5.1.0. The skill content and vocabulary (the `superpowers:` skill
prefix, the `using-superpowers` bootstrap) are preserved verbatim — the
*product* is Superslow, the *skills* are still called superpowers.

Upstream's full release history is archived at
[`UPSTREAM-RELEASE-NOTES.md`](./UPSTREAM-RELEASE-NOTES.md). Superslow's own
release notes live in [`CHANGELOG.md`](./CHANGELOG.md).

## Quickstart

Give your agent Superslow: [Claude Code](#claude-code) · [Codex CLI](#codex-cli) · [Cursor](#cursor) · [OpenCode](#opencode) · [Gemini CLI](#gemini-cli).

## How it works

From the moment you fire up your coding agent, Superslow steps in before
code gets written. It teases out a spec through conversation, presents it
in digestible chunks, then writes an implementation plan clear enough for
a junior engineer to follow. It enforces red/green TDD, YAGNI, and DRY,
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

### Codex CLI

```bash
codex plugin marketplace add slowdini/superslow
```

Then install the `superpowers` plugin from the `superslow` marketplace
through Codex's plugin interface.

### Cursor

Cursor has no native git-install path. The Superslow installer clones the
repo (or reuses an existing checkout) and symlinks the plugin into Cursor's
local plugin directory.

```bash
curl -fsSL https://raw.githubusercontent.com/slowdini/superslow/main/packages/cursor/install.sh | sh
```

Review the script before running if you prefer:
<https://github.com/slowdini/superslow/blob/main/packages/cursor/install.sh>

Restart Cursor after install.

### OpenCode

Tell OpenCode:

```
Fetch and follow instructions from https://raw.githubusercontent.com/slowdini/superslow/refs/heads/main/packages/opencode/INSTALL.md
```

Detailed docs: [`packages/opencode/INSTALL.md`](packages/opencode/INSTALL.md).

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

**Meta** — `writing-skills`, `using-superpowers`

## Philosophy

- Test-Driven Development — write tests first, always
- Systematic over ad-hoc — process over guessing
- Complexity reduction — simplicity as a primary goal
- Evidence over claims — verify before declaring success

## Repository structure

Bun workspaces monorepo:

- `packages/core/` — Skills, assets, cross-cutting tests
- `packages/claude/` — Claude Code plugin
- `packages/codex/` — OpenAI Codex plugin
- `packages/cursor/` — Cursor plugin
- `packages/opencode/` — OpenCode plugin
- `extension.json` + `GEMINI.md` — Gemini CLI extension (root-level)

## Contributing

See [`CLAUDE.md`](./CLAUDE.md) for contributor guidelines. Issues live at
<https://github.com/slowdini/superslow/issues>.

## Updating

| Harness | Update command |
|---|---|
| Claude Code | `/plugin marketplace update superslow` |
| Codex CLI | `codex plugin marketplace upgrade superslow` |
| Cursor | Re-run `install.sh` (it pulls latest into the cloned repo) |
| OpenCode | Re-run the INSTALL.md flow |
| Gemini CLI | `gemini extensions update superpowers` |

## License

MIT — see [`LICENSE`](./LICENSE).
