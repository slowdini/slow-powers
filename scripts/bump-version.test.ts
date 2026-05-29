import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { bumpFiles } from "./bump-version";

const FIXTURE_ROOT = join(tmpdir(), `slow-powers-bump-test-${process.pid}`);

beforeAll(() => {
  mkdirSync(FIXTURE_ROOT, { recursive: true });
});

afterAll(() => {
  rmSync(FIXTURE_ROOT, { recursive: true, force: true });
});

describe("bump-version bumpFiles", () => {
  test("updates the version and emits biome-canonical formatting (short arrays stay one line)", () => {
    // A manifest written the way bump-version USED to write it: short arrays
    // exploded one-element-per-line, the format biome would collapse.
    const file = join(FIXTURE_ROOT, "plugin.json");
    writeFileSync(
      file,
      [
        "{",
        '  "name": "demo",',
        '  "version": "0.0.1",',
        '  "capabilities": [',
        '    "Interactive",',
        '    "Read",',
        '    "Write"',
        "  ]",
        "}",
        "",
      ].join("\n"),
    );

    const updated = bumpFiles([file], "1.2.3");
    expect(updated).toEqual([file]);

    const content = readFileSync(file, "utf8");
    const parsed = JSON.parse(content) as {
      version: string;
      capabilities: string[];
    };

    // Version bumped.
    expect(parsed.version).toBe("1.2.3");
    expect(parsed.capabilities).toEqual(["Interactive", "Read", "Write"]);

    // Biome-canonical: the short array is collapsed onto a single line, so the
    // output no longer drifts against `biome check`.
    expect(content).toContain(
      '"capabilities": ["Interactive", "Read", "Write"]',
    );
    expect(content).toMatch(/\n$/);
  });

  test("bumps nested plugins[].version and skips files without a version field", () => {
    const marketplace = join(FIXTURE_ROOT, "marketplace.json");
    writeFileSync(
      marketplace,
      `${JSON.stringify({ plugins: [{ name: "p", version: "0.0.1" }] }, null, 2)}\n`,
    );
    const noVersion = join(FIXTURE_ROOT, "no-version.json");
    writeFileSync(noVersion, `${JSON.stringify({ name: "x" }, null, 2)}\n`);

    const updated = bumpFiles([marketplace, noVersion], "2.0.0");

    expect(updated).toEqual([marketplace]);
    const parsed = JSON.parse(readFileSync(marketplace, "utf8")) as {
      plugins: { version: string }[];
    };
    expect(parsed.plugins[0].version).toBe("2.0.0");
  });
});
