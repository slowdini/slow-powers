// Shared descriptors and helpers for the cross-harness parity test suite
// (tests/harness/manifests.test.ts). One entry per harness describes the
// manifest it ships and the paths/hooks it wires up; the suite holds every
// harness to the same standard checks. When a new harness is added, add an
// entry here and the parameterized suite covers it automatically.
import fs from "node:fs";
import path from "node:path";

/** Absolute path to the repository root (two levels up from tests/harness/). */
export const REPO_ROOT = path.resolve(import.meta.dir, "../..");

/** Read and parse a JSON file relative to the repo root. */
export function readJson(relPath: string): unknown {
  const abs = path.join(REPO_ROOT, relPath);
  return JSON.parse(fs.readFileSync(abs, "utf8"));
}

/**
 * Resolve a manifest-declared path (e.g. "./skills/") against a root and
 * verify it does not escape that root. Mirrors the path-traversal guard in
 * the retired tests/codex/test-plugin-layout.sh. Returns the absolute path.
 */
export function resolveWithinRoot(root: string, value: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error("path value must be a non-empty string");
  }
  const relative = value.startsWith("./") ? value.slice(2) : value;
  const parts = relative.split("/").filter((p) => p.length > 0);
  if (parts.length === 0 || parts.some((p) => p === "." || p === "..")) {
    throw new Error(`path escapes its root: ${value}`);
  }
  const resolved = path.resolve(root, relative);
  if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) {
    throw new Error(`path escapes its root: ${value}`);
  }
  return resolved;
}

/** Look up a dotted key (e.g. "interface.composerIcon") in a parsed object. */
export function getByPath(obj: unknown, dotted: string): unknown {
  return dotted.split(".").reduce<unknown>((acc, key) => {
    if (
      acc &&
      typeof acc === "object" &&
      key in (acc as Record<string, unknown>)
    ) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

export interface PathField {
  /** dotted key into the manifest whose value is a "./"-relative path */
  field: string;
  kind: "file" | "dir";
}

export interface HookSpec {
  /** repo-relative path to the hooks manifest */
  path: string;
  /**
   * "matcher" — Claude/Codex hooks.json: SessionStart groups with a "|"-joined
   *   matcher that must include startup/resume/clear.
   */
  format: "matcher";
}

export interface HarnessSpec {
  name: string;
  /** repo-relative JSON manifest path (OpenCode reuses package.json) */
  manifest: string;
  /** dotted keys required to be present on the manifest */
  requiredFields: string[];
  /** declared path-typed fields that must resolve inside the repo root */
  pathFields: PathField[];
  /** hooks manifest this harness wires up, if any */
  hooks: HookSpec | null;
}

export const HARNESSES: HarnessSpec[] = [
  {
    name: "Claude Code",
    manifest: ".claude-plugin/plugin.json",
    requiredFields: ["name", "version"],
    // skills/ and hooks/ are auto-discovered by convention, not declared.
    pathFields: [],
    hooks: { path: "hooks/hooks.json", format: "matcher" },
  },
  {
    name: "Codex CLI",
    manifest: ".codex-plugin/plugin.json",
    requiredFields: ["name", "version", "skills", "hooks"],
    pathFields: [
      { field: "skills", kind: "dir" },
      { field: "hooks", kind: "file" },
      { field: "interface.composerIcon", kind: "file" },
      { field: "interface.logo", kind: "file" },
    ],
    hooks: { path: "hooks/hooks.json", format: "matcher" },
  },
  {
    name: "OpenCode",
    // OpenCode has no standalone manifest; the npm package.json `main` field
    // points at the runtime plugin it loads.
    manifest: "package.json",
    requiredFields: ["name", "version", "main"],
    pathFields: [{ field: "main", kind: "file" }],
    hooks: null,
  },
];

export const BOOTSTRAP_MARKER = "# Instructions for using Slow-powers Skills";
