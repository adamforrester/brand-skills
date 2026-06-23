import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeManifest, validateManifest } from '../../src/utils/manifest-writer.js';

function validPayload() {
  return {
    version: '2',
    generated_at: '2026-06-10T14:23:11Z',
    generator: 'brand-cli@0.5.0',
    tier: 'minimum',
    client: 'acme',
    files: {
      'overview.md': { status: 'complete', bytes: 1000 },
    },
    stages: {
      '4_overview': {
        ran: true,
        wrote: ['overview.md'],
        fallback_decision: 'none',
        chain_entry_used: { kind: 'native_tool', name: 'read', quality_label: 'full' },
        required_dependencies: [],
        available_dependencies: ['read'],
      },
    },
    dependencies: {
      playwright: { kind: 'mcp', available: false, used_by: [] },
    },
  };
}

test('validateManifest accepts a valid payload', () => {
  const result = validateManifest(validPayload());
  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, null);
});

test('validateManifest rejects missing required field', () => {
  const p = validPayload();
  delete p.tier;
  const result = validateManifest(p);
  assert.equal(result.valid, false);
  assert.match(result.errorText, /tier/);
});

test('validateManifest rejects invalid status enum', () => {
  const p = validPayload();
  p.files['overview.md'].status = 'unknown';
  const result = validateManifest(p);
  assert.equal(result.valid, false);
});

test('validateManifest rejects unknown root key', () => {
  const p = validPayload();
  p.bogus = true;
  const result = validateManifest(p);
  assert.equal(result.valid, false);
});

test('validateManifest accepts _comment at root', () => {
  const p = validPayload();
  p._comment = 'Generated; do not hand-edit.';
  const result = validateManifest(p);
  assert.equal(result.valid, true);
});

test('writeManifest writes valid JSON to disk and pretty-prints', () => {
  const dir = mkdtempSync(join(tmpdir(), 'brand-test-'));
  try {
    const path = join(dir, 'manifest.json');
    writeManifest(path, validPayload());
    const raw = readFileSync(path, 'utf-8');
    const parsed = JSON.parse(raw);
    assert.equal(parsed.version, '2');
    // 2-space indent
    assert.match(raw, /\n {2}"version"/);
    // trailing newline
    assert.equal(raw.endsWith('\n'), true);
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('writeManifest throws on invalid payload', () => {
  const dir = mkdtempSync(join(tmpdir(), 'brand-test-'));
  try {
    const path = join(dir, 'manifest.json');
    const p = validPayload();
    delete p.version;
    assert.throws(() => writeManifest(path, p), /failed schema validation/);
  } finally {
    rmSync(dir, { recursive: true });
  }
});
