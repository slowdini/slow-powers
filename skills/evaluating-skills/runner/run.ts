#!/usr/bin/env bun
import { randomBytes } from "node:crypto";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { renderAvailableSkillsBlock } from "./adapters/claude-code-session";
import { detectRunContext, type RunContext } from "./context";
import { installGuard, teardownGuard } from "./guard/install";
import type {
  AvailableSkill,
  ConditionsRecord,
  Eval,
  EvalsConfig,
} from "./types";
import { validateEvalsConfig } from "./validate";

export const STAGED_SKILL_PREFIX = "slow-powers-eval-";
export const STAGED_SIBLING_MANIFEST = ".slow-powers-eval-manifest.json";

export function stageSkillForCC(opts: {
  content: string;
  iteration: number;
  condition: string;
  skillName: string;
  repoRoot: string;
  /**
   * When set, stage under this verbatim identifier instead of the conspicuous
   * `slow-powers-eval-…` slug. Used by `--stage-name` to A/B a natural name
   * against the eval-flagged one (issue #144 Step 2). A custom name is not
   * caught by `cleanupStagedSkills`'s prefix scan, so the caller must also call
   * `registerStagedSkillForCleanup` to have it removed on the next run.
   */
  stageNameOverride?: string;
}): string {
  const slug =
    opts.stageNameOverride ??
    `${STAGED_SKILL_PREFIX}${opts.iteration}-${opts.condition}__${opts.skillName}`;
  const skillDir = join(opts.repoRoot, ".claude", "skills", slug);
  mkdirSync(skillDir, { recursive: true });
  writeFileSync(join(skillDir, "SKILL.md"), opts.content);
  return slug;
}

/**
 * Adds a custom-named staged skill dir (one created via `stageNameOverride`) to
 * the sibling manifest's `created_entries` so the next run's
 * `cleanupStagedSkills` removes it — the prefix scan only catches
 * `slow-powers-eval-…` names. Idempotent: a name already recorded is left alone.
 */
