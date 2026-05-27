// Verifies the npm artifact published for the OpenCode harness
// (@slowdini/superslow-opencode): correct root metadata and that the packed
// tarball ships the runtime files while excluding contributor-only content.
// Replaces the retired test-core-paths.mjs and the packed-layout checks in
// test-plugin-loading.sh / setup.sh.

import { describe, expect, test } from "bun:test";
import { execFileSync } from "node:child_process";
import { REPO_ROOT, readJson } from "../harness/spec";

const rootPackage = readJson("package.json") as {
  name: string;
  private?: boolean;
  main?: string;
  scripts?: Record<string, string>;
};

interface PackResult {
  files: { path: string }[];
}

// `npm pack --dry-run --json` reports what would ship without writing a tarball.
const packResult: PackResult = JSON.parse(
  execFileSync("npm", ["pack", "--dry-run", "--json"], {
    cwd: REPO_ROOT,
    encoding: "utf8",
  }),
)[0];
const packedFiles = new Set(packResult.files.map((file) => file.path));

describe("OpenCode npm package metadata", () => {
  test("package name is @slowdini/superslow-opencode", () => {
    expect(rootPackage.name).toBe("@slowdini/superslow-opencode");
  });
  test("package stays private", () => {
    expect(rootPackage.private).toBe(true);
  });
  test("main points at the OpenCode plugin entry", () => {
    expect(rootPackage.main).toBe("./opencode/plugins/superpowers.js");
  });
  test("no contributor-only lifecycle scripts ship to consumers", () => {
    expect(Object.hasOwn(rootPackage.scripts ?? {}, "publish:all")).toBe(false);
    expect(Object.hasOwn(rootPackage.scripts ?? {}, "prepare")).toBe(false);
  });
});

describe("packed tarball contents", () => {
  test.each([
    "package.json",
    "README.md",
    "LICENSE",
    "opencode/plugins/superpowers.js",
    "bootstrap.md",
  ])("ships %s", (file) => {
    expect(packedFiles.has(file)).toBe(true);
  });

  test("ships the bundled skills directory", () => {
    const hasSkill = [...packedFiles].some((f) => f.startsWith("skills/"));
    expect(hasSkill).toBe(true);
  });

  test.each([
    "opencode/package.json",
    "antigravity-extension.json",
    "tests/opencode/superpowers.test.ts",
  ])("excludes contributor-only %s", (file) => {
    expect(packedFiles.has(file)).toBe(false);
  });
});
