# Branch-Safe Planning Doc Commits Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add branch-safety checks to the `brainstorming` and `writing-plans` skills so that planning documents (specs and implementation plans) are never committed directly to `main` or `master`.

**Architecture:** Insert a workspace-isolation verification step before any planning document is written or committed. If the agent is on a protected branch, it must invoke `superpowers:using-git-worktrees` to create an isolated workspace first. The changes are limited to two skill markdown files: updating checklists, process descriptions, and DOT diagrams.

**Tech Stack:** Markdown skill files, git, bash snippets for branch detection.

---

## Files

| File | Action | Responsibility |
|------|--------|----------------|
| `skills/brainstorming/SKILL.md` | Modify | Insert isolation step 5.5/6, update checklist numbering, add branch-check bash snippet, update process-flow DOT diagram |
| `skills/writing-plans/SKILL.md` | Modify | Insert "Branch safety" guard with bash snippet before the "Save plans to" line |

---

### Task 1: Modify `brainstorming` Skill — Insert Isolation Step and Update Checklist

**Files:**
- Modify: `skills/brainstorming/SKILL.md:20-32` (checklist)
- Modify: `skills/brainstorming/SKILL.md:86-93` (process section after "Presenting the design")

- [ ] **Step 1: Read the current brainstorming skill**

Run: `cat skills/brainstorming/SKILL.md | head -n 35`
Expected: Confirm the checklist contains steps 1–9 with step 5 as "Present design" and step 6 as "Write design doc".

- [ ] **Step 2: Update the checklist — insert step 6 and shift subsequent steps**

Replace:
```markdown
5. **Present design** — in sections scaled to their complexity, get user approval after each section
6. **Write design doc** — save to `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md` and commit
7. **Spec self-review** — quick inline check for placeholders, contradictions, ambiguity, scope (see below)
8. **User reviews written spec** — ask user to review the spec file before proceeding
9. **Transition to implementation** — invoke writing-plans skill to create implementation plan
```

With:
```markdown
5. **Present design** — in sections scaled to their complexity, get user approval after each section
6. **Ensure isolated workspace** — verify the current branch is safe before committing; create a worktree if on `main`/`master`
7. **Write design doc** — save to `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md` and commit
8. **Spec self-review** — quick inline check for placeholders, contradictions, ambiguity, scope (see below)
9. **User reviews written spec** — ask user to review the spec file before proceeding
10. **Transition to implementation** — invoke writing-plans skill to create implementation plan
```

- [ ] **Step 3: Insert the isolation process description after "Presenting the design"**

Replace:
```markdown
**Presenting the design:**

- Once you believe you understand what you're building, present the design
```

With:
```markdown
**Presenting the design:**

- Once you believe you understand what you're building, present the design

**Ensure isolated workspace before committing:**

Before writing and committing the spec, verify the current branch is safe:

```bash
BRANCH=$(git branch --show-current)
DEFAULT=$(git rev-parse --abbrev-ref origin/HEAD 2>/dev/null | sed 's|^origin/||')
if [ "$BRANCH" = "$DEFAULT" ] || [ "$BRANCH" = "main" ] || [ "$BRANCH" = "master" ]; then
    # On a protected branch — invoke using-git-worktrees to create isolation
fi
```

- **If already on a feature branch:** Proceed to write and commit in place
- **If on `main`/`master`:** Invoke `superpowers:using-git-worktrees` skill to create an isolated workspace. The spec is written and committed in the worktree.
```

- [ ] **Step 4: Verify the checklist and new section read correctly**

Run: `cat skills/brainstorming/SKILL.md | sed -n '20,35p'` and `cat skills/brainstorming/SKILL.md | sed -n '86,110p'`
Expected: Step 6 reads "Ensure isolated workspace"; the bash snippet and bullet points are present.

- [ ] **Step 5: Commit the brainstorming changes**

```bash
git add skills/brainstorming/SKILL.md
git commit -m "feat(brainstorming): require isolated workspace before committing spec"
```

---

### Task 2: Modify `brainstorming` Skill — Update Process Flow Diagram

**Files:**
- Modify: `skills/brainstorming/SKILL.md:34-63` (DOT digraph)

- [ ] **Step 1: Read the current DOT diagram**

Run: `cat skills/brainstorming/SKILL.md | sed -n '34,65p'`
Expected: Confirm the diagram contains nodes "User approves design?", "Write design doc", and the edge `"User approves design?" -> "Write design doc" [label="yes"];`.

- [ ] **Step 2: Add the new diagram node declaration**

Replace:
```dot
    "User approves design?" [shape=diamond];
    "Write design doc" [shape=box];
```

With:
```dot
    "User approves design?" [shape=diamond];
    "Ensure isolated workspace" [shape=box];
    "Write design doc" [shape=box];
```

- [ ] **Step 3: Re-route the "yes" edge through the new node**

Replace:
```dot
    "User approves design?" -> "Write design doc" [label="yes"];
    "Write design doc" -> "Spec self-review\n(fix inline)";
```

