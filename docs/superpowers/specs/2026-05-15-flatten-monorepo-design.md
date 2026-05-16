# Flatten Monorepo Design

**Date:** 2026-05-15
**Status:** Draft
**Author:** slowdini

## Problem Statement

The repository is currently structured as a Bun workspaces monorepo with a `packages/` directory:

- `packages/core/` — skills, assets, cross-cutting tests
- `packages/claude/` — Claude Code plugin
- `packages/codex/` — OpenAI Codex plugin
- `packages/cursor/` — Cursor plugin
- `packages/opencode/` — OpenCode plugin
- `gemini-extension.json` + `GEMINI.md` — Gemini CLI extension (root-level)

This structure has two acute pain points:

1. **Cross-agent handler skill discovery.** Several agent handlers (Gemini CLI, Claude Code, Codex CLI, Cursor) expect extensions/plugins to expose skills via a root-level or plugin-root `skills/` directory. Keeping skills inside `packages/core/` forces every harness manifest to use brittle relative traversals like `../core/skills/`, `../../core/skills/`, or runtime `require.resolve` hacks. Some handlers don't even support relative path traversal — they expect skills adjacent to the manifest.

2. **Monorepo overhead without monorepo value.** The repo ships no independently versioned packages, has no internal dependency graph worth managing, and gains nothing from workspace tooling. The `packages/` wrapper adds indirection without benefit.

The skills themselves are the product. Every harness exists solely to expose those skills to a specific agent handler. The repository should reflect that reality.

## Goals

- Move skills and assets to the repository root so all harnesses can reference them uniformly.
- Eliminate the `packages/` directory and Bun workspaces indirection.
- Consolidate cross-cutting tests into a single `tests/` directory with harness-specific subdirectories.
- Remove all monorepo relics (workspace scripts, per-package `package.json` files, `bun.lock` workspace entries).
- Document which root-level files serve which harness release target.
- Preserve all existing plugin functionality across Claude, Codex, Cursor, OpenCode, and Gemini.

## Non-Goals

- Independent versioning per harness (all harnesses continue to share a single version).
- Changing skill content or behavior.
- Adding new harnesses.
- Migrating away from Bun as the package manager (though workspace features are no longer used).

## Proposed Architecture

### Target Directory Structure

```
superslow/
├── skills/                          # moved from packages/core/skills/
│   ├── brainstorming/
│   ├── dispatching-parallel-agents/
│   ├── finishing-a-development-branch/
│   ├── receiving-code-review/
│   ├── requesting-code-review/
│   ├── subagent-driven-development/
│   ├── systematic-debugging/
│   ├── test-driven-development/
│   ├── using-git-worktrees/
│   ├── using-superpowers/
│   ├── verification-before-completion/
│   ├── writing-plans/
│   └── writing-skills/
├── assets/                          # moved from packages/core/assets/
│   ├── app-icon.png
│   └── superpowers-small.svg
├── tests/
│   ├── core/                        # moved from packages/core/tests/
│   │   ├── brainstorm-server/
│   │   ├── explicit-skill-requests/
│   │   ├── skill-triggering/
│   │   └── subagent-driven-dev/
│   ├── claude/                      # moved from packages/claude/tests/
│   ├── codex/                       # moved from packages/codex/tests/
│   ├── cursor/                      # moved from packages/cursor/tests/
│   ├── opencode/                    # moved from packages/opencode/tests/
│   └── gemini/                      # new — extension surface validation
├── claude/
│   ├── plugin.json
│   └── hooks/
│       ├── hooks.json
│       ├── run-hook.cmd
│       └── session-start
├── codex/
│   └── plugin.json
├── cursor/
│   ├── .cursor-plugin/
│   │   └── plugin.json
│   ├── install.sh
│   └── hooks/
│       ├── hooks-cursor.json
│       ├── run-hook.cmd
│       └── session-start
├── opencode/
│   ├── plugins/
│   │   └── superpowers.js
│   └── INSTALL.md
├── gemini-extension.json            # already root-level
├── gemini-instructions.md           # already root-level
├── marketplace.json                 # Claude marketplace registry
├── package.json                     # OpenCode manifest + dev tooling
├── docs/                            # planning docs (unchanged)
├── scripts/
│   └── bump-version.js              # updated paths
├── README.md
├── CLAUDE.md
├── GEMINI.md
├── AGENTS.md
├── CHANGELOG.md
├── LICENSE
├── CODE_OF_CONDUCT.md
├── UPSTREAM-RELEASE-NOTES.md
├── biome.json
├── .lintstagedrc.json
├── .markdownlint-cli2.jsonc
├── .gitignore
├── .gitattributes
├── .husky/
└── .github/
```

### Root-Level Files by Concern

| File | Harness | Purpose |
|---|---|---|
| `package.json` | OpenCode | Plugin manifest (`@slowdini/superslow-opencode`), dev tooling scripts |
| `marketplace.json` | Claude Code | Marketplace registry pointing to `claude/` source |
| `claude/plugin.json` | Claude Code | Plugin manifest for Claude's `/plugin` system |
| `codex/plugin.json` | Codex CLI | Plugin manifest for Codex's plugin system |
| `cursor/.cursor-plugin/plugin.json` | Cursor | Cursor plugin manifest |
| `cursor/install.sh` | Cursor | Installation script (symlinked into `~/.cursor/plugins/local/`) |
| `gemini-extension.json` | Gemini CLI | Extension manifest (points to `gemini-instructions.md`) |
| `gemini-instructions.md` | Gemini CLI | Instructions loaded by Gemini on extension activation |
| `skills/` | All | Shared skill library |
| `assets/` | All | Shared assets (icons, images) |

This table lives in `README.md` under a "How it's distributed" section.

