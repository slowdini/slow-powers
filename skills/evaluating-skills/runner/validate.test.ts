import { describe, expect, test } from "bun:test";
import { validateEvalsConfig } from "./validate";

const base = {
  skill_name: "demo",
  evals: [
    {
      id: "e1",
      prompt: "do the thing",
      expected_output: "the thing is done",
    },
  ],
};

describe("validateEvalsConfig skill_should_trigger", () => {
  test("accepts a boolean skill_should_trigger", () => {
    const cfg = {
      ...base,
      evals: [{ ...base.evals[0], skill_should_trigger: false }],
    };
    expect(() => validateEvalsConfig(cfg, "test")).not.toThrow();
  });

  test("accepts evals with no skill_should_trigger (defaults to true)", () => {
    expect(() => validateEvalsConfig(base, "test")).not.toThrow();
  });

  test("rejects a non-boolean skill_should_trigger", () => {
    const cfg = {
      ...base,
      evals: [{ ...base.evals[0], skill_should_trigger: "false" }],
    };
    expect(() => validateEvalsConfig(cfg, "test")).toThrow(
      /skill_should_trigger must be a boolean/,
    );
  });
});
