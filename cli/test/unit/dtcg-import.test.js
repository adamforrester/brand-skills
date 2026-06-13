import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { importDtcgFile, importDtcgFiles } from '../../src/utils/dtcg-import.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const FIXTURES = resolve(__dirname, '../fixtures/dtcg-tokens');

test('importDtcgFile parses a colors.tokens.json into the colors bucket', () => {
  const result = importDtcgFile(resolve(FIXTURES, 'colors.tokens.json'));
  assert.deepEqual(result.colors, {
    'primary':      '#E2231A',
    'primary-dark': '#C1190F',
    'neutral-900':  '#1A1A1A',
    'neutral-50':   '#F8F8F8',
  });
  assert.deepEqual(result.typography, {});
  assert.deepEqual(result.spacing, {});
  assert.deepEqual(result.surfaces, {});
  assert.deepEqual(result.motion, {});
  assert.deepEqual(result.unknown, []);
});

test('importDtcgFile parses a typography.tokens.json into typography fields', () => {
  const result = importDtcgFile(resolve(FIXTURES, 'typography.tokens.json'));
  assert.equal(result.typography['family-base'], 'Inter, sans-serif');
  assert.equal(result.typography['size-body'], '16px');
  assert.equal(result.typography['weight-regular'], 400);
});

test('importDtcgFile throws on missing $type', () => {
  assert.throws(
    () => importDtcgFile(resolve(FIXTURES, 'malformed.tokens.json')),
    /missing \$type/
  );
});

test('importDtcgFile throws on unreadable path', () => {
  assert.throws(
    () => importDtcgFile(resolve(FIXTURES, 'does-not-exist.tokens.json')),
    /no such file|ENOENT/
  );
});

test('importDtcgFiles merges multiple files; later files win on key conflict', () => {
  const result = importDtcgFiles([
    resolve(FIXTURES, 'colors.tokens.json'),
    resolve(FIXTURES, 'typography.tokens.json'),
  ]);
  assert.equal(result.colors.primary, '#E2231A');
  assert.equal(result.typography['family-base'], 'Inter, sans-serif');
});

test('importDtcgFile preserves unknown $type entries verbatim', () => {
  const result = importDtcgFile(resolve(FIXTURES, 'unknown-type.tokens.json'));
  assert.equal(result.unknown.length, 1);
  assert.equal(result.unknown[0].$type, 'gradient');
  assert.equal(result.unknown[0].path, 'gradient.hero');
});
