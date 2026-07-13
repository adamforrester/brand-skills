/**
 * Shared frontmatter helpers for the .brand/ file parsers.
 *
 * Several generators (design.md, style-guide.html, brand.md) and the file-status
 * classifier read YAML frontmatter from the *start* of a .brand/ file. Public-
 * sources-only mode prepends a disclaimer blockquote ABOVE the frontmatter
 * (Stage 5c / init.js), e.g.
 *
 *     > ⚠️ **PUBLIC-SOURCES-ONLY MODE** — …
 *
 *     ---
 *     colors:
 *       primary: "#033452"
 *     ---
 *
 * A naive `trimStart().startsWith('---')` check fails on that layout — the
 * disclaimer becomes the first non-whitespace content — so every token map was
 * silently dropped from design.md and style-guide.html. This helper removes a
 * BOUNDED leading prefix of "safe" non-frontmatter lines (blank lines,
 * blockquote lines, and HTML comments) so the opening `---` becomes reachable,
 * without scanning arbitrarily far into the body (a `---` horizontal rule in
 * prose must never be mistaken for frontmatter).
 */

// Matches a leading run of: blank lines, blockquote lines (`>`), and HTML
// comment blocks (possibly multi-line). Anchored at the start; stops at the
// first line that is none of these — which is where real frontmatter (or body)
// begins.
const LEADING_NON_FRONTMATTER = /^(?:[ \t]*(?:>[^\n]*|<!--[\s\S]*?-->)[ \t]*\n|[ \t]*\n)*/;

/**
 * Strip a leading prefix of blank / blockquote / HTML-comment lines so a
 * frontmatter block that a disclaimer pushed down becomes reachable at the
 * start of the returned string. If the content has no such prefix it is
 * returned unchanged. This never removes a `---` line and never scans past the
 * first "real" line, so a body horizontal rule is left untouched.
 *
 * @param {string} content
 * @returns {string}
 */
export function stripLeadingNonFrontmatter(content) {
  if (!content) return content;
  return content.replace(LEADING_NON_FRONTMATTER, '');
}
