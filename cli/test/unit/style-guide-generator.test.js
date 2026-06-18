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
