import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { generateStyleGuide } from '../../src/utils/style-guide-generator.js';

const FIXED_NOW = '2026-06-18T12:00:00Z';

function mkBrandDir(name, files) {
  const dir = join(tmpdir(), `style-guide-test-${name}-${process.pid}`);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  for (const [relPath, content] of Object.entries(files)) {
    const fullPath = join(dir, relPath);
    mkdirSync(join(fullPath, '..'), { recursive: true });
    writeFileSync(fullPath, content, 'utf-8');
  }
  return dir;
}

test('generateStyleGuide: header renders brand name from brand argument', () => {
  const dir = mkBrandDir('header-brand', {});
  try {
    const html = generateStyleGuide(dir, 'ACME Corp', FIXED_NOW);
    assert.match(html, /<h1>ACME Corp<\/h1>/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('generateStyleGuide: identity subtitle pulls first paragraph from overview.md', () => {
  const dir = mkBrandDir('identity-subtitle', {
    'overview.md': '# Brand overview\n\nACME makes precision tooling for B2B SaaS analytics teams.\n\n## Personality\n\nDirect, technical.\n',
  });
  try {
    const html = generateStyleGuide(dir, 'ACME Corp', FIXED_NOW);
    assert.match(html, /class="subtitle">ACME makes precision tooling for B2B SaaS analytics teams\./);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('generateStyleGuide: identity subtitle empty-state callout when overview.md is placeholder', () => {
  const dir = mkBrandDir('identity-empty', {
    'overview.md': '# Overview\n\n<!-- Fill this file following the schema at schema/brand/overview.schema.md -->\n',
  });
  try {
    const html = generateStyleGuide(dir, 'ACME Corp', FIXED_NOW);
    assert.match(html, /No brand identity captured yet\. Run \/brand-context:extract\./);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('generateStyleGuide: colors section renders swatches with token name + value when populated', () => {
  const dir = mkBrandDir('colors-populated', {
    'tokens/colors.md': '---\ncolors:\n  primary-500: "#0066ff"\n  primary-700: "#003a99"\n  neutral-900: "#1a1a1a"\n---\n\n# Colors\n',
  });
  try {
    const html = generateStyleGuide(dir, 'ACME Corp', FIXED_NOW);
    assert.match(html, /<h2>Colors<\/h2>/);
    assert.ok(html.includes('#0066ff'), 'expected primary-500 hex value in output');
    assert.ok(html.includes('primary-500'), 'expected primary-500 token name in output');
    assert.ok(html.includes('background: #0066ff'), 'expected swatch block to use the hex as background');
    // Two "primary-*" tokens should group under a "primary" group; neutral-900 under "neutral".
    assert.ok(html.includes('class="swatch-group-name">primary'), 'expected a primary group label');
    assert.ok(html.includes('class="swatch-group-name">neutral'), 'expected a neutral group label');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('generateStyleGuide: colors section renders empty-state callout when colors.md frontmatter is all-commented', () => {
  const dir = mkBrandDir('colors-empty', {
    'tokens/colors.md': '---\ncolors:\n  # primary: "#000000"\n  # neutral: "#FFFFFF"\n---\n\n# Colors\n',
  });
  try {
    const html = generateStyleGuide(dir, 'ACME Corp', FIXED_NOW);
    assert.match(html, /<h2>Colors<\/h2>/);
    assert.match(html, /No colors extracted yet\. Run \/brand-context:extract\./);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('generateStyleGuide: footer always renders with the supplied timestamp', () => {
  const dir = mkBrandDir('footer-timestamp', {});
  try {
    const html = generateStyleGuide(dir, 'ACME Corp', FIXED_NOW);
    assert.match(html, /<footer>/);
    assert.ok(html.includes('Generated 2026-06-18T12:00:00Z'), 'expected the supplied ISO timestamp in the footer');
    assert.ok(html.includes('brand-cli refresh-design'), 'expected the regenerate-with hint');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('generateStyleGuide: brand name is HTML-escaped to prevent injection', () => {
  const dir = mkBrandDir('escape-brand', {});
  try {
    const html = generateStyleGuide(dir, '<script>alert(1)</script>', FIXED_NOW);
    assert.ok(!html.includes('<script>alert(1)</script>'), 'expected raw script tag to be escaped');
    assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'), 'expected escaped form in output');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('generateStyleGuide: typography section renders empty-state callout when frontmatter is empty', () => {
  const dir = mkBrandDir('type-empty', {
    'tokens/typography.md': '---\ntypography:\n  # body-md:\n  #   fontFamily: Inter\n---\n',
  });
  try {
    const html = generateStyleGuide(dir, 'ACME Corp', FIXED_NOW);
    assert.match(html, /<h2>Typography<\/h2>/);
    assert.match(html, /No typography extracted yet\. Run \/brand-context:extract\./);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('generateStyleGuide: typography section renders type ramp with inline font CSS when populated', () => {
  const dir = mkBrandDir('type-populated', {
    'tokens/typography.md': '---\ntypography:\n  body-md:\n    fontFamily: Inter\n    fontSize: 16px\n    fontWeight: 400\n    lineHeight: 1.6\n  display-lg:\n    fontFamily: Inter\n    fontSize: 64px\n    fontWeight: 700\n    lineHeight: 1.1\n---\n',
  });
  try {
    const html = generateStyleGuide(dir, 'ACME Corp', FIXED_NOW);
    assert.match(html, /<h2>Typography<\/h2>/);
    assert.ok(html.includes('font-size: 16px'), 'expected body-md font-size in output');
    assert.ok(html.includes('font-size: 64px'), 'expected display-lg font-size in output');
    assert.ok(html.includes('font-family: Inter'), 'expected font-family applied inline');
    assert.ok(html.includes('font-weight: 400'), 'expected body-md font-weight applied inline');
    assert.ok(html.includes('The quick brown fox jumps over the lazy dog.'), 'expected the sample text');
    // Token names should appear in the meta line.
    assert.ok(html.includes('body-md'), 'expected body-md token name');
    assert.ok(html.includes('display-lg'), 'expected display-lg token name');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('generateStyleGuide: spacing section silently skipped when frontmatter is empty', () => {
  const dir = mkBrandDir('spacing-empty', {
    'tokens/spacing.md': '---\nspacing:\n  # base: 16px\n  # xs: 4px\n---\n',
  });
  try {
    const html = generateStyleGuide(dir, 'ACME Corp', FIXED_NOW);
    assert.ok(!html.includes('<h2>Spacing</h2>'), 'expected no Spacing section heading when source data is empty');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('generateStyleGuide: spacing section renders bars when populated', () => {
  const dir = mkBrandDir('spacing-populated', {
    'tokens/spacing.md': '---\nspacing:\n  base: 16px\n  xs: 4px\n  sm: 8px\n  md: 16px\n  lg: 32px\n---\n',
  });
  try {
    const html = generateStyleGuide(dir, 'ACME Corp', FIXED_NOW);
    assert.match(html, /<h2>Spacing<\/h2>/);
    // Each token name should appear.
    for (const name of ['base', 'xs', 'sm', 'md', 'lg']) {
      assert.ok(html.includes(name), `expected spacing token "${name}" in output`);
    }
    // Bar widths should reflect parsed px values.
    assert.ok(html.includes('width: 16px'), 'expected base bar width to be 16px');
    assert.ok(html.includes('width: 32px'), 'expected lg bar width to be 32px');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('generateStyleGuide: surfaces section renders rounded + elevation when populated', () => {
  const dir = mkBrandDir('surfaces-populated', {
    'tokens/surfaces.md': '---\nrounded:\n  sm: 4px\n  md: 8px\nelevation:\n  flat: none\n  md: "0 4px 8px rgba(0,0,0,0.06)"\n---\n',
  });
  try {
    const html = generateStyleGuide(dir, 'ACME Corp', FIXED_NOW);
    assert.match(html, /<h2>Surfaces<\/h2>/);
    assert.ok(html.includes('border-radius: 4px'), 'expected rounded.sm radius applied inline');
    assert.ok(html.includes('border-radius: 8px'), 'expected rounded.md radius applied inline');
    assert.ok(html.includes('box-shadow: 0 4px 8px rgba(0,0,0,0.06)'), 'expected elevation.md shadow applied inline');
    assert.ok(html.includes('box-shadow: none'), 'expected elevation.flat shadow as none');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('generateStyleGuide: surfaces section silently skipped when both rounded + elevation are empty', () => {
  const dir = mkBrandDir('surfaces-empty', {
    'tokens/surfaces.md': '---\nrounded:\n  # sm: 4px\nelevation:\n  # flat: none\n---\n',
  });
  try {
    const html = generateStyleGuide(dir, 'ACME Corp', FIXED_NOW);
    assert.ok(!html.includes('<h2>Surfaces</h2>'), 'expected no Surfaces heading when source data is empty');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('generateStyleGuide: token values cannot inject CSS via semicolons (defense in depth)', () => {
  // The user controls their own .brand/ so this is closer to "shoot own foot"
  // than a real vulnerability, but escapeHtml does not strip CSS-significant
  // characters and a token value of "red; background: black" would otherwise
  // inject a second declaration. Sanitize ;, {, }, <, >, \n, \r before any
  // value lands inside an inline style attribute.
  const dir = mkBrandDir('css-injection', {
    'tokens/colors.md': '---\ncolors:\n  evil: "red; background: black"\n---\n',
    'tokens/typography.md': '---\ntypography:\n  evil:\n    fontFamily: "Inter; background: black"\n    fontSize: 16px\n    fontWeight: 400\n    lineHeight: 1.5\n---\n',
    'tokens/surfaces.md': '---\nrounded:\n  evil: "4px; background: black"\nelevation:\n  evil: "0 1px 2px rgba(0,0,0,0.1); background: black"\n---\n',
  });
  try {
    const html = generateStyleGuide(dir, 'ACME Corp', FIXED_NOW);
    // The injected `background: black` declaration must not survive into any
    // inline style attribute. The substring may appear inside a <span> meta
    // line (text content) but never inside style="..." -- check both.
    const styleAttrs = html.match(/style="[^"]*"/g) || [];
    for (const attr of styleAttrs) {
      assert.ok(!attr.includes('background: black'),
        `expected no CSS injection in style attribute: ${attr}`);
    }
    // Sanity: the token value, with the injection stripped, still appears
    // in style attributes (escapeCss removes ; not the value before it).
    assert.ok(styleAttrs.some((a) => a.includes('background: red')),
      'expected the sanitized "red" prefix to survive in a style attribute');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('generateStyleGuide: voice section renders pull-quotes from Observed Voice (caps at 3)', () => {
  const dir = mkBrandDir('voice-populated', {
    'voice.md': [
      '# Voice',
      '',
      'Acme writes in plain sentences.',
      '',
      '## Observed Voice (live channels)',
      '',
      '> "The data is what it is. Read it carefully."',
      '',
      '> "Numbers do not negotiate."',
      '',
      '> "If you must guess, write down what you guessed."',
      '',
      '> "A fourth quote that should be capped off."',
      '',
    ].join('\n'),
  });
  try {
    const html = generateStyleGuide(dir, 'ACME Corp', FIXED_NOW);
    assert.match(html, /<h2>Voice<\/h2>/);
    assert.ok(html.includes('The data is what it is.'), 'expected first quote');
    assert.ok(html.includes('Numbers do not negotiate.'), 'expected second quote');
    assert.ok(html.includes('If you must guess'), 'expected third quote');
    assert.ok(!html.includes('A fourth quote'), 'expected the fourth quote to be capped');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('generateStyleGuide: voice section silently skipped when Observed Voice has no blockquotes', () => {
  const dir = mkBrandDir('voice-empty', {
    'voice.md': '# Voice\n\nAcme writes in plain sentences.\n\n## Observed Voice (live channels)\n_Stub for tests; not extracted._\n',
  });
  try {
    const html = generateStyleGuide(dir, 'ACME Corp', FIXED_NOW);
    assert.ok(!html.includes('<h2>Voice</h2>'), 'expected no Voice section heading when source has no blockquotes');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('generateStyleGuide: conflicts banner renders when conflicts.md has Active Conflicts entries', () => {
  const dir = mkBrandDir('conflicts-active', {
    'conflicts.md': [
      '# Conflicts',
      '',
      '## Active Conflicts',
      '',
      '### Primary color disagreement',
      'Brand guide says #007749; Figma says #008542.',
      '',
      '### Body font on web vs. print',
      'Print uses Display family; web uses Body family.',
      '',
      '## Intentional Adaptations',
      '',
      '### Font substitution on web',
      'Display font swapped for Body to keep page weight low.',
      '',
    ].join('\n'),
  });
  try {
    const html = generateStyleGuide(dir, 'ACME Corp', FIXED_NOW);
    assert.match(html, /class="banner">⚠ 2 active conflicts — see/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('generateStyleGuide: conflicts banner suppressed when Active Conflicts is empty', () => {
  const dir = mkBrandDir('conflicts-empty', {
    'conflicts.md': [
      '# Conflicts',
      '',
      'No active conflicts in this fixture.',
      '',
      '## Active Conflicts',
      '',
      '_(none)_',
      '',
    ].join('\n'),
  });
  try {
    const html = generateStyleGuide(dir, 'ACME Corp', FIXED_NOW);
    assert.ok(!html.includes('class="banner"'), 'expected no banner when Active Conflicts is empty');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('generateStyleGuide: output is a single self-contained HTML document', () => {
  const dir = mkBrandDir('single-document', {
    'tokens/colors.md': '---\ncolors:\n  primary: "#0066ff"\n---\n',
    'tokens/typography.md': '---\ntypography:\n  body-md:\n    fontSize: 16px\n    fontFamily: Inter\n---\n',
  });
  try {
    const html = generateStyleGuide(dir, 'ACME Corp', FIXED_NOW);
    assert.ok(html.startsWith('<!DOCTYPE html>'), 'expected the document to begin with the doctype');
    // Exactly one <style> block in <head>.
    const styleBlockCount = (html.match(/<style[\s>]/g) || []).length;
    assert.equal(styleBlockCount, 1, 'expected exactly one <style> block');
    // Zero <script> tags.
    assert.ok(!/<script[\s>]/.test(html), 'expected no <script> tags');
    // Zero <link rel="stylesheet">.
    assert.ok(!/<link\s+[^>]*rel\s*=\s*["']?stylesheet/.test(html), 'expected no <link rel="stylesheet">');
    // Zero external <script src=...>.
    assert.ok(!/<script\s+[^>]*src\s*=/.test(html), 'expected no external <script src=>');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('generateStyleGuide: never throws on malformed YAML frontmatter', () => {
  const dir = mkBrandDir('malformed-yaml', {
    'tokens/colors.md': '---\ncolors: [[[[[invalid\n---\n',
    'tokens/typography.md': '---\ntypography: {{{{{invalid\n---\n',
  });
  try {
    const html = generateStyleGuide(dir, 'ACME Corp', FIXED_NOW);
    // Generator does not throw -- both sections fall back to empty-state callouts.
    assert.match(html, /No colors extracted yet\. Run \/brand-context:extract\./);
    assert.match(html, /No typography extracted yet\. Run \/brand-context:extract\./);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('generateStyleGuide: conflicts banner does NOT count entries from "## Active Conflicts (archived)" or similar parenthetical headings', () => {
  // The Active-Conflicts H2 must match exactly. A user who archives old
  // conflicts under "## Active Conflicts (archived)" should see only the
  // current section feeding the banner count.
  const dir = mkBrandDir('conflicts-archived', {
    'conflicts.md': [
      '# Conflicts',
      '',
      '## Active Conflicts (archived)',
      '',
      '### Old conflict A',
      '',
      '### Old conflict B',
      '',
      '## Active Conflicts',
      '',
      '### Current conflict',
      '',
    ].join('\n'),
  });
  try {
    const html = generateStyleGuide(dir, 'ACME Corp', FIXED_NOW);
    assert.match(html, /1 active conflict\b/);
    assert.ok(!/3 active conflict/.test(html), 'expected archived entries to be excluded from the banner count');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
