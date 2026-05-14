# Linting, Formatting, and Git Hooks — Design

## Problem

The Superpowers monorepo has no automated linting, formatting, or git hooks. Code quality
depends entirely on contributor discipline. Files accumulate whitespace drift, inconsistent
quote styles, and markdown that violates common conventions. A lint/format/hook setup will
catch these issues automatically before they reach a PR.

## Scope

- Biome for JavaScript and JSON linting + formatting
- markdownlint for Markdown linting
- Husky + lint-staged for git hook management
- Single root-level configuration (no per-package configs)
- Pre-commit auto-fix on staged files only
- This spec excludes: Python linting, CI integration, TypeScript-specific rules

## Tool Selection

### Biome (`@biomejs/biome`)

Zero-dependency Rust tool, single `biome.json` config. Faster than ESLint + Prettier
combined. Handles both formatting and linting for JS, JSON, and JSONC. Ruleset: `recommended`.

**Config:** `biome.json` at repo root.

- Indent: 2 spaces (matches existing code)
- Quotes: double (matches existing code)
- Semicolons: always (matches existing code)
- Trailing commas: all
- Ignores: `node_modules`, `.worktrees`, `bun.lock`

### markdownlint (`markdownlint-cli2`)

CLI for the markdownlint library. Single config file `.markdownlint-cli2.jsonc`.

**Custom rule set** tuned to Superpowers' markdown conventions. The skill files use patterns
that violate default markdownlint rules:

- **`no-inline-html`** — skills use `<EXTREMELY-IMPORTANT>`, `<HARD-GATE>`, `<SUBAGENT-STOP>` etc.
- **`no-trailing-spaces`** — some ASCII diagrams and code blocks use intentional trailing spaces (though this should arguably be cleaned up)
- **`blanks-around-headings`** — some tightly-packed reference docs omit blank lines around headings
- **`single-h1`** — skill files are embedded into tool output and may have multiple top-level headings; also used in `> **Note**:` blockquote headings

The initial pass will run markdownlint across the entire repo and produce a list of
violations. Custom overrides will disable rules that conflict with intentional conventions
and enforce rules that are universally beneficial (consistent heading style, no bare URLs,
code block language labels, etc.).

### Husky (`husky`)

Manage git hooks without touching `.git/hooks` directly. The `prepare` script in
`package.json` installs hooks on `bun install`. Single hook: `pre-commit`.

### lint-staged (`lint-staged`)

Runs commands against staged files only. Configured via `.lintstagedrc.json`.

## Architecture

```
superpowers/
├── biome.json              # Biome formatter + linter
├── .lintstagedrc.json       # File glob → command mapping
├── .husky/
│   └── pre-commit           # Calls lint-staged
├── .markdownlint-cli2.jsonc # markdownlint rules
└── package.json             # + lint, format, prepare scripts
```

All configuration is at the repo root. Workspace packages inherit root-level lint/format
rules; no per-package overrides needed.

## Hook Flow

```
git commit
  → .husky/pre-commit
    → npx lint-staged
      → staged *.js, *.json, *.jsonc → biome check --write
      → staged *.md → markdownlint-cli2 --fix
  → if any command fails (non-zero exit) → commit blocked
  → auto-fixed files are re-staged automatically
```

## Scripts

Added to root `package.json`:

```json
{
  "lint": "biome check . && markdownlint-cli2 '**/*.md' '#node_modules'",
  "format": "biome check --write . && markdownlint-cli2 --fix '**/*.md' '#node_modules'",
  "prepare": "husky"
}
```

- `lint` — read-only, suitable for CI
- `format` — auto-fixes all files (for interactive use or `bun run format`)
- `prepare` — standard husky trigger

## Dependencies

Added to root `devDependencies`:

```json
{
  "@biomejs/biome": "^1.9.4",
  "markdownlint-cli2": "^0.17.2",
  "husky": "^9.1.7",
  "lint-staged": "^15.5.0"
}
```

## Implementation Plan

1. Install dependencies: `bun add -d @biomejs/biome markdownlint-cli2 husky lint-staged`
2. Initialize husky: `bunx husky init`
3. Write `biome.json`
4. Write `.lintstagedrc.json`
5. Write `.markdownlint-cli2.jsonc` with custom rules
6. Add scripts to `package.json`
7. Create `.husky/pre-commit` hook calling `npx lint-staged`
8. Run `bun run format` across the entire repo
9. Commit the baseline formatting + config files

## Risks

- **markdownlint false positives**: Skills use unconventional markdown. The initial pass
  will surface many violations. The custom rule config must be tuned carefully to avoid
  breaking intentional formatting.
- **Formatting churn on initial commit**: The first `biome check --write` will reformat
  every JS and JSON file. This is expected and will be a single isolated commit.
- **Pre-commit hook performance**: lint-staged only runs on staged files, so commits
  should stay fast (sub-500ms for typical changes).
