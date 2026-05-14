# Linting, Formatting, and Git Hooks — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Biome (JS/JSON), markdownlint (MD), and Husky + lint-staged (pre-commit hooks) to the Superpowers monorepo.

**Architecture:** Four root-level config files (`biome.json`, `.lintstagedrc.json`, `.markdownlint-cli2.jsonc`, `.husky/pre-commit`) plus three new `package.json` scripts (`lint`, `format`, `prepare`). All config is root-level; workspace packages inherit without per-package configs.

**Tech Stack:** Biome 1.9, markdownlint-cli2 0.17, husky 9, lint-staged 15, Bun

---

### Task 1: Install dependencies

**Files:**
- Modify: `package.json` (devDependencies)
- Modify: `bun.lock`

- [ ] **Step 1: Add all four packages as devDependencies**

```bash
bun add -d @biomejs/biome markdownlint-cli2 husky lint-staged
```

- [ ] **Step 2: Verify packages are installed**

```bash
bunx biome --version
bunx markdownlint-cli2 --version
npx husky --version
npx lint-staged --version
```

- [ ] **Step 3: Commit**

```bash
git add package.json bun.lock
git commit -m "chore: add biome, markdownlint-cli2, husky, lint-staged"
```

---

### Task 2: Create Biome config

**Files:**
- Create: `biome.json`

- [ ] **Step 1: Write `biome.json`**

```jsonc
{
  "$schema": "https://biomejs.dev/schemas/1.9.4/schema.json",
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2
  },
  "linter": {
    "enabled": true,
    "rules": { "recommended": true }
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "double",
      "semicolons": "always",
      "trailingCommas": "all"
    }
  },
  "json": {
    "formatter": { "enabled": true }
  },
  "files": {
    "include": ["**/*.js", "**/*.json", "**/*.jsonc"],
    "ignore": ["node_modules", ".worktrees", "bun.lock"]
  }
}
```

- [ ] **Step 2: Verify biome reads the config**

```bash
bunx biome check --files=biome.json
```

