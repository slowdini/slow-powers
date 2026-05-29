---
name: finishing-a-development-branch
description: Use when implementation is complete and all tests pass.
---

# Finishing a Development Branch

Safely merge or package completed work, clean up git worktrees, and handle git hygiene.

**Announce at start:** "I am using the finishing-a-development-branch skill to complete this work."

## The Process

### Step 1: Verify Tests
Before executing any integration action, verify that the project's test suite passes completely. Do not proceed if there are failing tests.
```bash
# Project-appropriate test command:
npm test / cargo test / pytest / go test ./...
```

### Step 2: Detect Git Environment
Determine the workspace state to choose the appropriate integration menu:
```bash
GIT_DIR=$(cd "$(git rev-parse --git-dir)" 2>/dev/null && pwd -P)
GIT_COMMON=$(cd "$(git rev-parse --git-common-dir)" 2>/dev/null && pwd -P)
```

* **GIT_DIR == GIT_COMMON:** Normal repository checkout. No worktree to clean up.
* **GIT_DIR != GIT_COMMON (Detached HEAD):** Workspace is externally managed. Present PR/Discard options only.
* **GIT_DIR != GIT_COMMON (Named Branch):** Workspace is a linked git worktree.

### Step 3: Present Structured Options

Present exactly these options based on your environment:

#### Normal Repo & Named-Branch Worktree:
```
Implementation complete. What would you like to do?

1. Merge back to base branch locally
2. Push and create a Pull Request
3. Keep the branch as-is (I'll handle it later)
4. Discard this work
```

#### Detached HEAD:
```
Implementation complete. You're on a detached HEAD (externally managed workspace).

1. Push as new branch and create a Pull Request
2. Keep as-is (I'll handle it later)
3. Discard this work
```

### Step 4: Execute Choice

#### 1. Merge Locally
1. Navigate to the main repository root.
2. Checkout the base branch (e.g., `main` or `master`) and run `git pull`.
3. Run `git merge <feature-branch>`.
4. Verify the test suite passes on the merged result.
5. Clean up the worktree (if any) and delete the local feature branch:
```bash
git branch -d <feature-branch>
```

#### 2. Push & Create PR
```bash
git push -u origin <feature-branch>
gh pr create --title "feat: <feature-title>" --body "## Summary\n- <bullets of what changed>\n\n## Test Plan\n- [ ] verified tests pass"
```
*Do not delete the worktree yet, as the user may need to iterate based on PR feedback.*

#### 3. Keep As-Is
Preserve the feature branch and worktree exactly as they are.

#### 4. Discard
**Explicit confirmation is required first.** Ask the user to type `discard` to confirm. If confirmed:
1. Navigate to the main repository root.
2. Clean up the worktree (if any).
3. Force-delete the branch:
```bash
git branch -D <feature-branch>
```

### Step 5: Clean Up Git Worktrees (Options 1 & 4 only)

> **REQUIRED BACKGROUND:** You must understand `slow-powers:using-git-worktrees` for workspace isolation and worktree management.

If the workspace is a worktree that you created (under `.worktrees/`, `worktrees/`, or `~/.config/slow-powers/worktrees/`), clean it up from the main repository root:
```bash
cd "$MAIN_REPO_ROOT"
git worktree remove "$WORKTREE_PATH"
git worktree prune
```
*Do not clean up worktrees that are managed by the host environment or harness.*
