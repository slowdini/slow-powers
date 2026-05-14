# Monorepo Restructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the flat superpowers repo into a Bun workspace monorepo with separate packages for core, claude, codex, cursor, opencode, and gemini.

**Architecture:** Bun workspaces with `packages/*` pattern. Core package contains skills and assets. Harness packages contain integration code. Single synchronized version managed by workspace-aware script.

**Tech Stack:** Bun workspaces, Node.js 20+, bash

---

## File Structure

### New files to create:
- `package.json` — root workspace definition (overwrites existing)
- `packages/core/package.json`
- `packages/claude/package.json`
- `packages/codex/package.json`
- `packages/cursor/package.json`
- `packages/opencode/package.json`
- `packages/gemini/package.json`
- `scripts/bump-version.js` — workspace-aware version bump (replaces .sh)

### Files to move:
- `skills/` → `packages/core/skills/`
- `assets/` → `packages/core/assets/`
- `.claude-plugin/plugin.json` → `packages/claude/plugin.json`
- `.claude-plugin/marketplace.json` → `packages/claude/marketplace.json`
- `.codex-plugin/plugin.json` → `packages/codex/plugin.json`
- `.cursor-plugin/plugin.json` → `packages/cursor/plugin.json`
- `.cursor-plugin/hooks-cursor.json` → `packages/cursor/hooks-cursor.json`
- `.opencode/plugins/superpowers.js` → `packages/opencode/plugins/superpowers.js`
- `gemini-extension.json` → `packages/gemini/extension.json`
- `hooks/session-start` → `packages/claude/hooks/session-start`
- `hooks/hooks.json` → `packages/claude/hooks/hooks.json`
- `hooks/run-hook.cmd` → `packages/claude/hooks/run-hook.cmd`
- `tests/brainstorm-server/` → `packages/core/tests/brainstorm-server/`
- `tests/explicit-skill-requests/` → `packages/core/tests/explicit-skill-requests/`
- `tests/skill-triggering/` → `packages/core/tests/skill-triggering/`
- `tests/subagent-driven-dev/` → `packages/core/tests/subagent-driven-dev/`
- `tests/claude-code/` → `packages/claude/tests/`
- `tests/codex-plugin-sync/` → `packages/codex/tests/`
- `tests/opencode/` → `packages/opencode/tests/`

### Files to modify in place:
- `packages/opencode/plugins/superpowers.js` — update core path resolution
- `packages/claude/hooks/session-start` — update skills path
- `scripts/sync-to-codex-plugin.sh` — update paths

### Files to delete:
- `.version-bump.json`
- `scripts/bump-version.sh`
- Old empty directories after move: `.claude-plugin/`, `.codex-plugin/`, `.cursor-plugin/`, `.opencode/`, `hooks/`
- Old root `package.json` (replaced by workspace definition)

---

## Task 1: Create Package Directories and Core Package

**Files:**
- Create: `packages/core/package.json`
- Create: `packages/claude/`
- Create: `packages/codex/`
- Create: `packages/cursor/`
- Create: `packages/opencode/`
- Create: `packages/gemini/`

- [ ] **Step 1: Create directory structure**

Run:
```bash
mkdir -p packages/core/skills packages/core/assets packages/core/tests
mkdir -p packages/claude/tests packages/claude/hooks
mkdir -p packages/codex/tests
mkdir -p packages/cursor/tests
mkdir -p packages/opencode/tests packages/opencode/plugins
mkdir -p packages/gemini/tests
```

- [ ] **Step 2: Write core package.json**

Create `packages/core/package.json`:
```json
{
  "name": "@slowdini/superpowers-core",
  "version": "5.1.0",
  "description": "Core skills library for superpowers",
  "files": ["skills/", "assets/"],
  "exports": {
    "./skills/*": "./skills/*",
    "./assets/*": "./assets/*"
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add packages/
git commit -m "chore: create workspace package directories"
```

