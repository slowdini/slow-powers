# Installing Superslow for OpenCode

## Prerequisites

- [OpenCode.ai](https://opencode.ai) installed
- `git` available in your shell

## Installation

Add Superslow to the `plugin` array in your `opencode.json` (global or project-level):

```json
{
  "plugin": ["superslow@git+https://github.com/slowdini/superslow.git"]
}
```

Restart OpenCode. The plugin installs from the Superslow GitHub repository and
registers all bundled skills.

Verify by using OpenCode's native `skill` tool to list bundled skills and make
sure entries such as `brainstorming` appear:

```text
use skill tool to list skills
```

OpenCode uses its own plugin install. If you also use Claude Code, Codex, or
another harness, install Superslow separately for each one.

## Pinning a release

To pin a specific tag, use the same plugin entry with a ref suffix:

```json
{
  "plugin": ["superslow@git+https://github.com/slowdini/superslow.git#v1.0.0"]
}
```

## Migrating from the old symlink-based install

If you previously installed superpowers/superslow using `git clone` and
symlinks, remove the old setup:

```bash
rm -f ~/.config/opencode/plugins/superpowers.js
rm -rf ~/.config/opencode/skills/superpowers
rm -rf ~/.config/opencode/superpowers ~/.config/opencode/superslow
```

Then follow the installation steps above.

## Usage

Use OpenCode's native `skill` tool:

```text
use skill tool to list skills
use skill tool to load brainstorming
```

## Updating

OpenCode installs Superslow through a git-backed package spec. To update, point
the plugin entry at a newer tag or restart OpenCode after the tracked ref
moves. Some OpenCode and Bun versions cache git dependencies, so a restart may
not pick up the newest commit immediately. If updates do not appear, clear
OpenCode's package cache or reinstall the plugin.

## Troubleshooting

### Plugin not loading

1. Check logs: `opencode run --print-logs "hello" 2>&1 | grep -Ei 'superpowers|superslow'`
2. Verify the plugin line in your `opencode.json`
3. Make sure you're running a recent version of OpenCode

### Git install issues

If OpenCode cannot install the git spec, clone the repo locally and point
OpenCode at the checkout root instead:

```bash
git clone https://github.com/slowdini/superslow "$HOME/.config/opencode/superslow"
```

Then use an absolute path in `opencode.json`:

```json
{
  "plugin": ["/Users/your-user/.config/opencode/superslow"]
}
```

Do not rely on `~` expansion unless you have verified that your OpenCode build
expands it in plugin paths.

### Skills not found

1. Use `skill` tool to list what's discovered
2. Check that the plugin is loading (see above)

### Tool mapping

When skills reference Claude Code tools:

- `TodoWrite` -> `todowrite`
- `Task` with subagents -> `@mention` syntax
- `Skill` tool -> OpenCode's native `skill` tool
- File operations -> your native tools

## Getting Help

- [Report issues](https://github.com/slowdini/superslow/issues)
- [Full documentation](https://github.com/slowdini/superslow/blob/main/docs/README.opencode.md)
