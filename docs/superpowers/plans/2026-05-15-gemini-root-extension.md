# Gemini CLI Extension Root Manifest Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the Gemini CLI extension manifest to the repo root, remove the empty `packages/gemini/` directory, update tooling references, and add a validation test.

**Architecture:** A simple file move and cleanup. The extension surface becomes root-level (`extension.json` + `GEMINI.md`), the empty workspace package is deleted, the version bump script and root `package.json` scripts are updated, and a shell test validates the surface.

**Tech Stack:** Bash, Node.js, JSON.

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `packages/gemini/extension.json` | Move to `extension.json` | Gemini CLI extension manifest (must be at repo root for `gemini extensions install`) |
| `packages/gemini/package.json` | Delete | Empty workspace stub, no longer needed |
| `extension.json` (new at root) | Create | Destination of the moved manifest |
| `package.json` (root) | Modify | Remove `test:gemini` script |
| `scripts/bump-version.js` | Modify | Update `extension.json` path from `packages/gemini/extension.json` to `extension.json` |
| `scripts/test-gemini-extension.sh` | Create | Validation test for the extension surface |

---

### Task 1: Move `extension.json` to repo root

**Files:**
- Move: `packages/gemini/extension.json` → `extension.json`

- [ ] **Step 1: Move the file**

```bash
git mv packages/gemini/extension.json extension.json
```

- [ ] **Step 2: Verify it exists at the new location**

```bash
node -e "const e = JSON.parse(require('fs').readFileSync('extension.json')); console.log(e.name, e.version, e.contextFileName)"
```

Expected output: `superpowers 1.0.0 GEMINI.md`

- [ ] **Step 3: Commit**

```bash
git add extension.json
git commit -m "fix(gemini): move extension.json to repo root for gemini install"
```

---

### Task 2: Delete empty `packages/gemini/` directory

**Files:**
- Delete: `packages/gemini/package.json`
- Delete: `packages/gemini/` (now empty)

- [ ] **Step 1: Remove the remaining package.json and directory**

```bash
rm -rf packages/gemini
git add packages/gemini/
git commit -m "chore(gemini): remove empty packages/gemini/ directory"
```

- [ ] **Step 2: Verify directory is gone**

```bash
test ! -d packages/gemini && echo "directory removed"
```

Expected: `directory removed`

---

### Task 3: Update root `package.json`

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Remove `test:gemini` script**

Replace the `scripts` block. Remove only the `"test:gemini": "bun run --filter gemini test"` line, keep all other scripts.

Before:
```json
    "test:gemini": "bun run --filter gemini test",
```

After: (remove the line entirely, no trailing comma needed)

- [ ] **Step 2: Verify valid JSON**

```bash
node -e "JSON.parse(require('fs').readFileSync('package.json'))" && echo "valid JSON"
```

Expected: `valid JSON`

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "chore(gemini): remove test:gemini script from root package.json"
```

---

### Task 4: Update `scripts/bump-version.js`

**Files:**
- Modify: `scripts/bump-version.js`

- [ ] **Step 1: Update the `files` array**

Replace `packages/gemini/extension.json` with `extension.json` in the `files` array.

Before:
```javascript
  "packages/gemini/extension.json",
```

After:
```javascript
  "extension.json",
```

- [ ] **Step 2: Verify the script still parses**

```bash
node --check scripts/bump-version.js && echo "valid JS"
```

Expected: `valid JS`

- [ ] **Step 3: Commit**

```bash
git add scripts/bump-version.js
git commit -m "chore(gemini): update bump-version.js for root extension.json"
```

---

### Task 5: Create `scripts/test-gemini-extension.sh`

**Files:**
- Create: `scripts/test-gemini-extension.sh`

- [ ] **Step 1: Write the test script**

```bash
#!/usr/bin/env bash
# Test: Gemini Extension Surface Validation
# Verifies that extension.json is at the repo root, is valid JSON,
# contains required fields, references an existing GEMINI.md, and
# has a version matching root package.json.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "=== Test: Gemini Extension Surface ==="

# Test 1: extension.json exists at repo root
if [ -f "$REPO_ROOT/extension.json" ]; then
    echo "  [PASS] extension.json exists at repo root"
else
    echo "  [FAIL] extension.json not found at repo root"
    exit 1
fi

