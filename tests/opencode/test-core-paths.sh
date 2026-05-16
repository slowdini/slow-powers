#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../../.." && pwd)"
PACK_OUTPUT_FILE="$(mktemp)"

cleanup() {
    rm -f "$PACK_OUTPUT_FILE"
}

trap cleanup EXIT

echo "=== Test: Root OpenCode Package Shape ==="

echo "Test 1: Checking repo-root package metadata and packed file list..."
npm pack --dry-run --json "$REPO_ROOT" > "$PACK_OUTPUT_FILE"
node "$SCRIPT_DIR/test-core-paths.mjs" "$REPO_ROOT" "$PACK_OUTPUT_FILE"
echo "  [PASS] Repo root exposes an OpenCode server export and ships only runtime files"

echo ""
echo "=== Root OpenCode package shape test passed ==="
