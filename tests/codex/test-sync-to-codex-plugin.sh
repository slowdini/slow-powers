#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

bash "$SCRIPT_DIR/test-plugin-layout.sh"
bash "$SCRIPT_DIR/codex-plugin-sync/test-sync-to-codex-plugin.sh"
