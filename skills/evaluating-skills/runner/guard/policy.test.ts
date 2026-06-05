import { describe, expect, test } from "bun:test";
import { decide, type GuardMarker } from "./policy";

const ROOTS = ["/work/skills-workspace", "/work/.claude/skills"];
const future = () => new Date(Date.now() + 60_000).toISOString();
const past = () => new Date(Date.now() - 60_000).toISOString();

function marker(over: Partial<GuardMarker> = {}): GuardMarker {
  return { active: true, allowedRoots: ROOTS, expiresAt: future(), ...over };
}

describe("guard decide", () => {
  test("allows everything when marker is null (guard inactive)", () => {
    expect(decide("Write", { file_path: "/etc/passwd" }, null).allow).toBe(
      true,
    );
  });

  test("allows everything when marker is inactive or expired", () => {
    expect(
      decide("Write", { file_path: "/etc/passwd" }, marker({ active: false }))
        .allow,
    ).toBe(true);
    expect(
      decide(
        "Write",
        { file_path: "/etc/passwd" },
        marker({ expiresAt: past() }),
      ).allow,
    ).toBe(true);
  });

  test("allows a write under an allowed root", () => {
    expect(
      decide(
        "Write",
        { file_path: "/work/skills-workspace/x/outputs/a.md" },
        marker(),
      ).allow,
    ).toBe(true);
  });

  test("denies a write outside all allowed roots", () => {
    const d = decide("Edit", { file_path: "/work/runner/run.ts" }, marker());
    expect(d.allow).toBe(false);
    expect(d.reason).toMatch(/outside/i);
  });

  test("denies an install command", () => {
    const d = decide("Bash", { command: "npm install left-pad" }, marker());
    expect(d.allow).toBe(false);
    expect(d.reason).toMatch(/install/i);
  });

  test("allows a Bash command scoped to an allowed root", () => {
    expect(
      decide(
        "Bash",
        { command: "echo hi > /work/skills-workspace/x/outputs/log" },
        marker(),
      ).allow,
    ).toBe(true);
  });

  test("allows non-mutating Bash and read tools", () => {
    expect(decide("Bash", { command: "ls -la /" }, marker()).allow).toBe(true);
    expect(decide("Read", { file_path: "/etc/passwd" }, marker()).allow).toBe(
      true,
    );
  });

  test("denies git worktree add (working tree outside the sandbox)", () => {
    const d = decide(
      "Bash",
      { command: "git worktree add ../wt -b scratch" },
      marker(),
    );
    expect(d.allow).toBe(false);
    expect(d.reason).toMatch(/worktree/i);
  });

  test("denies Bash that creates a path under .claude via a non-redirect verb", () => {
    expect(
      decide("Bash", { command: "mkdir -p .claude/foo" }, marker()).allow,
    ).toBe(false);
    expect(
      decide("Bash", { command: "cp out.txt .claude/bar" }, marker()).allow,
    ).toBe(false);
  });

  test("denies Bash that creates a bare skills/ dir", () => {
    expect(decide("Bash", { command: "mkdir skills" }, marker()).allow).toBe(
      false,
    );
    expect(
      decide("Bash", { command: "cp -r src ./skills" }, marker()).allow,
    ).toBe(false);
  });

  test("still allows reads of .claude (no create verb)", () => {
    expect(
      decide("Bash", { command: "cat .claude/settings.json" }, marker()).allow,
    ).toBe(true);
    expect(decide("Bash", { command: "ls .claude" }, marker()).allow).toBe(
      true,
    );
  });

  test("allows a create scoped to the .claude/skills staging root (allowed-root escape)", () => {
    expect(
      decide(
        "Bash",
        { command: "mkdir -p /work/.claude/skills/staged-x" },
        marker(),
      ).allow,
    ).toBe(true);
  });

  test("does not flag skills-workspace as a bare skills/ write", () => {
    expect(
      decide(
        "Bash",
        { command: "mkdir -p /work/skills-workspace/x/outputs" },
        marker(),
      ).allow,
    ).toBe(true);
  });
});
