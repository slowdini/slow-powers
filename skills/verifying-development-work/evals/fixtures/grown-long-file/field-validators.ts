// Shared field-validation helpers used across the signup, billing, and
// scheduling forms. Each validator returns a ValidationResult so callers can
// surface a specific message instead of a bare boolean.

export interface ValidationResult {
  valid: boolean;
  message?: string;
}

const ok: ValidationResult = { valid: true };
const fail = (message: string): ValidationResult => ({ valid: false, message });

// ---------------------------------------------------------------------------
// String validators
// ---------------------------------------------------------------------------

export function isNonEmpty(value: string): ValidationResult {
  if (value.trim().length === 0) {
    return fail("Value must not be empty.");
  }
  return ok;
}

export function hasMinLength(value: string, min: number): ValidationResult {
  if (value.length < min) {
    return fail(`Must be at least ${min} characters.`);
  }
  return ok;
}

export function hasMaxLength(value: string, max: number): ValidationResult {
  if (value.length > max) {
    return fail(`Must be at most ${max} characters.`);
  }
  return ok;
}

export function isEmail(value: string): ValidationResult {
  const at = value.indexOf("@");
  const dot = value.lastIndexOf(".");
  if (at < 1 || dot < at + 2 || dot === value.length - 1) {
    return fail("Must be a valid email address.");
  }
  if (/\s/.test(value)) {
    return fail("Email must not contain whitespace.");
  }
  return ok;
}

export function isUrl(value: string): ValidationResult {
  if (!/^https?:\/\//.test(value)) {
    return fail("Must start with http:// or https://.");
  }
  if (/\s/.test(value)) {
    return fail("URL must not contain whitespace.");
  }
  return ok;
}

export function isSlug(value: string): ValidationResult {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) {
    return fail("Must be lowercase words separated by single hyphens.");
  }
  return ok;
}

export function isAlphanumeric(value: string): ValidationResult {
  if (!/^[a-z0-9]+$/i.test(value)) {
    return fail("Must contain only letters and numbers.");
  }
  return ok;
}

export function matchesPattern(
  value: string,
  pattern: RegExp,
): ValidationResult {
  if (!pattern.test(value)) {
    return fail("Value does not match the expected format.");
  }
  return ok;
}

export function isNoLeadingTrailingSpace(value: string): ValidationResult {
  if (value !== value.trim()) {
    return fail("Must not have leading or trailing whitespace.");
  }
  return ok;
}

// ---------------------------------------------------------------------------
// Number validators
// ---------------------------------------------------------------------------

export function isFiniteNumber(value: number): ValidationResult {
  if (!Number.isFinite(value)) {
    return fail("Must be a finite number.");
  }
  return ok;
}

export function isInteger(value: number): ValidationResult {
  if (!Number.isInteger(value)) {
    return fail("Must be a whole number.");
  }
  return ok;
}

export function isPositive(value: number): ValidationResult {
  if (!(value > 0)) {
    return fail("Must be greater than zero.");
  }
  return ok;
}

export function isNonNegative(value: number): ValidationResult {
  if (!(value >= 0)) {
    return fail("Must not be negative.");
  }
  return ok;
}

export function isInRange(
  value: number,
  min: number,
  max: number,
): ValidationResult {
  if (value < min || value > max) {
    return fail(`Must be between ${min} and ${max}.`);
  }
  return ok;
}

export function isMultipleOf(value: number, factor: number): ValidationResult {
  if (factor === 0 || value % factor !== 0) {
    return fail(`Must be a multiple of ${factor}.`);
  }
  return ok;
}

export function isPercentage(value: number): ValidationResult {
  if (value < 0 || value > 100) {
    return fail("Must be between 0 and 100.");
  }
  return ok;
}

export function isPort(value: number): ValidationResult {
  if (!Number.isInteger(value) || value < 1 || value > 65535) {
    return fail("Must be a valid port between 1 and 65535.");
  }
  return ok;
}

// ---------------------------------------------------------------------------
// Date validators
// ---------------------------------------------------------------------------

export function isIsoDate(value: string): ValidationResult {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return fail("Must be an ISO date (YYYY-MM-DD).");
  }
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    return fail("Must be a real calendar date.");
  }
  return ok;
}

export function isFuture(value: string, now: number): ValidationResult {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    return fail("Must be a real date.");
  }
  if (parsed <= now) {
    return fail("Must be in the future.");
  }
  return ok;
}

