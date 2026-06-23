import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildHealth, writeHealth, validateHealth } from '../../src/utils/health-writer.js';

function makeManifest() {
  return {
    version: '2',
    generated_at: '2026-06-10T14:23:11Z',
    generator: 'brand-cli@0.5.0',
    tier: 'minimum',
    client: 'acme',
    files: {
      'overview.md': { status: 'complete', bytes: 4000 },
      'voice.md': { status: 'placeholder' },
      'tokens/colors.md': { status: 'complete' },
      'tokens/typography.md': { status: 'defaults', note: 'single-page sample' },
      'tokens/spacing.md': { status: 'missing' },
      'tokens/motion.md': { status: 'missing' },
      'tokens/surfaces.md': { status: 'complete' },
    },
    stages: { '2_web': { ran: true, wrote: [], fallback_decision: 'none' } },
    dependencies: { playwright: { kind: 'mcp', available: true, used_by: ['2_web'] } },
  };
}

test('buildHealth from manifest computes readiness from weights', () => {
  const h = buildHealth({ manifest: makeManifest(), now: '2026-06-10T14:25:42Z' });
  // weights: overview=2, voice=2, colors=1, typography=1, spacing=1, motion=1, surfaces=1 = 9
  // complete-or-defaults: overview(2) + colors(1) + typography(1, defaults) + surfaces(1) = 5
  // 5 / 9 = 0.555... → 0.56
  assert.equal(h.readiness, 0.56);
  assert.equal(h.weighted_complete, 5);
  assert.equal(h.weighted_total, 9);
  assert.equal(h.tier_label, 'partial');
});

test('buildHealth marks manifest_seen true and echoes manifest timestamp', () => {
  const h = buildHealth({ manifest: makeManifest(), now: '2026-06-10T14:25:42Z' });
  assert.equal(h.manifest_seen, true);
  assert.equal(h.manifest_generated_at, '2026-06-10T14:23:11Z');
});

test('buildHealth confidence is MEDIUM when defaults present', () => {
  const h = buildHealth({ manifest: makeManifest(), now: '2026-06-10T14:25:42Z' });
  assert.equal(h.confidence, 'MEDIUM');
});

test('buildHealth populates downgrades for defaults files', () => {
  const h = buildHealth({ manifest: makeManifest(), now: '2026-06-10T14:25:42Z' });
  assert.deepEqual(h.downgrades, [
    { file: 'tokens/typography.md', reason: 'single-page sample' },
  ]);
});

test('buildHealth gaps lists every non-complete non-defaults file', () => {
  const h = buildHealth({ manifest: makeManifest(), now: '2026-06-10T14:25:42Z' });
  const files = h.gaps.map((g) => g.file).sort();
  assert.deepEqual(files, ['tokens/motion.md', 'tokens/spacing.md', 'voice.md']);
  for (const g of h.gaps) {
    assert.match(g.suggested_action, /\S/); // non-empty
  }
});

test('buildHealth without manifest scans content; manifest_seen false; downgrades empty', () => {
  const dir = mkdtempSync(join(tmpdir(), 'brand-test-'));
  try {
    const h = buildHealth({
      manifest: null,
      brandDir: dir,
      tier: 'minimum',
      client: 'acme',
      now: '2026-06-10T14:25:42Z',
    });
    assert.equal(h.manifest_seen, false);
    assert.equal(h.downgrades.length, 0);
    // All files missing → readiness 0
    assert.equal(h.readiness, 0);
    assert.equal(h.tier_label, 'incomplete');
    // confidence cap: scanCompleteRatio = 0/9 = 0 → LOW
    assert.equal(h.confidence, 'LOW');
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('writeHealth writes valid JSON', () => {
  const dir = mkdtempSync(join(tmpdir(), 'brand-test-'));
  try {
    const path = join(dir, '.health.json');
    const h = buildHealth({ manifest: makeManifest(), now: '2026-06-10T14:25:42Z' });
    writeHealth(path, h);
    const parsed = JSON.parse(readFileSync(path, 'utf-8'));
    assert.equal(parsed.version, '1');
    assert.equal(parsed.readiness, 0.56);
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('validateHealth rejects readiness > 1', () => {
  const h = buildHealth({ manifest: makeManifest(), now: '2026-06-10T14:25:42Z' });
  h.readiness = 1.5;
  const r = validateHealth(h);
  assert.equal(r.valid, false);
  assert.match(r.errorText, /readiness/);
});
