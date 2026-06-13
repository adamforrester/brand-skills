import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  loadContract,
  getStageContract,
  getDependency,
} from '../../src/utils/contract-loader.js';

test('loadContract returns parsed contract with stages and dependencies', () => {
  const c = loadContract();
  assert.equal(c.version, '1');
  assert.ok(c.stages);
  assert.ok(c.dependencies);
});

test('loadContract result is cached (same reference across calls)', () => {
  const a = loadContract();
  const b = loadContract();
  assert.equal(a, b);
});

test('getStageContract returns the stage entry for a known key', () => {
  const s = getStageContract('3_voice');
  assert.equal(s.purpose.length > 0, true);
  assert.ok(Array.isArray(s.chain));
  assert.ok(s.chain.length >= 1);
  assert.equal(s.chain[0].kind, 'mcp');
  assert.equal(s.chain[0].name, 'playwright');
});

test('getStageContract returns undefined for unknown stage', () => {
  const s = getStageContract('99_bogus');
  assert.equal(s, undefined);
});

test('getDependency returns the dependency entry for a known name', () => {
  const d = getDependency('jina-reader');
  assert.equal(d.kind, 'http');
  assert.equal(d.endpoint, 'https://r.jina.ai/<URL>');
  assert.equal(d.auth, 'none');
});

test('getDependency returns undefined for unknown dependency', () => {
  assert.equal(getDependency('not-a-real-dep'), undefined);
});

test('every chain entry references a known dependency name (cross-link integrity)', () => {
  const c = loadContract();
  for (const [stageKey, stage] of Object.entries(c.stages)) {
    for (const entry of stage.chain) {
      assert.ok(
        c.dependencies[entry.name],
        `Stage ${stageKey} chain entry '${entry.name}' has no matching dependencies entry`
      );
    }
  }
});

test('every dependency.enables_stages references a known stage key', () => {
  const c = loadContract();
  const stageKeys = new Set(Object.keys(c.stages));
  for (const [name, dep] of Object.entries(c.dependencies)) {
    for (const stageKey of dep.enables_stages) {
      assert.ok(
        stageKeys.has(stageKey),
        `Dependency '${name}' enables unknown stage '${stageKey}'`
      );
    }
  }
});
