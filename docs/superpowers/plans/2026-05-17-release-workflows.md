# Release Workflows Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three GitHub Actions workflows (`ci.yml`, `release-pr.yml`, `release.yml`) plus a `## Releasing` section in `README.md` so feature work is CI-gated on `dev`, releases are cut by a manually-triggered `dev → main` PR that auto-bumps the version, and merges to `main` produce tagged GitHub releases.

**Architecture:** All three workflows live in `.github/workflows/`. `ci.yml` is triggered by PRs (light suite on PRs to `dev`, full matrix on PRs to `main`). `release-pr.yml` is manually triggered (`workflow_dispatch`); it runs `scripts/bump-version.js`, commits the bump to `dev`, and opens the release PR. `release.yml` fires on every push to `main`; it reads the version from `package.json`, tags `vX.Y.Z`, and creates a GitHub release using the release PR body or auto-generated notes.

**Tech Stack:** GitHub Actions (YAML), `oven-sh/setup-bun@v2`, `gh` CLI (preinstalled on `ubuntu-latest`), Node.js (preinstalled on `ubuntu-latest`).

**Spec reference:** [`docs/superpowers/specs/2026-05-17-release-workflows-design.md`](../specs/2026-05-17-release-workflows-design.md)

**Note on testing:** GitHub Actions workflows can't be unit-tested locally — the "test" for a workflow is running it on GitHub. We use `actionlint` for static validation, and the first real run on a PR / merge to main is the integration test. Each task's validation step is "the YAML parses and `actionlint` is clean", not "the workflow's behavior is correct" — that's verified post-merge.

---

## File Structure

| Path | Responsibility |
|------|----------------|
| `.github/workflows/ci.yml` | PR gating. Light suite on PRs to `dev`; full matrix on PRs to `main`. |
| `.github/workflows/release-pr.yml` | Manually triggered. Validates version, bumps manifests, commits to `dev`, opens `dev → main` PR. |
| `.github/workflows/release.yml` | Fires on push to `main`. Tags `vX.Y.Z` and creates the GitHub release. |
| `README.md` | Add `## Releasing` section between `## Contributing` and `## License`. |

---

## Prerequisite: Install `actionlint` locally (one-time)

The implementing engineer needs `actionlint` to validate workflow YAML before pushing. If it isn't installed:

```bash
# macOS (Homebrew)
brew install actionlint

# Or, run via Docker if you don't want to install
# (each `actionlint` invocation below can be replaced with:)
docker run --rm -v "$(pwd):/repo" -w /repo rhysd/actionlint:latest
```

Verify:
```bash
actionlint --version
```

Expected: prints a version like `1.7.x`.

If you genuinely can't install `actionlint`, fall back to:
```bash
node -e "console.log(JSON.parse(JSON.stringify(require('js-yaml').load(require('fs').readFileSync('FILE.yml','utf8')))))"
```
…but that only checks YAML validity, not workflow semantics. Strongly prefer `actionlint`.

---

## Task 1: Create `ci.yml`

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Create the directory**

```bash
mkdir -p .github/workflows
```

- [ ] **Step 2: Write `ci.yml`**

Create `.github/workflows/ci.yml` with the following content:

```yaml
name: CI

on:
  pull_request:
    branches: [dev, main]

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  light:
    if: github.base_ref == 'dev'
    name: Light suite (PR to dev)
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: oven-sh/setup-bun@v2

      - name: Install dependencies
        run: bun install --frozen-lockfile

      - name: Run unit tests
        run: bun test

      - name: Run lint and format checks
        run: bun run check

  full:
    if: github.base_ref == 'main'
    name: Full matrix (PR to main)
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: oven-sh/setup-bun@v2

      - name: Install dependencies
        run: bun install --frozen-lockfile

      - name: Run unit tests
        run: bun test

      - name: Run lint and format checks
        run: bun run check

      - name: Run core integration tests
        run: bun run test:core

      - name: Run claude harness tests
        run: bun run test:claude

      - name: Run codex harness tests
        run: bun run test:codex

      - name: Run opencode harness tests
        run: bun run test:opencode
```

- [ ] **Step 3: Validate with `actionlint`**

Run: `actionlint .github/workflows/ci.yml`
Expected: no output (clean).

If `actionlint` reports anything, fix the reported issue and re-run.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add PR check workflow (light on dev, full on main)"
```

---

## Task 2: Create `release-pr.yml`

**Files:**
- Create: `.github/workflows/release-pr.yml`

This workflow uses the `RELEASE_PR_TOKEN` secret (a fine-grained PAT). The secret won't exist until the maintainer creates it post-merge — that's expected and documented in the spec's "One-time maintainer setup" section. The workflow file itself just references the secret.

- [ ] **Step 1: Write `release-pr.yml`**

Create `.github/workflows/release-pr.yml` with the following content:

```yaml
name: Release PR