Expected: No errors on the config file itself (it's valid JSON).

- [ ] **Step 3: Run biome check on the repo to see what it would fix**

```bash
bunx biome check .
```

Expected: Lists files with formatting/lint issues. No surprises in the list (should be only JS and JSON files, no MD files since we excluded them from include).

- [ ] **Step 4: Commit**

```bash
git add biome.json
git commit -m "feat: add Biome config for JS/JSON linting and formatting"
```

---

### Task 3: Create lint-staged config

**Files:**
- Create: `.lintstagedrc.json`

- [ ] **Step 1: Write `.lintstagedrc.json`**

```jsonc
{
  "*.{js,json,jsonc}": ["biome check --write"],
  "*.md": ["markdownlint-cli2 --fix"]
}
```

- [ ] **Step 2: Verify JSON is valid**

```bash
bunx biome check --files=.lintstagedrc.json
```

- [ ] **Step 3: Commit**

```bash
git add .lintstagedrc.json
git commit -m "feat: add lint-staged config for pre-commit auto-fix"
```

---

### Task 4: Add scripts to root package.json

**Files:**
- Modify: `package.json:7-16` (scripts section)

- [ ] **Step 1: Add `lint`, `format`, and `prepare` scripts**

The existing `scripts` block:

```json
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
```

Becomes:

```json
"scripts": {
    "test": "bun run --filter '*' test",
    "test:core": "bun run --filter core test",
    "test:claude": "bun run --filter claude test",
    "test:codex": "bun run --filter codex test",
    "test:cursor": "bun run --filter cursor test",
    "test:opencode": "bun run --filter opencode test",
    "test:gemini": "bun run --filter gemini test",
    "version": "node scripts/bump-version.js",
    "publish:all": "bun run --filter '*' publish --access public",
    "lint": "biome check . && markdownlint-cli2 '**/*.md' '#node_modules' '#.worktrees'",
    "format": "biome check --write . && markdownlint-cli2 --fix '**/*.md' '#node_modules' '#.worktrees'",
    "prepare": "husky"
  }
```

Use Edit tool to insert the three new lines after `"publish:all"` line.

- [ ] **Step 2: Verify scripts parse**

```bash
bun run --help
```

Bun will parse package.json on any run; no syntax error means success.

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "feat: add lint, format, and prepare scripts"
```

---

### Task 5: Initialize husky and write pre-commit hook

**Files:**
- Create: `.husky/pre-commit`

- [ ] **Step 1: Initialize husky**

```bash
bunx husky init
```

Creates `.husky/` directory with a default `pre-commit` file. Also sets up the `prepare` lifecycle script if not already present (ours is already set from Task 4).

- [ ] **Step 2: Overwrite `.husky/pre-commit`**

The default husky hook runs `npm test`. Replace its contents with:

```
npx lint-staged
```

- [ ] **Step 3: Make the hook executable**

```bash
chmod +x .husky/pre-commit
```

- [ ] **Step 4: Commit**

```bash
git add .husky/pre-commit
git commit -m "feat: add husky pre-commit hook running lint-staged"
```

---

### Task 6: Analyze and configure markdownlint

**Files:**
- Create: `.markdownlint-cli2.jsonc`

- [ ] **Step 1: Run markdownlint against the repo to see current violations**

```bash
npx markdownlint-cli2 '**/*.md' '#node_modules' '#.worktrees'
```

The output will list all files with violations and the rule codes (e.g., `MD033`, `MD041`, `MD022`, `MD009`). Review the output to identify which rules need disabling vs. which should be enforced.

- [ ] **Step 2: Write `.markdownlint-cli2.jsonc` with custom rules**

Based on the violation analysis, the expected config will disable rules that conflict with Superpowers' intentional conventions. Predicted overrides:

```jsonc
{
  "config": {
    "default": true,
    "MD013": false,  // line-length: skill files use long lines in code blocks and tables
    "MD033": false,  // no-inline-html: skills use <EXTREMELY-IMPORTANT>, <HARD-GATE>, etc.
    "MD041": false,  // first-line-h1: skill files embed in tool output, may start with custom tags
    "MD024": false   // no-duplicate-heading: skills reuse heading names like "Overview" across sections
  },
  "globs": ["**/*.md"],
  "ignores": ["node_modules", ".worktrees"]
}
```

Adjust the disabled rules based on the actual output from Step 1. The goal: disable only what's necessary, enforce everything else.

- [ ] **Step 3: Re-run markdownlint to verify the config is valid and violations are expected**

```bash
npx markdownlint-cli2 '**/*.md' '#node_modules' '#.worktrees'
```

Expected: Fewer violations than Step 1 (only intentional ones remain). If unexpected violations still appear, investigate — they may be real issues worth fixing rather than disabling.

- [ ] **Step 4: Commit**

```bash
git add .markdownlint-cli2.jsonc
git commit -m "feat: add markdownlint config tuned to Superpowers conventions"
```

---

### Task 7: Initial formatting pass

**Files:**
- Modify: All JS and JSON files (biome formatting)
- Modify: All MD files (markdownlint auto-fixes)

- [ ] **Step 1: Run the format script**

```bash
bun run format
```

Expected: Biome formats all JS/JSON files (reports "Fixed N file(s)"). markdownlint reports auto-fixes applied to MD files. Review the diff to confirm changes look correct.

- [ ] **Step 2: Verify nothing broke**

```bash
bun run test
```

All existing tests must pass. If formatting changed test files, the tests themselves should still pass (only whitespace/quote changes).

- [ ] **Step 3: Commit the formatting baseline**

```bash
git add -A
git commit -m "style: apply biome and markdownlint formatting baseline"
```

---

### Task 8: Verify hook works end-to-end

**Files:**
- External: `README.md` (temporary test change, reverted after verification)

- [ ] **Step 1: Introduce a deliberate formatting issue**

Add two trailing spaces to a line in `README.md`:

```bash
echo "  " >> README.md
```

- [ ] **Step 2: Stage and commit to trigger the hook**

```bash
git add README.md && git commit -m "test: verify pre-commit hook"
```

Expected: The pre-commit hook runs and either:
- Auto-fixes the trailing spaces (markdownlint --fix), the file is re-staged, commit succeeds
- OR if a check fails (non-zero exit), the commit is blocked

- [ ] **Step 3: Revert the test change**

```bash
git reset HEAD~1 --soft && git checkout -- README.md
```

(If the commit succeeded, reset it. If it was blocked, just checkout README.md.)

---

### Task 9: Final commit

- [ ] **Step 1: Verify working tree is clean**

```bash
git status
```

Expected: "nothing to commit, working tree clean" (no lingering formatting changes or test modifications).

- [ ] **Step 2: Final verification**

```bash
bun run lint
bun run test
```

Both must pass.

- [ ] **Step 3: Done**

The repo now has automated linting, formatting, and pre-commit hooks. All future commits will auto-fix formatting issues on staged files before they land.
