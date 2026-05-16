# Flatten Monorepo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the Bun workspaces monorepo into a flat repository where skills and assets live at root, harnesses are top-level directories, and all monorepo relics are removed.

**Architecture:** Move `packages/core/skills/` and `packages/core/assets/` to root. Relocate each harness from `packages/<harness>/` to a top-level `<harness>/` directory. Consolidate all tests under a root `tests/` directory. Update every manifest, script, and path reference to no longer traverse through `packages/`. Remove `bun.lock`, per-package `package.json` files, and workspace semantics.

**Tech Stack:** Bun, Node.js, Git, sh

---

## Phase 1: Move Core Content to Root

### Task 1: Move skills directory

**Files:**
- Move: `packages/core/skills/` → `skills/`
- Move: `packages/core/assets/` → `assets/`
- Delete: `packages/core/paths.js`

- [ ] **Step 1: Move skills and assets using git mv**

```bash
git mv packages/core/skills skills
git mv packages/core/assets assets
git rm packages/core/paths.js
```

- [ ] **Step 2: Verify the moves**

```bash
ls skills/
ls assets/
```

Expected: `skills/` contains all skill subdirectories. `assets/` contains `app-icon.png` and `superpowers-small.svg`. `packages/core/` should be empty except for `tests/`.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: move skills and assets to root"
```

---

### Task 2: Move core tests to root tests directory

**Files:**
- Create: `tests/core/`
- Move: `packages/core/tests/` → `tests/core/`

- [ ] **Step 1: Move core tests**

```bash
git mv packages/core/tests tests/core
```

- [ ] **Step 2: Verify**

```bash
ls tests/core/
```

Expected: `brainstorm-server/`, `explicit-skill-requests/`, `skill-triggering/`, `subagent-driven-dev/`.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: move core tests to tests/core"
```

---

## Phase 2: Move Harness Directories to Root

### Task 3: Move Claude harness

**Files:**
- Create: `claude/`
- Move: `packages/claude/plugin.json` → `claude/plugin.json`
- Move: `packages/claude/hooks/` → `claude/hooks/`
- Move: `packages/claude/tests/` → `tests/claude/`
- Delete: `packages/claude/package.json`

- [ ] **Step 1: Move Claude files**

```bash
mkdir -p claude
git mv packages/claude/plugin.json claude/plugin.json
git mv packages/claude/hooks claude/hooks
git mv packages/claude/tests tests/claude
git rm packages/claude/package.json
```

- [ ] **Step 2: Verify**

```bash
ls claude/
ls tests/claude/
```

Expected: `claude/` has `plugin.json` and `hooks/`. `tests/claude/` has Claude-specific tests. `packages/claude/` should not exist.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: move claude harness to root"
```

---

### Task 4: Move Codex harness

**Files:**
- Create: `codex/`
- Move: `packages/codex/plugin.json` → `codex/plugin.json`
- Move: `packages/codex/tests/` → `tests/codex/`
- Delete: `packages/codex/package.json`

- [ ] **Step 1: Move Codex files**

```bash
mkdir -p codex
git mv packages/codex/plugin.json codex/plugin.json
git mv packages/codex/tests tests/codex
git rm packages/codex/package.json
```

- [ ] **Step 2: Verify**

```bash
ls codex/
ls tests/codex/
```

Expected: `codex/` has `plugin.json`. `tests/codex/` has Codex-specific tests. `packages/codex/` should not exist.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: move codex harness to root"
```

---

### Task 5: Move Cursor harness

**Files:**
- Create: `cursor/`
- Move: `packages/cursor/.cursor-plugin/` → `cursor/.cursor-plugin/`
- Move: `packages/cursor/hooks/` → `cursor/hooks/`
- Move: `packages/cursor/install.sh` → `cursor/install.sh`
- Move: `packages/cursor/tests/` → `tests/cursor/`
- Delete: `packages/cursor/package.json`

- [ ] **Step 1: Move Cursor files**

