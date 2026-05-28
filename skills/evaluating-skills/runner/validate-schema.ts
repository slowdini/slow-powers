import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Ajv, type ValidateFunction } from "ajv";

/**
 * The four portable artifact schemas live in `../schema/<name>.schema.json` and
 * are the single source of truth for each artifact's shape. This helper compiles
 * them with ajv and enforces them at runtime, so the schema files are an enforced
 * contract rather than documentation a hand-rolled validator can drift from.
 */
export type SchemaName = "run-record" | "evals" | "grading" | "stray-writes";

const SCHEMA_DIR = join(import.meta.dir, "..", "schema");

// strict: false — the schemas are plain draft-07; we don't want ajv's strict
// metaschema checks to reject otherwise-valid schemas over stylistic keywords.
const ajv = new Ajv({ allErrors: true, strict: false });
const validators = new Map<SchemaName, ValidateFunction>();

function getValidator(name: SchemaName): ValidateFunction {
  let validate = validators.get(name);
  if (!validate) {
    const schema = JSON.parse(
      readFileSync(join(SCHEMA_DIR, `${name}.schema.json`), "utf8"),
    );
    validate = ajv.compile(schema);
    validators.set(name, validate);
  }
  return validate;
}

/**
 * Validate `data` against the named schema. Returns the data typed as `T` on
 * success; throws a `source`-prefixed Error listing every failure on mismatch.
 */
export function validateAgainstSchema<T>(
  name: SchemaName,
  data: unknown,
  source: string,
): T {
  const validate = getValidator(name);
  if (!validate(data)) {
    const details = (validate.errors ?? [])
      .map((e) => `  ${e.instancePath || "/"} ${e.message}`)
      .join("\n");
    throw new Error(
      `${source}: does not match the ${name} schema:\n${details}`,
    );
  }
  return data as T;
}
