// Skip husky in CI and production — devDependencies (husky) aren't installed
// there, and git hooks are meaningless in those environments. Notably, npm runs
// `prepare` during `npm publish`, and our release job never installs
// devDependencies, so calling husky directly would fail with "husky: not found".
// See tests/opencode/install-contract.test.ts for why `prepare` must be CI-safe.
if (process.env.CI === "true" || process.env.NODE_ENV === "production") {
  process.exit(0);
}
const husky = (await import("husky")).default;
console.log(husky());