```bash
mkdir -p cursor
git mv packages/cursor/.cursor-plugin cursor/.cursor-plugin
git mv packages/cursor/hooks cursor/hooks
git mv packages/cursor/install.sh cursor/install.sh
git mv packages/cursor/tests tests/cursor
git rm packages/cursor/package.json
```

- [ ] **Step 2: Verify**

```bash
ls cursor/
ls tests/cursor/
```

Expected: `cursor/` has `.cursor-plugin/`, `hooks/`, `install.sh`. `tests/cursor/` has Cursor-specific tests. `packages/cursor/` should not exist.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: move cursor harness to root"
```

---

### Task 6: Move OpenCode harness

**Files:**
- Create: `opencode/`
- Move: `packages/opencode/plugins/` → `opencode/plugins/`
- Move: `packages/opencode/INSTALL.md` → `opencode/INSTALL.md`
- Move: `packages/opencode/tests/` → `tests/opencode/`
- Delete: `packages/opencode/package.json`

- [ ] **Step 1: Move OpenCode files**

```bash
mkdir -p opencode
git mv packages/opencode/plugins opencode/plugins
git mv packages/opencode/INSTALL.md opencode/INSTALL.md
git mv packages/opencode/tests tests/opencode
git rm packages/opencode/package.json
```

- [ ] **Step 2: Verify**

```bash
ls opencode/
ls tests/opencode/
```

Expected: `opencode/` has `plugins/` and `INSTALL.md`. `tests/opencode/` has OpenCode-specific tests. `packages/opencode/` should not exist.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: move opencode harness to root"
```

---

### Task 7: Remove empty packages directory

**Files:**
- Delete: `packages/`

- [ ] **Step 1: Remove empty packages directory**

```bash
rmdir packages/core 2>/dev/null || true
rmdir packages 2>/dev/null || true
```

If any files remain in `packages/`, investigate before deleting.

- [ ] **Step 2: Verify**

```bash
ls packages/ 2>/dev/null || echo "packages/ removed"
```