With:
```dot
    "User approves design?" -> "Ensure isolated workspace" [label="yes"];
    "Ensure isolated workspace" -> "Write design doc";
    "Write design doc" -> "Spec self-review\n(fix inline)";
```

- [ ] **Step 4: Verify the updated diagram**

Run: `cat skills/brainstorming/SKILL.md | sed -n '34,68p'`
Expected: The node "Ensure isolated workspace" appears, and the edge from "User approves design?" points to it with label "yes".

- [ ] **Step 5: Commit the diagram update**

```bash
git add skills/brainstorming/SKILL.md
git commit -m "feat(brainstorming): add isolation check to process flow diagram"
```

---

### Task 3: Modify `writing-plans` Skill — Insert Branch Safety Guard

**Files:**
- Modify: `skills/writing-plans/SKILL.md:14-19` (between Context and Save plans to)

- [ ] **Step 1: Read the current writing-plans header**

Run: `cat skills/writing-plans/SKILL.md | sed -n '14,22p'`
Expected: Confirm lines contain `**Context:**` followed by `**Save plans to:**` with nothing between them.

- [ ] **Step 2: Insert the branch safety guard**

Replace:
```markdown
**Context:** If working in an isolated worktree, it should have been created via the `superpowers:using-git-worktrees` skill at execution time.

**Save plans to:** `docs/superpowers/plans/YYYY-MM-DD-<feature-name>.md`
```

With:
```markdown
**Context:** If working in an isolated worktree, it should have been created via the `superpowers:using-git-worktrees` skill at execution time.

**Branch safety:** Before writing the plan document, verify the current branch is safe:

```bash
BRANCH=$(git branch --show-current)
DEFAULT=$(git rev-parse --abbrev-ref origin/HEAD 2>/dev/null | sed 's|^origin/||')
if [ "$BRANCH" = "$DEFAULT" ] || [ "$BRANCH" = "main" ] || [ "$BRANCH" = "master" ]; then
    # On a protected branch — invoke using-git-worktrees to create isolation
fi
```

- **If already isolated:** Write and commit in place
- **If on `main`/`master`:** Invoke `superpowers:using-git-worktrees` skill first, then write and commit in the worktree

**Save plans to:** `docs/superpowers/plans/YYYY-MM-DD-<feature-name>.md`
```

- [ ] **Step 3: Verify the guard is present**

Run: `cat skills/writing-plans/SKILL.md | sed -n '14,32p'`
Expected: The "Branch safety" heading, bash block, and two bullet points appear before "Save plans to".

- [ ] **Step 4: Commit the writing-plans change**

```bash
git add skills/writing-plans/SKILL.md
git commit -m "feat(writing-plans): require isolated workspace before saving plan"
```

---

### Task 4: Final Verification

- [ ] **Step 1: Run a syntax check on both modified files**

Run: `markdownlint skills/brainstorming/SKILL.md skills/writing-plans/SKILL.md 2>/dev/null || echo "markdownlint not installed; skipping"`
Expected: No errors (or skipping message). If markdownlint is unavailable, visually inspect the files for broken headings or code fences.

- [ ] **Step 2: Verify git history**

Run: `git log --oneline -3`
Expected: Three commits on the current feature branch:
1. `feat(writing-plans): require isolated workspace before saving plan`
2. `feat(brainstorming): add isolation check to process flow diagram`
3. `feat(brainstorming): require isolated workspace before committing spec`

- [ ] **Step 3: Confirm `main`/`master` remains untouched**

Run:
```bash
DEFAULT=$(git rev-parse --abbrev-ref origin/HEAD 2>/dev/null | sed 's|^origin/||')
git log "$DEFAULT"..HEAD --oneline
```
Expected: The three commits are listed, confirming they exist only on the feature branch and not on the default branch.

---

## Self-Review

**1. Spec coverage:**
- ✅ Insert step 5.5/6 in brainstorming — covered in Task 1 (checklist + process section)
- ✅ Update brainstorming checklist numbering — covered in Task 1 Step 2
- ✅ Update brainstorming process flow diagram — covered in Task 2
- ✅ Insert branch safety guard in writing-plans — covered in Task 3
- ✅ Bash snippet for branch detection — included in both Task 1 and Task 3
- ✅ Behavior table logic (feature branch → in place, main/master → worktree) — included in bullet points
- ✅ Manual verification steps — covered in Task 4

**2. Placeholder scan:**
- No "TBD", "TODO", "implement later", or "fill in details" found.
- No vague "add appropriate error handling" instructions.
- Every code block contains complete, copy-pasteable content.
- Exact file paths are specified.

**3. Type consistency:**
- Bash variable names (`BRANCH`, `DEFAULT`) are consistent across both skill modifications.
- Skill invocation syntax (`superpowers:using-git-worktrees`) is consistent.
- File path convention (`docs/superpowers/...`) is preserved.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-05-13-branch-safe-planning-docs.md`.**

- **REQUIRED SUB-SKILL:** Use superpowers:subagent-driven-development
- Fresh subagent per task + two-stage review
