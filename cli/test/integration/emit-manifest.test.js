import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { withFixture } from '../helpers/tmp-brand.js';
import { runCli } from '../helpers/run-cli.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const FIXTURES = resolve(__dirname, '../fixtures');
const GOLDEN = resolve(__dirname, '../golden');

test('emit-manifest writes a schema-valid manifest from populated fixture', async () => {
  const { dir, brandDir, cleanup } = withFixture('populated');
  try {
    const stdin = readFileSync(join(FIXTURES, 'stage-data/full-pipeline.json'), 'utf-8');
    const result = await runCli(['emit-manifest'], { cwd: dir, stdin });
    assert.equal(result.exitCode, 0, `stderr: ${result.stderr}`);

    const manifestPath = join(brandDir, 'manifest.json');
    assert.equal(existsSync(manifestPath), true);

    const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
    assert.equal(manifest.version, '2');
    assert.equal(manifest.tier, 'standard');
    assert.equal(manifest.client, 'acme');
    assert.equal(manifest.stages['2_web'].ran, true);
    assert.equal(manifest.stages['2_web'].fallback_decision, 'none');
    assert.equal(manifest.stages['2_web'].chain_entry_used.name, 'playwright');
    assert.equal(manifest.dependencies.playwright.available, true);
    assert.equal(manifest.dependencies.playwright.kind, 'mcp');

    // Compare to golden, excluding generated_at + generator (volatile).
    const golden = JSON.parse(readFileSync(join(GOLDEN, 'manifest-from-populated.json'), 'utf-8'));
    delete manifest.generated_at;
    delete manifest.generator;
    delete golden.generated_at;
    delete golden.generator;
    assert.deepEqual(manifest, golden);
  } finally {
    cleanup();
  }
});

test('emit-manifest --dry-run prints to stdout instead of writing', async () => {
  const { dir, brandDir, cleanup } = withFixture('populated');
  try {
    const stdin = readFileSync(join(FIXTURES, 'stage-data/full-pipeline.json'), 'utf-8');
    const result = await runCli(['emit-manifest', '--dry-run'], { cwd: dir, stdin });
    assert.equal(result.exitCode, 0);
    assert.equal(existsSync(join(brandDir, 'manifest.json')), false);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.version, '2');
  } finally {
    cleanup();
  }
});

test('emit-manifest applies file_overrides to mark defaults', async () => {
  const { dir, brandDir, cleanup } = withFixture('populated');
  try {
    const stdin = readFileSync(join(FIXTURES, 'stage-data/partial-pipeline.json'), 'utf-8');
    const result = await runCli(['emit-manifest'], { cwd: dir, stdin });
    assert.equal(result.exitCode, 0);
    const manifest = JSON.parse(readFileSync(join(brandDir, 'manifest.json'), 'utf-8'));
    assert.equal(manifest.files['voice.md'].status, 'defaults');
    assert.equal(manifest.files['voice.md'].note, '<10 samples; LOW confidence');
    assert.equal(manifest.files['tokens/colors.md'].status, 'defaults');
  } finally {
    cleanup();
  }
});

test('emit-manifest fails when .brand/ is absent', async () => {
  const { dir, brandDir, cleanup } = withFixture('populated');
  try {
    // Remove .brand/
    const { rmSync } = await import('node:fs');
    rmSync(brandDir, { recursive: true });
    const result = await runCli(['emit-manifest'], { cwd: dir, stdin: '{}' });
    assert.notEqual(result.exitCode, 0);
    assert.match(result.stderr, /No .brand\/ directory/);
  } finally {
    cleanup();
  }
});
