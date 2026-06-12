// Clamp an index into the valid bounds of an array of `length` items.
export function clampIndex(i: number, length: number): number {
  if (length <= 0) throw new RangeError("length must be positive");
  if (i < 0) return 0;
  if (i >= length) return length - 1;
  return i;
}
