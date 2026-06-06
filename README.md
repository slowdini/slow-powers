# Slow-powers

Slow-powers gives your agent superpowers. It's a complete software development
methodology for coding agents — a set of composable skills plus a bootstrap
that ensures the agent reaches for them at the right moments.

## About this fork

Slow-powers is a fork of [obra/superpowers](https://github.com/obra/superpowers)
at v5.1.0. We preserve the overall workflow of superpowers, while fixing bugs
and clarifying skill content.

## Quickstart

Give your agent superpowers with slow-powers: [Claude Code](#claude-code) · [Codex CLI](#codex-cli) · [OpenCode](#opencode). Support varies per harness — see the [feature support](#feature-support) tables.

## Feature support

Parity is tracked on two independent surfaces. **Plugin distribution** is how Slow-powers reaches a user's session — manifests, bootstrap injection, skill discovery, hooks:

| Harness         | Status   | Notes                                                                             |
|-----------------|----------|-----------------------------------------------------------------------------------|
| Claude Code     | Full     | Reference implementation                                                          |
| Codex CLI       | Full     | Plugin manifest + shared `hooks/hooks.json`; the plan hand-off hook is Claude-native (N/A here, see #141) |
| OpenCode        | Full     | JS plugin (npm package) injects bootstrap and registers skills via the native plugin API |

The **skill-eval runner** — now the standalone [`@slowdini/eval-runner`](https://www.npmjs.com/package/@slowdini/eval-runner) package (`slow-powers:evaluating-skills` teaches authoring the evals it runs) — is tracked separately:

| Harness         | Status   | Notes                                                                             |
|-----------------|----------|-----------------------------------------------------------------------------------|
| Claude Code     | Full     | Reference implementation: transcript adapter, auto-record, `--guard`, `--plan-mode` |
| Codex CLI       | Manual   | No transcript adapter — hand-authored run records; `llm_judge` assertions carry the measurement |
| OpenCode        | Manual   | No transcript adapter — hand-authored run records; `llm_judge` assertions carry the measurement |

Contributors closing parity gaps should follow [`harness-parity-check.md`](./harness-parity-check.md) for distribution gaps, or the `@slowdini/eval-runner` docs (`docs/harness-parity.md`) for eval-runner gaps: each audits which features are wired up for a given harness and preps an agent to close one gap.

## How it works

Slow-powers integrates directly into your agent's session, providing a highly disciplined set of technical execution utilities. It enforces strict test-driven development (TDD), systematic scientific debugging, rigorous verification checks, safe workspace isolation so new work doesn't collide with existing work, and clean branch-finishing hygiene. It also enhances native agent planning phases with strict rules: banning placeholders, enforcing atomic task granularity, and requiring TDD-first checklists.

## Installation

Installation differs by harness. If you use more than one, install
Slow-powers separately for each.

### Install with your agent

Don't want to look up the steps? Open the harness you want Slow-powers on and
paste this prompt to its agent — it'll read the guide, work out which harness
it's in, and do the install for you:

```text
Install the "slow-powers" plugin for the coding-agent harness you are currently
running in. Read the installation guide at
https://github.com/slowdini/slow-powers#installation, determine which harness
this is (Claude Code, Codex CLI, or OpenCode), and follow the matching steps —
run the documented marketplace/install commands for Claude Code or Codex, or add
the package to the `plugin` array in opencode.json for OpenCode. Then tell me
exactly what you changed and what I need to do to finish (e.g. restart the
session so the skills load).
```

The per-harness instructions below are the source of truth the agent follows —
and the reference for installing by hand.

### Claude Code

```
/plugin marketplace add slowdini/slow-powers
/plugin install slow-powers@slow-powers
```

### Codex CLI

```bash
codex plugin marketplace add slowdini/slow-powers
codex plugin add slow-powers@slowdini
```

You can also browse and install it interactively: run `codex`, open
`/plugins`, choose the `slowdini` marketplace, and install `slow-powers`.
Start a new Codex thread after installing so the bundled skills are loaded.

Slow-powers includes a plugin-bundled `SessionStart` hook for bootstrap
context. Codex hooks are stable, but plugin hooks must be reviewed and trusted
before Codex runs them.

### OpenCode

Add Slow-powers to the `plugin` array in your `opencode.json` (global or project-level):

```json
{
  "plugin": ["@slowdini/slow-powers-opencode"]
}
```

This installs the latest published version from npm.

## The Core Execution Utilities

Slow-powers provides a set of highly focused, execution-level skills that ensure your agent operates with maximum discipline:

1. **`working-in-isolation`** — Establishes an isolated workspace so new work doesn't collide with existing or in-progress work, keeping protected branches like `main` clean.
2. **`test-driven-development`** — Enforces a strict RED-GREEN-REFACTOR cycle, ensuring all production code is backed by failing test verification first.
3. **`systematic-debugging`** — Guides the agent to locate the root cause of failures via scientific hypothesis testing, avoiding "guess-and-check" thrashing.
4. **`verifying-development-work`** — Requires running actual test/build commands and presenting concrete evidence before any success claim, with a final review pass over the change before work is handed back.
5. **`writing-skills`** — Handles future custom skill authoring and updates.

## What's inside

**Testing & Verification** — `test-driven-development`, `verifying-development-work`

**Debugging** — `systematic-debugging`

**Workspace & Git Hygiene** — `working-in-isolation`

**Meta & Extension** — `writing-skills`

## Intended Workflows

The skills declare lightweight prerequisite / next-step gates so the agent knows the intended sequence. These gates **suggest** what comes before and after a skill once it is invoked; they do **not** restrict when any skill can be invoked. An agent may invoke `test-driven-development`, `verifying-development-work`, or any other skill at any point.

**Plan mode:** plan mode → `hardening-plans` → `working-in-isolation` → `test-driven-development` → `verifying-development-work`

**Debugging:** (`working-in-isolation`) → `systematic-debugging` → `verifying-development-work`

`hardening-plans` points to `test-driven-development` as its next step, and `test-driven-development` requires `working-in-isolation` first — so isolation is reached as TDD's prerequisite, producing the plan-mode order above.

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
- `opencode/` — OpenCode plugin
- `.claude-plugin/marketplace.json` — Claude Code marketplace registry
- `package.json` — OpenCode plugin manifest + dev tooling
- `harness-parity-check.md` — Instructions for an agent in any harness to audit plugin-distribution gaps and prep to close one (the eval runner's counterpart lives in the `@slowdini/eval-runner` docs at `docs/harness-parity.md`)

## Releasing

Releases are cut from `dev` and tagged from `main`:

1. Merge feature PRs into `dev` after CI passes.
2. When ready to ship, trigger the **Release PR** workflow with the next
   version number. It bumps every manifest via `scripts/bump-version.ts`,
   commits to `dev`, and opens a `dev → main` PR.
3. Review the release PR (full test matrix runs on it) and merge.
4. Merging to `main` automatically tags `vX.Y.Z`, creates the GitHub release,
   and publishes `@slowdini/slow-powers-opencode` to npm.
   Notes come from the release PR body, or auto-generated if empty.

See `.github/workflows/` for the workflow definitions.

### Required secrets

Only one secret is needed. Configure it in **Settings → Secrets and variables →
Actions**:

| Secret | Type | Used by | Scope / permissions |
|--------|------|---------|---------------------|
| `RELEASE_PR_TOKEN` | GitHub PAT (fine-grained or classic) | `release-pr.yml` | Push to `dev` (Contents: write) and open PRs (Pull requests: write). Required so the release PR triggers CI — PRs opened by the default `GITHUB_TOKEN` do not. |

## License

MIT — see [`LICENSE`](./LICENSE).
