# Notes — `split-no-regression` baseline

Context for the run that produced this baseline (see `BASELINE.md` for provenance).

## What this measured

A Mode B (revision) eval of the eval-runner split: `old_skill` = the pre-split,
runner-bundled `SKILL.md` (452 lines, snapshot `pre-split` taken from `dev`);
`new_skill` = the slimmed, craft-focused rewrite that routes all running mechanics to
`@slowdini/eval-runner` (204 lines). The three self-eval cases exercise the decision
framework the rewrite kept verbatim (revision-comparison prescription, ship-decision,
deterministic-skip).

**Result: `delta.pass_rate` = 0** — both arms passed all substantive assertions
(3/3 cases, 100% each, stddev 0), 100% skill-invocation both arms, no validity warnings.
The slim rewrite preserves the decision behavior with no regression. The new skill also
ran ~22% lighter (74.7k vs 95.4k mean tokens), as expected from halving the body.

## Methodology caveat — run with `--no-stage`

This run used `--no-stage` (skill content inlined into each dispatch prompt) rather than
the default staged-discovery path. Two reasons, both making `--no-stage` the *correct*
choice here rather than a workaround:

1. **Staged-skill discovery wasn't available to mid-session subagents.** A first attempt
   with staging produced subagents that couldn't load the staged slug via the Skill tool
   (the skill registry is fixed at parent-session start; skills staged mid-session aren't
   picked up), so they fell back to reading a `SKILL.md` from the working tree — which is
   the *new* version for both conditions, contaminating the `old_skill` arm. Inlining
   removes that failure mode: each arm provably reads its own condition's content
   (verified: the `old_skill` dispatch prompt carries the 452-line body, `new_skill` the
   204-line body).
2. **The revision didn't touch the `description:` frontmatter**, so there is nothing to
   measure on the trigger-discovery axis anyway — only body-content quality, which
   `--no-stage` isolates cleanly. The `__skill_invoked` meta-check therefore used the
   LLM-judge fallback (it passed 100% in both arms).

A future iterator re-running this with staged discovery (e.g. from a fresh,
plugin-isolated session where the staged skills exist at session start) would additionally
exercise the trigger path — worth doing if the `description:` ever changes.
