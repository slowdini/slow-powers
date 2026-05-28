// Single source of truth for the manifests kept in version lockstep.
// Consumed by scripts/bump-version.ts (to rewrite each version) and by
// tests/harness/manifests.test.ts (to assert each matches package.json).
// Paths are relative to the repository root.
export const VERSION_LOCKED_MANIFESTS = [
  "package.json",
  ".claude-plugin/plugin.json",
  ".codex-plugin/plugin.json",
  ".cursor-plugin/plugin.json",
  ".claude-plugin/marketplace.json",
  ".agents/plugins/marketplace.json",
] as const;
