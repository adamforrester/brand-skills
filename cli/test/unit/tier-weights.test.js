import { test } from 'node:test';
import assert from 'node:assert/strict';
import { weightsForTier, readiness, tierLabel, confidence } from '../../src/utils/tier-weights.js';

test('weightsForTier(minimum) returns 7 entries totaling 9', () => {
  const w = weightsForTier('minimum');
  assert.equal(Object.keys(w).length, 7);
  assert.equal(Object.values(w).reduce((a, b) => a + b, 0), 9);
  assert.equal(w['overview.md'], 2);
  assert.equal(w['voice.md'], 2);
  assert.equal(w['tokens/colors.md'], 1);
});

test('weightsForTier(standard) extends minimum with composition + conflicts + CHANGELOG', () => {
  const w = weightsForTier('standard');
  assert.equal(Object.keys(w).length, 12);
  assert.equal(w['composition/page-types.md'], 1);
  assert.equal(w['composition/patterns.md'], 1);
  assert.equal(w['composition/anti-patterns.md'], 1);
  assert.equal(w['conflicts.md'], 1);
  assert.equal(w['CHANGELOG.md'], 1);
});

test('weightsForTier(comprehensive) adds 4 workflow files', () => {
  const w = weightsForTier('comprehensive');
  assert.equal(Object.keys(w).length, 16);
  assert.equal(w['workflows/figma-to-code.md'], 1);
});

test('weightsForTier throws on unknown tier', () => {
  assert.throws(() => weightsForTier('bogus'), /Unknown tier/);
});

test('readiness counts complete and defaults; ignores partial/placeholder/missing', () => {
  const weights = { 'a.md': 2, 'b.md': 1, 'c.md': 1 };
  const files = { 'a.md': 'complete', 'b.md': 'defaults', 'c.md': 'placeholder' };
  // weighted_complete = 2 + 1 = 3, weighted_total = 4
  assert.equal(readiness(files, weights), 0.75);
});

test('readiness rounds to two decimals', () => {
  const weights = { 'a.md': 1, 'b.md': 1, 'c.md': 1 };
  const files = { 'a.md': 'complete', 'b.md': 'missing', 'c.md': 'missing' };
  // 1/3 = 0.333... → 0.33
  assert.equal(readiness(files, weights), 0.33);
});

test('readiness returns 0 for empty inputs', () => {
  assert.equal(readiness({}, {}), 0);
});

test('tierLabel boundaries', () => {
  assert.equal(tierLabel(0.95), 'ready');
  assert.equal(tierLabel(0.80), 'good');
  assert.equal(tierLabel(0.50), 'partial');
  assert.equal(tierLabel(0.49), 'incomplete');
  assert.equal(tierLabel(0), 'incomplete');
  assert.equal(tierLabel(1.0), 'ready');
});

test('confidence: HIGH when manifest seen and no defaults', () => {
  assert.equal(confidence({ manifestSeen: true, hasDefaults: false, scanCompleteRatio: 1 }), 'HIGH');
});

test('confidence: MEDIUM when manifest seen with defaults', () => {
  assert.equal(confidence({ manifestSeen: true, hasDefaults: true, scanCompleteRatio: 1 }), 'MEDIUM');
});

test('confidence: MEDIUM on content-scan with >=80% complete', () => {
  assert.equal(confidence({ manifestSeen: false, hasDefaults: false, scanCompleteRatio: 0.85 }), 'MEDIUM');
});

test('confidence: LOW on content-scan with <80% complete', () => {
  assert.equal(confidence({ manifestSeen: false, hasDefaults: false, scanCompleteRatio: 0.5 }), 'LOW');
});
