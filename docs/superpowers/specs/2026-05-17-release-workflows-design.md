# Release Workflows — Design

**Date:** 2026-05-17
**Status:** Approved (pending spec review)
**Branch:** `feat/release-workflows`

## Problem

Releases are currently cut by hand. There is no CI gate on PRs, no automation
around `scripts/bump-version.js`, and no consistent format for GitHub releases
(existing release titles vary: `v1.1.0`, `Superslow v1.0.1`, `Superslow v1.0.0`,
all with empty bodies). We want a controlled release flow with three properties:

1. Feature work lands on `dev` through PRs that are gated by CI.
2. Releases are cut by PR'ing `dev → main`, with the version bump baked into
   that PR rather than tacked on at the last minute.
3. Merges to `main` automatically tag and publish the GitHub release.

## Branching model

```
feature-branch ──PR──▶ dev ──release PR──▶ main ──auto-tag──▶ vX.Y.Z release
```

- Feature branches: cut from `dev`, PR'd back to `dev`.
- `dev`: integration branch. Everything that will ship lives here.
- `main`: release branch. Only release PRs land here; each merge produces a tag.

## Architecture overview

Three workflows in `.github/workflows/`:

| File | Trigger | Purpose |
|------|---------|---------|
| `ci.yml` | `pull_request` to `dev` or `main` | Run tests. Light suite on PRs to `dev`; full matrix on PRs to `main`. |
| `release-pr.yml` | `workflow_dispatch` with version input | Bump every manifest via `scripts/bump-version.js`, commit to `dev`, open the `dev → main` PR. |
| `release.yml` | `push` to `main` | Read version from `package.json`, tag `vX.Y.Z`, create the `Superslow vX.Y.Z` GitHub release. |

End-to-end flow:

1. Open a PR from a feature branch into `dev`. `ci.yml` runs the light suite.
2. Merge into `dev`.
3. When ready to ship, trigger `release-pr.yml` manually with the next
   version number (e.g. `1.2.0`). It bumps the manifests, commits to `dev`,
   and opens the `dev → main` release PR.
4. `ci.yml` runs the full matrix on the release PR. Review and merge.
5. `release.yml` fires on the push to `main`, tags `v1.2.0`, and creates the
   `Superslow v1.2.0` release.

## Workflow 1: `ci.yml`

**Trigger:**

```yaml
on:
  pull_request:
    branches: [dev, main]
```

**Concurrency:** cancel stale runs when new commits land on the same PR:

```yaml
concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true
```

**Job `light`** — runs when `github.base_ref == 'dev'`:

- `oven-sh/setup-bun@v2`
- `bun install --frozen-lockfile`
- `bun test`
- `bun run check`

**Job `full`** — runs when `github.base_ref == 'main'`:

- Everything in `light`, plus
- `bun run test:core`
- `bun run test:claude`
- `bun run test:codex`
- `bun run test:opencode`

Both jobs run on `ubuntu-latest`.

**Known limitation:** the `test:*` scripts in `package.json` end with `|| true`,
so they cannot currently fail CI. We accept this for now and track it as a
follow-up (see Out of scope).

## Workflow 2: `release-pr.yml`

**Trigger:**

```yaml
on:
  workflow_dispatch:
    inputs:
      version:
        description: "Next version (e.g. 1.2.0)"
        required: true
        type: string
```

**Steps:**

1. **Validate input.** Reject anything that does not match `^\d+\.\d+\.\d+$`.
   Fail with a clear message before any side effect.
2. **Checkout `dev`** with full history. Use a PAT (see "PAT requirement"
   below), not the default `GITHUB_TOKEN`.
3. **Confirm the version is strictly greater than current.** Read
   `package.json`, compare semver, fail on equal-or-lower input. Prevents
   accidental downgrades and re-bumps.
4. **Setup bun**, then run `node scripts/bump-version.js ${{ inputs.version }}`.
5. **Commit** the bumped manifests as `github-actions[bot]`:
   `chore: bump version to X.Y.Z`. Push directly to `dev`.
6. **Open PR `dev → main`** via `gh pr create`:
   - Title: `Release vX.Y.Z`
   - Body: a template with a release-notes section the maintainer fills in
     (see "Release notes template" below).
7. **Output** the PR URL in the workflow summary.

### PAT requirement

The default `GITHUB_TOKEN` cannot trigger downstream workflows. If
`release-pr.yml` pushes to `dev` or opens the PR with the default token,
`ci.yml` will not run on the release PR — defeating the purpose of having a
full-matrix gate before merge.

Solution: a fine-grained PAT scoped to this repo, with `contents: write` and
`pull-requests: write`, stored as repo secret `RELEASE_PR_TOKEN`. The
workflow uses this token for checkout, push, and `gh pr create`.

This is a one-time manual setup step performed by the maintainer.

### Release notes template

The PR body that `release-pr.yml` writes:

```markdown
<!-- release-notes -->
## Release notes

_Replace this paragraph with a short narrative for the release. If left
unchanged, GitHub's auto-generated notes will be used instead._
```

