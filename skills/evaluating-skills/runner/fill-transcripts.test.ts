import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { resolveAgentDescription } from "./fill-transcripts";

const ROOT = join(tmpdir(), `fill-transcripts-test-${process.pid}`);

beforeAll(() => mkdirSync(ROOT, { recursive: true }));
afterAll(() => rmSync(ROOT, { recursive: true, force: true }));

function writeDispatch(iterationDir: string, tasks: unknown[]) {
  mkdirSync(iterationDir, { recursive: true });
  writeFileSync(
    join(iterationDir, "dispatch.json"),
    JSON.stringify({ run_nonce: "abc123", tasks }, null, 2),
  );
}

describe("resolveAgentDescription", () => {
  test("returns the namespaced agent_description from dispatch.json", () => {
    const dir = join(ROOT, "iter-canonical");
    writeDispatch(dir, [
      {
        eval_id: "crash",
        condition: "with_skill",
        agent_description: "crash:with_skill:i3-abc123",
      },
      {
        eval_id: "crash",
        condition: "without_skill",
        agent_description: "crash:without_skill:i3-abc123",
      },
    ]);
    expect(resolveAgentDescription(dir, "crash", "with_skill")).toBe(
      "crash:with_skill:i3-abc123",
    );
    expect(resolveAgentDescription(dir, "crash", "without_skill")).toBe(
      "crash:without_skill:i3-abc123",
    );
  });

  test("falls back to legacy reconstruction when dispatch.json is absent", () => {
    const dir = join(ROOT, "iter-no-dispatch");
    mkdirSync(dir, { recursive: true });
    expect(resolveAgentDescription(dir, "crash", "with_skill")).toBe(
      "crash:with_skill",
    );
  });

  test("falls back when the task is missing from dispatch.json", () => {
    const dir = join(ROOT, "iter-partial");
    writeDispatch(dir, [
      {
        eval_id: "other",
        condition: "with_skill",
        agent_description: "other:with_skill:i1-x",
      },
    ]);
    expect(resolveAgentDescription(dir, "crash", "with_skill")).toBe(
      "crash:with_skill",
    );
  });

  test("falls back when dispatch.json is malformed", () => {
    const dir = join(ROOT, "iter-malformed");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "dispatch.json"), "{ not valid json");
    expect(resolveAgentDescription(dir, "crash", "with_skill")).toBe(
      "crash:with_skill",
    );
  });
});