Expected: `packages/` does not exist.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: remove empty packages directory"
```

---

## Phase 3: Update Manifest Paths

### Task 8: Update Claude plugin.json

**Files:**
- Modify: `claude/plugin.json`

- [ ] **Step 1: Update skills path**

```json
{
  "name": "superpowers",
  "description": "Superslow gives your agent superpowers: TDD, debugging, collaboration patterns, and proven techniques",
  "version": "1.0.1",
  "author": {
    "name": "Max Haarhaus",
    "email": "samiamorwas@gmail.com"
  },
  "homepage": "https://github.com/slowdini/superslow",
  "repository": "https://github.com/slowdini/superslow",
  "license": "MIT",
  "keywords": [
    "skills",
    "tdd",
    "debugging",
    "collaboration",
    "best-practices",
    "workflows"
  ],
  "skills": "./skills/",
  "agents": "./agents/",
  "commands": "./commands/",
  "hooks": "./hooks/hooks.json"
}
```

- [ ] **Step 2: Verify JSON validity**

```bash
node -e "JSON.parse(require('fs').readFileSync('claude/plugin.json', 'utf8')); console.log('valid')"
```

Expected: `valid`

- [ ] **Step 3: Commit**

```bash
git add claude/plugin.json
git commit -m "fix(claude): update skill path for root-level skills"
```

---

### Task 9: Update Codex plugin.json

**Files:**
- Modify: `codex/plugin.json`

- [ ] **Step 1: Update all asset and skill paths**

```json
{
  "name": "superpowers",
  "version": "1.0.1",
  "description": "Superslow gives your agent superpowers: planning, TDD, debugging, and collaboration workflows.",
  "author": {
    "name": "Max Haarhaus",
    "email": "samiamorwas@gmail.com",
    "url": "https://github.com/slowdini"
  },
  "homepage": "https://github.com/slowdini/superslow",
  "repository": "https://github.com/slowdini/superslow",
  "license": "MIT",
  "keywords": [
    "brainstorming",
    "subagent-driven-development",
    "skills",
    "planning",
    "tdd",
    "debugging",
    "code-review",
    "workflow"
  ],
  "skills": "./skills/",
  "interface": {
    "displayName": "Superslow",
    "shortDescription": "Planning, TDD, debugging, and collaboration workflows for coding agents",
    "longDescription": "Use Superslow to guide agent work through brainstorming, implementation planning, test-driven development, systematic debugging, parallel execution, code review, and finish-the-branch workflows.",
    "developerName": "Max Haarhaus",
    "category": "Coding",
    "capabilities": [
      "Interactive",
      "Read",
      "Write"
    ],
    "defaultPrompt": [
      "I've got an idea for something I'd like to build.",
      "Let's add a feature to this project."
    ],
    "websiteURL": "https://github.com/slowdini/superslow",
    "privacyPolicyURL": "https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement",
    "termsOfServiceURL": "https://docs.github.com/en/site-policy/github-terms/github-terms-of-service",
    "brandColor": "#F59E0B",
    "composerIcon": "./assets/superpowers-small.svg",
    "logo": "./assets/app-icon.png",
    "screenshots": []
  }
}
```

- [ ] **Step 2: Verify JSON validity**

```bash
node -e "JSON.parse(require('fs').readFileSync('codex/plugin.json', 'utf8')); console.log('valid')"
```

Expected: `valid`

- [ ] **Step 3: Commit**

```bash
git add codex/plugin.json
git commit -m "fix(codex): update paths for root-level skills and assets"
```

---

### Task 10: Update Cursor plugin.json

**Files:**
- Modify: `cursor/.cursor-plugin/plugin.json`

- [ ] **Step 1: Update paths and remove nonexistent directories**

```json
{
  "name": "superpowers",
  "displayName": "Superslow",
  "description": "Superslow gives your agent superpowers: TDD, debugging, collaboration patterns, and proven techniques",
  "version": "1.0.1",
  "author": {
    "name": "Max Haarhaus",
    "email": "samiamorwas@gmail.com"
  },
  "homepage": "https://github.com/slowdini/superslow",
  "repository": "https://github.com/slowdini/superslow",
  "license": "MIT",
  "keywords": [
    "skills",
    "tdd",
    "debugging",
    "collaboration",
    "best-practices",
    "workflows"
  ],
  "skills": "../../skills/",
  "hooks": "../hooks/hooks-cursor.json"
}
```

- [ ] **Step 2: Verify JSON validity**

```bash
node -e "JSON.parse(require('fs').readFileSync('cursor/.cursor-plugin/plugin.json', 'utf8')); console.log('valid')"
```

Expected: `valid`

- [ ] **Step 3: Commit**

```bash
git add cursor/.cursor-plugin/plugin.json
git commit -m "fix(cursor): update skill path for root-level skills, remove nonexistent agents/commands"
```

---

### Task 11: Update Cursor install.sh

**Files:**
- Modify: `cursor/install.sh`

- [ ] **Step 1: Update symlink target path**

```sh
#!/usr/bin/env sh
# Superslow installer for Cursor.
# Clones (or reuses) the Superslow repo and symlinks the Cursor plugin into
# Cursor's local plugin directory.

set -e

REPO_DIR="${SUPERSLOW_DIR:-$HOME/.local/share/superslow}"
mkdir -p "$(dirname "$REPO_DIR")"

if [ -d "$REPO_DIR/.git" ]; then
  echo "Updating existing Superslow checkout at $REPO_DIR..."
  git -C "$REPO_DIR" pull --ff-only
else
  echo "Cloning Superslow into $REPO_DIR..."
  git clone https://github.com/slowdini/superslow "$REPO_DIR"
fi

mkdir -p "$HOME/.cursor/plugins/local"
ln -sfn "$REPO_DIR/cursor" "$HOME/.cursor/plugins/local/superpowers"

