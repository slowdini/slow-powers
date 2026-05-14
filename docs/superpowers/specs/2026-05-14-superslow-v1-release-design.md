# Superslow v1.0.0 Release Design

**Status:** Draft
**Date:** 2026-05-14
**Author:** Max Haarhaus

## Summary

This spec defines the v1.0.0 release of **Superslow**, a fork of
[obra/superpowers](https://github.com/obra/superpowers) at upstream v5.1.0
(commit `f2cbfbe`). The fork repositions as a distinct product while
preserving upstream's skill content and vocabulary verbatim. The release is
self-hosted across all five supported agent harnesses (Claude Code, OpenAI
Codex, Cursor, OpenCode, Gemini CLI); no external marketplace submissions
are in scope for v1.

## Goals

1. Publish an installable v1.0.0 for every supported harness, so the fork
   can be exercised end-to-end across all five agents.
2. Establish a clean product identity (Superslow) distinct from upstream.
3. Preserve upstream's tested skill vocabulary (`superpowers:` skill prefix,
   `using-superpowers` bootstrap, in-skill language) — the *product* is
   renamed, the *skills* are not.
4. Define a manual release procedure suitable for the v1 cycle. Automation
   is post-v1 work.

## Non-goals

- GitHub Actions release workflow (deferred).
- Submissions to `openai/plugins`, Cursor's marketplace, or Anthropic's
  `claude-plugins-official` (deferred).
- Per-package independent versioning (lockstep for v1).
- New branding artwork (placeholder TODOs left in manifests).
- Factory Droid and GitHub Copilot CLI integrations (upstream supports
  these; Superslow does not include them).

## Identity

**Product name:** Superslow.

**Tagline:** Superslow gives your agent superpowers.

**npm namespace:** `@slowdini/superslow-*` (renamed from
`@slowdini/superpowers-*`). Six packages: `core`, `claude`, `codex`,
`cursor`, `opencode`, `gemini`.

**Skill vocabulary preserved:** the `superpowers:` skill prefix,
`using-superpowers` bootstrap skill, and all in-skill prose stay verbatim.
The `plugin.json`/`extension.json` files' `name` field stays `"superpowers"`
because that's what generates the skill prefix in Claude and Codex.

**GitHub repo:** `slowdini/superslow` (renamed from `slowdini/superpowers`;
GitHub auto-redirects the old URL).

**Author:** Max Haarhaus, `samiamorwas@gmail.com`. Replaces every
`Jesse Vincent`/`jesse@fsck.com` occurrence in manifests, except in legal
copyright lines in `LICENSE` (where the original copyright is preserved and
a new copyright line is added).

**Brand:** Manifests retain upstream's amber `#F59E0B` and
`superpowers-small.svg` placeholder logo for v1; replace with new art
post-v1 (tracked as TODOs in manifests).

## Versioning

- v1.0.0 is a fresh start. Upstream lineage is documented in `README.md` and
  `CHANGELOG.md`, but version numbers do not continue from upstream's
  5.x line.
- All packages move in lockstep at one shared version.
- `scripts/bump-version.js` updates every manifest in one shot.

## Distribution

For v1, every harness installs directly from `slowdini/superslow`. No
external marketplace submissions.

### Claude Code

- `marketplace.json` lives at repo root (moved from
  `packages/claude/marketplace.json`).
- Marketplace `name`: `"superslow"`. Plugin `name`: `"superpowers"`.
- Plugin `source` points at `./packages/claude/`.
- `packages/claude/plugin.json` stays in place; only its content (URLs,
  author, version) is updated.

**Install:**
```
/plugin marketplace add slowdini/superslow
/plugin install superpowers@superslow
```

### OpenAI Codex

- New `.agents/plugins/marketplace.json` at repo root (Codex's expected
  location per its docs).
