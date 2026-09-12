// Standard, cross-harness parity checks. Every supported harness is held to
// the same contract here; the per-harness specifics live in spec.ts. These
// checks replace the retired tests/codex/test-plugin-layout.sh and extend
// coverage to Claude Code and OpenCode which previously had no
// manifest tests.
import { describe, expect, test } from "bun:test";
import fs from "node:fs";
import path from "node:path";
import { VERSION_LOCKED_MANIFESTS } from "../../scripts/manifest-files";
import {
  BOOTSTRAP_MARKER,
  getByPath,
  HARNESSES,
  type HookSpec,
  REPO_ROOT,
  readJson,
  resolveWithinRoot,
} from "./spec";

const PACKAGE_VERSION = (readJson("package.json") as { version: string })
  .version;

const SKILL_ROOT_ENTRIES = new Set([
  "SKILL.md",
  "assets",
  "evals",
  "references",
  "scripts",
]);

function listFilesRecursively(root: string): string[] {
  if (!fs.existsSync(root)) return [];

  return fs
    .readdirSync(root, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => path.join(entry.parentPath, entry.name));
}

function localMarkdownTargets(markdownPath: string): string[] {
  const markdown = fs.readFileSync(markdownPath, "utf8");

  return [...markdown.matchAll(/\[[^\]]*]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)/g)]
    .map((match) => match[1])
    .filter((target): target is string => target !== undefined)
    .filter(
      (target) =>
        !target.startsWith("#") &&
        !target.startsWith("mailto:") &&
        !/^[a-z][a-z0-9+.-]*:\/\//i.test(target),
    )
    .map((target) => target.split(/[?#]/, 1)[0])
    .filter((target): target is string => target !== undefined);
}

describe("repository tooling", () => {
  test("Biome force-ignores eval-magic artifacts", () => {
    const config = readJson("biome.json") as {
      files?: { includes?: string[] };
    };

    expect(config.files?.includes).toContain("!!.eval-magic");
  });
});

describe("shared assets (delivered by every harness)", () => {
  const bootstrap = fs.readFileSync(
    path.join(REPO_ROOT, "bootstrap.md"),
    "utf8",
  );

  test("bootstrap.md leads with the Slow-powers instructions marker", () => {
    expect(bootstrap).toContain(BOOTSTRAP_MARKER);
  });

  // Flowcharts are authored as mermaid (renders natively in GitHub/editors, no
  // graphviz dependency). Guard against a silent regression back to ```dot.
  const markdownFiles = [
    "bootstrap.md",
    ...fs
      .readdirSync(path.join(REPO_ROOT, "skills"), { recursive: true })
      .map(String)
      .filter((entry) => entry.endsWith(".md"))
      .map((entry) => path.join("skills", entry)),
  ];

  test.each(markdownFiles)("%s uses mermaid, not graphviz ```dot", (rel) => {
    const content = fs.readFileSync(path.join(REPO_ROOT, rel), "utf8");
    expect(content).not.toMatch(/^```dot\b/m);
  });

  const skillFiles = fs
    .readdirSync(path.join(REPO_ROOT, "skills"), { recursive: true })
    .map(String)
    .filter((entry) => entry.endsWith("SKILL.md"));
  const skillDirs = skillFiles.map((skillFile) =>
    path.join(REPO_ROOT, "skills", path.dirname(skillFile)),
  );

  test("skills/ is populated with discoverable SKILL.md files", () => {
    expect(skillFiles.length).toBeGreaterThan(0);
  });

  test("Codex-discoverable skills are only top-level skill folders", () => {
    for (const rel of skillFiles) {
      expect(rel.split(/[\\/]/)).toEqual([expect.any(String), "SKILL.md"]);
    }
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

  test.each(
    skillDirs,
  )("%s keeps peer content in documented directories", (skillDir) => {
    const unexpected = fs
      .readdirSync(skillDir, { withFileTypes: true })
      .filter((entry) => !entry.name.startsWith("."))
      .filter(
        (entry) =>
          entry.isFile() ||
          listFilesRecursively(path.join(skillDir, entry.name)).some(
            (file) => !path.basename(file).startsWith("."),
          ),
      )
      .map((entry) => entry.name)
      .filter((entry) => !SKILL_ROOT_ENTRIES.has(entry));

    expect(unexpected).toEqual([]);
  });

  const agentMarkdownFiles = skillDirs.flatMap((skillDir) => [
    path.join(skillDir, "SKILL.md"),
    ...listFilesRecursively(path.join(skillDir, "references")).filter((file) =>
      file.endsWith(".md"),
    ),
  ]);

  test.each(
    agentMarkdownFiles,
  )("%s links resolve to existing local files", (markdownPath) => {
    const missing = localMarkdownTargets(markdownPath)
      .map((target) => path.resolve(path.dirname(markdownPath), target))
      .filter((target) => !fs.existsSync(target))
      .map((target) => path.relative(REPO_ROOT, target));

    expect(missing).toEqual([]);
  });

  test.each(
    skillDirs,
  )("%s references every bundled reference file", (skillDir) => {
    const referencesDir = path.join(skillDir, "references");
    const bundledReferences = new Set(listFilesRecursively(referencesDir));
    const reached = new Set<string>();
    const pending = [path.join(skillDir, "SKILL.md")];

    while (pending.length > 0) {
      const markdownPath = pending.pop();
      if (markdownPath === undefined || reached.has(markdownPath)) continue;
      reached.add(markdownPath);

      for (const target of localMarkdownTargets(markdownPath)) {
        const resolved = path.resolve(path.dirname(markdownPath), target);
        if (
          resolved.startsWith(`${referencesDir}${path.sep}`) &&
          fs.existsSync(resolved)
        ) {
          if (resolved.endsWith(".md")) {
            pending.push(resolved);
          } else {
            reached.add(resolved);
          }
        }
      }
    }

    const unreachable = [...bundledReferences]
      .filter((reference) => !reached.has(reference))
      .map((reference) => path.relative(skillDir, reference));

    expect(unreachable).toEqual([]);
  });

  const evalConfigs = fs
    .readdirSync(path.join(REPO_ROOT, "skills"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({
      skill: entry.name,
      path: path.join(REPO_ROOT, "skills", entry.name, "evals", "evals.json"),
    }))
    .filter((entry) => fs.existsSync(entry.path));

  test.each(
    evalConfigs,
  )("$skill/evals/evals.json references existing fixture files", ({
    path: evalsPath,
  }) => {
    const config = JSON.parse(fs.readFileSync(evalsPath, "utf8")) as {
      evals?: Array<{ files?: string[]; files_root?: string; id?: string }>;
    };
    const missing: string[] = [];

    for (const ev of config.evals ?? []) {
      const filesRoot = path.join(
        path.dirname(evalsPath),
        ev.files_root ?? ".",
      );
      for (const file of ev.files ?? []) {
        if (!fs.existsSync(path.join(filesRoot, file))) {
          missing.push(`${ev.id ?? "(unknown eval)"}: ${file}`);
        }
      }
    }

    expect(missing).toEqual([]);
  });

  // The ExitPlanMode gate lives in the shared hooks.json but is meaningful only
  // on Claude (Codex/OpenCode have no ExitPlanMode tool), so it is asserted as a
  // shared-asset property here rather than via the per-harness SessionStart
  // wiring check, which would conflate the inert Codex case with real wiring.
  test("hooks.json wires a PreToolUse ExitPlanMode gate to run-hook.cmd exit-plan-mode", () => {
    const manifest = readJson("hooks/hooks.json") as {
      hooks?: {
        PreToolUse?: { matcher?: string; hooks?: { command?: string }[] }[];
      };
    };
    const group = (manifest.hooks?.PreToolUse ?? []).find(
      (g) => g.matcher === "ExitPlanMode",
    );
    expect(group).toBeDefined();
    const command = group?.hooks?.[0]?.command ?? "";
    expect(command).toContain("run-hook.cmd");
    expect(command).toContain("exit-plan-mode");
    expect(fs.existsSync(path.join(REPO_ROOT, "hooks/exit-plan-mode"))).toBe(
      true,
    );
  });

  test("Codex manifest wires shared and Codex-specific hook manifests", () => {
    const manifest = readJson(".codex-plugin/plugin.json") as {
      hooks?: unknown;
    };

    expect(manifest.hooks).toEqual([
      "./hooks/hooks.json",
      "./hooks/codex-hooks.json",
    ]);
    expect(fs.existsSync(path.join(REPO_ROOT, "hooks/codex-hooks.json"))).toBe(
      true,
    );
    expect(
      fs.existsSync(path.join(REPO_ROOT, "hooks/codex-stop-plan-mode")),
    ).toBe(true);
  });
});

describe("Cline plugin manifest (package.json cline field)", () => {
  test("cline.plugins declares resolvable entry files with hooks+rules capabilities", () => {
    const manifest = readJson("package.json") as {
      cline?: { plugins?: { paths?: unknown; capabilities?: unknown }[] };
    };
    const plugins = manifest.cline?.plugins ?? [];
    expect(plugins.length).toBeGreaterThan(0);
    for (const plugin of plugins) {
      expect(Array.isArray(plugin.paths)).toBe(true);
      for (const entry of plugin.paths as string[]) {
        expect(typeof entry).toBe("string");
        const resolved = resolveWithinRoot(REPO_ROOT, entry);
        expect(fs.existsSync(resolved)).toBe(true);
        expect(fs.statSync(resolved).isFile()).toBe(true);
      }
      const capabilities = plugin.capabilities as string[];
      expect(capabilities).toContain("hooks");
      expect(capabilities).toContain("rules");
    }
  });
});

describe("version lockstep", () => {
  test.each([
    ...VERSION_LOCKED_MANIFESTS,
  ])("%s version matches package.json (%s)", (relPath) => {
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
      const values = Array.isArray(value) ? value : [value];
      expect(values.length).toBeGreaterThan(0);
      for (const item of values) {
        expect(typeof item).toBe("string");
        const resolved = resolveWithinRoot(REPO_ROOT, item as string);
        expect(fs.existsSync(resolved)).toBe(true);
        const stat = fs.statSync(resolved);
        expect(kind === "dir" ? stat.isDirectory() : stat.isFile()).toBe(true);
      }
    });
  }

  if (harness.hooks) {
    test("hook manifest wires SessionStart to run-hook.cmd", () => {
      assertHookWiring(harness.hooks as HookSpec);
    });
  }
});

function assertHookWiring(hooks: HookSpec): void {
  const manifest = readJson(hooks.path) as {
    hooks?: {
      SessionStart?: { matcher?: string; hooks?: { command?: string }[] }[];
    };
  };

  const groups = manifest.hooks?.SessionStart;
  expect(Array.isArray(groups) && groups.length > 0).toBe(true);
  const matcher = (groups as NonNullable<typeof groups>)[0].matcher ?? "";
  for (const event of ["startup", "resume", "clear"]) {
    expect(matcher.split("|")).toContain(event);
  }
  const command = (groups as NonNullable<typeof groups>)[0].hooks?.[0]?.command;

  expect(command ?? "").toContain("run-hook.cmd");
  expect(fs.existsSync(path.join(REPO_ROOT, "hooks/run-hook.cmd"))).toBe(true);
  expect(fs.existsSync(path.join(REPO_ROOT, "hooks/session-start"))).toBe(true);
}
