# Doc types: structure and audience defaults

Each doc type has a conventional structure its readers already expect. When your doc
matches a type here, the structure step of the writing process is done — use the
convention and spend your effort on content. Only invent a structure when no type fits.

**Evergreen** marks how strictly the timeless-content rules apply (see
[style-principles.md](style-principles.md)): *strict* docs are re-read for months or
years and must not narrate the moment of writing; *relaxed* docs are anchored to an
event but their lasting parts should still stand alone.

## Doc-block comment (function / class / module docs)

- **Audience:** a developer calling or extending this code, reading in an editor
  tooltip or generated reference.
- **Structure:** one-sentence summary (the essential fact — tooltips show only this) →
  behavior and contract details → parameters → return value → errors/exceptions →
  example if it earns its lines.
- **Evergreen:** strict. No "now handles", "no longer", "after the refactor" — describe
  what the code does.
- Follow the language's doc conventions (JSDoc, docstrings, rustdoc). Parameter,
  boolean, default, return, and deprecation phrasing: see
  [formatting.md](formatting.md#api-reference-comments).

## Inline comment

- **Audience:** the next developer editing this code.
- **Structure:** none — a comment this small skips the process. Write it directly.
- **Evergreen:** strict. Explain *why*: non-obvious constraints, deliberate departures,
  algorithms. Never restate the next line, and never narrate history ("// moved from
  parser.ts", "// workaround until #1234 lands" — link the issue if it's load-bearing,
  else delete).

## Commit message

- **Audience:** a future maintainer running `git log` / `git blame` to understand
  why this change exists.
- **Structure:** subject line in the imperative, ~50 characters ("Fix race in cache
  invalidation") → blank line → body wrapped ~72: what changed and *why*, not a diff
  restatement → trailers (issue links, co-authors) per repo convention.
- **Evergreen:** relaxed. The commit is a historical record, but the *why* must make
  sense years later without the session's context.

## PR description

- **Audience:** reviewers — teammates with full context, or maintainers seeing your
  work for the first time. Judge which, and front-load context for the second group.
- **Structure:** what and why (linked issue) → how, at the level a reviewer needs →
  how it was verified → anything you're unsure about or want eyes on.
- **Evergreen:** relaxed — a PR is anchored to a moment. But the "why" gets quoted into
  merge commits and consulted later; write it to stand alone.

## Review comment

- **Audience:** the change's author, who must act on it.
- **Structure:** none conventional; one point per comment. Say what you see, why it
  matters, and what would resolve it — a question when you're unsure, a request when
  you're not.
- **Evergreen:** relaxed. Tone carries the doc: direct about the code, never about the
  author.

## README

- **Audience:** a first-time evaluator deciding whether to use the project, then a new
  user trying to start using it. Optimized for scanning.
- **Structure:** what it is (one paragraph, no marketing) → quickstart / install →
  core usage → where to go deeper (links to docs, contributing, license). Badges and
  demos only where they help the evaluator.
- **Evergreen:** strict. "New in 2.0" belongs in release notes; the README describes
  the project as it is.

## Design doc / RFC

- **Audience:** peers who must understand, challenge, and later implement the design.
- **Structure:** problem and context → goals and non-goals → proposal → alternatives
  considered and why they were rejected → open questions.
- **Evergreen:** strict for the design description; the *decision record* part (what
  was decided, when, and why) is legitimately dated — label it as a decision, don't
  weave it into the description of the system.

## Release notes / changelog

- **Audience:** existing users deciding whether to upgrade and what changed for them.
- **Structure:** per version: breaking changes → features → fixes, each entry linking
  its change.
- **Evergreen:** this is the time-stamped genre — dates and versions are the point.
  Entries still describe changes factually ("Add support for X"), not with marketing
  language ("The long-awaited X is finally here!").

## Skill document (SKILL.md and references)

- **Structure owned elsewhere:** `slow-powers:writing-skills` is the doc-type
  authority for skills — frontmatter, description rules, body structure, and
  skill-specific prose conventions. Load it before authoring or editing a skill.
- The style principles still apply to skill prose where writing-skills is silent;
  on any conflict, writing-skills wins.

## Sources

Type conventions synthesized from common developer practice, with API-comment phrasing
adapted from the
[Google developer documentation style guide](https://developers.google.com/style)
(CC BY 4.0).
