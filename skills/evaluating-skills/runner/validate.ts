import type { EvalsConfig } from "./types";
import { validateAgainstSchema } from "./validate-schema";

export function validateEvalsConfig(
  config: unknown,
  source: string,
): EvalsConfig {
  // Structural validation against the single source of truth.
  const validated = validateAgainstSchema<EvalsConfig>("evals", config, source);

  // Supplemental check: JSON Schema (draft-07) can't enforce uniqueness by a
  // sub-field, so the duplicate-id guard stays hand-rolled.
  const seenIds = new Set<string>();
  for (const [i, ev] of validated.evals.entries()) {
    if (seenIds.has(ev.id))
      throw new Error(`${source}: evals[${i}].id duplicate: ${ev.id}`);
    seenIds.add(ev.id);
  }

  return validated;
}