export function registerStagedSkillForCleanup(
  repoRoot: string,
  name: string,
): void {
  const skillsDir = join(repoRoot, ".claude", "skills");
  const manifestPath = join(skillsDir, STAGED_SIBLING_MANIFEST);
  let manifest: SiblingManifest;
  if (existsSync(manifestPath)) {
    manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  } else {
    manifest = {
      created_at: new Date().toISOString(),
      staged_under_test: name,
      created_entries: [],
    };
  }
  if (manifest.created_entries.some((e) => e.name === name)) return;
  manifest.created_entries.push({ name, preexisting: false });
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

type SiblingManifest = {
  created_at: string;
  staged_under_test: string;
  created_entries: Array<{
    name: string;
    preexisting: boolean;
    backup_path?: string;
  }>;
};

export function stageSiblingSkills(opts: {
  skillUnderTest: string;
  skillsSourceDir: string;
  repoRoot: string;
}): SiblingManifest {
  const skillsDir = join(opts.repoRoot, ".claude", "skills");
  mkdirSync(skillsDir, { recursive: true });

  const siblings = readdirSync(opts.skillsSourceDir).filter((name) => {
    if (name === opts.skillUnderTest) return false;
    const srcDir = join(opts.skillsSourceDir, name);
    if (!statSync(srcDir).isDirectory()) return false;
    return existsSync(join(srcDir, "SKILL.md"));
  });

  const manifest: SiblingManifest = {
    created_at: new Date().toISOString(),
    staged_under_test: opts.skillUnderTest,
    created_entries: [],
  };

  for (const name of siblings) {
    const srcDir = join(opts.skillsSourceDir, name);
    const dstDir = join(skillsDir, name);
    const evalsSubdir = join(srcDir, "evals");

    const entry: SiblingManifest["created_entries"][number] = {
      name,
      preexisting: false,
    };

    if (existsSync(dstDir)) {
      entry.preexisting = true;
      const backupRoot = mkdtempSync(
        join(tmpdir(), "slow-powers-eval-backup-"),
      );
      entry.backup_path = join(backupRoot, name);
      cpSync(dstDir, entry.backup_path, { recursive: true });
      rmSync(dstDir, { recursive: true, force: true });
    }

    cpSync(srcDir, dstDir, {
      recursive: true,
      filter: (src) =>
        src !== evalsSubdir && !src.startsWith(`${evalsSubdir}/`),
    });

    manifest.created_entries.push(entry);
  }

  writeFileSync(
    join(skillsDir, STAGED_SIBLING_MANIFEST),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  return manifest;
}

export function cleanupStagedSkills(repoRoot: string): void {
  const skillsDir = join(repoRoot, ".claude", "skills");
  if (!existsSync(skillsDir)) return;

  for (const entry of readdirSync(skillsDir)) {
    if (!entry.startsWith(STAGED_SKILL_PREFIX)) continue;
    rmSync(join(skillsDir, entry), { recursive: true, force: true });
  }

  const manifestPath = join(skillsDir, STAGED_SIBLING_MANIFEST);
  if (!existsSync(manifestPath)) return;
  let manifest: SiblingManifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch {
    rmSync(manifestPath, { force: true });
    return;
  }
  for (const e of manifest.created_entries) {
    const target = join(skillsDir, e.name);
    rmSync(target, { recursive: true, force: true });
    if (e.preexisting && e.backup_path && existsSync(e.backup_path)) {
      cpSync(e.backup_path, target, { recursive: true });
      rmSync(dirname(e.backup_path), { recursive: true, force: true });
    }
  }
  rmSync(manifestPath, { force: true });
}

type Mode = "new-skill" | "revision";

type Args = {
  command: "run" | "snapshot" | "teardown-guard";
  mode?: Mode;
  baseline?: string;
  label?: string;
  iteration?: number;
  only?: string[];
  skip?: string[];
  dryRun: boolean;
  noStage: boolean;
  guard: boolean;
  stageName?: string;
};

function die(msg: string): never {
  console.error(`error: ${msg}`);
  process.exit(1);
}

function parseArgs(argv: string[]): Args {
  const positionals = argv.filter((a) => !a.startsWith("--"));
  const command: Args["command"] =
    positionals[0] === "snapshot"
      ? "snapshot"
      : positionals[0] === "teardown-guard"
        ? "teardown-guard"
        : "run";

  const flag = (name: string): string | undefined => {
    const i = argv.indexOf(`--${name}`);
    if (i === -1) return undefined;
    const v = argv[i + 1];
    if (v === undefined || v.startsWith("--")) {
      die(`flag --${name} requires a value`);
    }
    return v;
  };

  const has = (name: string) => argv.includes(`--${name}`);

  const iterationFlag = flag("iteration");
  const iteration =
    iterationFlag !== undefined ? Number(iterationFlag) : undefined;
  if (iteration !== undefined && !Number.isInteger(iteration))
    die(`--iteration must be an integer, got ${iterationFlag}`);

  const parseIdList = (v: string | undefined): string[] | undefined =>
    v === undefined
      ? undefined
      : v
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);

  return {
    command,
    mode: flag("mode") as Mode | undefined,
    baseline: flag("baseline"),
    label: flag("label"),
    iteration,
    only: parseIdList(flag("only")),
    skip: parseIdList(flag("skip")),
    dryRun: has("dry-run"),
    noStage: has("no-stage"),
    guard: has("guard"),
    stageName: flag("stage-name"),
  };
}

function ensureDir(path: string): void {
  if (!existsSync(path)) mkdirSync(path, { recursive: true });
}

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8"));
}

function nextIteration(workspaceSkillDir: string, override?: number): number {
  if (override !== undefined) return override;
  if (!existsSync(workspaceSkillDir)) return 1;
  const entries = readdirSync(workspaceSkillDir).filter((e) =>
    e.startsWith("iteration-"),
  );
  if (entries.length === 0) return 1;
  const nums = entries
    .map((e) => Number(e.slice("iteration-".length)))
    .filter((n) => Number.isFinite(n));
  return Math.max(...nums, 0) + 1;
}

function conditionNamesFor(mode: Mode): [string, string] {
  return mode === "new-skill"
    ? ["with_skill", "without_skill"]
    : ["old_skill", "new_skill"];
}

