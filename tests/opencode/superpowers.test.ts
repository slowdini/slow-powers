// Runtime behaviour of the OpenCode plugin (opencode/plugins/superpowers.js).
// The plugin stays JavaScript because OpenCode loads it directly; this suite
// exercises its logic. Ports the retired test-bootstrap-caching.mjs and the
// runtime/stale-path checks from test-plugin-loading.sh.
import { beforeEach, describe, expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { REPO_ROOT } from "../harness/spec";

const PLUGIN_FILE = path.join(REPO_ROOT, "opencode/plugins/superpowers.js");
const EXPECTED_SKILLS_DIR = path.join(REPO_ROOT, "skills");
const EXPECTED_BOOTSTRAP_PATH = path.join(REPO_ROOT, "bootstrap.md");
const BOOTSTRAP_MARKER = "You have superpowers";

type Scenario = "present" | "missing-file" | "missing-skills-dir";

interface OutputMessage {
  info: { role: string };
  parts: { type: string; text: string; [key: string]: unknown }[];
}
interface Output {
  messages: OutputMessage[];
}

function normalizePath(filePath: unknown): string {
  return String(filePath)
    .replaceAll("\\", "/")
    .replace(/^\/private/, "");
}

function makeOutput(
  text: string,
  firstPart: Record<string, unknown> = { type: "text", text },
): Output {
  return {
    messages: [{ info: { role: "user" }, parts: [firstPart as never] }],
  };
}

function countBootstrapParts(output: Output): number {
  return output.messages[0].parts.filter(
    (part) => part.type === "text" && part.text.includes(BOOTSTRAP_MARKER),
  ).length;
}

/**
 * Load a fresh copy of the plugin (resetting its module-level bootstrap cache)
 * and run config + transforms under instrumented fs, simulating the requested
 * scenario. Mirrors the per-process isolation the old .mjs relied on.
 */
async function runScenario(scenario: Scenario) {
  const originalExistsSync = fs.existsSync;
  const originalReadFileSync = fs.readFileSync;
  let existsCount = 0;
  let readCount = 0;

  fs.existsSync = ((p: fs.PathLike) => {
    const norm = normalizePath(p);
    if (norm === normalizePath(EXPECTED_BOOTSTRAP_PATH)) {
      existsCount += 1;
      if (scenario === "missing-file") return false;
    }
    if (
      norm === normalizePath(EXPECTED_SKILLS_DIR) &&
      scenario === "missing-skills-dir"
    ) {
      return false;
    }
    return originalExistsSync(p);
  }) as typeof fs.existsSync;

  fs.readFileSync = ((p: fs.PathOrFileDescriptor, ...rest: unknown[]) => {
    if (normalizePath(p) === normalizePath(EXPECTED_BOOTSTRAP_PATH))
      readCount += 1;
    // biome-ignore lint/suspicious/noExplicitAny: passthrough to original overloads
    return (originalReadFileSync as any)(p, ...rest);
  }) as typeof fs.readFileSync;

  // Import a fresh sibling copy so the plugin's module-level bootstrap cache
  // starts empty for each scenario (Bun dedupes imports by path, ignoring query
  // strings). The copy lives in the same directory so the plugin's `../../`
  // resolution still points at the repo root.
  const pluginSource = originalReadFileSync(PLUGIN_FILE, "utf8");
  const tmpPath = path.join(
    path.dirname(PLUGIN_FILE),
    `.superpowers.test.${scenario}.${randomUUID()}.mjs`,
  );
  fs.writeFileSync(tmpPath, pluginSource);

  try {
    const mod = await import(pathToFileURL(tmpPath).href);
    const plugin = await mod.SuperpowersPlugin({ client: {}, directory: "." });
    const config: { skills?: { paths?: string[] } } = {};
    await plugin.config(config);
    const transform = plugin["experimental.chat.messages.transform"];

    const firstOutput = makeOutput(`${scenario} first step`);
    await transform({}, firstOutput);
    const firstReadCount = readCount;
    const firstExistsCount = existsCount;

    const secondOutput = makeOutput(`${scenario} second step`);
    await transform({}, secondOutput);
    const secondReadCount = readCount;
    const secondExistsCount = existsCount;

    const sameOutput = makeOutput("user prompt mentions EXTREMELY_IMPORTANT", {
      type: "text",
      text: "user prompt mentions EXTREMELY_IMPORTANT",
      testOnlyField: "should-not-be-copied",
    });
    await transform({}, sameOutput);
    const sameOutputBootstrapPartsAfterFirst = countBootstrapParts(sameOutput);
    const sameOutputFirstPart = sameOutput.messages[0].parts[0];
    await transform({}, sameOutput);
    const sameOutputBootstrapPartsAfterSecond = countBootstrapParts(sameOutput);

    return {
      pluginSource,
      registeredSkillsPaths: config.skills?.paths ?? [],
      firstBootstrapParts: countBootstrapParts(firstOutput),
      secondBootstrapParts: countBootstrapParts(secondOutput),
      firstReadCount,
      secondReadCount,
      firstExistsCount,
      secondExistsCount,
      sameOutputBootstrapPartsAfterFirst,
      sameOutputBootstrapPartsAfterSecond,
      sameOutputFirstPartKeys: Object.keys(sameOutputFirstPart).sort(),
      sameOutputFirstPartText: sameOutputFirstPart.text,
      sameOutputFirstPartInheritedField: (
        sameOutputFirstPart as { testOnlyField?: unknown }
      ).testOnlyField,
    };
  } finally {
    fs.existsSync = originalExistsSync;
    fs.readFileSync = originalReadFileSync;
    fs.rmSync(tmpPath, { force: true });
  }
}

describe("OpenCode plugin runtime", () => {
  test("exports a SuperpowersPlugin factory exposing config + transform hooks", async () => {
    const mod = await import(`${pathToFileURL(PLUGIN_FILE).href}?probe=shape`);
    expect(typeof mod.SuperpowersPlugin).toBe("function");
    const plugin = await mod.SuperpowersPlugin({ client: {}, directory: "." });
    expect(typeof plugin.config).toBe("function");
    expect(typeof plugin["experimental.chat.messages.transform"]).toBe(
      "function",
    );
  });

  test("plugin source no longer references @slowdini/superslow-core/paths", () => {
    const source = fs.readFileSync(PLUGIN_FILE, "utf8");
    expect(source).not.toContain("@slowdini/superslow-core/paths");
  });

  test("plugin source does not advertise stale configDir skills paths", () => {
    const source = fs.readFileSync(PLUGIN_FILE, "utf8");
    expect(source).not.toMatch(/\$\{?_?configDir\}?\/skills\/superpowers\//);
    expect(source).not.toMatch(/\.config\/opencode\/skills\/superpowers\//);
  });

  describe("present: bootstrap.md and skills dir exist", () => {
    let r: Awaited<ReturnType<typeof runScenario>>;
    beforeEach(async () => {
      r = await runScenario("present");
    });

    test("config hook registers the bundled skills dir", () => {
      expect(r.registeredSkillsPaths.map(normalizePath)).toEqual(
        [EXPECTED_SKILLS_DIR].map(normalizePath),
      );
    });
    test("injects exactly one bootstrap part per fresh message array", () => {
      expect(r.firstBootstrapParts).toBe(1);
      expect(r.secondBootstrapParts).toBe(1);
    });
    test("reads bootstrap.md once, then serves it from cache", () => {
      expect(r.firstReadCount).toBe(1);
      expect(r.secondReadCount).toBe(r.firstReadCount);
      expect(r.secondExistsCount).toBe(r.firstExistsCount);
    });
    test("injects into a user prompt and stays idempotent on re-transform", () => {
      expect(r.sameOutputBootstrapPartsAfterFirst).toBe(1);
      expect(r.sameOutputBootstrapPartsAfterSecond).toBe(1);
    });
    test("injected part carries only type/text with bootstrap content", () => {
      expect(r.sameOutputFirstPartKeys).toEqual(["text", "type"]);
      expect(r.sameOutputFirstPartInheritedField).toBeUndefined();
      expect(r.sameOutputFirstPartText).toContain(BOOTSTRAP_MARKER);
    });
  });

  describe("missing-file: bootstrap.md absent", () => {
    let r: Awaited<ReturnType<typeof runScenario>>;
    beforeEach(async () => {
      r = await runScenario("missing-file");
    });

    test("still registers the skills dir", () => {
      expect(r.registeredSkillsPaths.map(normalizePath)).toEqual(
        [EXPECTED_SKILLS_DIR].map(normalizePath),
      );
    });
    test("injects no bootstrap and avoids reads", () => {
      expect(r.firstBootstrapParts).toBe(0);
      expect(r.secondBootstrapParts).toBe(0);
      expect(r.firstReadCount).toBe(0);
      expect(r.secondReadCount).toBe(0);
    });
    test("checks existence once, then caches the missing result", () => {
      expect(r.firstExistsCount).toBe(1);
      expect(r.secondExistsCount).toBe(r.firstExistsCount);
    });
  });

  describe("missing-skills-dir: skills directory absent", () => {
    test("config hook registers no skills paths", async () => {
      const r = await runScenario("missing-skills-dir");
      expect(r.registeredSkillsPaths).toEqual([]);
    });
  });
});