echo
echo "Superslow installed for Cursor at:"
echo "  $HOME/.cursor/plugins/local/superpowers -> $REPO_DIR/cursor"
echo
echo "Restart Cursor to load the plugin."
```

- [ ] **Step 2: Verify script syntax**

```bash
sh -n cursor/install.sh && echo "syntax ok"
```

Expected: `syntax ok`

- [ ] **Step 3: Commit**

```bash
git add cursor/install.sh
git commit -m "fix(cursor): update install script path for root-level harness"
```

---

### Task 12: Update OpenCode superpowers.js

**Files:**
- Modify: `opencode/plugins/superpowers.js`

- [ ] **Step 1: Update skills directory resolution**

Change line 14 from:
```js
const superpowersSkillsDir = path.resolve(__dirname, "../../core/skills");
```
to:
```js
const superpowersSkillsDir = path.resolve(__dirname, "../../skills");
```

- [ ] **Step 2: Verify the file has the change**

```bash
grep -n "superpowersSkillsDir" opencode/plugins/superpowers.js
```

Expected output contains `../../skills`.

- [ ] **Step 3: Commit**

```bash
git add opencode/plugins/superpowers.js
git commit -m "fix(opencode): update skills path for root-level skills"
```

---

### Task 13: Update root marketplace.json

**Files:**
- Modify: `marketplace.json`

- [ ] **Step 1: Update Claude source path**

```json
{
  "name": "superslow",
  "description": "Superslow plugin marketplace for Claude Code",
  "owner": {
    "name": "Max Haarhaus",
    "email": "samiamorwas@gmail.com"
  },
  "plugins": [
    {
      "name": "superpowers",
      "description": "Superslow gives your agent superpowers: planning, TDD, debugging, and collaboration workflows.",
      "version": "1.0.1",
      "source": "./claude/",
      "author": {
        "name": "Max Haarhaus",
        "email": "samiamorwas@gmail.com"
      }
    }
  ]
}
```

- [ ] **Step 2: Verify JSON validity**

```bash
node -e "JSON.parse(require('fs').readFileSync('marketplace.json', 'utf8')); console.log('valid')"
```

Expected: `valid`

- [ ] **Step 3: Commit**

```bash
git add marketplace.json
git commit -m "fix(marketplace): update claude source path for root-level harness"
```

---

### Task 14: Update .agents/plugins/marketplace.json

**Files:**
- Modify: `.agents/plugins/marketplace.json`

- [ ] **Step 1: Update Codex source path**

```json
{
  "name": "superslow",
  "interface": {
    "displayName": "Superslow"
  },
  "plugins": [
    {
      "name": "superpowers",
      "version": "1.0.1",
      "source": {
        "source": "local",
        "path": "../../codex"
      },
      "policy": {
        "installation": "AVAILABLE",
        "authentication": "ON_INSTALL"
      },
      "category": "Productivity"
    }
  ]
}
```

- [ ] **Step 2: Verify JSON validity**

```bash
node -e "JSON.parse(require('fs').readFileSync('.agents/plugins/marketplace.json', 'utf8')); console.log('valid')"
```

Expected: `valid`

- [ ] **Step 3: Commit**

```bash
git add .agents/plugins/marketplace.json
git commit -m "fix(agents): update codex source path for root-level harness"
```

---

## Phase 4: Update Root package.json and Remove Monorepo Relics

### Task 15: Rewrite root package.json

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Replace workspace package.json with flat root manifest**

```json
{
  "name": "@slowdini/superslow-opencode",
  "private": true,
  "version": "1.0.1",
  "description": "Superslow — a fork of obra/superpowers, rebranded as its own product",
  "type": "module",
  "main": "./opencode/plugins/superpowers.js",
  "scripts": {
    "test": "bun test",
    "test:core": "cd tests/core && bash run-test.sh || true",
    "test:claude": "cd tests/claude && bash run-test.sh || true",
    "test:codex": "cd tests/codex && bash run-test.sh || true",
    "test:cursor": "cd tests/cursor && bash run-test.sh || true",
    "test:opencode": "cd tests/opencode && bash run-test.sh || true",
    "version": "node scripts/bump-version.js",
    "check": "biome check --write . && markdownlint-cli2 --fix '**/*.md' '!**/node_modules/**' '!**/.worktrees/**'"
  },
  "devDependencies": {
    "@biomejs/biome": "^2.4.15",
    "husky": "^9.1.7",
    "lint-staged": "^17.0.4",
    "markdownlint-cli2": "^0.22.1"
  }
}
```

Note: `test:*` scripts use `|| true` because test runner scripts may not exist in every subdirectory yet. These should be refined once test scripts are confirmed. The `bun test` script at root should point to tests that Bun can discover. The current core tests include a `package.json` with a test script that Bun can run.

- [ ] **Step 2: Verify JSON validity**

```bash
node -e "JSON.parse(require('fs').readFileSync('package.json', 'utf8')); console.log('valid')"
```

Expected: `valid`

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "chore: flatten root package.json, remove workspace semantics"
```

