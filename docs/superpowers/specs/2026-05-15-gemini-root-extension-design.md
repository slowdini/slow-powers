# Gemini CLI Extension Root Manifest Design

**Status:** Draft  
**Date:** 2026-05-15  
**Author:** Max Haarhaus  

## Summary

Fix the Gemini CLI extension installation by moving the `extension.json` manifest
back to the repository root. The monorepo restructure that moved it into
`packages/gemini/extension.json` broke `gemini extensions install`, which expects
the manifest at the root of the cloned repository. This change consolidates the
Gemini harness surface to root-level files, deletes the now-empty
`packages/gemini/` directory, and adds an automated validation test that verifies
the extension manifest and context file stay in sync.

## Goals

1. Restore `gemini extensions install https://github.com/slowdini/superslow`
   functionality.
2. Eliminate the empty `packages/gemini/` workspace package.
3. Keep `GEMINI.md` at the repo root (already correct).
4. Add a deterministic, CI-friendly test that validates the extension surface.
5. Preserve lockstep versioning via `scripts/bump-version.js`.

## Non-Goals

- Change the content of `GEMINI.md`.
- Change Gemini-specific behavior, skills, or bootstrap content.
- Restructure any other harness.
- Add a full Gemini CLI integration test (environment dependency).

## Current State

- `packages/gemini/extension.json` exists with `contextFileName: "GEMINI.md"`.
- `GEMINI.md` lives at the repo root (correct).
- `packages/gemini/package.json` is a private workspace stub with no dependencies
  or scripts.
- `gemini extensions install <repo-url>` clones the repo root and expects
  `extension.json` at the root level. The current location inside
  `packages/gemini/` is invisible to the extension loader.

## Design

### 1. Root-Level Extension Surface

Move `packages/gemini/extension.json` to the repository root:

```text
<repo-root>/
├── extension.json          ← moved from packages/gemini/extension.json
├── GEMINI.md               ← already here
├── package.json            ← unchanged
└── ...
```

`GEMINI.md` stays at the root. `extension.json` continues to reference it via
`contextFileName: "GEMINI.md"`.

### 2. Remove Empty Package

Delete the `packages/gemini/` directory entirely, including:

- `packages/gemini/extension.json`
- `packages/gemini/package.json`

This directory no longer serves any purpose once the manifest is at the root.

### 3. Update Root Package Metadata

Remove the `test:gemini` script from the root `package.json`. There is no longer
a `packages/gemini/` workspace package to run tests for.

### 4. Update Version Bump Script

Update `scripts/bump-version.js` to bump `extension.json` at the repo root
instead of `packages/gemini/extension.json`.

### 5. Validation Test

Add `scripts/test-gemini-extension.sh` that validates the Gemini extension
surface without requiring the Gemini CLI to be installed.

Test assertions:

- `extension.json` exists at the repo root and is valid JSON.
- Required fields are present: `name`, `version`, `contextFileName`.
- `contextFileName` points to an existing file (`GEMINI.md`).
- `version` matches the root `package.json` version (prevents lockstep drift).

Exit code 0 on success, non-zero with descriptive message on failure.

This test is deterministic, fast, and can run in CI or local `bun test`
substitution.

## Verification

### Automated Validation

Run `scripts/test-gemini-extension.sh` and confirm it passes.

### Smoke Test

In a fresh directory, run:

```bash
gemini extensions install https://github.com/slowdini/superslow
```

Start a Gemini session and confirm the extension loads (e.g., a prompt
triggering `brainstorming` works).

## Risks And Mitigations

### Risk: Other references to `packages/gemini/` exist in docs or scripts

Mitigation: grep the repo for `packages/gemini` and update any remaining
references before committing.

### Risk: Root `extension.json` collides with other tooling

Mitigation: The filename `extension.json` at the repo root is already the
original upstream design; no other tool in this repo uses that filename. The
root `package.json` is private, so npm publishing is not a concern.

## Decision

Move the Gemini CLI extension manifest to the repository root, remove the empty
`packages/gemini/` workspace package, and validate the surface with a
dedicated shell test.
