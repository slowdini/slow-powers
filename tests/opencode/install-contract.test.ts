// OpenCode install contract.
//
// OpenCode installs Slow-powers straight from GitHub:
//   { "plugin": ["github:slowdini/slow-powers#main"] }
// A `github:` install delivers the whole repository working tree — bun does
// NOT apply the npm `files` allowlist to git installs (verified empirically).
// So there's nothing to assert about a packed tarball; what actually governs a
// GitHub install is that the package stays unpublishable and runs no
// install-time build step. (That the plugin entry, bootstrap.md, and skills/
// exist is covered by tests/harness/manifests.test.ts.)
import { describe, expect, test } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import { REPO_ROOT, readJson } from "../harness/spec";

const pkg = readJson("package.json") as {
  private?: boolean;
  main?: string;
  scripts?: Record<string, string>;
};

describe("OpenCode GitHub-install contract", () => {
  test("package stays private so it is never accidentally published to npm", () => {
    // Distribution is GitHub-only; `private: true` is the guard that keeps a
    // stray `npm publish` from shipping this package.
    expect(pkg.private).toBe(true);
  });

  test("declares no install-time lifecycle scripts", () => {
    // bun/npm run these during a `github:` install. A build/prepare step that
    // depends on devDependencies (which git installs do not fetch) would break
    // a consumer's install.
    for (const hook of [
      "preinstall",
      "install",
      "postinstall",
      "prepare",
      "prepack",
      "prepublish",
      "prepublishOnly",
    ]) {
      expect(Object.hasOwn(pkg.scripts ?? {}, hook)).toBe(false);
    }
  });

  test("main points at the OpenCode plugin entry that ships in the repo", () => {
    expect(pkg.main).toBe("./opencode/plugins/slow-powers.js");
    expect(
      fs.existsSync(path.join(REPO_ROOT, "opencode/plugins/slow-powers.js")),
    ).toBe(true);
  });
});