function commandSnapshot(args: Args, ctx: RunContext): void {
  if (!args.label) die("snapshot requires --label <name>");
  const skillDir = ctx.skillSubdir;
  const skillMd = join(skillDir, "SKILL.md");
  if (!existsSync(skillMd)) die(`skill not found: ${skillMd}`);

  const destDir = join(
    ctx.workspaceRoot,
    ctx.skillName,
    "snapshots",
    args.label,
  );
  if (existsSync(destDir))
    die(
      `snapshot already exists: ${destDir}\n` +
        "  Use a different --label or delete the existing snapshot first.",
    );
  ensureDir(destDir);

  cpSync(skillMd, join(destDir, "SKILL.md"));
  for (const entry of readdirSync(skillDir)) {
    if (entry === "SKILL.md" || entry === "evals") continue;
    const src = join(skillDir, entry);
    const dst = join(destDir, entry);
    if (statSync(src).isDirectory()) cpSync(src, dst, { recursive: true });
    else cpSync(src, dst);
  }

  console.log(`Snapshotted ${ctx.skillName} → ${destDir}`);
}

function commandRun(args: Args, ctx: RunContext): void {
  if (!args.mode) die("--mode required: new-skill | revision");
  if (args.mode !== "new-skill" && args.mode !== "revision")
    die(`unknown --mode: ${args.mode}`);
  if (args.mode === "revision" && !args.baseline)
    die("revision mode requires --baseline <label>");

  const skillDir = ctx.skillSubdir;
  const skillMd = join(skillDir, "SKILL.md");
  if (!existsSync(skillMd)) die(`skill not found: ${skillMd}`);

  const evalsPath = join(skillDir, "evals", "evals.json");
  if (!existsSync(evalsPath)) die(`evals.json not found: ${evalsPath}`);

  const config: EvalsConfig = validateEvalsConfig(
    readJson(evalsPath),
    evalsPath,
  );
  if (config.skill_name !== ctx.skillName)
    console.warn(
      `warning: evals.json skill_name (${config.skill_name}) does not match the skill folder (${ctx.skillName}). Proceeding with ${ctx.skillName}.`,
    );

  let selectedEvals: Eval[];
  try {
    selectedEvals = selectEvals(config.evals, {
      only: args.only,
      skip: args.skip,
    });
  } catch (err) {
    die(err instanceof Error ? err.message : String(err));
  }

  const workspaceSkillDir = join(ctx.workspaceRoot, ctx.skillName);
  const iteration = nextIteration(workspaceSkillDir, args.iteration);
  const iterationDir = join(workspaceSkillDir, `iteration-${iteration}`);

  // A per-run nonce makes each dispatch description globally unique. The
  // subagents dir is shared across iterations of one parent session, so a bare
  // `<eval>:<condition>` description repeats and fill-transcripts could fill an
  // iteration's run from a colliding agent in another iteration. `i<N>-<nonce>`
  // also disambiguates re-running the same iteration number.
  const runNonce = `${Date.now().toString(36)}-${randomBytes(3).toString("hex")}`;
  const runTag = `i${iteration}-${runNonce}`;

  if (existsSync(iterationDir) && args.iteration === undefined)
    die(
      `iteration-${iteration} already exists; pass --iteration to overwrite explicitly`,
    );

  const [conditionA, conditionB] = conditionNamesFor(args.mode);

  let skillPathForA: string | null;
  let skillPathForB: string | null;
  if (args.mode === "new-skill") {
    skillPathForA = skillMd;
    skillPathForB = null;
  } else {
    const baselineSkill = join(
      workspaceSkillDir,
      "snapshots",
      args.baseline as string,
      "SKILL.md",
    );
    if (!existsSync(baselineSkill))
      die(
        `baseline snapshot not found: ${baselineSkill}\n` +
          `  Run: bun run evals:snapshot --skill ${ctx.skillName} --skill-dir ${ctx.skillDir} --label ${args.baseline} (before editing)`,
      );
    skillPathForA = baselineSkill;
    skillPathForB = skillMd;
  }

  console.log(
    `Preparing ${ctx.skillName} iteration-${iteration} (${args.mode})`,
  );
  console.log(`  ${conditionA}: ${skillPathForA ?? "(no skill)"}`);
  console.log(`  ${conditionB}: ${skillPathForB ?? "(no skill)"}`);
  if (selectedEvals.length !== config.evals.length) {
    const [flagName, ids] = args.only
      ? ["--only", args.only]
      : ["--skip", args.skip ?? []];
    console.log(
      `  selection: ${selectedEvals.length} of ${config.evals.length} evals (${flagName} ${ids.join(", ")})`,
    );
  }
  if (args.noStage)
    console.log(
      "  staging: disabled (--no-stage) — skills will be inlined into dispatch_prompt for harnesses without project-local skill discovery",
    );

  ensureDir(iterationDir);
  cpSync(skillMd, join(iterationDir, "skill-snapshot.md"));

  // Always disarm a prior run's guard before re-staging, so a crashed run can't
  // leave the write-blocking hook armed across runs.
  teardownGuard(ctx.stageRoot);

  if (!args.noStage) cleanupStagedSkills(ctx.stageRoot);

  if (!args.noStage) {
    stageSiblingSkills({
      skillUnderTest: ctx.skillName,
      skillsSourceDir: ctx.skillDir,
      repoRoot: ctx.stageRoot,
    });
  }

  const bootstrapContent =
    ctx.bootstrapPath !== null ? readFileSync(ctx.bootstrapPath, "utf8") : null;

  // Sibling skill metadata, shared across conditions. Empty when --no-stage
  // (nothing is staged, so nothing is discoverable to list).
  const siblingSkills: AvailableSkill[] = args.noStage
    ? []
    : ctx.siblingSkillNames.map((name) => {
        const p = join(ctx.skillDir, name, "SKILL.md");
        return { name, path: p, description: getSkillDescription(p) };
      });

  // `--stage-name` overrides the conspicuous `slow-powers-eval-…` slug with a
  // verbatim name (issue #144 Step 2: A/B a natural name against the eval slug).
  // It targets the single staging condition, so reject the case where both
  // conditions stage (e.g. revision mode) — one name can't cover two dirs — and
  // refuse to clobber a dir that already exists (a real project skill the user
  // owns; cleanup has already removed our own prior custom dirs by this point).
  if (args.stageName !== undefined && !args.noStage) {
    if (skillPathForA !== null && skillPathForB !== null) {
      die(
        "--stage-name is only supported when exactly one condition stages the skill (e.g. --mode new-skill); both conditions stage here.",
      );
    }
    const target = join(ctx.stageRoot, ".claude", "skills", args.stageName);
    if (existsSync(target)) {
      die(
        `--stage-name "${args.stageName}": ${target} already exists; refusing to clobber it. Remove it or choose a different name.`,
      );
    }
  }

  const stageFor = (
    condName: string,
    condSkillPath: string | null,
  ): string | null => {
    if (!condSkillPath || args.noStage) return null;
    return stageSkillForCC({
      content: readFileSync(condSkillPath, "utf8"),
      iteration,
      condition: condName,
      skillName: ctx.skillName,
      repoRoot: ctx.stageRoot,
      stageNameOverride: args.stageName,
    });
  };

  const conditionASlug = stageFor(conditionA, skillPathForA);
  const conditionBSlug = stageFor(conditionB, skillPathForB);

  // A custom-named dir isn't caught by cleanupStagedSkills's prefix scan; record
  // it in the sibling manifest so the next run removes it.
  if (
    args.stageName !== undefined &&
    (conditionASlug === args.stageName || conditionBSlug === args.stageName)
  ) {
    registerStagedSkillForCleanup(ctx.stageRoot, args.stageName);
  }

  const conditions: ConditionsRecord = {
    mode: args.mode,
    baseline: args.baseline,
    conditions: [
      {
        name: conditionA,
        skill_path: skillPathForA,
        staged_skill_slug: conditionASlug,
      },
      {
        name: conditionB,
        skill_path: skillPathForB,
        staged_skill_slug: conditionBSlug,
      },
    ],
    timestamp: new Date().toISOString(),
    harness: ctx.harness,
    run_nonce: runNonce,
  };
  writeJson(join(iterationDir, "conditions.json"), conditions);

  // availableSkills for a condition = siblings + the skill-under-test when
  // that condition loads it. Empty when nothing was staged.
  const availableSkillsFor = (
    condSkillPath: string | null,
  ): AvailableSkill[] => {
    if (args.noStage) return [];
    const skills = [...siblingSkills];
    if (condSkillPath) {
      skills.push({
        name: ctx.skillName,
        path: condSkillPath,
        description: getSkillDescription(condSkillPath),
      });
    }
    return skills;
  };

  const tasks: DispatchTask[] = [];
  for (const ev of selectedEvals) {
    const evalDir = join(iterationDir, `eval-${ev.id}`);
    ensureDir(evalDir);

    for (const [condName, condSkillPath, condSlug] of [
      [conditionA, skillPathForA, conditionASlug],
      [conditionB, skillPathForB, conditionBSlug],
    ] as const) {
      const condDir = join(evalDir, condName);
      const outputsDir = join(condDir, "outputs");
      ensureDir(outputsDir);

      const fixtures = copyFixtures(ev, skillDir, condDir);
      tasks.push(
        buildDispatchTask({
          evalId: ev.id,
          condition: condName,
          skillPath: condSkillPath,
          stagedSkillSlug: condSlug,
          userPrompt: ev.prompt,
          fixtures,
          outputsDir,
          condDir,
          bootstrapContent,
          skillName: ctx.skillName,
          availableSkills: availableSkillsFor(condSkillPath),
          runTag,
        }),
      );
    }
  }

  const manifestPath = join(iterationDir, "dispatch-manifest.md");
  writeFileSync(
    manifestPath,
    buildManifest({
      skillName: ctx.skillName,
      mode: args.mode,
      baseline: args.baseline,
      iteration,
      tasks,
    }),
  );

  // Write each prompt to its own file and reference it by path in dispatch.json.
  // The orchestrator then dispatches with a short "read this file" prompt instead
  // of reproducing the full prompt verbatim per Task call.
  for (const task of tasks) {
    writeFileSync(task.dispatch_prompt_path, task.dispatch_prompt);
  }

  const dispatchJsonPath = join(iterationDir, "dispatch.json");
  writeJson(dispatchJsonPath, {
    skill_name: ctx.skillName,
    iteration,
    run_nonce: runNonce,
    iteration_dir: iterationDir,
    mode: args.mode,
    baseline: args.baseline ?? null,
    conditions: conditions.conditions,
    harness: ctx.harness,
    tasks: tasks.map(({ dispatch_prompt: _omit, ...rest }) => rest),
  });

  // Opt-in hard guard. Stages a PreToolUse hook that blocks subagent
  // writes/installs outside the eval sandbox while dispatches run.
  if (args.guard && !args.dryRun) {
    if (args.noStage) {
      console.warn(
        "\n⚠ --guard requires staging enabled; skipping guard install.",
      );
    } else {
      const guardScriptPath = join(import.meta.dir, "guard", "guard.ts");
      installGuard({
        stageRoot: ctx.stageRoot,
        workspaceRoot: ctx.workspaceRoot,
        guardScriptPath,
      });
      console.log(
        "\n🛡 Write guard armed: a PreToolUse hook is staged in .claude/settings.local.json\n" +
          "   and will block writes/installs outside the eval sandbox during dispatches.\n" +
          "   It auto-expires in 6h and is removed on the next run; to remove it now:\n" +
          "     bun run evals:teardown-guard --skill <name>",
      );
    }
  }

  console.log(`\nWorkspace prepared: ${iterationDir}`);
  console.log(`Dispatch manifest:  ${manifestPath}`);
  console.log(`Dispatch tasks:     ${dispatchJsonPath}`);
  console.log(
    `\n${tasks.length} dispatches required (${selectedEvals.length} evals × 2 conditions).`,
  );

  if (args.dryRun) console.log("\n--dry-run: stopping after workspace prep.");
  else
    console.log(
      "\nNext: read dispatch.json, dispatch each task as a subagent, write run.json + timing.json to the paths in each task.",
    );
}

