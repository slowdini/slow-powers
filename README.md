# Slow-powers

Slow-powers gives your agent superpowers. It's a complete software development
methodology for coding agents — a set of composable skills plus a bootstrap
that ensures the agent reaches for them at the right moments.

## About this fork

Slow-powers is a fork of [obra/superpowers](https://github.com/obra/superpowers)
at v5.1.0. We preserve the overall workflow of superpowers, while fixing bugs
and clarifying skill content.

## Quickstart

Give your agent superpowers with slow-powers: [Claude Code](#claude-code) · [Codex CLI](#codex-cli) · [Cursor](#cursor) · [OpenCode](#opencode). Support varies per harness — see the [feature support](#feature-support) table.

## Feature support

| Harness         | Status   | Notes                                                          |
|-----------------|----------|----------------------------------------------------------------|
| Claude Code     | Full     | Reference implementation                                       |
| Codex CLI       | Partial  | Plugin manifest + shared hooks; no eval transcript adapter     |
| Cursor          | Partial  | Plugin manifest + dedicated hooks; no eval transcript adapter  |
| OpenCode        | Partial  | JS plugin with bootstrap injection; no eval transcript adapter |

Contributors closing parity gaps should follow [`harness-parity-check.md`](./harness-parity-check.md): it audits which Slow-powers features are wired up for a given harness and preps an agent to close one gap.

## How it works

Slow-powers integrates directly into your agent's session, providing a highly disciplined set of technical execution utilities. It enforces strict test-driven development (TDD), systematic scientific debugging, rigorous verification checks, safe workspace isolation via git worktrees, and clean branch-finishing hygiene. It also enhances native agent planning phases with strict rules: banning placeholders, enforcing atomic task granularity, and requiring TDD-first checklists.

## Installation

Installation differs by harness. If you use more than one, install
Slow-powers separately for each.

### Claude Code

```
/plugin marketplace add slowdini/slow-powers
/plugin install slow-powers@slow-powers
```

### Codex CLI

```bash
codex plugin marketplace add slowdini/slow-powers
```

Then install the `slow-powers` plugin from the `slow-powers` marketplace
through Codex's plugin interface.

To enable automatic `SessionStart` bootstrap in current Codex releases, add this to `~/.codex/config.toml` and restart Codex:

```toml
[features]
plugin_hooks = true
```

### Cursor

Cursor has no native git-install path. The Slow-powers installer clones the
repo (or reuses an existing checkout) and symlinks the plugin into Cursor's
local plugin directory.

```bash
curl -fsSL https://raw.githubusercontent.com/slowdini/slow-powers/main/.cursor-plugin/install.sh | sh
```

### OpenCode

Add Slow-powers to the `plugin` array in your `opencode.json` (global or project-level):

```json
{
  "plugin": ["github:slowdini/slow-powers#main"]
}
```

## The Core Execution Utilities

Slow-powers provides a set of highly focused, execution-level skills that ensure your agent operates with maximum discipline:

1. **`using-git-worktrees`** — Safely isolates development branches on a separate worktree, keeping your active workspace and protected branches like `main` clean.
2. **`test-driven-development`** — Enforces a strict RED-GREEN-REFACTOR cycle, ensuring all production code is backed by failing test verification first.
3. **`systematic-debugging`** — Guides the agent to locate the root cause of failures via scientific hypothesis testing, avoiding "guess-and-check" thrashing.
4. **`verification-before-completion`** — Requires running actual test/build commands and presenting concrete evidence before making any success claims.
5. **`finishing-a-development-branch`** — Manages local branch hygiene, runs final test verifications, and cleans up git worktrees.
6. **`writing-skills`** — Handles future custom skill authoring and updates.

## What's inside

**Testing & Verification** — `test-driven-development`, `verification-before-completion`

**Debugging** — `systematic-debugging`

**Workspace & Git Hygiene** — `using-git-worktrees`, `finishing-a-development-branch`

**Meta & Extension** — `writing-skills`

## Philosophy

- Test-Driven Development — write tests first, always
- Systematic over ad-hoc — process over guessing
- Complexity reduction — simplicity as a primary goal
- Evidence over claims — verify before declaring success

## Repository structure

Flat layout — skills and assets live at root, harness-specific integration lives in top-level directories:

- `skills/` — All slow-powers skills
- `assets/` — Icons and images shared across harnesses
- `tests/` — Cross-cutting and harness-specific tests
- `.claude-plugin/` — Claude Code plugin manifest and hooks
- `.codex-plugin/` — OpenAI Codex plugin manifest
- `.cursor-plugin/` — Cursor plugin manifest, hooks, and install script
- `opencode/` — OpenCode plugin and installation docs
- `.claude-plugin/marketplace.json` — Claude Code marketplace registry
- `package.json` — OpenCode plugin manifest + dev tooling
- `harness-parity-check.md` — Instructions for an agent in any harness to audit feature gaps and prep to close one

## Releasing

Releases are cut from `dev` and tagged from `main`:

1. Merge feature PRs into `dev` after CI passes.
2. When ready to ship, trigger the **Release PR** workflow with the next
   version number. It bumps every manifest via `scripts/bump-version.ts`,
   commits to `dev`, and opens a `dev → main` PR.
3. Review the release PR (full test matrix runs on it) and merge.
4. Merging to `main` automatically tags `vX.Y.Z` and creates the GitHub
   release. Notes come from the release PR body, or auto-generated if empty.

See `.github/workflows/` for the workflow definitions.

## License

MIT — see [`LICENSE`](./LICENSE).
