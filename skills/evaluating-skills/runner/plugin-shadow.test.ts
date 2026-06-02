import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { dirname, join } from "node:path";
import {
  detectPluginShadows,
  formatShadowBanner,
  resolveConfigDir,
  shadowValidityWarnings,
} from "./plugin-shadow";

const ROOT = join(tmpdir(), `slow-powers-plugin-shadow-test-${process.pid}`);

beforeAll(() => mkdirSync(ROOT, { recursive: true }));
afterAll(() => rmSync(ROOT, { recursive: true, force: true }));

let seq = 0;
function freshDirs() {
  seq += 1;
  const base = join(ROOT, `case-${seq}`);
  const configDir = join(base, "config");
  const cwd = join(base, "cwd");
  mkdirSync(configDir, { recursive: true });
  mkdirSync(cwd, { recursive: true });
  return { configDir, cwd };
}

function writeFile(path: string, body: string) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, body);
}

/** Lay down a plugin's skill folders and return its install path. */
function installPlugin(
  configDir: string,
  key: string,
  skillNames: string[],
): string {
  const installPath = join(
    configDir,
    "plugins",
    "cache",
    key.replace("@", "__"),
  );
  for (const name of skillNames) {
    writeFile(
      join(installPath, "skills", name, "SKILL.md"),
      `---\nname: ${name}\ndescription: x\n---\n`,
    );
  }
  return installPath;
}

function writeInstalledManifest(
  configDir: string,
  entries: Record<string, string>,
) {
  const plugins: Record<string, Array<{ installPath: string }>> = {};
  for (const [key, installPath] of Object.entries(entries))
    plugins[key] = [{ installPath }];
  writeFile(
    join(configDir, "plugins", "installed_plugins.json"),
    `${JSON.stringify({ version: 2, plugins }, null, 2)}\n`,
  );
}

function writeSettings(path: string, enabledPlugins: Record<string, boolean>) {
  writeFile(path, `${JSON.stringify({ enabledPlugins }, null, 2)}\n`);
}

describe("resolveConfigDir", () => {
  test("honors CLAUDE_CONFIG_DIR", () => {
    expect(
      resolveConfigDir({
        CLAUDE_CONFIG_DIR: "/custom/cfg",
      } as NodeJS.ProcessEnv),
    ).toBe("/custom/cfg");
  });

  test("defaults to ~/.claude when unset", () => {
    expect(resolveConfigDir({} as NodeJS.ProcessEnv)).toBe(
      join(homedir(), ".claude"),
    );
  });
});

describe("detectPluginShadows", () => {
  test("flags a staged skill also provided by an enabled plugin", () => {
    const { configDir, cwd } = freshDirs();
    const ip = installPlugin(configDir, "slow-powers@slowdini", [
      "verification-before-completion",
      "writing-skills",
    ]);
    writeInstalledManifest(configDir, { "slow-powers@slowdini": ip });
    writeSettings(join(configDir, "settings.json"), {
      "slow-powers@slowdini": true,
    });

    const report = detectPluginShadows({
      configDir,
      cwd,
      stagedSkillNames: ["verification-before-completion"],
    });
    expect(report.shadowed).toHaveLength(1);
    expect(report.shadowed[0]).toMatchObject({
      kind: "plugin",
      plugin: "slow-powers@slowdini",
      skill_name: "verification-before-completion",
    });
  });

  test("does not flag a plugin disabled in user settings", () => {
    const { configDir, cwd } = freshDirs();
    const ip = installPlugin(configDir, "slow-powers@slowdini", [
      "verification-before-completion",
    ]);
    writeInstalledManifest(configDir, { "slow-powers@slowdini": ip });
    writeSettings(join(configDir, "settings.json"), {
      "slow-powers@slowdini": false,
    });

    const report = detectPluginShadows({
      configDir,
      cwd,
      stagedSkillNames: ["verification-before-completion"],
    });
    expect(report.shadowed).toHaveLength(0);
  });

  test("project settings disabling a user-enabled plugin suppresses the shadow", () => {
    const { configDir, cwd } = freshDirs();
    const ip = installPlugin(configDir, "slow-powers@slowdini", [
      "verification-before-completion",
    ]);
    writeInstalledManifest(configDir, { "slow-powers@slowdini": ip });
    writeSettings(join(configDir, "settings.json"), {
      "slow-powers@slowdini": true,
    });
    // Project scope (cwd/.claude/settings.json) outranks user scope.
    writeSettings(join(cwd, ".claude", "settings.json"), {
      "slow-powers@slowdini": false,
    });

    const report = detectPluginShadows({
      configDir,
      cwd,
      stagedSkillNames: ["verification-before-completion"],
    });
    expect(report.shadowed).toHaveLength(0);
  });

  test("flags a staged skill also present in the global skills dir", () => {
    const { configDir, cwd } = freshDirs();
    writeFile(
      join(configDir, "skills", "my-skill", "SKILL.md"),
      "---\nname: my-skill\n---\n",
    );

    const report = detectPluginShadows({
      configDir,
      cwd,
      stagedSkillNames: ["my-skill"],
    });
    expect(report.shadowed).toHaveLength(1);
    expect(report.shadowed[0]).toMatchObject({
      kind: "global-skill",
      skill_name: "my-skill",
    });
  });

  test("no shadow when staged names match nothing in the environment", () => {
    const { configDir, cwd } = freshDirs();
    const ip = installPlugin(configDir, "p@m", ["other"]);
    writeInstalledManifest(configDir, { "p@m": ip });
    writeSettings(join(configDir, "settings.json"), { "p@m": true });

    const report = detectPluginShadows({
      configDir,
      cwd,
      stagedSkillNames: ["mine"],
    });
    expect(report.shadowed).toHaveLength(0);
  });

  test("is graceful when the config dir has no plugins or skills", () => {
    const { configDir, cwd } = freshDirs();
    const report = detectPluginShadows({
      configDir,
      cwd,
      stagedSkillNames: ["x"],
    });
    expect(report.shadowed).toHaveLength(0);
    expect(report.config_dir).toBe(configDir);
  });
});

describe("warning formatting", () => {
  const report = {
    config_dir: "/x",
    shadowed: [
      {
        kind: "plugin" as const,
        plugin: "slow-powers@slowdini",
        skill_name: "verification-before-completion",
        path: "/p",
      },
    ],
  };

  test("shadowValidityWarnings names the skill, the plugin, and the contamination", () => {
    const warnings = shadowValidityWarnings(report);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("verification-before-completion");
    expect(warnings[0]).toContain("slow-powers@slowdini");
    expect(warnings[0]).toMatch(/contaminat/i);
  });

  test("formatShadowBanner is empty when nothing is shadowed", () => {
    expect(formatShadowBanner({ config_dir: "/x", shadowed: [] })).toBe("");
  });

  test("formatShadowBanner lists shadowed skills and points at isolation docs", () => {
    const banner = formatShadowBanner(report);
    expect(banner).toContain("verification-before-completion");
    expect(banner).toContain("slow-powers@slowdini");
    expect(banner).toMatch(/isolat/i);
  });
});