---

## Task 2: Move Core Assets

**Files:**
- Move: `skills/` → `packages/core/skills/`
- Move: `assets/` → `packages/core/assets/`

- [ ] **Step 1: Move skills directory**

Run:
```bash
git mv skills/ packages/core/skills/
```

- [ ] **Step 2: Move assets directory**

Run:
```bash
git mv assets/ packages/core/assets/
```

- [ ] **Step 3: Verify moves**

Run:
```bash
ls packages/core/skills/
ls packages/core/assets/
```
Expected: See skill directories (brainstorming/, writing-plans/, etc.) and asset files (app-icon.png, superpowers-small.svg)

- [ ] **Step 4: Commit**

```bash
git commit -m "chore: move skills and assets into packages/core"
```

---

## Task 3: Move Harness Integration Files

**Files:**
- Move: `.claude-plugin/plugin.json` → `packages/claude/plugin.json`
- Move: `.claude-plugin/marketplace.json` → `packages/claude/marketplace.json`
- Move: `.codex-plugin/plugin.json` → `packages/codex/plugin.json`
- Move: `.cursor-plugin/plugin.json` → `packages/cursor/plugin.json`
- Move: `.cursor-plugin/hooks-cursor.json` → `packages/cursor/hooks-cursor.json`
- Move: `.opencode/plugins/superpowers.js` → `packages/opencode/plugins/superpowers.js`
- Move: `gemini-extension.json` → `packages/gemini/extension.json`

- [ ] **Step 1: Move Claude plugin files**

Run:
```bash
git mv .claude-plugin/plugin.json packages/claude/plugin.json
git mv .claude-plugin/marketplace.json packages/claude/marketplace.json
```

- [ ] **Step 2: Move Codex plugin file**

Run:
```bash
git mv .codex-plugin/plugin.json packages/codex/plugin.json
```

- [ ] **Step 3: Move Cursor plugin files**

Run:
```bash
git mv .cursor-plugin/plugin.json packages/cursor/plugin.json
git mv .cursor-plugin/hooks-cursor.json packages/cursor/hooks-cursor.json
```

- [ ] **Step 4: Move OpenCode plugin**

Run:
```bash
git mv .opencode/plugins/superpowers.js packages/opencode/plugins/superpowers.js
```

- [ ] **Step 5: Move Gemini extension**

Run:
```bash
git mv gemini-extension.json packages/gemini/extension.json
```

- [ ] **Step 6: Verify harness files moved**

Run:
```bash
ls packages/claude/
ls packages/codex/
ls packages/cursor/
ls packages/opencode/
ls packages/gemini/
```
Expected: Each directory contains its manifest/plugin file

- [ ] **Step 7: Commit**

```bash
git commit -m "chore: move harness integration files into packages/"
```

---

## Task 4: Move Hook Scripts

**Files:**
- Move: `hooks/session-start` → `packages/claude/hooks/session-start`
- Move: `hooks/hooks.json` → `packages/claude/hooks/hooks.json`
- Move: `hooks/run-hook.cmd` → `packages/claude/hooks/run-hook.cmd`

- [ ] **Step 1: Move hook files**

Run:
```bash
git mv hooks/session-start packages/claude/hooks/session-start
git mv hooks/hooks.json packages/claude/hooks/hooks.json
git mv hooks/run-hook.cmd packages/claude/hooks/run-hook.cmd
```

- [ ] **Step 2: Verify hooks moved**

Run:
```bash
ls packages/claude/hooks/
```
Expected: hooks.json, run-hook.cmd, session-start

- [ ] **Step 3: Commit**

```bash
git commit -m "chore: move claude hooks into packages/claude/hooks/"
```

---

## Task 5: Move Tests

