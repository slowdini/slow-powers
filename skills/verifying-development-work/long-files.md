# Reviewing a File Your Change Made Long

This is a sub-process of **phase 1** of the finishing sequence in
[`./SKILL.md`](./SKILL.md), reached from [`./code-review.md`](./code-review.md). It
runs when your change grew a file past the line limit.

You've added code to a file that's now too long for humans and agents to parse
effectively. Being long isn't the disease — it's the symptom. The file has likely
grown unfocused, losing a single clear purpose.

Your job now is **not to refactor the whole file.** It's to avoid making the
situation worse while laying groundwork for future updates. This is how large code
problems get solved without halting feature work or forcing a big refactor.

---

> **THE IRON LAW:** If a change *you* made grew a file to over 500 lines, that file
> MUST go through this review before you finish. Handing back a newly-grown long
> file without a change or a declared exception is the failure this guidance exists
> to prevent.

This applies to files your change grew. A file someone else left long that you only
read past is out of scope.

---

## Thresholds

- **Over 500 lines** — a mandate to **review**, not necessarily to change. A review
  can legitimately conclude "no change needed" — but you must still *report* that
  conclusion and why. The size is a trigger, not a verdict.
- **Over 1000 lines** — never acceptable for a normal code file; no one can hold it
  in their head. At minimum, your change must not be what leaves it there: carve your
  addition into a new module rather than pile onto the existing bulk. Pre-existing
  bulk you didn't create and can't shed within your scope gets *surfaced to the user*
  as needing a dedicated effort — not silently accepted. Legitimately-exempt files
  (below) stay exempt at any size.

---

## The process

Do this for **each** file that tripped the rule, **one at a time** — don't dump every
proposal on the user at once.

### 1. Check for exceptions

Some files are meant to be long. This is the exception, not the rule. You MUST still
declare that you reviewed the file and found it exempt, naming the category and the
reason — a silent skip is not an exception.

| Category | What it covers | Examples |
|----------|----------------|----------|
| **Generated** | Machine-written files, not hand-authored code. | Lockfiles (`bun.lock`, `package-lock.json`), committed build output, generated API clients, generated GraphQL/protobuf types. |
| **Technical requirement** | Content a tool or framework expects by name and location. There's no clever workaround. | Prisma `schema.prisma`, Rails `db/schema.rb`, a single Django migration, a bundler entry file. |
| **Config / data** | Files that *store* values rather than express logic. | A large JSON config, an i18n string table, a generated constants file. Include what naturally belongs. |
| **Barrel** | Files whose only job is to re-export a module's public surface. Splitting them is *more* confusing, not less. | An `index.ts` that re-exports a package. |

**Multi-part files** need their own check. Some files intentionally hold distinct
parts — a JS import block, a Vue single-file component's template/script/style, Rust
modules with inline `#[cfg(test)]` tests. For these:

- Is there a standard way to split it? (Rust can move tests to a `tests/` directory.)
  If so, follow it — and don't propose anything else unless the split *also* leaves a
  long file.
- Treating each part as its own file, is every part under 500 lines? If so, there's
  no real violation — declare that as the exception and leave it.
- Otherwise, continue with this file below.

### 2. Understand why the file grew

You added to this file for a reason — what was it? Now look at the whole: does it
have one job that's simply outgrown a single file? Several jobs tangled together that
are really separate features now? Or no clear focus, just an accumulation of code
that resembles what you added? A clear read of *how* it grew is what makes the next
step a good fix instead of arbitrary cutting.

### 3. Determine the smallest, focused change

This is the key step. The test: this change ships in the **same pull request** as the
rest of your work. Would a reviewer see it as part of that change set — or stop and
ask, "what's this doing here?"

Carve out the scope you need *right now* and leave the rest of the file untouched. The
best change keeps the file from growing and sets up how this area should evolve, so it
doesn't cross the line again next time. You are **not** doing the big refactor the file
may eventually need — even if you can see it.

Sometimes the right change is none: the file is correct as-is and the smallest honest
move is to leave it. That's a valid outcome over 500 lines (it is not valid over 1000).

### 4. Apply or propose

- **Obvious, minimal, in-scope carve-out** → make it now and report it, like any other
  review fix. (Moving or extracting code changes the build, so it happens here in phase
  1, before behavior is frozen and re-verified.)
- **Non-trivial or ambiguous** — it touches code outside your change, restructures a
  shared surface, or would mean reverting the change that triggered this review → state
  your proposal and reasoning, and **wait** for the user. These are subtle calls; the
  user has the final say and may prefer the larger file. Don't push back past a clear
  "no."

### 5. Report every triggered file

For each file: a change made, a change proposed, or an exception declared with its
category and reason. No file that tripped the rule passes silently.

---

## Keep it proportional

[`./code-review.md`](./code-review.md) warns against a review louder than the change it
covers. This is the one place a small change earns a structured look — because the cost
of an unmaintainable file accrues quietly until a human inherits it. The *response*,
though, stays minimal: the smallest carve-out that fits the PR. A sprawling whole-file
refactor is the trap, not the fix.

---

## Common Rationalizations

| Excuse | Reality |
|--------|---------|
| "I'll just refactor this file properly while I'm here." | Not your job now. Carve out your scope; leave the rest. The big refactor is a separate, deliberate effort. |
| "The file was already long before I touched it." | If your change grew it past the line, you review it now. The trigger is the size you're leaving behind. |
| "It's only a little over 500 — not worth the ceremony." | 500 triggers a review that can conclude "no change." But you must still report that conclusion, not skip silently. |
| "I'll flag it in the PR description and move on." | Silently shipping a newly-grown long file is the worst outcome here. Resolve it in the diff, not in prose a reviewer may skim. |
| "Splitting it would make the diff bigger and noisier." | A minimal, in-scope carve-out is the goal; a sprawling split is the trap you're avoiding, not the fix you owe. |
| "It's over 1000 but the file just has to be that big." | Only if it's a declared exception. Otherwise your change must not leave it there — carve your addition out, and surface the pre-existing bulk. |

---

## Red Flags — STOP

- About to hand back a file your change grew past 500 lines without a change or a
  declared exception.
- Proposing a whole-file refactor instead of carving out your change's scope.
- A normal code file you touched is now over 1000 lines and you're treating that as
  fine.
- Declaring a file exempt without naming the category and the reason.
- Dumping proposals for several long files on the user at once instead of one at a time.