# Test 2: extension.json is valid JSON and has required fields
node - "$REPO_ROOT/extension.json" <<'EOF'
const fs = require("node:fs");
const path = process.argv[2];
let ext;
try {
    ext = JSON.parse(fs.readFileSync(path, "utf8"));
} catch (e) {
    console.error("  [FAIL] extension.json is not valid JSON:", e.message);
    process.exit(1);
}
for (const field of ["name", "version", "contextFileName"]) {
    if (ext[field] === undefined) {
        console.error(`  [FAIL] Missing required field: ${field}`);
        process.exit(1);
    }
}
console.log("  [PASS] extension.json is valid JSON with required fields");
EOF

# Test 3: contextFileName points to an existing file
contextFileName=$(node -p "JSON.parse(require('fs').readFileSync('$REPO_ROOT/extension.json', 'utf8')).contextFileName")
if [ -f "$REPO_ROOT/$contextFileName" ]; then
    echo "  [PASS] contextFileName ($contextFileName) resolves to existing file"
else
    echo "  [FAIL] contextFileName ($contextFileName) does not resolve to an existing file"
    exit 1
fi

# Test 4: version matches root package.json
extVersion=$(node -p "JSON.parse(require('fs').readFileSync('$REPO_ROOT/extension.json', 'utf8')).version")
pkgVersion=$(node -p "JSON.parse(require('fs').readFileSync('$REPO_ROOT/package.json', 'utf8')).version")
if [ "$extVersion" = "$pkgVersion" ]; then
    echo "  [PASS] extension.json version ($extVersion) matches package.json ($pkgVersion)"
else
    echo "  [FAIL] Version mismatch: extension.json=$extVersion, package.json=$pkgVersion"
    exit 1
fi

echo ""
echo "=== All Gemini extension surface tests passed ==="
```

- [ ] **Step 2: Make it executable**

```bash
chmod +x scripts/test-gemini-extension.sh
```

- [ ] **Step 3: Run it and confirm it passes**

```bash
bash scripts/test-gemini-extension.sh
```

Expected output:
```
=== Test: Gemini Extension Surface ===
  [PASS] extension.json exists at repo root
  [PASS] extension.json is valid JSON with required fields
  [PASS] contextFileName (GEMINI.md) resolves to existing file
  [PASS] extension.json version (1.0.0) matches package.json (1.0.0)

=== All Gemini extension surface tests passed ===
```

- [ ] **Step 4: Commit**

```bash
git add scripts/test-gemini-extension.sh
git commit -m "test(gemini): add extension surface validation script"
```

---

### Task 6: Hunt and update stale references

**Files:**
- Modify: Any files referencing `packages/gemini/`

- [ ] **Step 1: Search for stale references**

```bash
grep -r "packages/gemini" --include="*.json" --include="*.js" --include="*.sh" --include="*.md" . || echo "No stale references"
```

- [ ] **Step 2: Update any found references**

For each match, update to the new root-level path or remove if the reference is no longer relevant (e.g., docs listing `packages/gemini/` as a harness directory).

Common places to check:
- `docs/superpowers/plans/*.md` — plans may list `packages/gemini/` in file lists
- `docs/superpowers/specs/*.md` — specs may reference the old path
- `docs/README.md` or `CHANGELOG.md` — may list harness directories

- [ ] **Step 3: Commit**

```bash
git add <updated-files>
git commit -m "docs: update stale packages/gemini/ references"
```

---

### Task 7: Final verification

- [ ] **Step 1: Run the validation test one more time**

```bash
bash scripts/test-gemini-extension.sh
```

Expected: All 4 tests pass.

- [ ] **Step 2: Verify `npm pack --dry-run` does not include `packages/gemini/`**

```bash
npm pack --dry-run --json 2>/dev/null | node -e "const d=JSON.parse(require('fs').readFileSync('/dev/stdin','utf8')); const files=new Set(d[0].files.map(f=>f.path)); if(files.has('packages/gemini/extension.json')||files.has('packages/gemini/package.json')){console.error('FAIL: still includes packages/gemini');process.exit(1);}else{console.log('PASS: packages/gemini not in pack');}"
```

Expected: `PASS: packages/gemini not in pack`

- [ ] **Step 3: Confirm git status is clean**

```bash
git status
```

Expected: Working tree clean.

---

## Spec Coverage Checklist

| Spec Requirement | Plan Task |
|---|---|
| Move `extension.json` to repo root | Task 1 |
| Delete `packages/gemini/` directory | Task 2 |
| Update root `package.json` scripts | Task 3 |
| Update `scripts/bump-version.js` | Task 4 |
| Add `scripts/test-gemini-extension.sh` | Task 5 |
| Update stale references | Task 6 |
| Run validation test | Task 7 |
