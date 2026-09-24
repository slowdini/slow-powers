---
name: working-in-isolation
description: Use when you're about to start changing files in a repository — code, docs, config, or content, whether a feature, bugfix, refactor, or docs/config update — to establish an isolated workspace so your work doesn't collide with existing or in-progress work.
---

# Working in isolation

Before changing anything in a repository — code, docs, config, or other files —
make sure your work lands somewhere it won't collide with existing or in-progress
work. Decide the workspace based on the git state. When in doubt, pause and ask
the user.

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
3. **On `dev` / `main` / `master`** → sync with origin and **create a new
   branch** using the rule 3 command below. Keeps the base clean and makes the
   work easy to review.
4. **On any other branch** → **work in place.** The user already isolated this
   workspace; adding a worktree is needless ceremony.

> **Hard rule: never make changes while on `dev` / `main` / `master`.** If you
> find yourself on a base branch, branch (rule 3) or worktree (rule 2) first.

## Create a worktree (rule 2)

Prefer your harness's **native Git worktree capability** if it exists. The capability may be deferred or lazily loaded. Otherwise, fall back to a Git worktree:

```bash
git worktree add .worktrees/<branch-name> -b <branch-name>
cd .worktrees/<branch-name>
```

Keep the worktree out of version control: if `.worktrees/` isn't already
ignored by Git, add it to `.gitignore` and commit that first. If worktree creation
fails (sandbox or permission limits), say so and fall back to checking out a
branch in place (rule 3).

## Create a branch (rule 3)

After syncing the base branch with origin, create the new branch from the
current `HEAD` with no upstream tracking:

```bash
git switch --no-track --create <branch-name>
```

Do not create the branch from `origin/dev`, `origin/main`, or `origin/master`.
`--no-track` keeps the new branch without an upstream until the user pushes it
explicitly.

## Set up the workspace

Install dependencies and run the existing test suite once, to confirm a clean
baseline before you write anything.

Use the project-appropriate commands to verify the baseline is clean — lint, test, and build.

If the baseline is already failing, report it before starting — you need to know
which failures you introduced.
