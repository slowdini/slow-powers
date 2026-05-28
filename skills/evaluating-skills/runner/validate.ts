import type { EvalsConfig } from "./types";

export function validateEvalsConfig(
  config: unknown,
  source: string,
): EvalsConfig {
  const err = (msg: string): never => {
    throw new Error(`${source}: ${msg}`);
  };

  if (!config || typeof config !== "object") err("not an object");
  const c = config as Record<string, unknown>;

  if (typeof c.skill_name !== "string" || !c.skill_name)
    err("skill_name must be a non-empty string");

  if (!Array.isArray(c.evals)) err("evals must be an array");
  const evals = c.evals as unknown[];
  if (evals.length === 0) err("evals must not be empty");

  const seenIds = new Set<string>();
  for (const [i, raw] of evals.entries()) {
    if (!raw || typeof raw !== "object") err(`evals[${i}]: not an object`);
    const ev = raw as Record<string, unknown>;

    if (typeof ev.id !== "string" || !/^[a-z0-9][a-z0-9-]*$/.test(ev.id))
      err(`evals[${i}].id must be kebab-case`);
    if (seenIds.has(ev.id as string)) err(`evals[${i}].id duplicate: ${ev.id}`);
    seenIds.add(ev.id as string);

    if (typeof ev.prompt !== "string" || !ev.prompt.length)
      err(`evals[${i}].prompt must be a non-empty string`);

    if (typeof ev.expected_output !== "string" || !ev.expected_output.length)
      err(`evals[${i}].expected_output must be a non-empty string`);

    if (ev.files !== undefined) {
      if (!Array.isArray(ev.files)) err(`evals[${i}].files must be array`);
      for (const [j, f] of (ev.files as unknown[]).entries()) {
        if (typeof f !== "string")
          err(`evals[${i}].files[${j}] must be string`);
      }
    }

    if (
      ev.skill_should_trigger !== undefined &&
      typeof ev.skill_should_trigger !== "boolean"
    )
      err(`evals[${i}].skill_should_trigger must be a boolean`);

    if (ev.assertions !== undefined) {
      if (!Array.isArray(ev.assertions))
        err(`evals[${i}].assertions must be array`);
      for (const [j, a] of (ev.assertions as unknown[]).entries()) {
        validateAssertion(a, `evals[${i}].assertions[${j}]`, err);
      }
    }
  }

  return c as unknown as EvalsConfig;
}

function validateAssertion(
  a: unknown,
  path: string,
  err: (msg: string) => never,
): void {
  if (!a || typeof a !== "object") err(`${path}: not an object`);
  const obj = a as Record<string, unknown>;
  if (typeof obj.id !== "string" || !obj.id) err(`${path}.id missing`);
  if (obj.type === "transcript_check") {
    if (typeof obj.check !== "string" || !obj.check)
      err(`${path}.check missing`);
  } else if (obj.type === "llm_judge") {
    if (typeof obj.rubric !== "string" || !obj.rubric)
      err(`${path}.rubric missing`);
  } else {
    err(`${path}.type must be transcript_check or llm_judge`);
  }
}
