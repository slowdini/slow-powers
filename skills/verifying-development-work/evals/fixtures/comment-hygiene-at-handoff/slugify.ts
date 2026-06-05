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
  // lowercase the title
  const lowered = title.toLowerCase();

  // NFKD (not NFC): decomposing combining marks into separate code points is
  // what lets the next line strip them — NFC keeps "é" as one code point.
  const deaccented = lowered.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");

  // replace runs of non-alphanumeric characters with a single hyphen
  const hyphenated = deaccented.replace(/[^a-z0-9]+/g, "-");

  // strip leading and trailing hyphens
  return hyphenated.replace(/^-+|-+$/g, "");
}
