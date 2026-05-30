# Finding: full-transcript capture for `auditing-slow-powers-usage`

This documents the investigation the ticket asked for: *can* the audit skill attach the full
session transcript alongside its report, how big is it, which harnesses support it, and should it
be opt-in? The behavior it justifies is implemented in `SKILL.md` under
*The report → Optionally attaching the session transcript*.

## Verdict

**Feasible on Claude Code, and cheap — but only by copying the file, not by reading it.** Gated
behind a second, explicit opt-in because the transcript contains host-codebase content.

## Feasible? — yes, by copy not read

The ticket's stated worry was that "an agent reading its own in-progress session transcript mid-run
is awkward and potentially very large." That worry only bites if the agent loads the transcript into
its context. It doesn't have to. The transcript is a file on disk; a **filesystem copy** (`cp`)
relocates it without the agent ever reading a byte into context. That single move dissolves both the
"awkward" and the "very large" objections at once. The skill instruction is therefore: copy, never
read.

On Claude Code the current session's transcript is the **most-recently-modified `*.jsonl`** in:

```
~/.claude/projects/<cwd-slug>/<session-id>.jsonl
```

where `<cwd-slug>` is the working-directory path with `/` replaced by `-` (leading `-` included) —
e.g. `/Users/me/Projects/foo` → `-Users-me-Projects-foo`. Selecting the newest file by mtime
reliably picks out the live session, since it's the one being appended to as the audit runs.

## How large?

Measured across one project's accumulated sessions: **~18 KB to ~584 KB** per session `.jsonl`.
Unbounded in principle (a very long session could be larger), but irrelevant to a filesystem copy,
which is O(1) on the agent's context regardless of file size. The size only ever mattered under the
"read it into context" framing we rejected.

## In-progress caveat

The transcript is being written live, so the copy is a snapshot that **omits the final turns** —
including the audit turn that triggers the copy. This is acceptable: it captures the lived session up
to ~now, which is exactly the attractor-competition signal the audit exists to preserve. The missing
tail is the bookkeeping of the audit itself, which the report already records.

## Which harnesses?

- **Claude Code:** yes — the path above. This matches the transcript-access asymmetry already
  documented in `skills/evaluating-skills/SKILL.md` ("Transcript access"), where Claude Code is the
  one harness that persists readable per-session transcripts.
- **Codex / Cursor / OpenCode:** no accessible persisted session-transcript file. The skill degrades
  gracefully — it records one line in the report (`transcript: not captured — <reason>`) and
  continues. This is an honest limitation, not a bug, and keeps the skill cross-harness clean: the
  imperative prose says "copy it if your harness exposes one," and the Claude-Code-specific path
  lives here in the finding, not in the skill body.

## Opt-in & confidentiality

Capture is **double opt-in**, both signalled by folder existence (consistent with how report
persistence itself is enabled), default OFF:

1. `~/.super-slow-audits/` — enables report-doc persistence.
2. `~/.super-slow-audits/transcripts/` — *additionally* enables transcript copies.

The second gate is deliberate. A persisted report is a curated summary *about slow-powers*; a raw
transcript embeds whatever host-codebase content scrolled through the session — code, paths, data —
which is outside this audit's nominal scope. Requiring a distinct, explicit opt-in for transcripts
means an operator who wants accumulating report docs does not silently also start spilling host-repo
content into a global folder. Neither folder is ever created by the skill.