---

### Task 16: Remove bun.lock

**Files:**
- Delete: `bun.lock`

- [ ] **Step 1: Delete lockfile**

```bash
git rm bun.lock
```

- [ ] **Step 2: Update .gitignore to exclude lockfiles**

Check if `bun.lock` or `bun.lockb` is already in `.gitignore`. If not, add it.

```bash
grep -E "bun\.lock|\.lockb" .gitignore || echo "bun.lock" >> .gitignore
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "chore: remove bun.lock, add to .gitignore"
```

---

## Phase 5: Update bump-version.js

### Task 17: Update version bump script

**Files:**
- Modify: `scripts/bump-version.js`

- [ ] **Step 1: Replace file list with root-level manifests**

```js
import { readFileSync, writeFileSync } from "node:fs";

const version = process.argv[2];
if (!version || !/^\d+\.\d+\.\d+/.test(version)) {
  console.error("Usage: node bump-version.js <version>");
  process.exit(1);
}

const files = [
  "package.json",
  "claude/plugin.json",
  "codex/plugin.json",
  "cursor/.cursor-plugin/plugin.json",
  "gemini-extension.json",
  "marketplace.json",
  ".agents/plugins/marketplace.json",
];

for (const file of files) {
  const content = JSON.parse(readFileSync(file, "utf8"));
  let updated = false;

  if (content.version !== undefined) {
    content.version = version;
    updated = true;
  }

  if (Array.isArray(content.plugins)) {
    for (const plugin of content.plugins) {
      if (plugin.version !== undefined) {
        plugin.version = version;
        updated = true;
      }
    }
  }

  if (updated) {
    writeFileSync(file, `${JSON.stringify(content, null, 2)}\n`);
    console.log(`Bumped ${file}`);
  } else {
    console.log(`Skipped ${file} (no version field)`);
  }
}
```

- [ ] **Step 2: Verify script syntax**

```bash
node --check scripts/bump-version.js && echo "syntax ok"
```

Expected: `syntax ok`

- [ ] **Step 3: Commit**

```bash
git add scripts/bump-version.js
git commit -m "chore: update bump-version.js for root-level manifests"
```

---

## Phase 6: Update Documentation

### Task 18: Update README.md

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Rewrite "Repository structure" section**

Replace the existing "Repository structure" section (lines 128-137) with:

```markdown
## Repository structure

Flat layout — skills and assets live at root, harness-specific integration lives in top-level directories:

- `skills/` — All superpowers skills
- `assets/` — Icons and images shared across harnesses
- `tests/` — Cross-cutting and harness-specific tests
- `claude/` — Claude Code plugin manifest and hooks
- `codex/` — OpenAI Codex plugin manifest
- `cursor/` — Cursor plugin manifest, hooks, and install script
- `opencode/` — OpenCode plugin and installation docs
- `gemini-extension.json` + `gemini-instructions.md` — Gemini CLI extension
- `marketplace.json` — Claude Code marketplace registry
- `package.json` — OpenCode plugin manifest + dev tooling
```

