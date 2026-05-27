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