on:
  workflow_dispatch:
    inputs:
      version:
        description: "Next version (e.g. 1.2.0)"
        required: true
        type: string

jobs:
  open-release-pr:
    name: Bump version and open release PR
    runs-on: ubuntu-latest
    steps:
      - name: Validate version format
        run: |
          if ! [[ "${{ inputs.version }}" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
            echo "::error::Version must be X.Y.Z (no pre-release suffixes). Got: ${{ inputs.version }}"
            exit 1
          fi

      - uses: actions/checkout@v4
        with:
          ref: dev
          fetch-depth: 0
          token: ${{ secrets.RELEASE_PR_TOKEN }}

      - name: Confirm version is strictly greater than current
        run: |
          CURRENT=$(node -p "require('./package.json').version")
          NEXT="${{ inputs.version }}"
          HIGHEST=$(printf '%s\n%s\n' "$CURRENT" "$NEXT" | sort -V | tail -n1)
          if [ "$CURRENT" = "$NEXT" ] || [ "$HIGHEST" != "$NEXT" ]; then
            echo "::error::New version ($NEXT) must be strictly greater than current ($CURRENT)"
            exit 1
          fi
          echo "Bumping $CURRENT -> $NEXT"

      - uses: oven-sh/setup-bun@v2

      - name: Bump version in all manifests
        run: node scripts/bump-version.js "${{ inputs.version }}"

      - name: Commit and push bump
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          git add -A
          git commit -m "chore: bump version to ${{ inputs.version }}"
          git push origin dev

      - name: Open release PR
        env:
          GH_TOKEN: ${{ secrets.RELEASE_PR_TOKEN }}
        run: |
          PR_BODY_FILE=$(mktemp)
          cat > "$PR_BODY_FILE" <<'EOF'
          <!-- release-notes -->
          ## Release notes

          _Replace this paragraph with a short narrative for the release. If left unchanged, GitHub's auto-generated notes will be used instead._
          EOF

          PR_URL=$(gh pr create \
            --base main \
            --head dev \
            --title "Release v${{ inputs.version }}" \
            --body-file "$PR_BODY_FILE")

          echo "Opened release PR: $PR_URL" >> "$GITHUB_STEP_SUMMARY"
```

- [ ] **Step 2: Validate with `actionlint`**

Run: `actionlint .github/workflows/release-pr.yml`
Expected: no output (clean).

`actionlint` will not complain about the missing `RELEASE_PR_TOKEN` secret — secrets are dynamic and can't be statically checked.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/release-pr.yml
git commit -m "ci: add release-pr workflow (bump version, open dev->main PR)"
```

---

## Task 3: Create `release.yml`

**Files:**
- Create: `.github/workflows/release.yml`

- [ ] **Step 1: Write `release.yml`**

Create `.github/workflows/release.yml` with the following content:

```yaml
name: Release

on:
  push:
    branches: [main]

jobs:
  release:
    name: Tag and create GitHub release
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Read version from package.json
        id: version
        run: |
          VERSION=$(node -p "require('./package.json').version")
          echo "version=$VERSION" >> "$GITHUB_OUTPUT"
          echo "tag=v$VERSION" >> "$GITHUB_OUTPUT"
          echo "Version on main: $VERSION"

      - name: Check if tag already exists (idempotency)
        id: tag-check
        run: |
          if git rev-parse "${{ steps.version.outputs.tag }}" >/dev/null 2>&1; then
            echo "Tag ${{ steps.version.outputs.tag }} already exists — skipping release."
            echo "exists=true" >> "$GITHUB_OUTPUT"
          else
            echo "exists=false" >> "$GITHUB_OUTPUT"
          fi

      - name: Create and push tag
        if: steps.tag-check.outputs.exists == 'false'
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          git tag "${{ steps.version.outputs.tag }}"
          git push origin "${{ steps.version.outputs.tag }}"

      - name: Build release notes
        if: steps.tag-check.outputs.exists == 'false'
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          PR_BODY=$(gh pr list \
            --state merged \
            --base main \
            --limit 1 \
            --json body \
            --jq '.[0].body // ""')

          if [ -n "$PR_BODY" ] && ! echo "$PR_BODY" | grep -q "Replace this paragraph"; then
            echo "Using release PR body for notes."
            printf '%s\n' "$PR_BODY" > /tmp/release-notes.md
          else
            echo "Falling back to auto-generated notes."
            PREVIOUS_TAG=$(git tag --sort=-creatordate \
              | grep -v "^${{ steps.version.outputs.tag }}$" \
              | head -n1)
            if [ -n "$PREVIOUS_TAG" ]; then
              gh api "repos/${{ github.repository }}/releases/generate-notes" \
                -f tag_name="${{ steps.version.outputs.tag }}" \
                -f previous_tag_name="$PREVIOUS_TAG" \
                --jq '.body' > /tmp/release-notes.md
            else
              gh api "repos/${{ github.repository }}/releases/generate-notes" \
                -f tag_name="${{ steps.version.outputs.tag }}" \
                --jq '.body' > /tmp/release-notes.md
            fi
          fi

          echo "--- Release notes preview ---"
          cat /tmp/release-notes.md
          echo "--- end preview ---"

      - name: Create GitHub release
        if: steps.tag-check.outputs.exists == 'false'
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          gh release create "${{ steps.version.outputs.tag }}" \
            --title "Superslow ${{ steps.version.outputs.tag }}" \
            --notes-file /tmp/release-notes.md
```

- [ ] **Step 2: Validate with `actionlint`**

Run: `actionlint .github/workflows/release.yml`
Expected: no output (clean).

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/release.yml
git commit -m "ci: add release workflow (tag and publish on push to main)"
```

---

## Task 4: Validate the full workflow set

Sanity-check all three workflows together — no cross-file issues, all parse, all are picked up by `gh`.

- [ ] **Step 1: Lint all workflows together**

Run: `actionlint .github/workflows/*.yml`
Expected: no output.

- [ ] **Step 2: Confirm `gh` recognises them after pushing the branch**

```bash
git push -u origin feat/release-workflows
gh workflow list --all
```

Expected: output includes `CI`, `Release PR`, and `Release` (they'll be marked as `disabled_inactivity` or similar since they haven't run on the default branch yet — that's fine; the names being present confirms parse).

If a workflow is missing from the list, GitHub failed to parse it. Run `gh api repos/{owner}/{repo}/actions/workflows` for raw errors.

- [ ] **Step 3: No commit needed** (this task is verification-only).

---

## Task 5: Add `## Releasing` section to `README.md`

**Files:**
- Modify: `README.md` (insert new section between `## Contributing` and `## License`)

- [ ] **Step 1: Find the insertion point**

Run: `grep -n "^## " README.md`
Expected: shows `## Contributing` followed by `## License` near the end of the file. Note the line number of `## License`.

- [ ] **Step 2: Insert the new section**

Insert the following block immediately before the `## License` heading (i.e. between the existing `## Contributing` section and `## License`):

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

Make sure there's a blank line before `## Releasing` (separating it from the prior section) and a blank line after the closing backtick paragraph before `## License`.

- [ ] **Step 3: Verify the section renders correctly**

Run: `bun run check`
Expected: passes (markdownlint will catch heading-spacing issues if any).

If markdownlint complains, fix and re-run.

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "docs(readme): add Releasing section describing the dev->main flow"
```

---

## Task 6: Final verification

- [ ] **Step 1: Confirm all four files exist on the branch**

Run:
```bash
ls .github/workflows/
grep -c "^## Releasing" README.md
```

Expected:
- `ls`: shows `ci.yml`, `release-pr.yml`, `release.yml`.
- `grep`: prints `1`.

- [ ] **Step 2: Re-run full lint suite**

```bash
actionlint .github/workflows/*.yml
bun run check
```

Expected: both clean.

- [ ] **Step 3: Push and open PR to `dev`**

```bash
git push origin feat/release-workflows
gh pr create \
  --base dev \
  --head feat/release-workflows \
  --title "Add release workflows" \
  --body "Implements the design in docs/superpowers/specs/2026-05-17-release-workflows-design.md.

  Three new workflows in .github/workflows/:
  - ci.yml: light suite on PRs to dev, full matrix on PRs to main
  - release-pr.yml: workflow_dispatch with version input, bumps manifests and opens dev->main PR
  - release.yml: tags and creates GitHub release on push to main

  README gets a new ## Releasing section.

  Follow-up after merge (not in this PR):
  - Create RELEASE_PR_TOKEN secret (fine-grained PAT, contents: write + pull-requests: write)
  - Configure branch protection on dev and main per the spec"
```

Note: this PR targets `dev`, but `ci.yml` is brand new in the PR — GitHub will pick it up and run the **light** suite (since base is `dev`). That's the first end-to-end smoke test.

- [ ] **Step 4: Watch the PR's CI run**

```bash
gh pr checks --watch
```

Expected: `CI / Light suite (PR to dev)` passes.

If it fails, fix the issue, push, and re-watch.

- [ ] **Step 5: Done — hand off to maintainer for merge and post-merge setup**

After this PR merges into `dev`, the maintainer needs to (per the spec's "One-time maintainer setup" section):

1. Create the `RELEASE_PR_TOKEN` repo secret.
2. Configure branch protection on `dev` and `main`.
3. Bootstrap the first release. `workflow_dispatch` workflows only appear in the Actions UI once they're on the default branch (`main`). For the very first release, open a `dev → main` PR by hand (or via `gh pr create --base main --head dev`) — that lands `release-pr.yml` on `main`. From then on, every subsequent release uses the **Release PR** workflow normally.

These are out of scope for this PR.
