---
name: using-git-worktrees
description: Use when starting new feature development or bugfix work to establish a safe, isolated development workspace.
---

# Using Git Worktrees

Ensure work happens in an isolated workspace. Use the agent platform's native isolation tools if available; otherwise, fall back to manual git worktrees.

**Announce at start:** "I am using the using-git-worktrees skill to set up an isolated workspace."

---

## Step 0: Detect Existing Isolation

Before creating anything, verify if you are already in an isolated workspace or worktree:
```bash
GIT_DIR=$(cd "$(git rev-parse --git-dir)" 2>/dev/null && pwd -P)
GIT_COMMON=$(cd "$(git rev-parse --git-common-dir)" 2>/dev/null && pwd -P)
```

* **If `GIT_DIR != GIT_COMMON` (and not in a git submodule):** You are already in an isolated worktree. Skip creation and proceed to Step 2.
* **If `GIT_DIR == GIT_COMMON` (or in a submodule):** You are in a normal repository checkout. Ask for user consent before creating a worktree:
  > "Would you like me to set up an isolated git worktree? This protects your current workspace and branch from changes."

If the user declines, work in place and skip to Step 2.

---

## Step 1: Create Isolated Workspace (Git Fallback)

If the user consents and no native platform isolation tool is present, create a git worktree manually.

### 1. Directory Selection & Safety
Select the worktree directory path by priority:
1. Local directory: `.worktrees/` (preferred) or `worktrees/` at the project root.
2. Global legacy directory: `~/.config/superslow/worktrees/<project-name>/`
3. Fallback: Default to `.worktrees/`

**Safety Guard (for local directories):** Verify the worktree directory is ignored in `.gitignore`:
```bash
git check-ignore -q .worktrees 2>/dev/null || git check-ignore -q worktrees 2>/dev/null
```
*If not ignored, add the path to `.gitignore` and commit it before creating the worktree. This prevents worktree contents from being tracked.*

### 2. Create the Worktree
```bash
git worktree add "<path-to-worktree>/<branch-name>" -b "<branch-name>"
cd "<path-to-worktree>/<branch-name>"
```
*If creation fails due to sandbox or permission constraints, notify the user and safely proceed to work in place.*

---

## Step 2: Project Setup & Baseline Verification

### 1. Install Dependencies
Detect and run appropriate project setup:
* **Node.js:** `npm install`
* **Rust:** `cargo build`
* **Python:** `pip install -r requirements.txt` or `poetry install`
* **Go:** `go mod download`

### 2. Run Baseline Tests
Run tests before writing any code to ensure the workspace starts clean:
```bash
npm test / cargo test / pytest / go test ./...
```
* **If tests fail:** Report the failures and ask the user whether to investigate or proceed.
* **If tests pass:** Proceed with implementation.
