import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadScope, validateScope } from '../../src/utils/scope-loader.js';

function tmpBrandDir(scopeContent) {
  const dir = mkdtempSync(join(tmpdir(), 'scope-loader-'));
  const brandDir = join(dir, '.brand');
  mkdirSync(brandDir, { recursive: true });
  if (scopeContent !== undefined) {
    writeFileSync(join(brandDir, '.scope.json'), scopeContent);
  }
  return { brandDir, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

test('loadScope returns null when .brand/.scope.json is absent', () => {
  const { brandDir, cleanup } = tmpBrandDir();
  try {
    assert.equal(loadScope(brandDir), null);
  } finally { cleanup(); }
});

test('loadScope returns parsed object when .scope.json is present and valid JSON', () => {
  const { brandDir, cleanup } = tmpBrandDir(JSON.stringify({ client: 'ACME', tier: 'standard' }));
  try {
    const s = loadScope(brandDir);
    assert.equal(s.client, 'ACME');
    assert.equal(s.tier, 'standard');
  } finally { cleanup(); }
});

test('loadScope throws with file path on malformed JSON', () => {
  const { brandDir, cleanup } = tmpBrandDir('{ "client": "ACME", '); // truncated
  try {
    assert.throws(
      () => loadScope(brandDir),
      (err) => /scope\.json/.test(err.message) && /not valid JSON/.test(err.message)
    );
  } finally { cleanup(); }
});

test('validateScope accepts an empty object', () => {
  const r = validateScope({});
  assert.equal(r.valid, true);
});

test('validateScope rejects bad tier value with ajv error text', () => {
  const r = validateScope({ tier: 'wrong' });
  assert.equal(r.valid, false);
  assert.match(r.errorText, /tier/);
});

test('validateScope rejects unknown top-level field (additionalProperties: false)', () => {
  const r = validateScope({ unknownTopLevel: 'foo' });
  assert.equal(r.valid, false);
  assert.match(r.errorText, /additional|unknownTopLevel/);
});
