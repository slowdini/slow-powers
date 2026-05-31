// OpenCode install contract.
//
// Slow-powers ships to OpenCode users as an npm package:
//   { "plugin": ["@slowdini/slow-powers-opencode"] }
// The `files` allowlist controls exactly what lands in the published tarball.
// These tests assert the package metadata is correct for both npm and
// GitHub installs, and that no install-time build step runs on the consumer's
// machine. (That the plugin entry, bootstrap.md, and skills/ exist is covered
// by tests/harness/manifests.test.ts.)
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

  test("declares no install-time lifecycle scripts", () => {
    // bun/npm run these during install. A build/prepare step that depends on
    // devDependencies (which npm does not fetch for production installs) would
    // break a consumer's install. prepublishOnly is allowed — it only runs
    // during `npm pack`/`npm publish`, never on the consumer's machine.
    for (const hook of [
      "preinstall",
      "install",
      "postinstall",
      "prepare",
      "prepack",
      "prepublish",
    ]) {
      expect(Object.hasOwn(pkg.scripts ?? {}, hook)).toBe(false);
    }
  });
});