- Marketplace `name`: `"superslow"`. Plugin `name`: `"superpowers"`.
- Plugin `source.path`: `"../../packages/codex"` (relative to the
  marketplace.json file). Verify this resolves correctly during
  implementation; fallback is a symlink
  `.agents/plugins/plugins/superpowers → ../../../packages/codex`.
- `packages/codex/plugin.json` stays in place; content updated.

**Install:**
```
codex plugin marketplace add slowdini/superslow
```
(followed by the plugin install step in Codex's UI — exact command verified
during implementation.)

### Cursor

- Cursor expects the manifest at `<plugin-root>/.cursor-plugin/plugin.json`.
  Move `packages/cursor/plugin.json` →
  `packages/cursor/.cursor-plugin/plugin.json`.
- Cursor has no native git-install path. Ship `packages/cursor/install.sh`
  which clones the repo (if needed) and symlinks `packages/cursor/` into
  `~/.cursor/plugins/local/superpowers`.

`packages/cursor/install.sh`:
```sh
#!/usr/bin/env sh
set -e
REPO_DIR="${SUPERSLOW_DIR:-$HOME/.local/share/superslow}"
mkdir -p "$(dirname "$REPO_DIR")"
[ -d "$REPO_DIR/.git" ] || git clone https://github.com/slowdini/superslow "$REPO_DIR"
mkdir -p "$HOME/.cursor/plugins/local"
ln -sfn "$REPO_DIR/packages/cursor" "$HOME/.cursor/plugins/local/superpowers"
echo "Superslow installed for Cursor. Restart Cursor to load."
```

**Install:**
```
curl -fsSL https://raw.githubusercontent.com/slowdini/superslow/main/packages/cursor/install.sh | sh
```
README notes the standard caveat about reviewing curl-piped shell scripts.

### OpenCode

- `packages/opencode/package.json`: move `@slowdini/superslow-core` from
  `peerDependencies` to `dependencies`. Bun replaces the `workspace:*`
  specifier with the published version at publish time, so users get core
  via standard npm resolution.
- `packages/opencode/INSTALL.md`: every `obra/superpowers` retargeted to
  `slowdini/superslow`; every `@slowdini/superpowers-*` retargeted to
  `@slowdini/superslow-*`.

**Install (user tells OpenCode):**
```
Fetch and follow instructions from https://raw.githubusercontent.com/slowdini/superslow/refs/heads/main/packages/opencode/INSTALL.md
```

### Gemini CLI

- `packages/gemini/extension.json` content updated (URLs, author, version).
  No structural moves.

**Install:**
```
gemini extensions install https://github.com/slowdini/superslow
```

## Monorepo cross-package references

Harness `plugin.json`/`extension.json` files reference core skills via the
relative path `../core/skills/`. Verified by install mechanism:

| Harness | Mechanism | `../core/` resolves? |
|---|---|---|
| Claude | Marketplace install clones whole repo to local cache | Expected yes — verify at implementation |
| Codex | Same | Expected yes — verify at implementation |
| Cursor | `install.sh` symlinks `packages/cursor/` from the cloned repo | Yes (symlink target is in the cloned repo) |
| OpenCode | npm package; JS entry uses `require('@slowdini/superslow-core/...')` | Yes (node module resolution; relative path not used) |
| Gemini | `gemini extensions install <git-url>` clones the whole repo | Expected yes — verify at implementation |

No "flatten core into each harness" build step is needed for v1. If
verification reveals Claude/Codex/Gemini do not resolve `../core/` in
practice, a sync step is added in a follow-up.

## Repo restructure summary

Files moved or created:

