import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { withFixture } from '../helpers/tmp-brand.js';
import { runCli } from '../helpers/run-cli.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const FIXTURES = resolve(__dirname, '../fixtures');

test('round-trip: emit-manifest then score uses manifest as input', async () => {
  const { dir, brandDir, cleanup } = withFixture('populated');
  try {
    const stdin = readFileSync(join(FIXTURES, 'stage-data/full-pipeline.json'), 'utf-8');
    const emit = await runCli(['emit-manifest'], { cwd: dir, stdin });
    assert.equal(emit.exitCode, 0);

    const score = await runCli(['score'], { cwd: dir });
    assert.equal(score.exitCode, 0);

    const manifest = JSON.parse(readFileSync(join(brandDir, 'manifest.json'), 'utf-8'));
    const health = JSON.parse(readFileSync(join(brandDir, '.health.json'), 'utf-8'));

    assert.equal(health.manifest_seen, true);
    assert.equal(health.manifest_generated_at, manifest.generated_at);
    // Populated fixture has all content; full-pipeline overrides nothing → all complete.
    assert.equal(health.confidence, 'HIGH');
    assert.equal(health.downgrades.length, 0);
  } finally {
    cleanup();
  }
});

test('round-trip with defaults: confidence drops to MEDIUM, downgrades populated', async () => {
  const { dir, brandDir, cleanup } = withFixture('populated');
  try {
    const stdin = readFileSync(join(FIXTURES, 'stage-data/partial-pipeline.json'), 'utf-8');
    await runCli(['emit-manifest'], { cwd: dir, stdin });
    await runCli(['score'], { cwd: dir });

    const health = JSON.parse(readFileSync(join(brandDir, '.health.json'), 'utf-8'));
    assert.equal(health.manifest_seen, true);
    assert.equal(health.confidence, 'MEDIUM');
    assert.equal(health.downgrades.length, 2);
    const files = health.downgrades.map((d) => d.file).sort();
    assert.deepEqual(files, ['tokens/colors.md', 'voice.md']);
  } finally {
    cleanup();
  }
});
