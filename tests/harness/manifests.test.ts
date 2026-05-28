// Standard, cross-harness parity checks. Every supported harness is held to
// the same contract here; the per-harness specifics live in spec.ts. These
// checks replace the retired tests/codex/test-plugin-layout.sh and
// scripts/test-antigravity-extension.sh, and extend coverage to Claude Code,
// Cursor, and OpenCode which previously had no manifest tests.
import { describe, expect, test } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import { VERSION_LOCKED_MANIFESTS } from "../../scripts/manifest-files";
import {
  BOOTSTRAP_MARKER,
  CORE_SKILLS,
  getByPath,
  HARNESSES,
  type HookSpec,
  REPO_ROOT,
  readJson,
  resolveWithinRoot,
} from "./spec";

const PACKAGE_VERSION = (readJson("package.json") as { version: string })
  .version;

describe("shared assets (delivered by every harness)", () => {
  const bootstrap = fs.readFileSync(
    path.join(REPO_ROOT, "bootstrap.md"),
    "utf8",
  );

  test("bootstrap.md leads with the Superslow instructions marker", () => {
    expect(bootstrap).toContain(BOOTSTRAP_MARKER);
  });

  test.each(CORE_SKILLS)("bootstrap.md advertises the %s skill", (skill) => {
    expect(bootstrap).toContain(skill);
  });

  const skillFiles = fs
    .readdirSync(path.join(REPO_ROOT, "skills"), { recursive: true })
    .map(String)
    .filter((entry) => entry.endsWith("SKILL.md"));

  test("skills/ is populated with discoverable SKILL.md files", () => {
    expect(skillFiles.length).toBeGreaterThan(0);
  });

  test.each(skillFiles)("%s declares name + description frontmatter", (rel) => {
    const content = fs.readFileSync(
      path.join(REPO_ROOT, "skills", rel),
      "utf8",
    );
    expect(content.startsWith("---")).toBe(true);
    expect(content).toMatch(/\nname:\s*\S/);
    expect(content).toMatch(/\ndescription:\s*\S/);
  });
});

describe("version lockstep", () => {
  test.each(
    VERSION_LOCKED_MANIFESTS,
  )("%s version matches package.json (%s)", (relPath) => {
    const manifest = readJson(relPath) as {
      version?: string;
      plugins?: { version?: string }[];
    };
    if (manifest.version !== undefined) {
      expect(manifest.version).toBe(PACKAGE_VERSION);
    }
    for (const plugin of manifest.plugins ?? []) {
      if (plugin.version !== undefined) {
        expect(plugin.version).toBe(PACKAGE_VERSION);
      }
    }
  });
});

describe.each(HARNESSES)("$name harness", (harness) => {
  test("manifest is valid JSON with required fields", () => {
    const manifest = readJson(harness.manifest);
    for (const field of harness.requiredFields) {
      expect(getByPath(manifest, field)).toBeDefined();
    }
  });

  if (harness.pathFields.length > 0) {
    test.each(
      harness.pathFields,
    )("declared path $field resolves to an existing $kind within the repo", ({
      field,
      kind,
    }) => {
      const manifest = readJson(harness.manifest);
      const value = getByPath(manifest, field);
      expect(typeof value).toBe("string");
      const resolved = resolveWithinRoot(REPO_ROOT, value as string);
      expect(fs.existsSync(resolved)).toBe(true);
      const stat = fs.statSync(resolved);
      expect(kind === "dir" ? stat.isDirectory() : stat.isFile()).toBe(true);
    });
  }

  if (harness.hooks) {
    test("hook manifest wires SessionStart to run-hook.cmd", () => {
      assertHookWiring(harness.hooks as HookSpec);
    });
  }

  if (harness.name === "Antigravity CLI") {
    test("contextFileName contains bootstrap content", () => {
      const manifest = readJson(harness.manifest) as {
        contextFileName?: string;
      };
      const value = manifest.contextFileName;
      expect(value).toBeDefined();
      const resolved = resolveWithinRoot(REPO_ROOT, value as string);
      const content = fs.readFileSync(resolved, "utf8");
      expect(content).toContain(BOOTSTRAP_MARKER);
    });

    test("manifest filename matches expected filename in agy binary", () => {
      let agyPath: string | undefined;
      try {
        const { execSync } = require("node:child_process");
        agyPath = execSync("which agy", { encoding: "utf8" }).trim();
      } catch {
        const home = process.env.HOME || "";
        const commonPath = path.join(home, ".local/bin/agy");
        if (fs.existsSync(commonPath)) {
          agyPath = commonPath;
        }
      }

      if (agyPath && fs.existsSync(agyPath)) {
        const binaryContent = fs.readFileSync(agyPath);
        const expectedFilename = harness.manifest;
        expect(binaryContent.includes(Buffer.from(expectedFilename))).toBe(
          true,
        );
      } else {
        console.warn(
          "agy binary not found, skipping binary-manifest sync check",
        );
      }
    });
  }
});

function assertHookWiring(hooks: HookSpec): void {
  const manifest = readJson(hooks.path) as {
    hooks?: {
      SessionStart?: { matcher?: string; hooks?: { command?: string }[] }[];
      sessionStart?: { command?: string }[];
    };
  };

  let command: string | undefined;

  if (hooks.format === "matcher") {
    const groups = manifest.hooks?.SessionStart;
    expect(Array.isArray(groups) && groups.length > 0).toBe(true);
    const matcher = (groups as NonNullable<typeof groups>)[0].matcher ?? "";
    for (const event of ["startup", "resume", "clear"]) {
      expect(matcher.split("|")).toContain(event);
    }
    command = (groups as NonNullable<typeof groups>)[0].hooks?.[0]?.command;
  } else {
    const list = manifest.hooks?.sessionStart;
    expect(Array.isArray(list) && list.length > 0).toBe(true);
    command = (list as NonNullable<typeof list>)[0].command;
  }

  expect(command ?? "").toContain("run-hook.cmd");
  expect(fs.existsSync(path.join(REPO_ROOT, "hooks/run-hook.cmd"))).toBe(true);
  expect(fs.existsSync(path.join(REPO_ROOT, "hooks/session-start"))).toBe(true);
}