type DispatchTask = {
  eval_id: string;
  condition: string;
  skill_path: string | null;
  staged_skill_slug: string | null;
  user_prompt: string;
  fixtures: string[];
  outputs_dir: string;
  run_record_path: string;
  timing_path: string;
  agent_description: string;
  /**
   * Absolute path to the file holding the full dispatch prompt. The orchestrator
   * dispatches each subagent with a short "read this file and follow it" prompt
   * rather than inlining the prompt, so it never has to reproduce ~KB of text per
   * Task call. `dispatch_prompt` carries the same text in-memory (for manifest
   * building and unit tests) but is stripped from the serialized dispatch.json.
   */
  dispatch_prompt_path: string;
  dispatch_prompt: string;
};

export type { AvailableSkill } from "./types";

/**
 * Filters the eval list to the subset requested via `--only` / `--skip`. The
 * two flags are mutually exclusive. Every requested id must exist in the config,
 * so a typo'd id is caught up front rather than silently producing an empty or
 * surprising run. Throws on invalid input; the caller routes the message to
 * `die`. `--only` preserves the config's eval order, not the order ids were
 * passed.
 */
export function selectEvals(
  evals: Eval[],
  opts: { only?: string[]; skip?: string[] },
): Eval[] {
  if (opts.only && opts.skip)
    throw new Error("use only one of --only / --skip, not both");
  const requested = opts.only ?? opts.skip;
  if (requested === undefined) return evals;
  if (requested.length === 0)
    throw new Error("--only/--skip requires at least one eval id");

  const known = new Set(evals.map((e) => e.id));
  const unknown = requested.filter((id) => !known.has(id));
  if (unknown.length)
    throw new Error(
      `unknown eval id(s): ${unknown.join(", ")}. ` +
        `Available ids: ${[...known].join(", ")}`,
    );

  const set = new Set(requested);
  return opts.only
    ? evals.filter((e) => set.has(e.id))
    : evals.filter((e) => !set.has(e.id));
}

