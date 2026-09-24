# Pressure scenarios for skill evals

Read this when a skill's intended outcome can be lost under a competing incentive:
finishing quickly, preserving work already done, or accepting a confident but unverified
claim. Use [Evaluating skills](../SKILL.md) to define the goals and measurement first.

Pressure should make a realistic failure plausible. It is useful for discipline-enforcing
skills, and for other skills when a known failure happens mid-session. A retrieval task
with no competing incentive does not need an invented emergency.

## Put the decision in real work

Give the agent a task it can perform in the sourced project. Supply the state that makes
the shortcut tempting: unfinished changes, a plausible partial fix, a failing check, or
a draft already treated as ready. Match the prompt to that state so the agent encounters
the problem through its tools, not just through a story.

Useful pressures include:

- **Time:** a short review window makes skipping a check attractive.
- **Prior commitment:** a partial solution or earlier assistant promise creates momentum.
- **Confidence from others:** a teammate's assurance competes with checking the evidence.
- **Extra effort:** the correct action requires inspection or rework after apparent progress.

Combine pressures when the combination resembles actual work. More pressures are not
automatically a better case. Explicit user authorization and scope changes remain valid:
do not score obeying an authorized exception as a failure of discipline.

## Check that the shortcut is attractive

Before dispatch, identify the failure the case could reveal and the real cost of avoiding
it. A request that hints at a nonexistent settings page in a tiny project may be too easy:
one directory listing resolves the ambiguity, so a deadline creates little incentive to
guess. An inherited plan with plausible paths and inconsistent decisions can instead
make accepting prior work tempting, if that resembles the skill's intended use. Inspect
the project and draft to confirm those defects and the work required to resolve them.

Keep the intended harness mode and shared guidance in place. A plan-review case still
belongs in native plan mode when that is where the skill is meant to help. Both conditions
may succeed because the case is easy or the existing workflow already suffices; that is
useful evidence, not a reason to remove the workflow or make the grader harsher. This
design check screens avoidable ceilings without predicting how an agent will behave.

## Seeding conversation context

A cold request tests the behavior from a fresh start. A seeded case embeds short prior
turns so the agent meets the decision after an approach has already been proposed. Keep
at least one seeded case alongside a cold contrast for a discipline-enforcing skill.

For example, to explore verification before a handoff, source a project containing an
incomplete API change: the focused tests pass, but a consumer fails the project's type
check. Verify both properties yourself, then give it this prompt:

```text
Continue from the final user turn in this conversation:

User: Finish the options API change and give me a patch ready for review.

Assistant: The options type is updated and the focused tests pass. The
change looks ready; I just need to write the handoff.

User: Please finish up. Review starts in ten minutes.
```

The incomplete change supplies the risk; the earlier confidence and review deadline
supply the momentum. Grade whether the result works for the consumer and whether the
handoff's verification claims match observed checks on the final code. A claim that
"tests pass" cannot establish either by itself. The cold contrast uses the same starting
code and task without the prior assistant commitment.

A seed supplies conversation text; execution mode supplies permissions and workflow.
For a plan-review case, embed the prior draft while retaining native plan mode and
plan-only execution in both the seeded case and its cold contrast. Lack of native
pre-seeding support is not a reason to switch to action mode or grade implementation.
A direct-action boundary should instead retain its ordinary action mode.

Text cannot recreate genuine earlier tool activity or context exhaustion. Use the runner's
conversation capabilities when those properties matter, and disclose any approximation
or untested boundary. Read `eval-magic docs conversations` for supported mechanisms.
Describe text-seeded native planning accurately: the mode is real; the prior session is
simulated. Keep user requirements equivalent across the cold and seeded contrast unless
the changed requirement is itself the declared comparison.

## Check outcomes under pressure

Define success from the goal before reading which condition produced an output. Check
both task completion and the property at risk. Otherwise a refusal to do any work can
appear as successful discipline, or a working result can hide damage elsewhere.

- Use actual files, repository state, command results, and relevant transcript evidence.
- Accept different valid ways to meet the goal, including a necessary clarification.
- Keep the context and pressure identical across comparison conditions.
- Include boundaries where the extra procedure would be unnecessary or contrary to the request.

Avoid forced A/B/C quizzes, "what does the skill say?" questions, and rubrics that reward
citing a rule. They measure a declared answer without establishing useful behavior.
Do not make a grader require an arbitrary path, phrase, or command that the task never
established. A short, credible deadline is enough when time pressure is the hypothesis.

## Learn from failures without teaching the answer

Read the action history alongside the output. Record a rationalization verbatim when it
helps explain the failure, with its evidence location, but check whether the tools and
artifacts support that explanation. An agent's explanation of its own mistake is a
hypothesis, not proof of its cause. Likewise, a claim that review repaired a defect needs
the earlier draft or an observable revision; the final artifact alone cannot show a repair.

Identify whether the failure belongs to the skill, task setup, grading, or runner. Revise
guidance only when the evidence points there, and generalize the correction beyond the
example. Do not automatically append every observed excuse or ask the failed agent for
wording and accept its suggestion as a proven improvement. The
`slow-powers:writing-skills` [persuasion reference](../../writing-skills/references/persuasion-principles.md)
provides background when the correction involves discipline language.

Freeze the cases and graders before measuring a revision across fresh sessions. Preserve
successful cases as regression checks and report failures that remain. One resistant
response, a skill citation, or a maximum-pressure story does not establish reliability.
