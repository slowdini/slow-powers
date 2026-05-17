#!/usr/bin/env bash
# Setup script for OpenCode plugin tests
# Creates an isolated test environment using the packed repo-root artifact.
set -eEuo pipefail

# Get the repository root from this sourced script location.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Create temp home directory for isolation
export TEST_HOME
TEST_HOME="$(mktemp -d)"
export HOME="$TEST_HOME"
export XDG_CONFIG_HOME="$TEST_HOME/.config"
export OPENCODE_CONFIG_DIR="$TEST_HOME/.config/opencode"

# Packed install layout:
#   $OPENCODE_CONFIG_DIR/superslow/package.json
#   $OPENCODE_CONFIG_DIR/superslow/skills/
#   $OPENCODE_CONFIG_DIR/superslow/opencode/plugins/superpowers.js
#   $OPENCODE_CONFIG_DIR/plugins/superpowers.js

cleanup_test_env() {
    if [ -n "${TEST_HOME:-}" ] && [ -d "$TEST_HOME" ]; then
        rm -rf "$TEST_HOME"
    fi
}

setup_failed=1
cleanup_setup_on_error() {
    if [ "$setup_failed" -eq 1 ]; then
        cleanup_test_env
    fi
}

trap cleanup_setup_on_error ERR

SUPERPOWERS_DIR="$OPENCODE_CONFIG_DIR/superslow"
SUPERPOWERS_PACKAGE_JSON="$SUPERPOWERS_DIR/package.json"
SUPERPOWERS_SKILLS_DIR="$SUPERPOWERS_DIR/skills"
SUPERPOWERS_PLUGIN_FILE="$SUPERPOWERS_DIR/opencode/plugins/superpowers.js"

PACK_OUTPUT="$(npm pack --json --pack-destination "$TEST_HOME" "$REPO_ROOT")"
PACK_FILE_RELATIVE="$(printf '%s' "$PACK_OUTPUT" | node -e 'const fs = require("node:fs"); const data = JSON.parse(fs.readFileSync(0, "utf8")); process.stdout.write(data[0].filename);')"
PACK_FILE="$TEST_HOME/$PACK_FILE_RELATIVE"
EXTRACT_DIR="$TEST_HOME/extracted-root-package"

mkdir -p "$OPENCODE_CONFIG_DIR"
mkdir -p "$EXTRACT_DIR"
tar -xzf "$PACK_FILE" -C "$EXTRACT_DIR"
mv "$EXTRACT_DIR/package" "$SUPERPOWERS_DIR"
rm -rf "$EXTRACT_DIR" "$PACK_FILE"

# Register plugin via symlink (what OpenCode actually reads)
mkdir -p "$OPENCODE_CONFIG_DIR/plugins"
ln -sf "$SUPERPOWERS_PLUGIN_FILE" "$OPENCODE_CONFIG_DIR/plugins/superpowers.js"

# Create test skills in different locations for testing
mkdir -p "$OPENCODE_CONFIG_DIR/skills/personal-test"
cat > "$OPENCODE_CONFIG_DIR/skills/personal-test/SKILL.md" <<'EOF'
---
name: personal-test
description: Test personal skill for verification
---
# Personal Test Skill

This is a personal skill used for testing.

PERSONAL_SKILL_MARKER_12345
EOF

mkdir -p "$TEST_HOME/test-project/.opencode/skills/project-test"
cat > "$TEST_HOME/test-project/.opencode/skills/project-test/SKILL.md" <<'EOF'
---
name: project-test
description: Test project skill for verification
---
# Project Test Skill

This is a project skill used for testing.

PROJECT_SKILL_MARKER_67890
EOF

echo "Setup complete: $TEST_HOME"
echo "OPENCODE_CONFIG_DIR:  $OPENCODE_CONFIG_DIR"
echo "Superpowers dir:      $SUPERPOWERS_DIR"
echo "Package manifest:     $SUPERPOWERS_PACKAGE_JSON"
echo "Skills dir:           $SUPERPOWERS_SKILLS_DIR"
echo "Plugin file:          $SUPERPOWERS_PLUGIN_FILE"
echo "Plugin registered at: $OPENCODE_CONFIG_DIR/plugins/superpowers.js"
echo "Test project at:      $TEST_HOME/test-project"

setup_failed=0
trap - ERR

export -f cleanup_test_env
export REPO_ROOT
export SUPERPOWERS_DIR
export SUPERPOWERS_PACKAGE_JSON
export SUPERPOWERS_SKILLS_DIR
export SUPERPOWERS_PLUGIN_FILE
