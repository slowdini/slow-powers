#!/usr/bin/env sh
# Slow-powers installer for Cursor.
# Clones (or reuses) the Slow-powers repo and symlinks the Cursor plugin into
# Cursor's local plugin directory.

set -e

REPO_DIR="${SLOW_POWERS_DIR:-$HOME/.local/share/slow-powers}"
mkdir -p "$(dirname "$REPO_DIR")"

if [ -d "$REPO_DIR/.git" ]; then
  echo "Updating existing Slow-powers checkout at $REPO_DIR..."
  git -C "$REPO_DIR" pull --ff-only
else
  echo "Cloning Slow-powers into $REPO_DIR..."
  git clone https://github.com/slowdini/slow-powers "$REPO_DIR"
fi

mkdir -p "$HOME/.cursor/plugins/local"
ln -sfn "$REPO_DIR/cursor" "$HOME/.cursor/plugins/local/slow-powers"

echo
echo "Slow-powers installed for Cursor at:"
echo "  $HOME/.cursor/plugins/local/slow-powers -> $REPO_DIR/cursor"
echo
echo "Restart Cursor to load the plugin."