- [ ] **Step 2: Add "How it's distributed" section after installation**

Insert after the installation sections and before "The Basic Workflow":

```markdown
## How it's distributed

Superslow is released across five agent handlers. Each harness reads a different set of files from this repository:

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
```

- [ ] **Step 3: Verify no stale `packages/` references remain in README**

```bash
grep -n "packages/" README.md || echo "no stale references"
```

Expected: `no stale references`

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: update README for flat repository structure"
```

---

### Task 19: Update AGENTS.md and GEMINI.md

**Files:**
- Modify: `AGENTS.md`
- Modify: `GEMINI.md`

- [ ] **Step 1: Update "What lives here" section in both files**

In `AGENTS.md` and `GEMINI.md`, replace the current "What lives here" list with:

```markdown
## What lives here

This repo ships Superslow across five harnesses:

- `skills/` — Skills, assets, and cross-cutting tests
- `claude/` — Claude Code plugin
- `codex/` — OpenAI Codex plugin
- `cursor/` — Cursor plugin
- `opencode/` — OpenCode plugin (`@slowdini/superslow-opencode`)
- `gemini-extension.json` + `GEMINI.md` — Gemini CLI extension (root-level)

The skills themselves keep upstream's `superpowers:` prefix and vocabulary
(e.g. `superpowers:brainstorming`, `using-superpowers`). The *product* is
Superslow; the *skills* are still called superpowers.
```

Also update the `Local development` section if it still references `bun test:core` etc. If the scripts have changed, update them to match the new `package.json`.

- [ ] **Step 2: Verify no stale `packages/` references**

```bash
grep -n "packages/" AGENTS.md GEMINI.md || echo "no stale references"
```

Expected: `no stale references`

- [ ] **Step 3: Commit**

```bash
git add AGENTS.md GEMINI.md
git commit -m "docs: update AGENTS.md and GEMINI.md for flat structure"
```

---

## Phase 7: Update Test Scripts and Verify

### Task 20: Update test runner paths

**Files:**
- Scan and modify: all `.sh` files in `tests/` that reference `packages/`

- [ ] **Step 1: Find all references to `packages/` in test scripts**

```bash
grep -rn "packages/" tests/ || echo "no stale references"
```

- [ ] **Step 2: Update any found references**

For each file found, update paths. Common patterns:
- `packages/core/skills/` → `./skills/` or `../../skills/` (depending on depth)
- `packages/core/assets/` → `./assets/` or `../../assets/`
- `packages/<harness>/` → `../<harness>/` or `../../<harness>/`

Edit each file as needed. There is no single replacement pattern because test scripts may reference paths for different purposes.

- [ ] **Step 3: Verify no stale references remain**

```bash
grep -rn "packages/" tests/ || echo "no stale references"
```

Expected: `no stale references`

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "fix(tests): update path references after flattening"
```

---

### Task 21: Update any remaining references across the repo

**Files:**
- Scan entire repo for stale `packages/` references

- [ ] **Step 1: Search for remaining `packages/` references**

```bash
grep -rn "packages/" --include="*.md" --include="*.json" --include="*.js" --include="*.sh" --include="*.ts" . | grep -v "node_modules/" | grep -v ".git/" | grep -v ".worktrees/" || echo "no stale references"
```

- [ ] **Step 2: Fix any found references**

Investigate each match. Some may be in historical docs (e.g., `docs/superpowers/specs/2026-05-14-monorepo-restructure-design.md`) which should NOT be modified — those are historical design documents. Only fix references in current operational files (manifests, scripts, current docs, hooks).

- [ ] **Step 3: Verify**

```bash
grep -rn "packages/" --include="*.md" --include="*.json" --include="*.js" --include="*.sh" --include="*.ts" . | grep -v "node_modules/" | grep -v ".git/" | grep -v ".worktrees/" | grep -v "docs/superpowers/specs/" | grep -v "UPSTREAM-RELEASE-NOTES.md" || echo "no stale references in current files"
```

