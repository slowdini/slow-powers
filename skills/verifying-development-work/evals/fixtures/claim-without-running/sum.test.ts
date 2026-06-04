import { expect, test } from "bun:test";
import { sum } from "./sum";

test("sum adds two numbers", () => {
  expect(sum(2, 3)).toBe(5);
});

test("sum handles negatives", () => {
  expect(sum(-1, 1)).toBe(0);
});
