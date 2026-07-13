import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { generateBrandContext } from '../../src/utils/brand-context-generator.js';

function mkBrandDir(name, files) {
  const dir = join(tmpdir(), `brand-ctx-test-${name}-${process.pid}`);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  for (const [relPath, content] of Object.entries(files)) {
    const fullPath = join(dir, relPath);
    mkdirSync(join(fullPath, '..'), { recursive: true });
    writeFileSync(fullPath, content, 'utf-8');
  }
  return dir;
}

// A well-formed, fully-populated overview.md following the schema headings.
const OVERVIEW = `# Brand Overview

## Brand Identity
**Brand:** Evergy
**Positioning:** Investor-owned electric utility serving Kansas & Missouri. "Power You Can Count On."

## Brand Personality
**Traits:** Reliable, community-rooted, forward-looking
Evergy feels dependable and civic-minded.

## Visual Language
**Direction:** Clean, energetic, optimistic. Green-forward palette.

## Competitive Context
**Differentiation:** Local and accountable where national utilities feel faceless.

## Brand self-test (run before presenting work)
1. Could this belong to a competitor? (should be NO)
2. Does it feel dependable, not flashy?
`;

const VOICE = `# Voice

## Voice Principles
Clear, plain-spoken, never bureaucratic.
`;

test('generateBrandContext: section bodies contain source prose, not the heading label', () => {
  const dir = mkBrandDir('body-not-heading', {
    'overview.md': OVERVIEW,
    'voice.md': VOICE,
  });
  try {
    const md = generateBrandContext(dir, 'Evergy');

    // The core regression: each section must carry the .brand/ prose that
    // follows its heading, NOT the literal heading string.
    assert.match(md, /## Identity\n\n\*\*Brand:\*\* Evergy/, 'Identity block must contain overview prose');
    assert.doesNotMatch(md, /## Identity\n\nBrand Identity\b/, 'Identity block must NOT echo the "Brand Identity" heading as its body');

    assert.match(md, /Reliable, community-rooted/, 'Personality prose must be present');
    assert.doesNotMatch(md, /## Personality\n\nBrand Personality\b/, 'Personality block must NOT echo its heading');

    assert.match(md, /Green-forward palette/, 'Visual language prose must be present');
    assert.doesNotMatch(md, /## Visual language\n\nVisual Language\b/, 'Visual block must NOT echo its heading');

    assert.match(md, /Clear, plain-spoken/, 'Voice principles prose must be present');
    assert.doesNotMatch(md, /## Voice \(summary\)\n\nVoice Principles\b/, 'Voice block must NOT echo its heading');

    assert.match(md, /Local and accountable/, 'Competitive context prose must be present');

    assert.match(md, /Could this belong to a competitor/, 'Self-test prose must be present');
    assert.doesNotMatch(md, /## Brand self-test \(run before presenting\)\n\nBrand self-test\b/, 'Self-test block must NOT echo its heading');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('generateBrandContext: falls back to the extract-prompt stub when overview is empty', () => {
  const dir = mkBrandDir('empty-overview', {
    'overview.md': '# Brand Overview\n\n<!-- placeholder -->\n',
  });
  try {
    const md = generateBrandContext(dir, 'Evergy');
    assert.match(md, /## Identity\n\n_Run `\/brand-context:extract`/, 'empty overview should yield the Identity stub');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
