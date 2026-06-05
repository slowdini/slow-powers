import { isAbsolute, resolve, sep } from "node:path";

/** Tools that mutate the filesystem and carry a target path argument. */
export const WRITE_TOOLS = new Set([
  "Write",
  "Edit",
  "MultiEdit",
  "NotebookEdit",
]);

/**
 * Bash command patterns that mutate state outside an eval's sandbox. Heuristics
 * — Bash is too flexible to parse exactly. `detect-stray-writes` surfaces these
 * as warnings; the opt-in guard denies them. Each is meaningful only when the
 * command does not reference an allowed root (see `classifyBash`).
 */
export const BASH_MUTATION_PATTERNS: Array<{ re: RegExp; reason: string }> = [
  {
    re: /\b(npm|pnpm|yarn|bun)\s+(install|add|ci|i)\b/,
    reason: "package install/add",
  },
  { re: /\bpip3?\s+install\b/, reason: "pip install" },
  { re: /\bsed\s+-i\b/, reason: "in-place file edit (sed -i)" },
  {
    re: /\bgit\s+(commit|add|push|checkout|reset|restore|merge|rebase)\b/,
    reason: "git mutation",
  },
  {
    re: /\bgit\s+worktree\s+add\b/,
    reason: "git worktree add (working tree outside the sandbox)",
  },
  // A create/copy/move/link verb whose operand is a path under `.claude` —
  // catches stray writes to the harness config dir that aren't a `>` redirect
  // (those are caught below). Read-only verbs (`cat`, `ls`) aren't listed, so
  // inspecting `.claude` stays allowed.
  {
    re: /\b(cp|mv|mkdir|touch|ln|rsync|install)\b[^|;&\n]*\.claude(\/|\b)/,
    reason: "path under .claude",
  },
  // The same create verbs whose operand is a top-level `skills/` directory —
  // catches a bare `skills/` left in the cwd. `skills-workspace` and other
  // `skills`-prefixed names are excluded by the trailing `/`, whitespace, or
  // end-of-string boundary.
  {
    re: /\b(cp|mv|mkdir|touch|ln|rsync)\b[^|;&\n]*[\s'"=/]\.{0,2}\/?skills(\/|\s|$)/,
    reason: "creates a bare skills/ dir",
  },
  { re: /(^|\s)(>>?|tee)\s/, reason: "output redirection to a file" },
];

/** Pull the target path from a write tool's arguments. */
export function pathArg(args: unknown): string | undefined {
  if (!args || typeof args !== "object") return undefined;
  const a = args as Record<string, unknown>;
  const p = a.file_path ?? a.notebook_path ?? a.path;
  return typeof p === "string" ? p : undefined;
}

/** True when `target` resolves to `dir` or a descendant of it. */
export function isUnder(
  target: string,
  dir: string,
  repoRoot: string,
): boolean {
  const base = resolve(dir);
  const abs = isAbsolute(target) ? resolve(target) : resolve(repoRoot, target);
  return abs === base || abs.startsWith(base + sep);
}

/** True when `target` is under any of `dirs`. */
export function isUnderAny(
  target: string,
  dirs: string[],
  repoRoot: string,
): boolean {
  return dirs.some((d) => isUnder(target, d, repoRoot));
}

/**
 * If a Bash command matches a mutation pattern and is not scoped to one of
 * `allowedRoots`, return the human reason; otherwise null. A command is treated
 * as scoped when it textually references an allowed root.
 */
export function classifyBash(
  command: string,
  allowedRoots: string[],
): string | null {
  if (!command) return null;
  if (allowedRoots.some((r) => command.includes(r))) return null;
  for (const { re, reason } of BASH_MUTATION_PATTERNS) {
    if (re.test(command)) return reason;
  }
  return null;
}
