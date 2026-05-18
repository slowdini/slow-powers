#!/usr/bin/env bash
# Test: Bootstrap Content Caching (#1202)
# Verifies repo-relative skill resolution and cached bootstrap behavior.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "=== Test: Bootstrap Content Caching (#1202) ==="

source "$SCRIPT_DIR/setup.sh"
trap cleanup_test_env EXIT

run_present_check() {
    node "$SCRIPT_DIR/test-bootstrap-caching.mjs" "$SUPERPOWERS_PLUGIN_FILE" present
}

run_missing_file_check() {
    mv "$SUPERPOWERS_DIR/bootstrap.md" "$TEST_HOME/bootstrap.md.bak"
    node "$SCRIPT_DIR/test-bootstrap-caching.mjs" "$SUPERPOWERS_PLUGIN_FILE" missing-file
}

run_missing_skills_dir_check() {
    mv "$SUPERPOWERS_SKILLS_DIR" "$TEST_HOME/missing-skills-dir.bak"
    node "$SCRIPT_DIR/test-bootstrap-caching.mjs" "$SUPERPOWERS_PLUGIN_FILE" missing-skills-dir
}

echo "Test 1: Caches bootstrap after the first successful transform..."
run_present_check
echo "  [PASS] Repo-relative bootstrap content is cached while fresh message arrays still receive injection"

echo "Test 2: Caches missing bootstrap file result..."
run_missing_file_check
echo "  [PASS] Missing bootstrap file is cached and not re-probed every transform"

echo "Test 3: Skips missing repo-relative skills directory..."
run_missing_skills_dir_check
echo "  [PASS] Missing repo-relative skills directory avoids registration and repeated disk work"

echo ""
echo "=== All bootstrap caching tests passed ==="
