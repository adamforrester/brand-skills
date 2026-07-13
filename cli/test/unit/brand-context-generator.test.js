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

test('generateBrandContext: promotes a bold "**Aesthetic anti-patterns:**" label to a clean section (block-list shape)', () => {
  // Real Evergy shape: the anti-patterns are a bold inline label inside
  // Competitive Context, followed by a bulleted block. The extractor promotes
  // it to its own `## Aesthetic anti-patterns` section — it must NOT re-emit the
  // label line, and must not orphan the `**` bold markers.
  const overview = `# Brand Overview

## Competitive Context
**Differentiation:** Trust and local rootedness.

**Aesthetic anti-patterns:**
- NOT flashy or hype-driven.
- NOT sterile corporate minimalism.
- NOT jargon-forward.
`;
  const dir = mkBrandDir('anti-block', { 'overview.md': overview });
  try {
    const md = generateBrandContext(dir, 'Evergy');
    assert.match(md, /## Aesthetic anti-patterns/, 'anti-patterns section heading present');
    // The ENTIRE list content is intact (not truncated to the first bullet)...
    assert.match(md, /- NOT flashy or hype-driven\./, 'first anti-pattern list item present');
    assert.match(md, /- NOT sterile corporate minimalism\./, 'middle anti-pattern list item present');
    assert.match(md, /- NOT jargon-forward\./, 'last anti-pattern list item present');
    // ...but the malformed label line must be gone (no re-emitted label, no orphaned **).
    assert.doesNotMatch(md, /Aesthetic anti-patterns:\*\*/, 'must not render the orphaned "Aesthetic anti-patterns:**" label');
    assert.doesNotMatch(md, /## Aesthetic anti-patterns\n\n[^\n]*anti-patterns:/i, 'section body must start with content, not the label');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('generateBrandContext: handles the schema-canonical inline anti-patterns shape', () => {
  // overview.schema.md:112 shape — inline label + comma-separated body on one line.
  const overview = `# Brand Overview

## Competitive Context
**Differentiation:** Personality-driven.
**Aesthetic anti-patterns:** NOT corporate minimalist (too sterile), NOT retro diner (too nostalgic). Modern and energetic.
`;
  const dir = mkBrandDir('anti-inline', { 'overview.md': overview });
  try {
    const md = generateBrandContext(dir, 'Evergy');
    assert.match(md, /## Aesthetic anti-patterns/, 'anti-patterns section heading present');
    assert.match(md, /NOT corporate minimalist \(too sterile\)/, 'inline anti-pattern body present');
    assert.doesNotMatch(md, /Aesthetic anti-patterns:\*\*/, 'must not render an orphaned bold label');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('generateBrandContext: a mid-sentence "anti-pattern" mention is NOT promoted to a section', () => {
  // Guard against over-eager matching: only a line-leading label callout should
  // become the Aesthetic anti-patterns section. A prose mention keeps the whole
  // Competitive Context under its own heading.
  const overview = `# Brand Overview

## Competitive Context
**Differentiation:** Trust and local roots. There is no anti-pattern callout in this prose.
`;
  const dir = mkBrandDir('anti-midsentence', { 'overview.md': overview });
  try {
    const md = generateBrandContext(dir, 'Evergy');
    assert.match(md, /## Competitive context/, 'should render Competitive context, not a spurious anti-patterns section');
    assert.doesNotMatch(md, /## Aesthetic anti-patterns/, 'mid-sentence mention must not create an anti-patterns section');
    assert.match(md, /Trust and local roots/, 'full competitive body preserved');
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
