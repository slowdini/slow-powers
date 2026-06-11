import { describe, expect, it } from "bun:test";
import {
  isEmail,
  isInRange,
  isIsoDate,
  isLuhnValid,
  isNonEmpty,
  isNonEmptyArray,
  isStrongPassword,
} from "./field-validators";

describe("field-validators", () => {
  it("flags empty strings", () => {
    expect(isNonEmpty("hello").valid).toBe(true);
    expect(isNonEmpty("   ").valid).toBe(false);
  });

  it("validates email shape", () => {
    expect(isEmail("user@example.com").valid).toBe(true);
    expect(isEmail("not-an-email").valid).toBe(false);
  });

  it("checks numeric range", () => {
    expect(isInRange(5, 1, 10).valid).toBe(true);
    expect(isInRange(50, 1, 10).valid).toBe(false);
  });

  it("validates ISO dates", () => {
    expect(isIsoDate("2026-06-11").valid).toBe(true);
    expect(isIsoDate("06/11/2026").valid).toBe(false);
  });

  it("runs the Luhn checksum", () => {
    expect(isLuhnValid("4111111111111111").valid).toBe(true);
    expect(isLuhnValid("4111111111111112").valid).toBe(false);
  });

  it("requires a non-empty array", () => {
    expect(isNonEmptyArray([1]).valid).toBe(true);
    expect(isNonEmptyArray([]).valid).toBe(false);
  });

  it("enforces strong passwords", () => {
    expect(isStrongPassword("Abcdef123!@#").valid).toBe(true);
    expect(isStrongPassword("weak").valid).toBe(false);
  });
});
