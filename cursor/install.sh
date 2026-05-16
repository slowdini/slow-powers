#!/usr/bin/env sh
# Superslow installer for Cursor.
# Clones (or reuses) the Superslow repo and symlinks the Cursor plugin into
# Cursor's local plugin directory.

set -e

REPO_DIR="${SUPERSLOW_DIR:-$HOME/.local/share/superslow}"
mkdir -p "$(dirname "$REPO_DIR")"

if [ -d "$REPO_DIR/.git" ]; then
  echo "Updating existing Superslow checkout at $REPO_DIR..."
  git -C "$REPO_DIR" pull --ff-only
else
  echo "Cloning Superslow into $REPO_DIR..."
  git clone https://github.com/slowdini/superslow "$REPO_DIR"
fi

mkdir -p "$HOME/.cursor/plugins/local"
ln -sfn "$REPO_DIR/cursor" "$HOME/.cursor/plugins/local/superpowers"

echo
echo "Superslow installed for Cursor at:"
echo "  $HOME/.cursor/plugins/local/superpowers -> $REPO_DIR/cursor"
echo
echo "Restart Cursor to load the plugin."
