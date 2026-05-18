#!/usr/bin/env bash
# Test: Plugin Loading
# Verifies that the superpowers plugin loads correctly in OpenCode
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "=== Test: Plugin Loading ==="

# Source setup to create isolated environment
source "$SCRIPT_DIR/setup.sh"

# Trap to cleanup on exit
trap cleanup_test_env EXIT

plugin_link="$OPENCODE_CONFIG_DIR/plugins/superpowers.js"

# Test 1: Verify packed root layout exists
echo "Test 1: Checking packed root layout..."
if [ -f "$SUPERPOWERS_PACKAGE_JSON" ]; then
    echo "  [PASS] Packed root package.json exists"
else
    echo "  [FAIL] Packed root package.json not found at $SUPERPOWERS_PACKAGE_JSON"
    exit 1
fi

if [ -d "$SUPERPOWERS_SKILLS_DIR" ]; then
    echo "  [PASS] Packed root includes bundled skills"
else
    echo "  [FAIL] Packed root skills directory not found at $SUPERPOWERS_SKILLS_DIR"
    exit 1
fi

# Test 2: Verify plugin file exists and is registered
echo "Test 2: Checking plugin registration..."
if [ -L "$plugin_link" ]; then
    echo "  [PASS] Plugin symlink exists"
else
    echo "  [FAIL] Plugin symlink not found at $plugin_link"
    exit 1
fi

if [ -f "$(readlink "$plugin_link")" ]; then
    echo "  [PASS] Plugin symlink target exists"
else
    echo "  [FAIL] Plugin symlink target does not exist"
    exit 1
fi

# Test 3: Verify skills directory is populated
echo "Test 3: Checking skills directory..."
skill_count="$(find "$SUPERPOWERS_SKILLS_DIR" -name "SKILL.md" | wc -l | tr -d ' ')"
if [ "$skill_count" -gt 0 ]; then
    echo "  [PASS] Found $skill_count skills"
else
    echo "  [FAIL] No skills found in $SUPERPOWERS_SKILLS_DIR"
    exit 1
fi

# Test 4: Check bootstrap.md exists (critical for bootstrap)
echo "Test 4: Checking bootstrap.md (required for bootstrap)..."
if [ -f "$SUPERPOWERS_DIR/bootstrap.md" ]; then
    echo "  [PASS] bootstrap.md exists"
else
    echo "  [FAIL] bootstrap.md not found"
    exit 1
fi

# Test 5: Verify plugin JavaScript syntax
echo "Test 5: Checking plugin JavaScript syntax..."
if node --check "$SUPERPOWERS_PLUGIN_FILE" 2>/dev/null; then
    echo "  [PASS] Plugin JavaScript syntax is valid"
else
    echo "  [FAIL] Plugin has JavaScript syntax errors"
    exit 1
fi

# Test 6: Verify plugin can be imported and initialized at runtime
echo "Test 6: Checking plugin runtime import and initialization..."
if node --input-type=module - "$SUPERPOWERS_PLUGIN_FILE" "$SUPERPOWERS_SKILLS_DIR" "$TEST_HOME/test-project" <<'EOF'
import assert from "node:assert/strict";
import fs from "node:fs";
import { pathToFileURL } from "node:url";

const pluginFile = process.argv[2];
const skillsDir = process.argv[3];
const projectDir = process.argv[4];

process.chdir(projectDir);

const pluginModule = await import(pathToFileURL(pluginFile).href);

assert.equal(
  typeof pluginModule.SuperpowersPlugin,
  "function",
  "plugin should export SuperpowersPlugin",
);

const plugin = await pluginModule.SuperpowersPlugin({
  client: {},
  directory: process.cwd(),
});

assert.equal(typeof plugin, "object", "plugin factory should return an object");
assert.equal(typeof plugin.config, "function", "plugin should expose config hook");
assert.equal(
  typeof plugin["experimental.chat.messages.transform"],
  "function",
  "plugin should expose chat transform hook",
);

const config = { skills: { paths: [] } };
await plugin.config(config);
const normalizedSkillsDir = fs.realpathSync.native(skillsDir);
const normalizedRegisteredPaths = config.skills.paths.map((entry) =>
  fs.realpathSync.native(entry),
);
assert.equal(
  normalizedRegisteredPaths.includes(normalizedSkillsDir),
  true,
  "config hook should register bundled skills dir",
);
EOF
then
    echo "  [PASS] Plugin imports and initializes successfully"
else
    echo "  [FAIL] Plugin could not be imported or initialized"
    exit 1
fi

# Test 7: Verify plugin JavaScript does not advertise stale path hints
echo "Test 7: Checking plugin does not advertise stale skills paths..."
if node --input-type=module - "$SUPERPOWERS_PLUGIN_FILE" <<'EOF'
import fs from "node:fs";

const pluginFile = process.argv[2];
const pluginSource = fs.readFileSync(pluginFile, "utf8");
const stalePathHintPatterns = [
  /\$\{?_?configDir\}?\/skills\/superpowers\//,
  /\.config\/opencode\/skills\/superpowers\//,
];

if (stalePathHintPatterns.some((pattern) => pattern.test(pluginSource))) {
  process.exit(1);
}
EOF
then
    echo "  [PASS] Plugin does not advertise a misleading skills path"
else
    echo "  [FAIL] Plugin still references an old configDir skills path"
    exit 1
fi

# Test 8: Verify personal test skill was created
echo "Test 8: Checking test fixtures..."
if [ -f "$OPENCODE_CONFIG_DIR/skills/personal-test/SKILL.md" ]; then
    echo "  [PASS] Personal test skill fixture created"
else
    echo "  [FAIL] Personal test skill fixture not found"
    exit 1
fi

echo ""
echo "=== All plugin loading tests passed ==="
