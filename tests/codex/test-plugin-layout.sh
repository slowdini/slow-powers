#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
MARKETPLACE_PATH="$REPO_ROOT/.agents/plugins/marketplace.json"

fail() {
  printf 'FAIL: %s\n' "$1" >&2
  exit 1
}

plugin_root_rel="$(python3 - "$MARKETPLACE_PATH" <<'PY'
import json
import pathlib
import sys

with open(sys.argv[1], 'r', encoding='utf-8') as handle:
    marketplace = json.load(handle)

def normalize_local_path(path_value: str, label: str) -> str:
    if not isinstance(path_value, str) or not path_value:
        raise SystemExit(f'{label} must be a non-empty string path')
    if not path_value.startswith('./'):
        raise SystemExit(f'{label} must start with ./ (got {path_value!r})')

    relative_path = path_value[2:]
    if not relative_path:
        raise SystemExit(f'{label} must not be ./')

    parts = pathlib.PurePosixPath(relative_path).parts
    if not parts or any(part in ('', '.', '..') for part in parts):
        raise SystemExit(f'{label} must stay within the marketplace root (got {path_value!r})')

    return relative_path

def normalize_git_subdir(path_value: str, label: str) -> str:
    if not isinstance(path_value, str) or not path_value:
        raise SystemExit(f'{label} must be a non-empty string path')

    normalized = path_value[2:] if path_value.startswith('./') else path_value
    parts = pathlib.PurePosixPath(normalized).parts
    if not parts or any(part in ('', '.', '..') for part in parts):
        raise SystemExit(f'{label} must stay within the repository root (got {path_value!r})')

    return normalized

for plugin in marketplace.get('plugins', []):
    if plugin.get('name') == 'superslow':
        source = plugin.get('source', {})
        if isinstance(source, str):
            print(normalize_local_path(source, 'Marketplace plugin path'))
            break

        if not isinstance(source, dict):
            raise SystemExit('Marketplace plugin source must be a string or object')

        source_type = source.get('source', 'local')
        if source_type == 'local':
            print(normalize_local_path(source.get('path', ''), 'Marketplace plugin path'))
        elif source_type == 'url':
            if source.get('url') != './':
                raise SystemExit(
                    f"Marketplace plugin git source url must be './' (got {source.get('url')!r})"
                )
            git_path = source.get('path')
            if git_path:
                print(normalize_git_subdir(git_path, 'Marketplace plugin git source path'))
            else:
                print('.')
        elif source_type == 'git-subdir':
            if source.get('url') != './':
                raise SystemExit(
                    f"Marketplace plugin git source url must be './' (got {source.get('url')!r})"
                )
            print(
                normalize_git_subdir(
                    source.get('path', ''),
                    'Marketplace plugin git source path',
                )
            )
        else:
            raise SystemExit(f'Unsupported marketplace plugin source type: {source_type!r}')
        break
else:
    raise SystemExit('superslow plugin entry missing from marketplace.json')
PY
)"

[[ -n "$plugin_root_rel" ]] || fail "Marketplace plugin root is empty"

if [[ "$plugin_root_rel" != "." ]]; then
  plugin_root="$(cd "$REPO_ROOT/$plugin_root_rel" && pwd)"
else
  plugin_root="$REPO_ROOT"
fi

manifest_path="$plugin_root/.codex-plugin/plugin.json"
[[ -f "$manifest_path" ]] || fail "Plugin manifest missing at $manifest_path"

python3 - "$plugin_root" "$manifest_path" <<'PY'
import json
import os
import sys

plugin_root = os.path.realpath(sys.argv[1])
manifest_path = sys.argv[2]

with open(manifest_path, 'r', encoding='utf-8') as handle:
    manifest = json.load(handle)

def resolve_component(path_value: str, label: str) -> str:
    if not isinstance(path_value, str) or not path_value:
        raise SystemExit(f'{label} must be a non-empty string path')
    if not path_value.startswith('./'):
        raise SystemExit(f'{label} must start with ./ (got {path_value!r})')

    resolved = os.path.realpath(os.path.join(plugin_root, path_value))
    if os.path.commonpath([plugin_root, resolved]) != plugin_root:
        raise SystemExit(f'{label} escapes the plugin root (got {path_value!r})')
    if not os.path.exists(resolved):
        raise SystemExit(f'{label} target does not exist: {path_value!r}')

    return resolved

skills_dir = resolve_component(manifest.get('skills'), 'skills')
hooks_path = resolve_component(manifest.get('hooks'), 'hooks')
resolve_component(manifest.get('interface', {}).get('composerIcon'), 'interface.composerIcon')
resolve_component(manifest.get('interface', {}).get('logo'), 'interface.logo')

bootstrap_path = os.path.join(plugin_root, 'bootstrap.md')
if not os.path.isfile(bootstrap_path):
    raise SystemExit('bootstrap.md missing from plugin root')

with open(hooks_path, 'r', encoding='utf-8') as handle:
    hooks = json.load(handle)

session_start_groups = hooks.get('hooks', {}).get('SessionStart')
if not session_start_groups:
    raise SystemExit('hooks.json must define SessionStart hooks')

matcher = session_start_groups[0].get('matcher', '')
for expected in ('startup', 'resume', 'clear'):
    if expected not in matcher.split('|'):
        raise SystemExit(f'SessionStart matcher must include {expected!r} (got {matcher!r})')

hook_command = session_start_groups[0].get('hooks', [{}])[0].get('command', '')
if 'run-hook.cmd' not in hook_command:
    raise SystemExit('SessionStart hook must call hooks/run-hook.cmd')

run_hook_path = os.path.join(plugin_root, 'hooks', 'run-hook.cmd')
session_start_path = os.path.join(plugin_root, 'hooks', 'session-start')
if not os.path.isfile(run_hook_path):
    raise SystemExit('hooks/run-hook.cmd missing from plugin root')
if not os.path.isfile(session_start_path):
    raise SystemExit('hooks/session-start missing from plugin root')

print('PASS')
PY