| Path | Action |
|---|---|
| `marketplace.json` | New (at repo root, for Claude) |
| `packages/claude/marketplace.json` | Delete (moved to root) |
| `.agents/plugins/marketplace.json` | New (for Codex) |
| `packages/cursor/.cursor-plugin/plugin.json` | New (moved from `packages/cursor/plugin.json`) |
| `packages/cursor/plugin.json` | Delete (moved to `.cursor-plugin/`) |
| `packages/cursor/install.sh` | New (Cursor install helper) |
| `CHANGELOG.md` | New (at repo root) |
| `RELEASE-NOTES.md` | Rename to `UPSTREAM-RELEASE-NOTES.md` |
| `docs/superpowers/upstream-CLAUDE.md` | New (preserves the upstream contributor guide) |

`scripts/bump-version.js` file list updates:

- Remove: `packages/claude/marketplace.json`, `packages/cursor/plugin.json`
- Add: `marketplace.json`, `.agents/plugins/marketplace.json`,
  `packages/cursor/.cursor-plugin/plugin.json`

## Package privacy

Of the six packages, only `core` and `opencode` are published to npm.
`claude`, `codex`, `cursor`, and `gemini` ship via git-based install paths
and have `package.json` only for workspace identification. Each of those
four gets `"private": true` in its `package.json` so `bun publish` skips
them. The existing `publish:all` script (`bun run --filter '*' publish
--access public`) needs no change — bun respects the privacy flag.

## Content rewrites

### `README.md`

- New title: "Superslow".
- New tagline and opening paragraph.
- "About this fork" section near the top: 2–3 sentences crediting
  `obra/superpowers`, linking to upstream, explaining Superslow's
  independent cadence.
- Install table reduced to the five harnesses we actually ship (drop
  Factory Droid and GitHub Copilot CLI).
- Every install command/URL retargeted to `slowdini/superslow`.
- "Sponsorship" section: removed.
- "Community" section: removed.
- "Contributing" section: kept in spirit; upstream-specific language
  stripped; issues link points at `slowdini/superslow/issues`.
- "Updating" section: rewritten per-harness with the actual update commands
  (`/plugin marketplace update superslow` for Claude, `codex plugin
  marketplace upgrade superslow` for Codex, re-run `install.sh` for Cursor,
  re-run INSTALL.md flow for OpenCode, `gemini extensions update
  superpowers` for Gemini — verify exact commands during implementation).

### `CLAUDE.md` / `AGENTS.md`