**Files:**
- Move: `tests/brainstorm-server/` → `packages/core/tests/brainstorm-server/`
- Move: `tests/explicit-skill-requests/` → `packages/core/tests/explicit-skill-requests/`
- Move: `tests/skill-triggering/` → `packages/core/tests/skill-triggering/`
- Move: `tests/subagent-driven-dev/` → `packages/core/tests/subagent-driven-dev/`
- Move: `tests/claude-code/` → `packages/claude/tests/`
- Move: `tests/codex-plugin-sync/` → `packages/codex/tests/`
- Move: `tests/opencode/` → `packages/opencode/tests/`

- [ ] **Step 1: Move core tests**

Run:
```bash
git mv tests/brainstorm-server/ packages/core/tests/brainstorm-server/
git mv tests/explicit-skill-requests/ packages/core/tests/explicit-skill-requests/
git mv tests/skill-triggering/ packages/core/tests/skill-triggering/
git mv tests/subagent-driven-dev/ packages/core/tests/subagent-driven-dev/
```

- [ ] **Step 2: Move harness tests**

Run:
```bash
git mv tests/claude-code/ packages/claude/tests/
git mv tests/codex-plugin-sync/ packages/codex/tests/
git mv tests/opencode/ packages/opencode/tests/
```

- [ ] **Step 3: Verify tests moved**

Run:
```bash
ls packages/core/tests/
ls packages/claude/tests/
ls packages/codex/tests/
ls packages/opencode/tests/
```
Expected: Core has 4 test directories; harnesses have their respective test directories

- [ ] **Step 4: Remove empty tests directory**

Run:
```bash
rmdir tests/
```

- [ ] **Step 5: Commit**

```bash
git commit -m "chore: move tests into respective packages"
```

---

## Task 6: Create Harness Package Definitions

**Files:**
- Create: `packages/claude/package.json`
- Create: `packages/codex/package.json`
- Create: `packages/cursor/package.json`
- Create: `packages/opencode/package.json`
- Create: `packages/gemini/package.json`

- [ ] **Step 1: Write Claude package.json**

Create `packages/claude/package.json`:
```json
{
  "name": "@slowdini/superpowers-claude",
  "version": "5.1.0",
  "description": "Superpowers integration for Claude Code",
  "peerDependencies": {
    "@slowdini/superpowers-core": "workspace:*"
  }
}
```

- [ ] **Step 2: Write Codex package.json**

Create `packages/codex/package.json`:
```json
{
  "name": "@slowdini/superpowers-codex",
  "version": "5.1.0",
  "description": "Superpowers integration for OpenAI Codex",
  "peerDependencies": {
    "@slowdini/superpowers-core": "workspace:*"
  }
}
```

- [ ] **Step 3: Write Cursor package.json**

Create `packages/cursor/package.json`:
```json
{
  "name": "@slowdini/superpowers-cursor",
  "version": "5.1.0",
  "description": "Superpowers integration for Cursor",
  "peerDependencies": {
    "@slowdini/superpowers-core": "workspace:*"
  }
}
```

- [ ] **Step 4: Write OpenCode package.json**

Create `packages/opencode/package.json`:
```json
{
  "name": "@slowdini/superpowers-opencode",
  "version": "5.1.0",
  "description": "Superpowers integration for OpenCode",
  "type": "module",
  "main": "plugins/superpowers.js",
  "dependencies": {
    "@opencode-ai/plugin": "1.14.29"
  },
  "peerDependencies": {
    "@slowdini/superpowers-core": "workspace:*"
  }
}
```

- [ ] **Step 5: Write Gemini package.json**

Create `packages/gemini/package.json`:
```json
{
  "name": "@slowdini/superpowers-gemini",
  "version": "5.1.0",
  "description": "Superpowers integration for Gemini CLI",
  "peerDependencies": {
    "@slowdini/superpowers-core": "workspace:*"
  }
}
```

- [ ] **Step 6: Commit**

```bash
git add packages/*/package.json
git commit -m "chore: add harness package definitions"
```

