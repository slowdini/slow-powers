# Spec: Transition using-superpowers skill to bootstrap.md

This spec describes the transition of the `using-superpowers` skill into a foundational `bootstrap.md` file at the repository root. This removes the "skill" status from the bootstrap content, preventing agent confusion and streamlining session initialization across all supported harnesses.

## Background

Currently, `using-superpowers` is a skill located in `skills/using-superpowers/SKILL.md`. It contains the foundational instructions for how an agent should use other skills. Because it is a skill, it is discoverable by agents via the `Skill` tool. However, all supported harnesses already inject its content into the session context at startup. This leads to agents occasionally trying to "load" the skill they are already following, which is redundant and confusing.

## Goals

- Move foundational instructions from a "skill" to a repository-level `bootstrap.md` file.
- Update all agent harnesses (Gemini, Claude, Cursor, Codex, OpenCode) to use the new file.
- Delete the `using-superpowers` skill.
- Update documentation and tests to reflect this change.

## Design

### 1. Core File Changes

- **Create `bootstrap.md`** at the repository root.
- **Migrate content** from `skills/using-superpowers/SKILL.md`:
    - Strip YAML frontmatter.
    - Remove the `<SUBAGENT-STOP>` block (it's no longer an invokable skill).
    - Update framing text to refer to "core instructions" or "bootstrap context" instead of the `using-superpowers` skill.
- **Delete `skills/using-superpowers/`** directory.

### 2. Harness Updates

#### Gemini CLI
- Update `gemini-instructions.md`:
    - Change `@./skills/using-superpowers/SKILL.md` to `@./bootstrap.md`.

#### Claude / Cursor / Codex
- Update `hooks/session-start`:
    - Update the file path to read `bootstrap.md`.
    - Update the `session_context` framing to remove skill-specific language.

#### OpenCode
- Update `opencode/plugins/superpowers.js`:
    - Update `usingSuperpowersSkillPath` to point to `bootstrap.md`.
    - Remove `extractAndStripFrontmatter`.
    - Update framing in `_bootstrapCache`.

### 3. Tests and Documentation

- **Update tests**:
    - `tests/opencode/test-opencode-git-install.sh`: Update assertions for file existence and content.
- **Update documentation**:
    - `README.md`: Remove `using-superpowers` from the skills list.
    - `CHANGELOG.md`: Note the transition.

## Success Criteria

- `bootstrap.md` exists at the root and contains the instruction content.
- `skills/using-superpowers/` is removed.
- Gemini CLI loads the bootstrap content at start.
- Claude/Cursor/Codex hooks correctly inject the bootstrap content.
- OpenCode plugin correctly injects the bootstrap content.
- All tests pass.
- No agent tries to "load" a skill named `using-superpowers`.