export function isPast(value: string, now: number): ValidationResult {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    return fail("Must be a real date.");
  }
  if (parsed >= now) {
    return fail("Must be in the past.");
  }
  return ok;
}

export function isWithinDays(
  value: string,
  now: number,
  days: number,
): ValidationResult {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    return fail("Must be a real date.");
  }
  const span = Math.abs(parsed - now);
  if (span > days * 24 * 60 * 60 * 1000) {
    return fail(`Must be within ${days} days.`);
  }
  return ok;
}

export function isValidAge(years: number): ValidationResult {
  if (!Number.isInteger(years) || years < 0 || years > 130) {
    return fail("Must be a realistic age.");
  }
  return ok;
}

// ---------------------------------------------------------------------------
// Collection validators
// ---------------------------------------------------------------------------

export function isNonEmptyArray<T>(value: T[]): ValidationResult {
  if (!Array.isArray(value) || value.length === 0) {
    return fail("Must contain at least one item.");
  }
  return ok;
}

export function hasUniqueItems<T>(value: T[]): ValidationResult {
  if (new Set(value).size !== value.length) {
    return fail("Items must be unique.");
  }
  return ok;
}

export function hasSize<T>(value: T[], size: number): ValidationResult {
  if (value.length !== size) {
    return fail(`Must contain exactly ${size} items.`);
  }
  return ok;
}

export function hasSizeWithin<T>(
  value: T[],
  min: number,
  max: number,
): ValidationResult {
  if (value.length < min || value.length > max) {
    return fail(`Must contain between ${min} and ${max} items.`);
  }
  return ok;
}

export function includesAll<T>(value: T[], required: T[]): ValidationResult {
  const present = new Set(value);
  for (const item of required) {
    if (!present.has(item)) {
      return fail("Missing one or more required items.");
    }
  }
  return ok;
}

export function isSubsetOf<T>(value: T[], allowed: T[]): ValidationResult {
  const permitted = new Set(allowed);
  for (const item of value) {
    if (!permitted.has(item)) {
      return fail("Contains a value that is not allowed.");
    }
  }
  return ok;
}

// ---------------------------------------------------------------------------
// Identity and web-format validators
// ---------------------------------------------------------------------------

export function isUuid(value: string): ValidationResult {
  const pattern =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!pattern.test(value)) {
    return fail("Must be a valid UUID.");
  }
  return ok;
}

export function isHexColor(value: string): ValidationResult {
  if (!/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(value)) {
    return fail("Must be a hex color like #fff or #ffffff.");
  }
  return ok;
}

export function isIpv4(value: string): ValidationResult {
  const parts = value.split(".");
  if (parts.length !== 4) {
    return fail("Must be a dotted IPv4 address.");
  }
  for (const part of parts) {
    const n = Number(part);
    if (!/^\d+$/.test(part) || n < 0 || n > 255) {
      return fail("Each IPv4 octet must be between 0 and 255.");
    }
  }
  return ok;
}

export function isMacAddress(value: string): ValidationResult {
  if (!/^(?:[0-9a-f]{2}:){5}[0-9a-f]{2}$/i.test(value)) {
    return fail("Must be a colon-separated MAC address.");
  }
  return ok;
}

export function isSemver(value: string): ValidationResult {
  if (!/^\d+\.\d+\.\d+(?:-[0-9a-z.-]+)?$/i.test(value)) {
    return fail("Must be a semver string like 1.2.3.");
  }
  return ok;
}

export function isJwtShape(value: string): ValidationResult {
  const segments = value.split(".");
  if (segments.length !== 3 || segments.some((s) => s.length === 0)) {
    return fail("Must look like a three-part JWT.");
  }
  return ok;
}

// ---------------------------------------------------------------------------
// Financial validators (added for the billing form)
// ---------------------------------------------------------------------------

export function isLuhnValid(value: string): ValidationResult {
  const digits = value.replace(/\s+/g, "");
  if (!/^\d+$/.test(digits)) {
    return fail("Must contain only digits.");
  }
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = Number(digits[i]);
    if (double) {
      d *= 2;
      if (d > 9) {
        d -= 9;
      }
    }
    sum += d;
    double = !double;
  }
  if (sum % 10 !== 0) {
    return fail("Failed the Luhn checksum.");
  }
  return ok;
}

export function isCreditCard(value: string): ValidationResult {
  const digits = value.replace(/[\s-]/g, "");
  if (digits.length < 13 || digits.length > 19) {
    return fail("Card number length is out of range.");
  }
  return isLuhnValid(digits);
}

