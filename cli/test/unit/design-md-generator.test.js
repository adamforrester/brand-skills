import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { parse as yamlParse } from 'yaml';
import { generateDesignMd } from '../../src/utils/design-md-generator.js';

function mkBrandDir(name, files) {
  const dir = join(tmpdir(), `design-md-test-${name}-${process.pid}`);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  for (const [relPath, content] of Object.entries(files)) {
    const fullPath = join(dir, relPath);
    mkdirSync(join(fullPath, '..'), { recursive: true });
    writeFileSync(fullPath, content, 'utf-8');
  }
  return dir;
}

// Pull the YAML frontmatter object out of a generated design.md.
function frontmatterOf(md) {
  const m = md.match(/^---\n([\s\S]*?)\n---\n/);
  assert.ok(m, 'expected a --- fenced frontmatter block');
  return yamlParse(m[1]);
}

test('generateDesignMd: merges token blocks into frontmatter', () => {
  const dir = mkBrandDir('token-blocks', {
    'tokens/colors.md': '---\ncolors:\n  primary: "#C8102E"\n  neutral-900: "#191A1B"\n---\n',
    'tokens/typography.md': '---\ntypography:\n  display-lg:\n    fontFamily: Inter\n    fontSize: 48px\n    fontWeight: 700\n    lineHeight: 1.1\n---\n',
    'tokens/surfaces.md': '---\nrounded:\n  md: 8px\nelevation:\n  flat: none\n---\n',
  });
  try {
    const fm = frontmatterOf(generateDesignMd(dir, 'Acme'));
    assert.equal(fm.name, 'Acme');
    assert.equal(fm.colors.primary, '#C8102E');
    assert.ok(fm.typography['display-lg'], 'display-lg type role present');
    assert.equal(fm.rounded.md, '8px');
    assert.equal(fm.elevation.flat, 'none');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('generateDesignMd: passes an x-prism3 block from surfaces.md through to a top-level key', () => {
  const dir = mkBrandDir('x-prism3-passthrough', {
    'tokens/surfaces.md': '---\nrounded:\n  md: 8px\nx-prism3:\n  radiusScale: 2\n  typeScale: expressive\n  surfaces:\n    light: { base: 50 }\n---\n',
  });
  try {
    const md = generateDesignMd(dir, 'Acme');
    const fm = frontmatterOf(md);
    assert.ok(fm['x-prism3'], 'expected a top-level x-prism3 key');
    assert.equal(fm['x-prism3'].radiusScale, 2);
    assert.equal(fm['x-prism3'].typeScale, 'expressive');
    assert.equal(fm['x-prism3'].surfaces.light.base, 50);
    // Verbatim passthrough — brand-skills does not validate lever values.
    assert.match(md, /x-prism3:/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('generateDesignMd: no x-prism3 key when surfaces.md carries no block (plain-spec stays plain)', () => {
  const dir = mkBrandDir('x-prism3-absent', {
    'tokens/surfaces.md': '---\nrounded:\n  md: 8px\nelevation:\n  flat: none\n---\n',
  });
  try {
    const fm = frontmatterOf(generateDesignMd(dir, 'Acme'));
    assert.ok(!('x-prism3' in fm), 'expected no x-prism3 key');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
