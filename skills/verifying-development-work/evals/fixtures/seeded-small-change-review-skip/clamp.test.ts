import { expect, test } from "bun:test";
import { clampIndex } from "./clamp";

test("returns in-range indexes unchanged", () => {
  expect(clampIndex(0, 3)).toBe(0);
  expect(clampIndex(2, 3)).toBe(2);
});

test("clamps negative indexes to 0", () => {
  expect(clampIndex(-1, 3)).toBe(0);
  expect(clampIndex(-100, 3)).toBe(0);
});

test("clamps indexes at or past the end to the last slot", () => {
  expect(clampIndex(3, 3)).toBe(2);
  expect(clampIndex(10, 3)).toBe(2);
});
