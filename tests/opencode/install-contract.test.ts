// OpenCode install contract.
//
// Slow-powers ships to OpenCode users only as an npm package:
//   { "plugin": ["@slowdini/slow-powers-opencode"] }
// The `files` allowlist controls exactly what lands in the published tarball.
// These tests assert the package metadata is correct and that no build step
// runs on the consumer's machine when they install the package. (That the
// plugin entry, bootstrap.md, and skills/ exist is covered by
// tests/harness/manifests.test.ts.)
import { describe, expect, test } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import { REPO_ROOT, readJson } from "../harness/spec";

const pkg = readJson("package.json") as {
  name?: string;
  main?: string;
  files?: string[];
  scripts?: Record<string, string>;
};

describe("OpenCode npm-publish contract", () => {
  test("has a scoped public package name", () => {
    expect(pkg.name).toBe("@slowdini/slow-powers-opencode");
  });

  test("files allowlist includes everything the plugin needs at runtime", () => {
    const files = pkg.files ?? [];
    expect(files).toContain("opencode/");
    expect(files).toContain("skills/");
    expect(files).toContain("bootstrap.md");
  });

  test("main points at the OpenCode plugin entry that ships in the repo", () => {
    expect(pkg.main).toBe("./opencode/plugins/slow-powers.js");
    expect(
      fs.existsSync(path.join(REPO_ROOT, "opencode/plugins/slow-powers.js")),
    ).toBe(true);
  });

  test("declares no scripts that run on a consumer's install", () => {
    // npm/bun run these on every install of the published package. A build step
    // here that depends on devDependencies (which npm does not fetch for
    // production installs) would break a consumer's install. `prepare` is
    // intentionally allowed: it activates our git hooks for contributors and
    // does NOT run on a registry-tarball install — only on local dev and during
    // `npm pack`/`npm publish` (already gated to CI by `prepublishOnly`).
    for (const hook of ["preinstall", "install", "postinstall"]) {
      expect(Object.hasOwn(pkg.scripts ?? {}, hook)).toBe(false);
    }
  });
});