function copyFixtures(ev: Eval, skillDir: string, condDir: string): string[] {
  if (!ev.files || ev.files.length === 0) return [];
  const inputsDir = join(condDir, "inputs");
  ensureDir(inputsDir);
  const copied: string[] = [];
  for (const f of ev.files) {
    const src = join(skillDir, "evals", f);
    if (!existsSync(src)) die(`fixture not found: ${src}`);
    const dst = join(inputsDir, basename(f));
    if (statSync(src).isDirectory()) cpSync(src, dst, { recursive: true });
    else cpSync(src, dst);
    copied.push(dst);
  }
  return copied;
}

function getSkillDescription(skillPath: string): string {
  try {
    const content = readFileSync(skillPath, "utf8");
    const match = content.match(/description:\s*([^\n\r]+)/);
    if (match) {
      let desc = match[1].trim();
      if (
        (desc.startsWith('"') && desc.endsWith('"')) ||
        (desc.startsWith("'") && desc.endsWith("'"))
      ) {
        desc = desc.slice(1, -1).trim();
      }
      return desc;
    }
  } catch {}
  return "No description available.";
}

/**
 * Removes the skill-under-test's "Active Skills Directory" entry from bootstrap
 * content so a skill-absent condition (e.g. `without_skill`) carries no
 * reference to it. Targets the markdown list-item block: a top-level `*`/`-`
 * bullet whose backticked name equals `skillName`, plus its indented
 * continuation lines (the `*Trigger:*` sub-bullet). Sibling entries and the
 * heading are left intact. The eval bootstrap names skills only in that
 * directory, so this is the sole reference vector to scrub.
 */
