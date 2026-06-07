// Regression tests for the bash deployment tool scripts/sync-to-codex-plugin.sh.
// The tool stays bash (it's an operator script); this suite drives it through
// child_process against throwaway git fixtures, stubbing `gh auth status` with
// a fake binary on PATH so nothing touches the network. Trimmed from the
// retired 667-line bash suite to its essential regressions.
//
// Requires git, rsync, python3 (present on dev machines + CI). gh is faked.
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { REPO_ROOT } from "../harness/spec";

const SYNC_SCRIPT_SOURCE = path.join(
  REPO_ROOT,
  "scripts/sync-to-codex-plugin.sh",
);
const PACKAGE_VERSION = "1.2.3";
const MANIFEST_VERSION = "9.8.7";

let testRoot: string;
let fakeBin: string;

function git(repo: string, ...args: string[]): void {
  const result = spawnSync("git", ["-C", repo, ...args], { encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(
      `git ${args.join(" ")} failed: ${result.stderr || result.stdout}`,
    );
  }
}

function write(file: string, content: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}

interface RunResult {
  status: number;
  output: string;
}

/** Run the sync tool copied into an upstream fixture, with the fake gh on PATH. */
function runSync(upstream: string, args: string[]): RunResult {
  const result = spawnSync(
    "bash",
    [path.join(upstream, "scripts/sync-to-codex-plugin.sh"), ...args],
    {
      cwd: testRoot,
      encoding: "utf8",
      env: { ...process.env, PATH: `${fakeBin}:${process.env.PATH}` },
    },
  );
  return {
    status: result.status ?? -1,
    output: `${result.stdout}${result.stderr}`,
  };
}

function previewSection(output: string): string {
  const start = output.indexOf("=== Preview (rsync --dry-run) ===");
  const end = output.indexOf("=== End preview ===");
  return start >= 0 && end >= 0 ? output.slice(start, end) : "";
}

function currentBranch(repo: string): string {
  return spawnSync("git", ["-C", repo, "branch", "--show-current"], {
    encoding: "utf8",
  }).stdout.trim();
}

function syncBranches(repo: string): string {
  return spawnSync(
    "git",
    ["-C", repo, "branch", "--list", "sync/slow-powers-*"],
    {
      encoding: "utf8",
    },
  ).stdout.trim();
}

function initRepo(repo: string): void {
  fs.mkdirSync(repo, { recursive: true });
  git(repo, "init", "-q", "-b", "main");
  git(repo, "config", "user.name", "Test Bot");
  git(repo, "config", "user.email", "test@example.com");
}

// Reuse the repo's real hooks.json as fixture content (its `${CLAUDE_PLUGIN_ROOT}`
// placeholder is awkward to embed in a template literal, and reading the real
// file keeps the fixture representative).
const HOOKS_JSON = fs.readFileSync(
  path.join(REPO_ROOT, "hooks/hooks.json"),
  "utf8",
);
const CODEX_HOOKS_JSON = fs.readFileSync(
  path.join(REPO_ROOT, "hooks/codex-hooks.json"),
  "utf8",
);
const CODEX_STOP_PLAN_MODE = fs.readFileSync(
  path.join(REPO_ROOT, "hooks/codex-stop-plan-mode"),
  "utf8",
);
const OPENAI_YAML = `interface:
  display_name: "Example"
  short_description: "Destination-owned OpenAI metadata"
`;
const SKILL_MD = "# Example Skill\n\nFixture content.\n";

function writeUpstreamFixture(repo: string): void {
  fs.copyFileSync(
    SYNC_SCRIPT_SOURCE,
    ensureDir(path.join(repo, "scripts/sync-to-codex-plugin.sh")),
  );
  write(
    path.join(repo, "package.json"),
    `{\n  "name": "fixture-upstream",\n  "version": "${PACKAGE_VERSION}"\n}\n`,
  );
  write(path.join(repo, ".gitignore"), ".private-journal/\n");
  write(
    path.join(repo, ".codex-plugin/plugin.json"),
    `{\n  "name": "slow-powers",\n  "version": "${MANIFEST_VERSION}"\n}\n`,
  );
  write(path.join(repo, "hooks/hooks.json"), HOOKS_JSON);
  write(path.join(repo, "hooks/codex-hooks.json"), CODEX_HOOKS_JSON);
  write(path.join(repo, "hooks/session-start"), "#!/usr/bin/env bash\n");
  write(path.join(repo, "hooks/exit-plan-mode"), "#!/usr/bin/env bash\n");
  write(path.join(repo, "hooks/codex-stop-plan-mode"), CODEX_STOP_PLAN_MODE);
  write(path.join(repo, "hooks/run-hook.cmd"), "@echo off\n");
  write(
    path.join(repo, "assets/slow-powers-small.svg"),
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"></svg>\n',
  );
  write(path.join(repo, "assets/app-icon.png"), "png fixture\n");
  write(path.join(repo, "skills/example/SKILL.md"), SKILL_MD);
  write(path.join(repo, ".private-journal/keep.txt"), "tracked keep\n");
  write(path.join(repo, ".private-journal/leak.txt"), "ignored leak\n");

  git(
    repo,
    "add",
    ".codex-plugin/plugin.json",
    ".gitignore",
    "assets/app-icon.png",
    "assets/slow-powers-small.svg",
    "hooks/exit-plan-mode",
    "hooks/codex-hooks.json",
    "hooks/codex-stop-plan-mode",
    "hooks/hooks.json",
    "hooks/run-hook.cmd",
    "hooks/session-start",
    "package.json",
    "scripts/sync-to-codex-plugin.sh",
    "skills/example/SKILL.md",
  );
  git(repo, "add", "-f", ".private-journal/keep.txt");
  git(repo, "commit", "-q", "-m", "Initial upstream fixture");
}

/** Destination as it looks before a first sync (pre-synced layout, no plugin files yet). */
function writeDestinationFixture(repo: string): void {
  write(path.join(repo, "plugins/slow-powers/.fixture-keep"), "fixture keep\n");
  write(
    path.join(repo, "plugins/slow-powers/skills/example/SKILL.md"),
    SKILL_MD,
  );
  write(
    path.join(repo, "plugins/slow-powers/skills/example/agents/openai.yaml"),
    OPENAI_YAML,
  );
  git(repo, "add", "plugins/slow-powers");
  git(repo, "commit", "-q", "-m", "Initial destination fixture");
}

/** Destination already in sync with upstream (used for apply scenarios). */
function writeSyncedDestinationFixture(repo: string): void {
  write(
    path.join(repo, "plugins/slow-powers/.codex-plugin/plugin.json"),
    `{\n  "name": "slow-powers",\n  "version": "${MANIFEST_VERSION}"\n}\n`,
  );
  write(path.join(repo, "plugins/slow-powers/hooks/hooks.json"), HOOKS_JSON);
  write(
    path.join(repo, "plugins/slow-powers/hooks/codex-hooks.json"),
    CODEX_HOOKS_JSON,
  );
  write(
    path.join(repo, "plugins/slow-powers/hooks/session-start"),
    "#!/usr/bin/env bash\n",
  );
  write(
    path.join(repo, "plugins/slow-powers/hooks/exit-plan-mode"),
    "#!/usr/bin/env bash\n",
  );
  write(
    path.join(repo, "plugins/slow-powers/hooks/codex-stop-plan-mode"),
    CODEX_STOP_PLAN_MODE,
  );
  write(
    path.join(repo, "plugins/slow-powers/hooks/run-hook.cmd"),
    "@echo off\n",
  );
  write(
    path.join(repo, "plugins/slow-powers/assets/slow-powers-small.svg"),
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"></svg>\n',
  );
  write(
    path.join(repo, "plugins/slow-powers/assets/app-icon.png"),
    "png fixture\n",
  );
  write(
    path.join(repo, "plugins/slow-powers/skills/example/SKILL.md"),
    SKILL_MD,
  );
  write(
    path.join(repo, "plugins/slow-powers/skills/example/agents/openai.yaml"),
    OPENAI_YAML,
  );
  write(
    path.join(repo, "plugins/slow-powers/.private-journal/keep.txt"),
    "tracked keep\n",
  );
  git(repo, "add", "plugins/slow-powers");
  git(repo, "commit", "-q", "-m", "Initial synced destination fixture");
}

function ensureDir(file: string): string {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  return file;
}

beforeAll(() => {
  testRoot = fs.mkdtempSync(path.join(os.tmpdir(), "codex-sync-"));
  fakeBin = path.join(testRoot, "bin");
  fs.mkdirSync(fakeBin, { recursive: true });
  // Fake gh: succeeds for `gh auth status`, fails loudly on anything else
  // (the trimmed scenarios never reach a real gh call).
  const ghPath = path.join(fakeBin, "gh");
  const ghScript =
    '#!/usr/bin/env bash\nif [ "$1" = "auth" ] && [ "$2" = "status" ]; then exit 0; fi\necho "unexpected gh invocation: $*" >&2\nexit 1\n';
  fs.writeFileSync(ghPath, ghScript);
  fs.chmodSync(ghPath, 0o755);
});

afterAll(() => {
  if (testRoot) fs.rmSync(testRoot, { recursive: true, force: true });
});

describe("dry-run preview", () => {
  let result: RunResult;
  let section: string;
  const dest = () => path.join(testRoot, "destination");

  beforeAll(() => {
    const upstream = path.join(testRoot, "upstream");
    initRepo(upstream);
    writeUpstreamFixture(upstream);

    initRepo(dest());
    writeDestinationFixture(dest());
    git(dest(), "checkout", "-q", "-b", "fixture/preview-target");
    // Locally modify a tracked file so the preview must reflect it.
    write(
      path.join(dest(), "plugins/slow-powers/skills/example/SKILL.md"),
      "# Example Skill\n\nLocally modified fixture content.\n",
    );

    result = runSync(upstream, ["-n", "--local", dest()]);
    section = previewSection(result.output);
  });

  test("exits successfully", () => {
    expect(result.status).toBe(0);
  });
  test("reports the version from the committed manifest, not package.json", () => {
    expect(result.output).toContain(`Version:  ${MANIFEST_VERSION}`);
    expect(result.output).not.toContain(`Version:  ${PACKAGE_VERSION}`);
  });
  test("preview includes the manifest, assets, and hooks", () => {
    expect(section).toContain(".codex-plugin/plugin.json");
    expect(section).toContain("assets/slow-powers-small.svg");
    expect(section).toContain("assets/app-icon.png");
    expect(section).toContain("hooks/hooks.json");
    expect(section).toContain("hooks/codex-hooks.json");
    expect(section).toContain("hooks/codex-stop-plan-mode");
  });
  test("includes tracked ignored files but excludes untracked ignored files", () => {
    expect(section).toContain(".private-journal/keep.txt");
    expect(section).not.toContain(".private-journal/leak.txt");
  });
  test("reflects the dirty tracked destination file", () => {
    expect(section).toContain("skills/example/SKILL.md");
  });
  test("preserves destination-owned OpenAI agent metadata", () => {
    expect(section).not.toMatch(
      /\*deleting +skills\/example\/agents\/openai\.yaml/,
    );
  });
  test("leaves the destination checkout on its branch with no sync branch", () => {
    expect(currentBranch(dest())).toBe("fixture/preview-target");
    expect(syncBranches(dest())).toBe("");
  });
});

describe("bootstrap preview", () => {
  let result: RunResult;
  const dest = () => path.join(testRoot, "bootstrap-destination");

  beforeAll(() => {
    const upstream = path.join(testRoot, "bootstrap-upstream");
    initRepo(upstream);
    writeUpstreamFixture(upstream);

    initRepo(dest());
    write(path.join(dest(), "README.md"), "bootstrap fixture\n");
    git(dest(), "add", "README.md");
    git(dest(), "commit", "-q", "-m", "Initial bootstrap destination fixture");
    git(dest(), "checkout", "-q", "-b", "fixture/bootstrap-preview-target");

    result = runSync(upstream, ["-n", "--bootstrap", "--local", dest()]);
  });

  test("exits successfully and describes bootstrap mode", () => {
    expect(result.status).toBe(0);
    expect(result.output).toContain(
      "Mode:     BOOTSTRAP (creating plugins/slow-powers/ when absent)",
    );
  });
  test("stays dry-run only and does not create the destination plugin dir", () => {
    expect(result.output).toContain(
      "Dry run only. Nothing was changed or pushed.",
    );
    expect(fs.existsSync(path.join(dest(), "plugins/slow-powers"))).toBe(false);
  });
});

describe("apply guards", () => {
  test("dirty local checkout aborts before creating a sync branch", () => {
    const upstream = path.join(testRoot, "dirty-upstream");
    initRepo(upstream);
    writeUpstreamFixture(upstream);

    const dest = path.join(testRoot, "dirty-apply-destination");
    initRepo(dest);
    writeSyncedDestinationFixture(dest);
    git(dest, "checkout", "-q", "-b", "fixture/dirty-apply-target");
    const skill = path.join(
      dest,
      "plugins/slow-powers/skills/example/SKILL.md",
    );
    write(skill, "# Example Skill\n\nLocally modified fixture content.\n");

    const result = runSync(upstream, ["-y", "--local", dest]);

    expect(result.status).toBe(1);
    expect(result.output).toContain(
      "ERROR: local checkout has uncommitted changes under 'plugins/slow-powers'",
    );
    expect(currentBranch(dest)).toBe("fixture/dirty-apply-target");
    expect(syncBranches(dest)).toBe("");
    expect(fs.readFileSync(skill, "utf8")).toContain(
      "Locally modified fixture content.",
    );
  });

  test("clean no-op apply reports no changes and preserves OpenAI metadata", () => {
    const upstream = path.join(testRoot, "noop-upstream");
    initRepo(upstream);
    writeUpstreamFixture(upstream);

    const dest = path.join(testRoot, "noop-apply-destination");
    initRepo(dest);
    writeSyncedDestinationFixture(dest);
    git(dest, "checkout", "-q", "-b", "fixture/noop-apply-target");

    const result = runSync(upstream, ["-y", "--local", dest]);

    expect(result.status).toBe(0);
    expect(result.output).toContain(
      "No changes — embedded plugin was already in sync with upstream",
    );
    expect(currentBranch(dest)).toBe("fixture/noop-apply-target");
    const yaml = fs.readFileSync(
      path.join(dest, "plugins/slow-powers/skills/example/agents/openai.yaml"),
      "utf8",
    );
    expect(yaml).toBe(OPENAI_YAML);
  });
});

describe("manifest guard", () => {
  test("missing committed Codex manifest aborts with an error", () => {
    const upstream = path.join(testRoot, "no-manifest-upstream");
    initRepo(upstream);
    writeUpstreamFixture(upstream);
    fs.rmSync(path.join(upstream, ".codex-plugin/plugin.json"));

    const dest = path.join(testRoot, "no-manifest-destination");
    initRepo(dest);
    writeDestinationFixture(dest);

    const result = runSync(upstream, ["-n", "--local", dest]);

    expect(result.status).toBe(1);
    expect(result.output).toContain(
      "ERROR: committed Codex manifest missing at",
    );
  });
});
