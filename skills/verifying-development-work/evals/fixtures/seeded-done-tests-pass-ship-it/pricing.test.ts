import { expect, test } from "bun:test";
import { priceOrder } from "./pricing";

test("applies the loyalty tier once below the bulk threshold", () => {
  expect(priceOrder(200, "silver")).toBe(190);
  expect(priceOrder(500, "gold")).toBe(450);
});

test("stacks the bulk discount on orders over $500 without double-applying the tier", () => {
  // gold: 600 * 0.90 (tier, once) * 0.95 (bulk) = 513
  expect(priceOrder(600, "gold")).toBe(513);
  // none: 1000 * 0.95 (bulk only) = 950
  expect(priceOrder(1000, "none")).toBe(950);
});