---

## Task 7: Update Root package.json to Workspace Definition

**Files:**
- Modify: `package.json` (overwrite existing)

- [ ] **Step 1: Write workspace root package.json**

Overwrite `package.json`:
```json
{
  "name": "superpowers",
  "private": true,
  "version": "5.1.0",
  "type": "module",
  "workspaces": ["packages/*"],
  "scripts": {
    "test": "bun run --filter '*' test",
    "test:core": "bun run --filter core test",
    "test:claude": "bun run --filter claude test",
    "test:codex": "bun run --filter codex test",
    "test:cursor": "bun run --filter cursor test",
    "test:opencode": "bun run --filter opencode test",
    "test:gemini": "bun run --filter gemini test",
    "version": "node scripts/bump-version.js",
    "publish:all": "bun run --filter '*' publish --access public"
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add package.json
git commit -m "chore: convert root to Bun workspace definition"
```

---

## Task 8: Create Workspace-Aware Version Bump Script

**Files:**
- Create: `scripts/bump-version.js`
- Delete: `.version-bump.json`
- Delete: `scripts/bump-version.sh`

- [ ] **Step 1: Write bump-version.js**

Create `scripts/bump-version.js`:
```javascript
import { readFileSync, writeFileSync } from 'fs';

const version = process.argv[2];
if (!version || !/^\d+\.\d+\.\d+/.test(version)) {
  console.error('Usage: node bump-version.js <version>');
  process.exit(1);
}

const files = [
  'package.json',
  'packages/core/package.json',
  'packages/claude/package.json',
  'packages/codex/package.json',
  'packages/cursor/package.json',
  'packages/opencode/package.json',
  'packages/gemini/package.json',
  'packages/claude/plugin.json',
  'packages/claude/marketplace.json',
  'packages/codex/plugin.json',
  'packages/cursor/plugin.json',
  'packages/gemini/extension.json'
];

for (const file of files) {
  const content = JSON.parse(readFileSync(file, 'utf8'));
  content.version = version;
  writeFileSync(file, JSON.stringify(content, null, 2) + '\n');
  console.log(`Bumped ${file}`);
}
```

- [ ] **Step 2: Remove old version bump files**

Run:
```bash
git rm .version-bump.json
git rm scripts/bump-version.sh
```

- [ ] **Step 3: Commit**

```bash
git add scripts/bump-version.js
git commit -m "chore: replace version bump script with workspace-aware version"
```

---

## Task 9: Update Path Resolution in OpenCode Plugin

**Files:**
- Modify: `packages/opencode/plugins/superpowers.js`

- [ ] **Step 1: Update core path resolution**

Read the current file, then modify the `superpowersSkillsDir` line to use runtime resolution:

```javascript
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

// ... existing imports ...

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Resolve core skills directory at runtime
// Works in both workspace (symlinked) and npm-installed contexts
let superpowersSkillsDir;
try {
  const corePackageJson = require.resolve('@slowdini/superpowers-core/package.json');
  superpowersSkillsDir = path.join(path.dirname(corePackageJson), 'skills');
} catch {
  // Fallback for development when core is not yet installed
  superpowersSkillsDir = path.resolve(__dirname, '../core/skills');
}
```

The rest of the plugin remains unchanged. The key change is replacing the hardcoded relative path `../../skills` with runtime resolution of the `@slowdini/superpowers-core` package.

- [ ] **Step 2: Commit**

```bash
git add packages/opencode/plugins/superpowers.js
git commit -m "fix(opencode): resolve core skills via package name at runtime"
```

---

## Task 10: Update Path Resolution in Claude Hooks

**Files:**
- Modify: `packages/claude/hooks/session-start`

- [ ] **Step 1: Read current session-start to find skills references**

Run:
```bash
grep -n "skills" packages/claude/hooks/session-start
```

- [ ] **Step 2: Update skills path reference**