- Current `CLAUDE.md` is upstream contributor guidance ("94% PR rejection
  rate", `obra/superpowers` references, etc.) and is symlinked from
  `AGENTS.md`. It does not apply to this fork.
- Replace with a Superslow-specific contributor guide. Keep the symlink
  arrangement.
- Preserve the original upstream version at
  `docs/superpowers/upstream-CLAUDE.md` for historical reference.

### `LICENSE`

- Stays MIT. Preserve the original copyright line. Add a new copyright line
  for Max Haarhaus / slowdini.

### Manifests (every `package.json`, `plugin.json`, `marketplace.json`, `extension.json`)

- `name` (npm): `@slowdini/superslow-*` (replaces `@slowdini/superpowers-*`).
- `name` (plugin/extension): stays `"superpowers"` to preserve the skill
  prefix.
- `displayName` / `interface.displayName`: "Superslow" where applicable.
- `description`: rewritten to position Superslow as the product.
- `author` / `owner`: Max Haarhaus, `samiamorwas@gmail.com`.
- `homepage` / `repository`: `https://github.com/slowdini/superslow`.

## Changelog

`CHANGELOG.md` follows Keep a Changelog format. First entry:

```markdown
## [1.0.0] — 2026-05-14

First release of Superslow. Forked from
[obra/superpowers](https://github.com/obra/superpowers) at v5.1.0
(commit f2cbfbe) and rebranded as a product with its own release cadence.

### Added

- Self-hosted Claude marketplace (`marketplace.json` at repo root)
- Self-hosted Codex marketplace (`.agents/plugins/marketplace.json`)
- Cursor install helper at `packages/cursor/install.sh`

### Changed

- npm packages renamed `@slowdini/superpowers-*` → `@slowdini/superslow-*`
- OpenCode core dependency moved from `peerDependencies` to `dependencies`
- All upstream-specific URLs, attribution, and marketplace names retargeted
  to `slowdini/superslow`
- README rewritten for Superslow identity and trimmed to the five harnesses
  we ship

### Removed

- Sponsorship and Community sections from README
- Upstream-specific contributor guidance from CLAUDE.md (preserved at
  `docs/superpowers/upstream-CLAUDE.md`)
- Factory Droid and GitHub Copilot CLI install sections from README

### Notes

- Upstream's full release history is archived at `UPSTREAM-RELEASE-NOTES.md`
```

## Release procedure (manual, v1)

1. Create release branch `release/v1.0.0`.
2. On the branch:
   - Run `node scripts/bump-version.js 1.0.0`.
   - Update `CHANGELOG.md` with the v1.0.0 entry.
   - Commit: `chore: release v1.0.0`.
3. Open PR, review the complete diff, merge to `main`.
4. From `main`:
   - `git tag -a v1.0.0 -m "Superslow 1.0.0"`
   - `git push origin main v1.0.0`
   - `bun run publish:all` (publishes `@slowdini/superslow-core` and
     `@slowdini/superslow-opencode` to npm; requires `npm login` with
     publish rights on the `@slowdini` org — confirmed available).
   - `gh release create v1.0.0` with notes drawn from the `CHANGELOG.md`
     v1.0.0 entry.
5. Run the per-harness smoke tests (Verification section below).
6. If any smoke test fails: fix on a new branch, repeat from step 1 with
   `1.0.1`.

## Verification

### Pre-release checks (on `release/v1.0.0`, before tagging)

- `bun install` succeeds (workspace deps resolve).
- `bun test` passes across all packages.
- `bun run check` passes (Biome + markdownlint).
- Every JSON manifest validates: root `package.json`, all
  `packages/*/package.json`, `marketplace.json`,
  `.agents/plugins/marketplace.json`, `packages/claude/plugin.json`,
  `packages/codex/plugin.json`,
  `packages/cursor/.cursor-plugin/plugin.json`,
  `packages/gemini/extension.json`.
- `node scripts/bump-version.js 1.0.0` updates every targeted file (grep
  `"version": "1.0.0"` across the file list to confirm).
- Grep for leftover `obra/`, `superpowers-dev`, `Jesse`, `fsck.com`,
  `@slowdini/superpowers-` strings; nothing should remain in shipped files
  (the `UPSTREAM-RELEASE-NOTES.md` archive is the only legitimate
  exception).

### Per-harness post-release smoke test

For each harness, in a clean session / fresh environment, run the README
install command, then send:

> Let's make a react todo list

**Pass criteria:** the agent invokes `superpowers:brainstorming` before
writing code (or describing implementation). This proves the
`using-superpowers` bootstrap loads at session start.

| Harness | Setup |
|---|---|
| Claude Code | Fresh project dir; `/plugin marketplace add slowdini/superslow`; `/plugin install superpowers@superslow`; restart Claude |
| Codex | Fresh project dir; `codex plugin marketplace add slowdini/superslow`; plugin install via Codex UI |
| Cursor | Fresh Cursor instance; run `install.sh`; restart Cursor; verify `~/.cursor/plugins/local/superpowers/.cursor-plugin/plugin.json` resolves |
| OpenCode | Fresh project dir; send the INSTALL.md fetch prompt; agent runs install steps |
| Gemini CLI | Fresh dir; `gemini extensions install https://github.com/slowdini/superslow` |

### Failure recovery

- npm packages are immutable once published. A broken `core`/`opencode`
  requires a `1.0.1` patch release.
- Git-installed harnesses (Claude/Codex/Cursor/Gemini) can be fixed on
  `main` without a version bump, but a `1.0.1` tag is cut anyway for
  hygiene so users have a known-good version reference.
- The user is prepared for several incremental bugfix releases.
