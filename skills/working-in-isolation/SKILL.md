---
name: working-in-isolation
description: Use when you're about to start code changes — a feature, bugfix, or refactor — to establish an isolated workspace so your work doesn't collide with existing or in-progress work.
---

# Working in Isolation

Before changing code, make sure your work lands somewhere it won't collide with
existing or in-progress work. Decide the workspace based on the git state.
When in doubt, pause and ask the user.

## Decision: where does this work go?

Check the current state, then take the **first** matching rule:

```bash
git branch --show-current      # current branch
git status --porcelain         # empty = clean tree
git worktree list              # >1 entry = worktrees already exist
```

1. **The user named a workspace** (explicit command, or a configured preference)
   → follow it.
2. **Dirty tree (staged or unstaged changes) OR worktrees already exist**
   → a human or another agent is mid-work here. Use a **new worktree** so your
   changes can't collide with theirs.
3. **On `dev` / `main` / `master`** → sync with origin and **check out a new
   branch**. Keeps the base clean and makes the work easy to review.
4. **On any other branch** → **work in place.** The user already isolated this
   workspace; adding a worktree is needless ceremony.

> **Hard rule: never make changes while on `dev` / `main` / `master`.** If you
> find yourself on a base branch, branch (rule 3) or worktree (rule 2) first.

## Creating a worktree (rule 2)

Prefer your harness's **native git worktree tool** if it exists. Note that the tool my be deferred or lazily-loaded
Otherwise fall back to a git worktree:

```bash
git worktree add .worktrees/<branch-name> -b <branch-name>
cd .worktrees/<branch-name>
```

Keep the worktree out of version control: if `.worktrees/` isn't already
git-ignored, add it to `.gitignore` and commit that first. If worktree creation
fails (sandbox or permission limits), say so and fall back to checking out a
branch in place (rule 3).

## After the workspace is set

Install dependencies and run the existing test suite once, to confirm a clean
baseline before you write anything.

Use the project-appropriate commands to verify the baseline is clean - lint, test, build.

If the baseline is already failing, report it before starting — you need to know
which failures you introduced.
