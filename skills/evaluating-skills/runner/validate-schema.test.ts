import { describe, expect, test } from "bun:test";
import { validateAgainstSchema } from "./validate-schema";

const validRunRecord = {
  eval_id: "e1",
  condition: "with_skill",
  skill_path: null,
  prompt: "do the thing",
  files: [],
  final_message: "done",
  tool_invocations: [],
  total_tokens: 100,
  duration_ms: 1000,
};

describe("validateAgainstSchema", () => {
  test("returns the data when it matches the run-record schema", () => {
    const result = validateAgainstSchema(
      "run-record",
      validRunRecord,
      "run.json",
    );
    expect(result).toEqual(validRunRecord);
  });

  test("accepts an empty tool_invocations array (written pre-fill)", () => {
    expect(() =>
      validateAgainstSchema(
        "run-record",
        { ...validRunRecord, tool_invocations: [] },
        "run.json",
      ),
    ).not.toThrow();
  });

  test("accepts skill_path: null on the without_skill arm", () => {
    expect(() =>
      validateAgainstSchema(
        "run-record",
        { ...validRunRecord, skill_path: null },
        "run.json",
      ),
    ).not.toThrow();
  });

  test("throws a source-prefixed error when a required field is missing", () => {
    const { eval_id, ...missing } = validRunRecord;
    expect(() =>
      validateAgainstSchema("run-record", missing, "/tmp/run.json"),
    ).toThrow(/\/tmp\/run\.json/);
  });

  test("requires skill_path and files (type is the contract)", () => {
    const { skill_path, ...noSkillPath } = validRunRecord;
    expect(() =>
      validateAgainstSchema("run-record", noSkillPath, "run.json"),
    ).toThrow(/skill_path/);

    const { files, ...noFiles } = validRunRecord;
    expect(() =>
      validateAgainstSchema("run-record", noFiles, "run.json"),
    ).toThrow(/files/);
  });

  test("rejects a run record with an unknown extra property", () => {
    expect(() =>
      validateAgainstSchema(
        "run-record",
        { ...validRunRecord, surprise: true },
        "run.json",
      ),
    ).toThrow();
  });

  test("validates a tool_invocation's ordinal must be an integer", () => {
    expect(() =>
      validateAgainstSchema(
        "run-record",
        {
          ...validRunRecord,
          tool_invocations: [{ name: "Bash", ordinal: "zero" }],
        },
        "run.json",
      ),
    ).toThrow();
  });

  test("compiles and validates the grading schema too", () => {
    const validGrading = {
      assertion_results: [
        { id: "a1", passed: true, evidence: "quote", grader: "llm_judge" },
      ],
      summary: { passed: 1, failed: 0, total: 1, pass_rate: 1 },
    };
    expect(() =>
      validateAgainstSchema("grading", validGrading, "grading.json"),
    ).not.toThrow();
  });
});