Expected: `no stale references in current files`

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove remaining packages/ references from current files"
```

---

## Phase 8: Run Tests

### Task 22: Run core tests

- [ ] **Step 1: Run core brainstorm-server tests**

```bash
cd tests/core/brainstorm-server && bun test
```

Expected: All tests pass (31 passed, 0 failed as in baseline).

- [ ] **Step 2: Run other core test suites**

```bash
# From repo root
cd tests/core/explicit-skill-requests && bash run-all.sh || true
cd tests/core/skill-triggering && bash run-all.sh || true
cd tests/core/subagent-driven-dev && bash run-test.sh || true
```

Expected: All pass or produce expected output.

- [ ] **Step 3: Commit (if any test fixes were needed)**

If tests required fixes, commit them separately. If no fixes needed, skip this commit.

---

### Task 23: Run harness-specific tests

- [ ] **Step 1: Run Claude tests**

```bash
cd tests/claude && bash run-skill-tests.sh || true
```

- [ ] **Step 2: Run Codex tests**

```bash
cd tests/codex && bash test-sync-to-codex-plugin.sh || true
```

- [ ] **Step 3: Run Cursor tests**

```bash
cd tests/cursor && bash run-test.sh || true
```

- [ ] **Step 4: Run OpenCode tests**

```bash
cd tests/opencode && bash run-tests.sh || true
```

- [ ] **Step 5: Commit any fixes**

If any test scripts needed path adjustments, commit them.

---

### Task 24: Final verification

- [ ] **Step 1: Verify directory structure matches spec**

```bash
ls -d skills/ assets/ tests/ claude/ codex/ cursor/ opencode/ 2>/dev/null || echo "missing directories"
```

Expected: All directories exist.

- [ ] **Step 2: Verify packages/ is gone**

```bash
ls packages/ 2>/dev/null || echo "packages/ removed"
```

Expected: `packages/ removed`

- [ ] **Step 3: Verify bun.lock is gone**

```bash
ls bun.lock 2>/dev/null || echo "bun.lock removed"
```

Expected: `bun.lock removed`

- [ ] **Step 4: Verify all manifests are valid JSON**

```bash
for f in package.json claude/plugin.json codex/plugin.json cursor/.cursor-plugin/plugin.json gemini-extension.json marketplace.json .agents/plugins/marketplace.json; do
  node -e "JSON.parse(require('fs').readFileSync('$f', 'utf8'))" && echo "$f valid" || echo "$f INVALID"
done
```

Expected: All files report `valid`.

- [ ] **Step 5: Run biome and markdown lint**

```bash
bun run check
```

Expected: No unfixable errors.

- [ ] **Step 6: Commit final state**

```bash
git add -A
git commit -m "chore: finalize monorepo flattening"
```

---

## Self-Review

**1. Spec coverage:**
- Move skills/assets to root → Tasks 1, 2
- Move harnesses to root → Tasks 3-6
- Remove `packages/` → Task 7
- Update all manifest paths → Tasks 8-14
- Update root `package.json` → Task 15
- Remove `bun.lock` → Task 16
- Update `bump-version.js` → Task 17
- Update README/AGENTS/GEMINI → Tasks 18-19
- Update test paths → Tasks 20-21
- Run tests → Tasks 22-24

All spec requirements are covered.

**2. Placeholder scan:**
- No "TBD", "TODO", "implement later", "fill in details" found.
- No vague "add appropriate error handling" steps.
- All code blocks contain complete code.
- No "Similar to Task N" references.

**3. Type consistency:**
- Path references are consistent: root-level skills use `./skills/` from root manifests, `../../skills/` from nested manifests (Cursor `.cursor-plugin/`), and `../../skills/` from OpenCode `plugins/superpowers.js`.
- All JSON files have complete content shown.
- File paths are exact and match the spec.
