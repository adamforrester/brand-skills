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

import { parse as yamlParse } from 'yaml';

// Matches a leading run of: blank lines, blockquote lines (`>`), and HTML
// comment blocks (possibly multi-line). Anchored at the start; stops at the
// first line that is none of these — which is where real frontmatter (or body)
// begins.
const LEADING_NON_FRONTMATTER = /^(?:[ \t]*(?:>[^\n]*|<!--[\s\S]*?-->)[ \t]*\n|[ \t]*\n)*/;

/**
 * True when `s` opens with a real YAML *mapping* frontmatter block: a `---`
 * fence, a closing `\n---`, and fenced content that parses to a non-null,
 * non-array object. This mirrors exactly what every downstream consumer
 * accepts as frontmatter (`yamlParse(...)` → object), so the strip decision
 * never exposes something a consumer would then reject.
 */
function opensFrontmatterMapping(s) {
  if (!s.startsWith('---')) return false;
  const rest = s.slice(3);
  const end = rest.indexOf('\n---');
  if (end === -1) return false;
  try {
    const parsed = yamlParse(rest.slice(0, end));
    return parsed != null && typeof parsed === 'object' && !Array.isArray(parsed);
  } catch {
    return false;
  }
}

/**
 * Strip a leading prefix of blank / blockquote / HTML-comment lines so a
 * frontmatter block that a disclaimer pushed down becomes reachable at the
 * start of the returned string.
 *
 * The strip is only applied when it actually EXPOSES a real frontmatter mapping
 * (see `opensFrontmatterMapping`). This guards the one new failure mode the
 * bounded strip would otherwise introduce: a prose file that opens with a
 * blockquote/comment immediately followed by a body `---` thematic break would,
 * once the leading run is removed, have that break mistaken for a frontmatter
 * opener — silently swallowing the prose in between. By requiring the exposed
 * block to parse as a YAML mapping, a `---`-delimited prose section (which
 * parses to a scalar or null) is left untouched and the original content is
 * returned verbatim. Content that has no strippable prefix, or already opens at
 * `---`, is returned unchanged.
 *
 * @param {string} content
 * @returns {string}
 */
export function stripLeadingNonFrontmatter(content) {
  if (!content) return content;
  const stripped = content.replace(LEADING_NON_FRONTMATTER, '');
  if (stripped === content) return content; // nothing strippable
  return opensFrontmatterMapping(stripped) ? stripped : content;
}