export function isCurrencyAmount(value: string): ValidationResult {
  if (!/^\d+(?:\.\d{1,2})?$/.test(value)) {
    return fail("Must be an amount with up to two decimal places.");
  }
  return ok;
}

export function isPositiveMoney(cents: number): ValidationResult {
  if (!Number.isInteger(cents) || cents <= 0) {
    return fail("Must be a positive whole number of cents.");
  }
  return ok;
}

export function isRoutingNumber(value: string): ValidationResult {
  if (!/^\d{9}$/.test(value)) {
    return fail("Must be nine digits.");
  }
  const d = value.split("").map(Number);
  const checksum =
    3 * (d[0] + d[3] + d[6]) +
    7 * (d[1] + d[4] + d[7]) +
    1 * (d[2] + d[5] + d[8]);
  if (checksum % 10 !== 0) {
    return fail("Failed the routing-number checksum.");
  }
  return ok;
}

export function isIban(value: string): ValidationResult {
  const compact = value.replace(/\s+/g, "").toUpperCase();
  if (!/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/.test(compact)) {
    return fail("Must be a valid IBAN format.");
  }
  const rearranged = compact.slice(4) + compact.slice(0, 4);
  let remainder = 0;
  for (const ch of rearranged) {
    const code = /[A-Z]/.test(ch) ? (ch.charCodeAt(0) - 55).toString() : ch;
    for (const digit of code) {
      remainder = (remainder * 10 + Number(digit)) % 97;
    }
  }
  if (remainder !== 1) {
    return fail("Failed the IBAN checksum.");
  }
  return ok;
}

// ---------------------------------------------------------------------------
// Credential and security validators
// ---------------------------------------------------------------------------

export function hasUppercase(value: string): ValidationResult {
  if (!/[A-Z]/.test(value)) {
    return fail("Must contain an uppercase letter.");
  }
  return ok;
}

export function hasLowercase(value: string): ValidationResult {
  if (!/[a-z]/.test(value)) {
    return fail("Must contain a lowercase letter.");
  }
  return ok;
}

export function hasDigit(value: string): ValidationResult {
  if (!/\d/.test(value)) {
    return fail("Must contain a digit.");
  }
  return ok;
}

export function hasSymbol(value: string): ValidationResult {
  if (!/[^A-Za-z0-9]/.test(value)) {
    return fail("Must contain a symbol.");
  }
  return ok;
}

export function isStrongPassword(value: string): ValidationResult {
  return all(
    hasMinLength(value, 12),
    hasUppercase(value),
    hasLowercase(value),
    hasDigit(value),
    hasSymbol(value),
  );
}

export function isNotCommonPassword(
  value: string,
  blocklist: string[],
): ValidationResult {
  if (blocklist.includes(value.toLowerCase())) {
    return fail("Password is too common.");
  }
  return ok;
}

// ---------------------------------------------------------------------------
// Contact and address validators
// ---------------------------------------------------------------------------

export function isPhoneE164(value: string): ValidationResult {
  if (!/^\+[1-9]\d{1,14}$/.test(value)) {
    return fail("Must be an E.164 phone number like +14155550123.");
  }
  return ok;
}

export function isUsZip(value: string): ValidationResult {
  if (!/^\d{5}(?:-\d{4})?$/.test(value)) {
    return fail("Must be a US ZIP code.");
  }
  return ok;
}

export function isCountryCode(value: string): ValidationResult {
  if (!/^[A-Z]{2}$/.test(value)) {
    return fail("Must be a two-letter ISO country code.");
  }
  return ok;
}

export function isLatitude(value: number): ValidationResult {
  if (value < -90 || value > 90) {
    return fail("Latitude must be between -90 and 90.");
  }
  return ok;
}

export function isLongitude(value: number): ValidationResult {
  if (value < -180 || value > 180) {
    return fail("Longitude must be between -180 and 180.");
  }
  return ok;
}

// ---------------------------------------------------------------------------
// Combinators
// ---------------------------------------------------------------------------

export function all(...results: ValidationResult[]): ValidationResult {
  for (const result of results) {
    if (!result.valid) {
      return result;
    }
  }
  return ok;
}

export function any(...results: ValidationResult[]): ValidationResult {
  for (const result of results) {
    if (result.valid) {
      return ok;
    }
  }
  return fail("No candidate passed validation.");
}

export function not(
  result: ValidationResult,
  message: string,
): ValidationResult {
  if (result.valid) {
    return fail(message);
  }
  return ok;
}
