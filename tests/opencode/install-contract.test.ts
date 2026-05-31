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
    // `npm pack`/`npm publish`. (Its CI-safety is asserted separately below.)
    for (const hook of ["preinstall", "install", "postinstall"]) {
      expect(Object.hasOwn(pkg.scripts ?? {}, hook)).toBe(false);
    }
  });

  test("prepare is CI-safe — guards husky behind a CI/production check", () => {
    // `npm publish` runs `prepare`, but the release job never installs
    // devDependencies, so calling `husky` directly fails with "husky: not
    // found" (exit 127). `prepublishOnly` does NOT prevent this — it only blocks
    // publishing *outside* CI; inside CI, `prepare` still fires. The guard
    // script must short-circuit before importing husky when CI/production.
    expect(pkg.scripts?.prepare).toBe("node .husky/install.mjs");

    const guardPath = path.join(REPO_ROOT, ".husky/install.mjs");
    expect(fs.existsSync(guardPath)).toBe(true);

    const guard = fs.readFileSync(guardPath, "utf8");
    // The CI/production exit must precede the husky import, or publish breaks.
    const exitIdx = guard.indexOf("process.exit(0)");
    const huskyIdx = guard.indexOf('import("husky")');
    expect(guard).toContain('process.env.CI === "true"');
    expect(guard).toContain('process.env.NODE_ENV === "production"');
    expect(exitIdx).toBeGreaterThanOrEqual(0);
    expect(huskyIdx).toBeGreaterThan(exitIdx);
  });
});