export function redactSkillFromBootstrap(
  content: string,
  skillName: string,
): string {
  const out: string[] = [];
  let skipping = false;
  for (const line of content.split("\n")) {
    if (skipping) {
      // Indented continuation lines belong to the entry being dropped.
      if (/^\s+\S/.test(line)) continue;
      skipping = false;
    }
    if (/^[*-]\s/.test(line) && line.includes(`\`${skillName}\``)) {
      skipping = true;
      continue;
    }
    out.push(line);
  }
  return out.join("\n");
}

export function buildDispatchTask(opts: {
  evalId: string;
  condition: string;
  skillPath: string | null;
  stagedSkillSlug: string | null;
  userPrompt: string;
  fixtures: string[];
  outputsDir: string;
  condDir: string;
  bootstrapContent: string | null;
  skillName: string;
  availableSkills: AvailableSkill[];
  /**
   * Per-run uniqueness suffix (`i<iteration>-<nonce>`). Appended to the
   * dispatch description so transcripts can't collide across iterations or
   * re-runs. Omitted in unit tests that exercise prompt assembly directly.
   */
  runTag?: string;
}): DispatchTask {
  const stagedSkills = [...opts.availableSkills].sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  let skillBlock: string;
  if (opts.stagedSkillSlug) {
    // Neutral slug disambiguation only — no imperative to invoke. The slug is
    // surfaced so a deliberate invocation targets the staged version (a bare
    // name would resolve to the globally-installed plugin copy), but whether to
    // invoke is left to the skill's own triggering. Removing the old "invoke
    // that slug ... if the skill applies" directive is the fix for the issue
    // #119 invocation ceiling.
    skillBlock = [
      "Your environment has the slow-powers plugin loaded; its skills are discoverable via the Skill tool.",
      `The \`${opts.skillName}\` skill is registered under the identifier \`${opts.stagedSkillSlug}\`. If you invoke it, use that identifier rather than the bare name.`,
    ].join("\n");
  } else if (opts.skillPath) {
    skillBlock = [
      "The following skill is loaded into your operating guidelines. Apply it where relevant to the user's request.",
      "",
      `<skill name="${basename(dirname(opts.skillPath))}">`,
      readFileSync(opts.skillPath, "utf8").trim(),
      "</skill>",
    ].join("\n");
  } else if (stagedSkills.length > 0 || opts.bootstrapContent) {
    // Skill-absent arm in a realistic environment: stay silent. The
    // available-skills block already omits the skill-under-test, so any
    // commentary here would only announce the eval (and, in the control arm,
    // draw attention to the very skill that is supposed to be absent).
    skillBlock = "";
  } else {
    skillBlock = "No skill is loaded. Respond as you naturally would.";
  }

  const fixturesBlock = opts.fixtures.length
    ? `Available fixture files:\n${opts.fixtures.map((f) => `  - ${f}`).join("\n")}`
    : "Available fixture files: none";

  // A dispatch mirrors a real session by carrying two *separate* surfaces, the
  // way the harness actually delivers them:
  //   1. The verbatim --bootstrap file (the SessionStart-hook equivalent),
  //      wrapped in <session-start-context>, if supplied.
  //   2. The list of discoverable skills, rendered in the harness's native
  //      presentation as its own block (see adapters/claude-code-session.ts).
  // A condition that does not load the skill-under-test (the new-skill
  // `without_skill` arm, under staging or --no-stage) must carry zero reference
  // to it. The skill-under-test is auto-omitted from the available-skills block
  // (see `availableSkillsFor`). redactSkillFromBootstrap covers the other path:
  // a *user-supplied* --bootstrap that names the skill in its own prose would
  // otherwise leak it into the control arm. (The shipped bootstrap.md no longer
  // enumerates skills, so that redaction is a no-op against it.)
  const skillAbsent = !opts.skillPath && !opts.stagedSkillSlug;
  const effectiveBootstrap =
    opts.bootstrapContent && skillAbsent
      ? redactSkillFromBootstrap(opts.bootstrapContent, opts.skillName)
      : opts.bootstrapContent;

  const sections: string[] = [];
  if (effectiveBootstrap) {
    sections.push(
      [
        "<session-start-context>",
        "The following guidelines were loaded at session start by the slow-powers plugin",
        "(equivalent to the SessionStart hook firing in a real user's environment):",
        "",
        effectiveBootstrap.trim(),
        "</session-start-context>",
        "",
      ].join("\n"),
    );
  }
  const availableSkillsBlock = renderAvailableSkillsBlock(stagedSkills);
  if (availableSkillsBlock) {
    sections.push(`${availableSkillsBlock}\n\n`);
  }
  const taskLines = [
    "You are executing a single test case for a skill evaluation framework.",
    "Treat this as a real user request — do NOT optimize behavior for the eval.",
  ];
  if (skillBlock) taskLines.push("", skillBlock);
  taskLines.push(
    "",
    fixturesBlock,
    `Output directory: ${opts.outputsDir}`,
    "",
    "Instructions:",
    "- Write any files you produce into the output directory.",
    `- After completing the task, write your final user-facing response to ${opts.outputsDir}/final-message.md.`,
    "- Do not write outside the output directory.",
    "",
    "User request:",
    opts.userPrompt,
  );
  sections.push(taskLines.join("\n"));

  return {
    eval_id: opts.evalId,
    condition: opts.condition,
    skill_path: opts.skillPath,
    staged_skill_slug: opts.stagedSkillSlug,
    user_prompt: opts.userPrompt,
    fixtures: opts.fixtures,
    outputs_dir: opts.outputsDir,
    run_record_path: join(opts.condDir, "run.json"),
    timing_path: join(opts.condDir, "timing.json"),
    agent_description: opts.runTag
      ? `${opts.evalId}:${opts.condition}:${opts.runTag}`
      : `${opts.evalId}:${opts.condition}`,
    dispatch_prompt_path: join(opts.condDir, "dispatch-prompt.txt"),
    dispatch_prompt: sections.join(""),
  };
}

