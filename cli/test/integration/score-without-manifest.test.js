import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { withFixture } from '../helpers/tmp-brand.js';
import { runCli } from '../helpers/run-cli.js';

test('score without manifest: manifest_seen false, no defaults marked', async () => {
  const { dir, brandDir, cleanup } = withFixture('mixed');
  try {
    assert.equal(existsSync(join(brandDir, 'manifest.json')), false);
    await runCli(['score'], { cwd: dir });
    const health = JSON.parse(readFileSync(join(brandDir, '.health.json'), 'utf-8'));
    assert.equal(health.manifest_seen, false);
    assert.equal(health.downgrades.length, 0);
    // No file should be 'partial' or 'defaults' from a content-scan-only run.
    for (const status of Object.values(health.files)) {
      assert(['complete', 'placeholder', 'missing'].includes(status), `unexpected status: ${status}`);
    }
  } finally {
    cleanup();
  }
});

test('score without manifest: confidence capped at MEDIUM', async () => {
  const { dir, brandDir, cleanup } = withFixture('populated');
  try {
    await runCli(['score'], { cwd: dir });
    const health = JSON.parse(readFileSync(join(brandDir, '.health.json'), 'utf-8'));
    // Populated fixture is fully complete by content scan, so scanCompleteRatio = 1.0
    // confidence should be MEDIUM (manifest_seen: false caps it)
    assert.equal(health.manifest_seen, false);
    assert.equal(health.confidence, 'MEDIUM');
  } finally {
    cleanup();
  }
});