Modify the line(s) that reference `${CLAUDE_PLUGIN_ROOT}/skills/` to use `${CLAUDE_PLUGIN_ROOT}/../core/skills/`.

If the current line is:
```bash
SKILLS_DIR="${CLAUDE_PLUGIN_ROOT}/skills"
```

Change to:
```bash
SKILLS_DIR="${CLAUDE_PLUGIN_ROOT}/../core/skills"
```

- [ ] **Step 3: Commit**

```bash
git add packages/claude/hooks/session-start
git commit -m "fix(claude): update hooks to resolve core skills from workspace"
```

---

## Task 11: Update Harness Manifest Paths

**Files:**
- Modify: `packages/claude/plugin.json`
- Modify: `packages/codex/plugin.json`
- Modify: `packages/cursor/plugin.json`

- [ ] **Step 1: Update Claude plugin.json**

Modify `packages/claude/plugin.json` to add/update the skills path:
```json
{
  "name": "superpowers",
  "description": "Core skills library for Claude Code: TDD, debugging, collaboration patterns, and proven techniques",
  "version": "5.1.0",
  "author": {
    "name": "Jesse Vincent",
    "email": "jesse@fsck.com"
  },
  "homepage": "https://github.com/obra/superpowers",
  "repository": "https://github.com/obra/superpowers",
  "license": "MIT",
  "keywords": [
    "skills",
    "tdd",
    "debugging",
    "collaboration",
    "best-practices",
    "workflows"
  ],
  "skills": "../core/skills/",
  "agents": "./agents/",
  "commands": "./commands/",
  "hooks": "./hooks/hooks.json"
}
```

- [ ] **Step 2: Update Codex plugin.json**

Modify `packages/codex/plugin.json` to add skills path:
```json
{
  "name": "superpowers",
  "version": "5.1.0",
  "description": "An agentic skills framework & software development methodology that works: planning, TDD, debugging, and collaboration workflows.",
  "author": {
    "name": "Jesse Vincent",
    "email": "jesse@fsck.com",
    "url": "https://github.com/obra"
  },
  "homepage": "https://github.com/obra/superpowers",
  "repository": "https://github.com/obra/superpowers",
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
  "skills": "../core/skills/",
  "interface": {
    "displayName": "Superpowers",
    "shortDescription": "Planning, TDD, debugging, and delivery workflows for coding agents",
    "longDescription": "Use Superpowers to guide agent work through brainstorming, implementation planning, test-driven development, systematic debugging, parallel execution, code review, and finish-the-branch workflows.",
    "developerName": "Jesse Vincent",
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
    "websiteURL": "https://github.com/obra/superpowers",
    "privacyPolicyURL": "https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement",
    "termsOfServiceURL": "https://docs.github.com/en/site-policy/github-terms/github-terms-of-service",
    "brandColor": "#F59E0B",
    "composerIcon": "../core/assets/superpowers-small.svg",
    "logo": "../core/assets/app-icon.png",
    "screenshots": []
  }
}
```

- [ ] **Step 3: Update Cursor plugin.json**

Modify `packages/cursor/plugin.json` to update skills and agents paths:
```json
{
  "name": "superpowers",
  "displayName": "Superpowers",
  "description": "Core skills library: TDD, debugging, collaboration patterns, and proven techniques",
  "version": "5.1.0",
  "author": {
    "name": "Jesse Vincent",
    "email": "jesse@fsck.com"
  },
  "homepage": "https://github.com/obra/superpowers",
  "repository": "https://github.com/obra/superpowers",
  "license": "MIT",
  "keywords": [
    "skills",
    "tdd",
    "debugging",
    "collaboration",
    "best-practices",
    "workflows"
  ],
  "skills": "../core/skills/",
  "agents": "./agents/",
  "commands": "./commands/",
  "hooks": "./hooks-cursor.json"
}
```

- [ ] **Step 4: Commit**

