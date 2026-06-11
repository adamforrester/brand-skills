import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { withFixture } from '../helpers/tmp-brand.js';
import { runCli } from '../helpers/run-cli.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const GOLDEN = resolve(__dirname, '../golden');

test('score writes .health.json from populated fixture', async () => {
  const { dir, brandDir, cleanup } = withFixture('populated');
  try {
    const result = await runCli(['score'], { cwd: dir });
    assert.equal(result.exitCode, 0);
    const healthPath = join(brandDir, '.health.json');
    assert.equal(existsSync(healthPath), true);
    const health = JSON.parse(readFileSync(healthPath, 'utf-8'));
    assert.equal(health.version, '1');
    assert.equal(health.manifest_seen, false); // no manifest in this fixture
    assert.equal(health.tier, 'standard');
  } finally {
    cleanup();
  }
});

test('score against populated fixture matches golden health', async () => {
  const { dir, brandDir, cleanup } = withFixture('populated');
  try {
    await runCli(['score'], { cwd: dir });
    const health = JSON.parse(readFileSync(join(brandDir, '.health.json'), 'utf-8'));
    const golden = JSON.parse(readFileSync(join(GOLDEN, 'health-from-populated.json'), 'utf-8'));
    delete health.generated_at;
    delete health.generator;
    delete golden.generated_at;
    delete golden.generator;
    assert.deepEqual(health, golden);
  } finally {
    cleanup();
  }
});

test('score still exits 0 and prints summary on incomplete .brand/', async () => {
  const { dir, brandDir, cleanup } = withFixture('fresh-init');
  try {
    const result = await runCli(['score'], { cwd: dir });
    assert.equal(result.exitCode, 0);
    assert.match(result.stdout, /Summary/);
    assert.match(result.stdout, /incomplete/);
    const health = JSON.parse(readFileSync(join(brandDir, '.health.json'), 'utf-8'));
    assert(health.readiness < 0.1, `expected readiness < 0.1, got ${health.readiness}`);
    assert.equal(health.tier_label, 'incomplete');
  } finally {
    cleanup();
  }
});