`release.yml` decides whether the maintainer edited the body by checking
for the presence of the placeholder phrase `Replace this paragraph` (see
Workflow 3, step 5). The `<!-- release-notes -->` marker is informational
and may be left in or removed.

## Workflow 3: `release.yml`

**Trigger:**

```yaml
on:
  push:
    branches: [main]
```

This fires on any push to `main`. With branch protection on `main` (see
"Branch protection" below), the only normal way to push is a PR merge, so
this is effectively "on release-PR merge." Direct admin pushes during an
emergency are handled by the fallback in step 5.

**Steps:**

1. **Checkout `main`** with full history (needed for the release-notes
   fallback API call).
2. **Read version** from `package.json` into `$VERSION`.
3. **Idempotency check.** If tag `v$VERSION` already exists, exit
   successfully with a no-op. This means:
   - Re-running the workflow on the same merge is safe.
   - A non-bump merge to `main` (e.g. an emergency docs hotfix that does not
     change the version) skips release creation rather than failing.
4. **Tag and push** `v$VERSION` at the merge commit.
5. **Build release body:**
   - Find the most recent PR merged into `main` (the release PR).
   - If a release PR is found AND its body no longer contains the exact
     placeholder phrase `Replace this paragraph` (the maintainer edited it),
     use the PR body verbatim.
   - Otherwise (no release PR found, or body still contains the placeholder),
     fall back to
     `gh api repos/{owner}/{repo}/releases/generate-notes` with
     `tag_name=v$VERSION` and `previous_tag_name=<previous tag>`.
6. **Create release** via
   `gh release create v$VERSION --title "Superslow v$VERSION" --notes "<body>"`.

## Edge cases

**Handled:**

| Case | Behavior |
|------|----------|
| Concurrent push to `dev` between bump and PR open | The new commit rides along into the release PR. Acceptable given low dev cadence. |
| Re-running `release.yml` on the same commit | Tag-exists check makes it a no-op. |
| Direct push to `main` (admin bypass) | No release PR found; auto-generated notes are used. Release still publishes. |
| Invalid version input to `release-pr.yml` | Workflow fails on the regex check before any commit. |
| Downgrade attempt (`1.0.0` after `1.1.0`) | Workflow fails the semver comparison. |
| Non-bump merge to `main` (docs hotfix) | Tag already exists → release workflow no-ops. |

**Explicit non-goals:**

- Pre-release versions (`1.2.0-beta.1`). Out of scope.
- Concurrent runs of `release-pr.yml` (maintainer triggers it twice). Git
  will refuse one of the pushes; manual cleanup. Not engineered around.
- Hotfix branches off `main`. Not part of the branching model.

## Branch protection

Workflows alone do not enforce the flow. The maintainer should configure
branch protection in the GitHub UI after the workflows are in place:

**`main`:**

- Require a PR before merging.
- Require status check: `ci.yml / full`.
- Disallow force pushes.
- Disallow deletions.
- Allow admins to bypass (for emergencies).

**`dev`:**

- Require a PR before merging.
- Require status check: `ci.yml / light`.
- Disallow force pushes.

This is a manual one-time setup step, called out in the spec for the
maintainer to perform after merging the workflow changes. Workflows do not
attempt to configure protection programmatically.

## Documentation

Add a `## Releasing` section to `README.md`, placed between `## Contributing`
and `## License`. Shape:

```markdown
## Releasing

Releases are cut from `dev` and tagged from `main`:

1. Merge feature PRs into `dev` after CI passes.
2. When ready to ship, trigger the **Release PR** workflow with the next
   version number. It bumps every manifest via `scripts/bump-version.js`,
   commits to `dev`, and opens a `dev → main` PR.
3. Review the release PR (full test matrix runs on it) and merge.
4. Merging to `main` automatically tags `vX.Y.Z` and creates the GitHub
   release. Notes come from the release PR body, or auto-generated if empty.

See `.github/workflows/` for the workflow definitions.
```

`CLAUDE.md` is contributor guidance, not maintainer ops. No changes there.

## File layout

```
.github/
  workflows/
    ci.yml           ← new
    release-pr.yml   ← new
    release.yml      ← new
README.md            ← add `## Releasing` section
```

## Out of scope (follow-ups)

- Fix the `|| true` in `test:*` scripts so the full matrix can actually fail
  CI on regressions. Without this, the full matrix is informational only.
- npm publishing. The `@slowdini/superslow-opencode` package is `private` and
  is part of a legacy opencode install path; publishing is not currently
  needed.
- Pre-release version support (`1.2.0-beta.1`). Add later if needed.
- Programmatic branch protection (Terraform, `gh api`).

## One-time maintainer setup

After merging the workflow changes:

1. Create a fine-grained PAT scoped to this repo with `contents: write` and
   `pull-requests: write`. Store as repo secret `RELEASE_PR_TOKEN`.
2. Configure branch protection on `main` and `dev` per "Branch protection"
   above.
