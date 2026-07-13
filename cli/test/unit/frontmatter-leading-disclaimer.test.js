import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { parse as yamlParse } from 'yaml';
import { generateDesignMd } from '../../src/utils/design-md-generator.js';
import { generateStyleGuide } from '../../src/utils/style-guide-generator.js';
import { generateBrandContext } from '../../src/utils/brand-context-generator.js';
import { classifyFile } from '../../src/utils/file-status.js';
import { stripLeadingNonFrontmatter } from '../../src/utils/frontmatter.js';

// The public-sources-only disclaimer that Stage 5c / init.js prepend ABOVE the
// frontmatter — the exact layout that broke every start-of-file parser.
const DISCLAIMER =
  '> ⚠️ **PUBLIC-SOURCES-ONLY MODE** — derived from public sources only. Not validated against internal brand standards.\n\n';

const COLORS = `---
colors:
  primary: "#033452"
  green: "#5c9e31"
---

# Color System

## Philosophy
Navy-forward, green for action.
`;

const TYPO = `---
typography:
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.6
---

# Typography
`;

function mkBrandDir(name, files) {
  const dir = join(tmpdir(), `fm-disc-${name}-${process.pid}`);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  for (const [rel, content] of Object.entries(files)) {
    const full = join(dir, rel);
    mkdirSync(join(full, '..'), { recursive: true });
    writeFileSync(full, content, 'utf-8');
  }
  return dir;
}

test('stripLeadingNonFrontmatter: removes a leading disclaimer blockquote so --- opens the block', () => {
  const out = stripLeadingNonFrontmatter(DISCLAIMER + COLORS);
  assert.ok(out.startsWith('---\n'), 'frontmatter should now start at the beginning');
  assert.equal(yamlParse(out.match(/^---\n([\s\S]*?)\n---/)[1]).colors.primary, '#033452');
});

test('stripLeadingNonFrontmatter: also skips leading blank lines and HTML comments', () => {
  const withComment = '\n\n<!-- note -->\n' + DISCLAIMER + COLORS;
  assert.ok(stripLeadingNonFrontmatter(withComment).startsWith('---\n'));
});

test('stripLeadingNonFrontmatter: negative control — a body horizontal rule is NOT treated as frontmatter', () => {
  const prose = '# Title\n\nSome prose.\n\n---\n\nMore prose after a rule.\n';
  // No real frontmatter → content returned unchanged so the caller falls back
  // to its no-frontmatter path.
  assert.equal(stripLeadingNonFrontmatter(prose), prose);
});

test('stripLeadingNonFrontmatter: plain frontmatter (--- already line 1) is unchanged', () => {
  assert.equal(stripLeadingNonFrontmatter(COLORS), COLORS);
});

test('stripLeadingNonFrontmatter: guard — disclaimer above a BODY --- thematic break (no real frontmatter) is left unchanged', () => {
  // Finding 1: without the mapping guard, stripping the leading blockquote would
  // expose "\n\nsection one\n\n---\n..." and the downstream parser would mistake
  // the body thematic break for a frontmatter opener, swallowing the prose.
  const proseWithLeadingQuote = '> Editor note: draft.\n\n---\n\nsection one\n\n---\n\nsection two\n';
  assert.equal(
    stripLeadingNonFrontmatter(proseWithLeadingQuote),
    proseWithLeadingQuote,
    'must return content unchanged when the exposed --- block is a prose thematic break, not a YAML mapping'
  );
});

test('stripLeadingNonFrontmatter: unterminated HTML comment does not hang or over-consume (ReDoS guard)', () => {
  const start = Date.now();
  const unterminated = '<!--' + 'x'.repeat(200000) + '\n' + DISCLAIMER + COLORS;
  const out = stripLeadingNonFrontmatter(unterminated);
  assert.ok(Date.now() - start < 1000, 'must complete well under a second');
  // The comment is never closed, so nothing is safely strippable → unchanged.
  assert.equal(out, unterminated);
});

test('generateDesignMd: token maps survive a leading disclaimer (Bug #2)', () => {
  const dir = mkBrandDir('design-disc', {
    'tokens/colors.md': DISCLAIMER + COLORS,
    'tokens/typography.md': DISCLAIMER + TYPO,
  });
  try {
    const fm = generateDesignMd(dir, 'Evergy').match(/^---\n([\s\S]*?)\n---\n/)[1];
    const parsed = yamlParse(fm);
    assert.equal(parsed.colors.primary, '#033452', 'colors must appear despite the disclaimer');
    assert.ok(parsed.typography['body-md'], 'typography must appear despite the disclaimer');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('generateStyleGuide: swatches render despite a leading disclaimer (Bug #2)', () => {
  const dir = mkBrandDir('sg-disc', { 'tokens/colors.md': DISCLAIMER + COLORS });
  try {
    const html = generateStyleGuide(dir, 'Evergy', '2026-07-10');
    assert.doesNotMatch(html, /No colors extracted yet/, 'must not show the empty-state placeholder');
    assert.match(html, /#033452/i, 'primary swatch hex must render');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('classifyFile: a populated-but-disclaimer-prefixed token file is complete, not placeholder (Bug #2)', () => {
  const dir = mkBrandDir('classify-disc', { 'tokens/colors.md': DISCLAIMER + '---\ncolors:\n  primary: "#033452"\n---\n\n# C\n' });
  try {
    assert.equal(classifyFile(join(dir, 'tokens/colors.md')), 'complete');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('generateBrandContext: frontmatter is stripped from overview even behind a disclaimer (Bug #2)', () => {
  const overview = DISCLAIMER + `---
sometop: value
---

# Brand Overview

## Brand Identity
**Brand:** Evergy — dependable utility.
`;
  const dir = mkBrandDir('ctx-disc', { 'overview.md': overview });
  try {
    const md = generateBrandContext(dir, 'Evergy');
    // Bug #2 scope: the disclaimer must not defeat frontmatter stripping, so the
    // raw `sometop: value` frontmatter must never leak into brand.md. (Correct
    // section-body *extraction* is a separate concern fixed on the
    // refresh-context branch — asserted there, not here, so this branch stays
    // independently green.)
    assert.doesNotMatch(md, /sometop: value/, 'raw frontmatter must not leak into brand.md');
    assert.match(md, /## Identity/, 'brand.md still renders the Identity section');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
