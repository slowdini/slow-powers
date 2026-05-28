// Small string helpers for the content pipeline.
// A `slugify(title)` helper needs to be added here.

export function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max - 1)}…`;
}