```bash
git add packages/claude/plugin.json packages/codex/plugin.json packages/cursor/plugin.json
git commit -m "fix: update harness manifests with workspace-relative paths"
```

---

## Task 12: Update sync-to-codex-plugin Script

**Files:**
- Modify: `scripts/sync-to-codex-plugin.sh`

- [ ] **Step 1: Read current script to identify paths**

Run:
```bash
grep -n "skills\|assets\|plugin.json\|codex-plugin" scripts/sync-to-codex-plugin.sh
```

- [ ] **Step 2: Update path references**

Modify `scripts/sync-to-codex-plugin.sh` to reference the new locations:
- Change `.codex-plugin/plugin.json` → `packages/codex/plugin.json`
- Change `./skills/` → `packages/core/skills/`
- Change `./assets/` → `packages/core/assets/`

- [ ] **Step 3: Commit**

```bash
git add scripts/sync-to-codex-plugin.sh
git commit -m "fix: update codex sync script for workspace paths"
```

---

## Task 13: Install Workspace Dependencies

**Files:**
- Create: `bun.lockb`

- [ ] **Step 1: Install workspace dependencies**

Run:
```bash
bun install
```

Expected: Bun creates `bun.lockb` and resolves workspace packages.

- [ ] **Step 2: Verify workspace resolution**

Run:
```bash
ls node_modules/@slowdini/
```
Expected: See symlinks to `superpowers-core`, `superpowers-claude`, etc.

- [ ] **Step 3: Commit lockfile**

```bash
git add bun.lockb
git commit -m "chore: generate workspace lockfile"
```

---

## Task 14: Clean Up Empty Directories and Old Files

**Files:**
- Delete: `.claude-plugin/` (empty after move)
- Delete: `.codex-plugin/` (empty after move)
- Delete: `.cursor-plugin/` (empty after move)
- Delete: `.opencode/` (except node_modules which was not moved)
- Delete: `hooks/` (empty after move)
- Delete: `.version-bump.json` (already deleted)

- [ ] **Step 1: Remove empty directories**

Run:
```bash
rm -rf .claude-plugin/
rm -rf .codex-plugin/
rm -rf .cursor-plugin/
rm -rf hooks/
```

Note: `.opencode/` still has `node_modules/`, `package.json`, `package-lock.json` which are old standalone deps. Remove the entire `.opencode/` directory since Bun workspace handles dependencies centrally:
```bash
rm -rf .opencode/
```

- [ ] **Step 2: Verify cleanup**

Run:
```bash
ls -la .claude-plugin 2>&1 || echo "Removed"
ls -la .codex-plugin 2>&1 || echo "Removed"
ls -la .cursor-plugin 2>&1 || echo "Removed"
ls -la hooks 2>&1 || echo "Removed"
ls -la .opencode 2>&1 || echo "Removed"
```

- [ ] **Step 3: Commit cleanup**

```bash
git add -A
git commit -m "chore: remove empty harness directories and old standalone deps"
```

---

## Task 15: Verify No Stale References

**Files:**
- All files in repo

- [ ] **Step 1: Search for old paths**

Run:
```bash
grep -r "\.claude-plugin/" --include="*.json" --include="*.js" --include="*.sh" --include="*.md" . || echo "No stale .claude-plugin references"
grep -r "\.codex-plugin/" --include="*.json" --include="*.js" --include="*.sh" --include="*.md" . || echo "No stale .codex-plugin references"
grep -r "\.cursor-plugin/" --include="*.json" --include="*.js" --include="*.sh" --include="*.md" . || echo "No stale .cursor-plugin references"
grep -r "^hooks/" --include="*.json" --include="*.js" --include="*.sh" --include="*.md" . || echo "No stale hooks references"
grep -r "\.opencode/plugins" --include="*.json" --include="*.js" --include="*.sh" --include="*.md" . || echo "No stale .opencode references"
grep -r "gemini-extension\.json" --include="*.json" --include="*.js" --include="*.sh" --include="*.md" . || echo "No stale gemini-extension references"
```