## Path Updates

All relative paths that currently traverse through `packages/` are simplified to root-relative references:

### Claude `plugin.json`

```json
// before
"skills": "../core/skills/"
// after
"skills": "./skills/"
```

### Codex `plugin.json`

```json
// before
"skills": "../core/skills/",
"composerIcon": "../core/assets/superpowers-small.svg",
"logo": "../core/assets/app-icon.png"
// after
"skills": "./skills/",
"composerIcon": "./assets/superpowers-small.svg",
"logo": "./assets/app-icon.png"
```

### Cursor `.cursor-plugin/plugin.json`

```json
// before
"skills": "../../core/skills/",
"agents": "../agents/",
"commands": "../commands/",
"hooks": "../hooks/hooks-cursor.json"
// after
"skills": "../../skills/",
"hooks": "../hooks/hooks-cursor.json"
```

Note: `agents/` and `commands/` references are removed because those directories do not exist. The `hooks` path does not change because `.cursor-plugin/` remains a subdirectory inside `cursor/`.

### Cursor `install.sh`

```sh
# before
ln -sfn "$REPO_DIR/packages/cursor" "$HOME/.cursor/plugins/local/superpowers"
# after
ln -sfn "$REPO_DIR/cursor" "$HOME/.cursor/plugins/local/superpowers"
```

### OpenCode `plugins/superpowers.js`

```js
// before
const superpowersSkillsDir = path.resolve(__dirname, "../../core/skills");
// after
const superpowersSkillsDir = path.resolve(__dirname, "../../skills");
```

### Root `marketplace.json`

```json
// before
"source": "./packages/claude/"
// after
"source": "./claude/"
```

### Root `package.json`

Remove `workspaces` field and `--filter '*'` semantics. Replace per-harness `test:*` scripts with direct shell test invocations or a single `test` script that runs all harness tests.

## Monorepo Relics to Remove

These artifacts become unnecessary and are deleted:

- `packages/` directory and all contents
- `bun.lock` — removed entirely (Bun can work without a committed lockfile for a root-only dev dependency set; if needed, it will be regenerated as a non-workspace lockfile)
- Per-package `package.json` files (`packages/core/package.json`, `packages/claude/package.json`, `packages/codex/package.json`, `packages/cursor/package.json`, `packages/opencode/package.json`)
- `scripts/bump-version.js` references to `packages/*/package.json` — updated to scan harness directories instead
- Root `package.json` `workspaces` field and `--filter` semantics in scripts

## Testing Strategy

After relocation, tests are organized by concern rather than by package:

- `tests/core/` — cross-cutting tests (skill triggering, subagent-driven dev, brainstorming server, explicit skill requests)
- `tests/claude/` — Claude-specific integration tests
- `tests/codex/` — Codex-specific tests
- `tests/cursor/` — Cursor-specific tests
- `tests/opencode/` — OpenCode plugin tests
- `tests/gemini/` — Gemini extension surface validation

Each test runner script is updated to no longer reference `packages/` paths. The root `package.json` `test` script runs all test suites sequentially.

## Version Management

`scripts/bump-version.js` is updated to scan the following files for `version` fields:

- `package.json`
- `claude/plugin.json`
- `codex/plugin.json`
- `cursor/.cursor-plugin/plugin.json`
- `gemini-extension.json`
- `marketplace.json`

No `packages/*/package.json` entries remain.

## README Update

The "Repository structure" section in `README.md` is rewritten to reflect the flat layout. A new "How it's distributed" subsection documents the root-level file → harness mapping (the table above). Installation instructions for each harness are verified for path correctness.

## Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Cursor plugin breaks because `install.sh` symlinks wrong path | High | High | Update `install.sh`, test Cursor install locally |
| OpenCode plugin fails to find skills after `../../core/skills` → `../../skills` | High | High | Update JS path, run OpenCode plugin tests |
| Claude/Codex marketplace bundles fail if relative paths wrong | Medium | High | Verify `plugin.json` paths, run integration tests |
| Test scripts break due to moved directories | Medium | Medium | Update all test runner paths, run full test suite |
| Contributors confused by flattened structure | Low | Low | Update README with clear "Repository structure" and "How it's distributed" sections |
| Root `package.json` becomes overloaded (OpenCode manifest + dev tooling) | Low | Low | Document the dual purpose in README; OpenCode expects a standard Node manifest at root anyway |

## Alternatives Considered

**Approach B: Root manifests with support subdirs**
Keep all manifest files at root with prefixed names (`claude-plugin.json`, `cursor-plugin.json`, etc.). Support files live in harness-named subdirs. Rejected because several plugin systems (Claude marketplace, Cursor installer) expect `plugin.json` specifically inside a directory, not a renamed file at root. Risk of breaking discovery is too high.

**Approach C: Keep monorepo, add build-time flattening**
Keep `packages/core/` but add a build step that copies `skills/` and `assets/` to root before release. Rejected because it adds automation complexity without solving the core problem: the source of truth for skills should be where the harnesses expect them. A build step is an unnecessary band-aid.

## Decision Log

| Date | Decision | Rationale |
|---|---|---|
| 2026-05-15 | Flatten to root-level skills + harness microdirectories | Skills are the product; root placement eliminates brittle relative paths |
| 2026-05-15 | Remove Bun workspaces | No independent packages to manage; workspace tooling adds indirection |
| 2026-05-15 | Remove `bun.lock` | Root-only dev dependencies don't need a committed lockfile; simplify |
| 2026-05-15 | Keep harnesses in small top-level directories | Plugin ecosystems expect manifests inside directories, not at root |
| 2026-05-15 | Consolidate tests under `tests/` | Mirrors harness directory structure; easy to run subsets |
