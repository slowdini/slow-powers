#!/usr/bin/env bash
# Test: Antigravity Extension Surface Validation
# Verifies that antigravity-extension.json is at the repo root, is valid JSON,
# contains required fields, references an existing antigravity-instructions.md, and
# has a version matching root package.json.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "=== Test: Antigravity Extension Surface ==="

# Test 1: antigravity-extension.json exists at repo root
if [ -f "$REPO_ROOT/antigravity-extension.json" ]; then
    echo "  [PASS] antigravity-extension.json exists at repo root"
else
    echo "  [FAIL] antigravity-extension.json not found at repo root"
    exit 1
fi

# Test 2: antigravity-extension.json is valid JSON and has required fields
node - "$REPO_ROOT/antigravity-extension.json" <<'EOF'
const fs = require("node:fs");
const path = process.argv[2];
let ext;
try {
    ext = JSON.parse(fs.readFileSync(path, "utf8"));
} catch (e) {
    console.error("  [FAIL] antigravity-extension.json is not valid JSON:", e.message);
    process.exit(1);
}
for (const field of ["name", "version", "contextFileName"]) {
    if (ext[field] === undefined) {
        console.error(`  [FAIL] Missing required field: ${field}`);
        process.exit(1);
    }
}
console.log("  [PASS] antigravity-extension.json is valid JSON with required fields");
EOF

# Test 3: contextFileName points to an existing file
contextFileName=$(node -p "JSON.parse(require('fs').readFileSync('$REPO_ROOT/antigravity-extension.json', 'utf8')).contextFileName")
if [ -f "$REPO_ROOT/$contextFileName" ]; then
    echo "  [PASS] contextFileName ($contextFileName) resolves to existing file"
else
    echo "  [FAIL] contextFileName ($contextFileName) does not resolve to an existing file"
    exit 1
fi

# Test 4: version matches root package.json
extVersion=$(node -p "JSON.parse(require('fs').readFileSync('$REPO_ROOT/antigravity-extension.json', 'utf8')).version")
pkgVersion=$(node -p "JSON.parse(require('fs').readFileSync('$REPO_ROOT/package.json', 'utf8')).version")
if [ "$extVersion" = "$pkgVersion" ]; then
    echo "  [PASS] antigravity-extension.json version ($extVersion) matches package.json ($pkgVersion)"
else
    echo "  [FAIL] Version mismatch: antigravity-extension.json=$extVersion, package.json=$pkgVersion"
    exit 1
fi

echo ""
echo "=== All Antigravity extension surface tests passed ==="