- [ ] **Step 2: Fix any found references**

If any references are found in non-gitignored files, update them to the new paths.

- [ ] **Step 3: Commit fixes**

```bash
git add -A
git commit -m "fix: update remaining stale path references"
```

---

## Task 16: Update README Installation Instructions

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Check README for path references**

Run:
```bash
grep -n "\.opencode\|INSTALL\.md\|plugins/superpowers" README.md
```

- [ ] **Step 2: Update any paths that reference moved files**

If the README references `.opencode/INSTALL.md` or other moved files, update to `packages/opencode/INSTALL.md` or similar. Check if OpenCode install instructions need updating for the new npm package name.

- [ ] **Step 3: Add Repository Structure section**

Add a new section near the top of README.md after the quickstart:

```markdown
## Repository Structure

This is a monorepo managed with [Bun workspaces](https://bun.sh/docs/install/workspaces).

- `packages/core/` — Skills, assets, and cross-cutting tests (published as `@slowdini/superpowers-core`)
- `packages/claude/` — Claude Code plugin
- `packages/codex/` — OpenAI Codex plugin
- `packages/cursor/` — Cursor plugin
- `packages/opencode/` — OpenCode plugin (published as `@slowdini/superpowers-opencode`)
- `packages/gemini/` — Gemini CLI extension (published as `@slowdini/superpowers-gemini`)
```

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs: update README for monorepo structure"
```

---

## Task 17: Verify Workspace Commands Work

**Files:**
- No file changes

- [ ] **Step 1: Verify version bump script**

Run:
```bash
node scripts/bump-version.js 5.2.0-test
grep '"version"' packages/core/package.json packages/claude/plugin.json
```
Expected: All files show `"version": "5.2.0-test"`

- [ ] **Step 2: Revert test version bump**

Run:
```bash
node scripts/bump-version.js 5.1.0
git checkout -- .
```

- [ ] **Step 3: Verify test commands exist**

Run:
```bash
bun run test:core 2>&1 | head -5 || echo "No test script defined in core yet"
```
Expected: Either runs tests or shows "No test script" (which is fine until tests are configured)

- [ ] **Step 4: Final review**

Run:
```bash
git diff --stat HEAD~16 HEAD
```
Expected: See all moves, creates, and modifications without unexpected changes.

---

## Self-Review

### Spec Coverage Check

| Spec Section | Implementing Task |
|-------------|-------------------|
| Workspace layout | Tasks 1-7 |
| Package definitions | Tasks 1, 6 |
| Path resolution (OpenCode) | Task 9 |
| Path resolution (Claude hooks) | Task 10 |
| Path resolution (manifests) | Task 11 |
| Version management | Task 8 |
| Testing relocation | Task 5 |
| Publishing model | Covered by package.json structure (Tasks 1, 6, 7) |
| Migration phases | All tasks map to phases 1-4 and 6 |
| Cleanup | Tasks 14-15 |
| README update | Task 16 |

All spec requirements are covered. No gaps.

### Placeholder Scan

- No TBD, TODO, or "implement later" found.
- No vague steps like "add error handling" or "handle edge cases".
- No "similar to Task N" references.
- Every step has exact file paths and complete code where applicable.

### Type Consistency

- Package names use `@slowdini/superpowers-*` consistently.
- Version is `5.1.0` everywhere (until bump script runs).
- Path patterns use `packages/<name>/` consistently.
- No signature mismatches.

---

## Plan complete.

**Plan saved to `docs/superpowers/plans/2026-05-14-monorepo-restructure.md`.**

Ready to execute with subagent-driven-development.

- **REQUIRED SUB-SKILL:** Use superpowers:subagent-driven-development
- Fresh subagent per task + two-stage review