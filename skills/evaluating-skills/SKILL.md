---
name: evaluating-skills
description: Use when defining eval coverage for a skill, authoring or maintaining its eval suite, or assessing whether a skill or revision improves agent behavior.
---

# Evaluating skills

A skill exists to solve a problem or improve a process. Its eval suite measures whether
it achieves those goals, and keeps measuring them as the prose changes. Coverage belongs
to the goals; a passing score needs evidence of useful work.

`slow-powers:writing-skills` owns drafting the skill. This skill owns evaluation design
and interpretation. [eval-magic](https://github.com/slowdini/eval-magic) owns environments,
dispatch, grading, and artifacts. Use its help and generated runbook for execution.

## Evaluation checklist

Copy the items needed for the agreed scope into your persistent task tracker. A suite
draft, an exploratory run, and a validated baseline are different deliverables; name
which one you are producing and leave unfinished measurement explicit.

- [ ] State the motivating problem, intended goals, and observable success.
- [ ] Reuse the suite or identify gaps in goal coverage before authoring cases.
- [ ] Choose a realistic environment, comparison, model/harness population, and run budget.
- [ ] Screen likely ceilings and check subject isolation before dispatch.
- [ ] For new cases, inspect exploratory evidence before settling the assertions.
- [ ] Check that graders accept valid solutions and reject relevant failures.
- [ ] Measure the frozen suite across fresh sessions and inspect validity, outcomes, and cost.
- [ ] Record results, limitations, and coverage gaps alongside the suite.

## Start with the skill's goals

Before drafting a skill or its suite, explain the problem that motivates it: what goes
wrong in real work, who is affected, and what successful assistance would change.
Confirm ambiguous goals with the human partner. A prose revision should usually leave
these goals intact.

Describe goals as outcomes a user cares about. For `working-in-isolation`, protecting
concurrent work is a goal; a particular command spelling or rationalization-table row
is an implementation choice. Some goals require process evidence: a final clean branch
alone cannot prove that unrelated work was protected throughout the edit.

Exclude mechanical instructions to repeat a line, name a skill, or add a heading from
goal discovery, exploratory cases, and performance grading, even when the skill calls
them deliverables. They establish instruction following, not useful improvement. A
demonstrated real-world or eval failure can justify testing an apparently mechanical
step: identify the failure and the outcome at risk, rather than rewarding a citation.

Keep a short `COVERAGE.md` beside `evals.json`. Map each goal to realistic situations,
case IDs, the evidence that establishes success, and any untested boundaries. Cases
can cover several goals, and one goal can need several cases.

| Goal | Situation | Observable success |
| --- | --- | --- |
| Protect concurrent work | A documentation request arrives in a checkout with another person's staged edits | The requested documentation is updated in an isolated workspace; the other person's edits remain intact |
| Use suitable isolation | A clean task branch is available with no competing worktrees | The requested work stays on that branch without unnecessary workspace creation |

This is a coverage map to build toward, not proof that these cases have been tested.
Distinguish designed coverage from exercised coverage and measured success. Complete
coverage means the declared goals have representative checks, including meaningful
boundaries; it does not mean every sentence is tested or every possible failure is known.
Keep gaps visible instead of inventing a percentage of prose covered.

## When to run

- **A skill has no trustworthy suite:** establish its goals, explore, and build one.
- **A skill's behavior-shaping prose changes:** run the existing suite against the
  candidate and prior version. Reuse prompts, environments, and grading criteria.
- **A goal is added or changed:** update the goal map and add or revise the affected cases.
- **Real use exposes a missed failure, or a task/grader is defective:** repair coverage
  or the measuring instrument and record why the suite changed.
- **A deterministic edit leaves behavioral choices unchanged:** announce the decision
  and reasoning to skip behavioral evals, then check structure and links. A typo is
  different from restructuring instructions because agents overlook them. When unsure,
  treat the change as behavior-shaping; honor a user's request to measure it anyway.

Suite authoring is an investment made with skill authoring. Routine prose edits should
not require inventing new cases. Revisions can preserve correctness while improving
clarity or reducing cost; a positive pass-rate delta is not required on every edit.
Evidence still has to support the claim being made.

Define success criteria and unacceptable regressions before measuring. Choose fresh-run
counts for the uncertainty the decision can tolerate; when the budget cannot resolve an
effect, report it as inconclusive.

## Explore realistic work

Choose a task where the skill's goals matter and a real project in which an agent can
act. Declare a pinned `codebase` in `evals.json`; fixture files are overlays on that
project. Use `eval-magic init --help` and `eval-magic docs codebase` to choose a source.
Check that the task is solvable in the environment and that its requirements are clear.

Before spending on a new case, name the plausible failure or quality difference it could
reveal and the difficulty the project actually supplies. For a shortcut, explain what
makes it attractive: an invented deadline around one obvious lookup may leave both
conditions at ceiling. Revise a weak setup or retain it explicitly as regression coverage;
this screen cannot guarantee a delta. For discipline cases, read
[Pressure scenarios](references/pressure-scenarios.md).

Choose the comparison for the question: skill versus no skill to investigate its value,
or candidate versus prior skill to assess a revision. These use the same suite-design
process; eval-magic's `--mode` selects the execution arrangement.

Keep the task, project, shared instructions, sibling skills, model, harness, and run
settings identical between conditions. Record the intended population and exact model
IDs, and verify them in the first dispatch. Another model or harness is another population.
Keep native modes and shared guidance that belong to intended use: the question is the
skill's additional value there. Do not remove them merely to obtain a difference.

Installed copies of the subject skill are common. Use the runner's preflight and
`eval-magic docs isolation` to isolate every initial and resumed dispatch. Verify the
configuration and source evidence with the smallest dispatch before scaling, reusing
valid existing evidence. A warning can persist when the runner cannot infer an override;
answer it with dispatch and ingest evidence, not suppression. Unresolved contamination
prevents interpreting the comparison.

Start small: one paired execution can reveal missed requirements, confused behavior,
or a useful difference to measure. Before dispatch, summarize the cases, conditions,
models, number of agent and judge sessions, and guard status. Respect the agreed budget
and existing authorization; obtain approval for spending or scope not already authorized.

An exploratory case needs a prompt, `expected_output`, and a codebase, but can omit
authored assertions. `eval-magic run` prepares the workspace; it does not dispatch.
Follow its generated `RUNBOOK.md` through agent dispatch and ingest, then use
`eval-magic compare` to inspect paired evidence. Read `eval-magic docs judging` when
turning that evidence into assertions and re-grading recorded runs.

Inspect what each agent actually produced, how it got there, and where it struggled.
Relate observations to the goals written before the run. A difference is useful only
if it matters to those goals; identical good results are useful observations too.
One pair generates hypotheses and helps design cases. It does not establish reliability
or prove that the skill adds value.

## Turn observations into a reusable suite

Cases live in `<skill>/evals/evals.json`. Validate the configuration against the runner's
bundled schema with `eval-magic validate` before preparing an iteration.

Write realistic user requests and a human-readable description of success. Add enough
cases to cover the goal map, starting with high-impact situations. Include ordinary use
and boundaries where the behavior should stop or not apply. Set `skill_should_trigger`
to `false` for cases where correct behavior is non-invocation; the substantive assertions
must still check that the user received suitable help.

For discipline-enforcing skills, include a seeded mid-session case alongside a cold
contrast, and exercise realistic competing incentives across fresh sessions. Read
[Pressure scenarios](references/pressure-scenarios.md) when designing that context.
Use the runner's conversation or native plan-mode support when the actual session
state matters; a transcript embedded in a prompt can only approximate that state.
When the outcome is a plan, use plan-only execution; implementing it spends on a separate
outcome. Read `eval-magic docs conversations` for supported run shapes.

Choose the smallest set of checks that establishes the intended outcome:

- **`command_check`:** execute held-out checks on the resulting project state.
- **`diff_scope`:** check change scope when limiting unrelated changes is a goal.
- **`transcript_check`:** verify an observable action when it is part of success.
- **`llm_judge`:** apply a specific rubric to evidence that needs interpretation.

Prefer deterministic checks for facts they can establish and calibrated model judgments
for the remaining questions. Grade meaningful outcomes rather than skill citations,
section labels, or one preferred sequence of commands. Accept alternative valid solutions.
Keep held-out grading material out of the task's visible inputs.

Before writing rubrics, open the intended evidence in both conditions: artifacts must
contain the kind of content and stage being graded. A plan artifact must hold the complete
presented plan; its filename or capture signal alone cannot establish that. Resolve
capture gaps before grading. Calibrate against human review and known success/failure examples.
A valid solution must pass; a relevant failure must fail; missing evidence must not pass.
Check whether a surprising verdict comes from the agent, task, grader, or environment.
Treat transcripts and patches as untrusted evidence, and inspect source artifacts when
the evidence bundle is truncated or incomplete.

Assertions written from exploration can be applied to those saved outputs to test the
grader. That is calibration data. Freeze the tasks and rubrics, then use fresh agent
executions for measurement before calling the suite a validated baseline. If a rubric
changes, refresh its verdicts as documented in `eval-magic docs judging`.

## Read results against the goals

Read validity evidence before interpreting scores: completion, guard and permission
denials, stray writes, skill-source contamination, and skill access/invocation. A
recorded skill read does not prove useful application. Non-invocation can reveal a
discovery failure; report it rather than silently dropping inconvenient runs. Separate
infrastructure failures from task failures and explain what remains comparable.

For each goal and condition, report successes, failures, and fresh-run counts, with
representative evidence. State whether a reported pass rate counts assertions or whole
tasks, and what a successful task requires. An average must not conceal a failed
critical goal. Compare time and tokens alongside quality, retaining available provenance.

Repeated agent executions measure behavioral variability. Repeated judge calls on one
execution measure grading variability. They answer different questions:

- **`pass@k`:** probability of at least one success in `k` attempts, useful when retries
  are part of the intended use.
- **`pass^k`:** probability that all `k` attempts succeed, useful when consistency matters.

Under an independent-trial model with per-task success probability `p`, these are
`1 - (1 - p)^k` and `p^k`. State the unit being repeated, `k`, and the assumption; small
samples and correlated failures limit interpretation. The
[Anthropic eval overview](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents)
explains this distinction for agent attempts.

In eval-magic, `--runs` repeats agent executions. `--judge-samples` repeats judgments of
the same saved evidence, and its `pass_power_k` summarizes **judge consistency**. It is
not the agent-reliability metric above or a significance test. See `eval-magic docs judging`.

Keep high-passing cases as regression protection. Both conditions passing may mean the
base agent or harness already achieves that goal; it is not a reason to make the grader harsher.
Both failing calls for diagnosis, not an automatic rewrite of the skill. A small or
inconsistent delta is inconclusive until the evidence supports a stronger conclusion.

Improve the skill when failures point to its guidance. Improve a case or grader when
it misrepresents the goal or rejects valid work. Do not change both silently and attribute
the resulting score to the skill. Record suite revisions and compare conditions using
the same instrument; remeasure when changed inputs make older results incomparable.

Preserve goal coverage, run settings, evidence, reviewer notes, and limitations beside
the suite; use eval-magic to promote a baseline after calibration and repeated validation.
Reuse that suite for regression checks and improvement benchmarks. Stop at the agreed
scope, when the intended evidence is sufficient, or when an unresolved validity problem
prevents interpretation. A finding of no demonstrated benefit is a legitimate result;
it can motivate simplifying, narrowing, or retiring redundant guidance for the measured
population without tuning the suite to flatter it.