function buildManifest(opts: {
  skillName: string;
  mode: Mode;
  baseline?: string;
  iteration: number;
  tasks: DispatchTask[];
}): string {
  const header = [
    `# Dispatch manifest — ${opts.skillName} iteration-${opts.iteration}`,
    "",
    `Mode: ${opts.mode}${opts.baseline ? ` (baseline: ${opts.baseline})` : ""}`,
    `Generated: ${new Date().toISOString()}`,
    `Total dispatches: ${opts.tasks.length}`,
    "",
    "## How to use this manifest",
    "",
    'In an agent session, read `dispatch.json` (sibling of this file) instead of this manifest. Each task has a `dispatch_prompt_path` field pointing at the file that holds the full prompt — dispatch the subagent with a short "read this file and follow it" instruction rather than inlining the prompt — plus exact paths for `run.json` and `timing.json`.',
    "",
    "**Transcript correlation:** Each task has an `agent_description` field of the form `<eval_id>:<condition>:i<N>-<nonce>`. When dispatching the subagent via the host's primitive (e.g. Claude Code's Agent tool), pass this string verbatim as the dispatch `description` — do not reconstruct it. The per-run nonce keeps descriptions unique across iterations sharing one session's subagents dir, so the transcript adapter correlates each subagent's persisted transcript back to the right `(eval, condition)` slot without collisions.",
    "",
    "After every dispatch:",
    "",
    "1. Write `run.json` matching `skills/evaluating-skills/schema/run-record.schema.json` (enforced at runtime by grade/fill-transcripts/detect-stray-writes). Carry over `eval_id`, `condition`, `skill_path` (`null` on the without_skill arm), `prompt`, and `files` from the task; populate `final_message` from the subagent's reply; leave `tool_invocations` as `[]` for now — `evals:fill-transcripts` will populate it from the persisted transcript in a later step.",
    "2. Capture `total_tokens` and `duration_ms` from the harness's task completion event into `timing.json`. These values may not be persisted anywhere else — save them immediately.",
    "",
    "After all dispatches:",
    "",
    "3. (Claude Code only, optional) Run `bun run evals:fill-transcripts --skill <name> --iteration <N> --subagents-dir ~/.claude/projects/<project-slug>/<parent-session-id>/subagents/` to fill `tool_invocations` from each subagent's persisted transcript. Skipping this step leaves `transcript_check` assertions unverifiable.",
    "4. Run `bun run evals:grade --skill <name> --iteration <N>` to grade.",
    "",
    "## Dispatches",
    "",
  ].join("\n");

  const entries = opts.tasks
    .map((t) =>
      [
        `### ${t.eval_id} / ${t.condition}`,
        "",
        `- run.json:    ${t.run_record_path}`,
        `- timing.json: ${t.timing_path}`,
        "",
        "```",
        t.dispatch_prompt,
        "```",
        "",
      ].join("\n"),
    )
    .join("\n");

  return header + entries;
}

if (import.meta.main) {
  const argv = Bun.argv.slice(2);
  const args = parseArgs(argv);
  let ctx: RunContext;
  try {
    ctx = detectRunContext(argv);
  } catch (err) {
    die(err instanceof Error ? err.message : String(err));
  }
  if (args.command === "snapshot") commandSnapshot(args, ctx);
  else if (args.command === "teardown-guard") {
    const torn = teardownGuard(ctx.stageRoot);
    console.log(
      torn
        ? "🛡 Write guard removed."
        : "No write guard was installed — nothing to remove.",
    );
  } else commandRun(args, ctx);
}
