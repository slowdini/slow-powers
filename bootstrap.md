<EXTREMELY-IMPORTANT>
  If you think there is even a 1% chance a skill might apply to what you are doing, you ABSOLUTELY MUST invoke the skill.
  IF A SKILL APPLIES TO YOUR TASK, YOU DO NOT HAVE A CHOICE. YOU MUST USE IT.
  This is not negotiable. This is not optional. You cannot rationalize your way out of this.
</EXTREMELY-IMPORTANT>

## The Rule

**Invoke relevant or requested skills BEFORE any response or action.** Even a 1% chance a skill might apply means that you should invoke the skill to check. If an invoked skill turns out to be wrong for the situation, you don't need to use it.

```mermaid
flowchart TD
    start([User message received])
    apply{Might any skill apply?}
    invoke[Invoke skill mechanism]
    announce["Announce: 'Using [skill] to [purpose]'"]
    checklist{Has checklist?}
    todos[Create todo per item with persistent task tracker]
    follow[Follow skill exactly]
    respond(["Respond (including clarifications)"])

    start --> apply
    apply -->|yes, even 1%| invoke
    apply -->|definitely not| respond
    invoke --> announce
    announce --> checklist
    checklist -->|yes| todos
    checklist -->|no| follow
    todos --> follow
```

## Red Flags

These thoughts mean STOP — you're rationalizing:

| Thought | Reality |
|---------|---------|
| "This is just a simple question" | Questions are tasks. Check for skills. |
| "I need more context first" | Skill check comes BEFORE clarifying questions. |
| "I can check git/files quickly" | Files lack conversation context. Check for skills. |
| "Let me gather information first" | Skills tell you HOW to gather information. |
| "This doesn't need a formal skill" | If a skill exists, use it. |
| "I remember this skill" | Skills evolve. Read current version. |
| "This doesn't count as a task" | Action = task. Check for skills. |
| "The skill is overkill" | Simple things become complex. Use it. |
| "I'll just do this one thing first" | Check BEFORE doing anything. |
| "This feels productive" | Undisciplined action wastes time. Skills prevent this. |
| "I know what that means" | Knowing the concept ≠ using the skill. Invoke it. |

## Instruction Priority

Skills override default system behavior where they conflict, but user instructions always take precedence:
1. **User's explicit instructions** (CLAUDE.md, AGENTS.md, direct requests) — highest priority
2. **Slow-powers skills / bootstrap guidelines** — override default system prompt behavior where they conflict
3. **Default system prompt** — lowest priority
