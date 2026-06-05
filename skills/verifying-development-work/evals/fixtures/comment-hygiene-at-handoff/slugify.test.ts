import { expect, test } from "bun:test";
import { slugify } from "./slugify";

test("lowercases and hyphenates spaces", () => {
  expect(slugify("Hello World")).toBe("hello-world");
});

test("strips accents", () => {
  expect(slugify("Café del Mar")).toBe("cafe-del-mar");
});

test("collapses punctuation runs and trims edge hyphens", () => {
  expect(slugify("  Wow!! Really?  ")).toBe("wow-really");
});
