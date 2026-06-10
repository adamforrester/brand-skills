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
  body = body
    .replace(/^#\s+[^\n]+\n+/, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .trim();

  // Frontmatter check: walk the value lines once.
  // - If every value line is commented and body is short → placeholder.
  // - If at least one value line is uncommented (a real key:value) → complete,
  //   regardless of body length: the frontmatter itself carries the content
  //   (e.g. token files where the body is a short note above filled tokens).
  const fm = raw.match(/^---\n([\s\S]*?)\n---/);
  if (fm) {
    const fmLines = fm[1].split('\n').filter((l) => l.trim());
    const valueLines = fmLines.filter((l) => /^\s+/.test(l));
    const allCommented = valueLines.length > 0 && valueLines.every((l) => /^\s*#/.test(l));
    if (allCommented && body.length < 50) return 'placeholder';
    const hasUncommentedValue = valueLines.some((l) => !/^\s*#/.test(l));
    if (hasUncommentedValue) return 'complete';
  }

  return body.length >= 50 ? 'complete' : 'placeholder';
}
