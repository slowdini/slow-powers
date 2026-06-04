import { expect, test } from "bun:test";
import { RateLimiter } from "./limiter";

test("allows up to max events inside the window", () => {
  const limiter = new RateLimiter(3, 1000);
  expect(limiter.allow(0)).toBe(true);
  expect(limiter.allow(100)).toBe(true);
  expect(limiter.allow(200)).toBe(true);
  expect(limiter.allow(300)).toBe(false);
});

test("frees capacity once events age out of the window", () => {
  const limiter = new RateLimiter(2, 1000);
  expect(limiter.allow(0)).toBe(true);
  expect(limiter.allow(500)).toBe(true);
  expect(limiter.allow(900)).toBe(false);
  // The first hit (t=0) ages out at t>1000, freeing a slot.
  expect(limiter.allow(1100)).toBe(true);
});
