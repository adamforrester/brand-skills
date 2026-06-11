/**
 * File-status classifier. Returns the three statuses a content scan can
 * detect: 'missing' | 'placeholder' | 'complete'. The 'partial' and
 * 'defaults' statuses come from producer-side stage data (extract) and
 * are layered on top of this. Spec: docs/superpowers/specs/2026-06-10-manifest-and-health-design.md §3.
 */

import { existsSync, readFileSync } from 'node:fs';

const PLACEHOLDER_MARKER = '<!-- Fill this file following the schema';

/**
 * Classify a brand file by scanning its content.
 * Returns one of: 'missing' | 'placeholder' | 'complete'.
 *
 * The 'partial' and 'defaults' statuses cannot be detected by content scan —
 * they require producer-side stage-execution data and are emitted by extract.
 * When this returns 'complete', the producer may downgrade it to 'partial'
 * or 'defaults' before the manifest is written.
 */
export function classifyFile(absPath) {
  if (!existsSync(absPath)) return 'missing';

  const raw = readFileSync(absPath, 'utf-8');

  if (raw.includes(PLACEHOLDER_MARKER)) return 'placeholder';

  // Strip frontmatter and inspect remaining body.
  let body = raw;
  const trimmed = body.trimStart();
  if (trimmed.startsWith('---')) {
    const rest = trimmed.slice(3);
    const end = rest.indexOf('\n---');
    if (end !== -1) body = rest.slice(end + 4);
  }

  // Strip leading H1, HTML comments, blank lines.
  // trimStart() first: after the frontmatter strip, body begins with "\n\n# Title…",
  // which would prevent the anchored H1 regex from matching.
  body = body
    .trimStart()
    .replace(/^#\s+[^\n]+\n+/, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .trim();

  // Frontmatter check: if the frontmatter contains at least one uncommented
  // key:value line where the value is non-empty (top-level OR nested), treat
  // the file as complete — the frontmatter itself carries the content (e.g.
  // token files where the body is a short note above filled tokens). A bare
  // header line like `colors:` with all children commented is NOT a value;
  // we require non-whitespace after the first colon. If no real value is
  // present, fall through to the body-length check (→ 'placeholder' when
  // the body is short).
  const fm = raw.match(/^---\n([\s\S]*?)\n---/);
  if (fm) {
    const fmLines = fm[1].split('\n').filter((l) => l.trim());
    const uncommentedValueLines = fmLines.filter((l) => {
      if (/^\s*#/.test(l)) return false;
      const idx = l.indexOf(':');
      if (idx === -1) return false;
      return l.slice(idx + 1).trim().length > 0;
    });
    if (uncommentedValueLines.length > 0) return 'complete';
  }

  return body.length >= 50 ? 'complete' : 'placeholder';
}
