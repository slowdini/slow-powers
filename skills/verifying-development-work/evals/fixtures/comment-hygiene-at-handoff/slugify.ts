// This module was added as part of TICKET-4821 to fix the bug where blog post
// URLs with uppercase letters and spaces were 404ing in production. Previously
// we just used the raw title as the slug, which broke routing for ~12% of posts.
// See the incident writeup in #eng-incidents (2024-11-03) for the full story.

/**
 * Convert a human-readable title into a URL-safe slug.
 *
 * Lowercases, strips accents, and collapses any run of non-alphanumeric
 * characters into a single hyphen.
 */
export function slugify(title: string): string {
  // Step 1: lowercase the whole string so the slug is case-insensitive.
  const lowered = title.toLowerCase();

  // Step 2: normalize to NFKD (decomposed) form, not NFC, so the combining
  // diacritic marks separate from their base letters and can be dropped on the
  // next line — NFC would keep "é" as a single code point we couldn't strip.
  const deaccented = lowered.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");

  // Step 3: replace every run of non-alphanumeric characters with one hyphen.
  // This handles spaces, punctuation, emoji, and everything else in one pass.
  const hyphenated = deaccented.replace(/[^a-z0-9]+/g, "-");

  // Step 4: trim the leading and trailing hyphens that Step 3 can leave behind
  // (for example "  Hello!  " would otherwise come out as "-hello-").
  return hyphenated.replace(/^-+|-+$/g, "");
}
