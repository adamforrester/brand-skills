import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { withFixture } from '../helpers/tmp-brand.js';
import { runCli } from '../helpers/run-cli.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const FIXTURES = resolve(__dirname, '../fixtures');

async function emitWith(stageDataName) {
  const { dir, brandDir, cleanup } = withFixture('populated');
  try {
    const stdin = readFileSync(join(FIXTURES, 'stage-data', stageDataName), 'utf-8');
    const result = await runCli(['emit-manifest'], { cwd: dir, stdin });
    assert.equal(result.exitCode, 0, `stderr: ${result.stderr}`);
    const manifest = JSON.parse(readFileSync(join(brandDir, 'manifest.json'), 'utf-8'));
    return manifest;
  } finally {
    cleanup();
  }
}

test('preflight: all MCPs available — every stage fallback_decision: none', async () => {
  const m = await emitWith('all-mcps-available.json');
  // Lock the stage-key set so a silently-dropped stage in the fixture would
  // fail loudly here rather than producing a vacuously-true loop pass.
  assert.deepEqual(
    Object.keys(m.stages).sort(),
    ['1_figma', '2_web', '3_voice', '8_brand_md'],
  );
  for (const [stageKey, stage] of Object.entries(m.stages)) {
    assert.equal(stage.fallback_decision, 'none', `${stageKey} should be 'none'`);
    assert.notEqual(stage.chain_entry_used, null);
    assert.equal(stage.chain_entry_used.quality_label, 'full');
  }
  assert.equal(m.dependencies['figma-console'].available, true);
  assert.equal(m.dependencies['figma-console'].kind, 'mcp');
});

test('preflight: no MCPs but Jina available — Stage 3 DOWNGRADE via jina-reader', async () => {
  const m = await emitWith('no-mcps-jina-available.json');
  assert.equal(m.stages['1_figma'].fallback_decision, 'SKIP');
  assert.equal(m.stages['1_figma'].chain_entry_used, null);
  assert.equal(m.stages['2_web'].fallback_decision, 'SKIP');
  assert.equal(m.stages['3_voice'].fallback_decision, 'DOWNGRADE');
  assert.equal(m.stages['3_voice'].chain_entry_used.kind, 'http');
  assert.equal(m.stages['3_voice'].chain_entry_used.name, 'jina-reader');
  assert.equal(m.stages['3_voice'].chain_entry_used.quality_label, 'degraded');
  assert.equal(m.dependencies['jina-reader'].kind, 'http');
  assert.equal(m.dependencies['jina-reader'].used_by[0], '3_voice');
});

test('preflight: dtcg-only — Stage 1 DOWNGRADE via user_artifact', async () => {
  const m = await emitWith('dtcg-only.json');
  assert.equal(m.stages['1_figma'].fallback_decision, 'DOWNGRADE');
  assert.equal(m.stages['1_figma'].chain_entry_used.kind, 'user_artifact');
  assert.equal(m.stages['1_figma'].chain_entry_used.name, 'dtcg-tokens-file');
  assert.equal(m.dependencies['dtcg-tokens-file'].kind, 'user_artifact');
  // Cross-task tripwire: 'assets/*.tokens.json' is the single-source glob for
  // the dtcg-tokens-file user_artifact. If this fails, also check the contract
  // data (schema/mcp-fallback-contract.json), manifest schema, SKILL prose
  // (brand-extract §0.5 + Stage 1), and CLI default before "fixing" the test.
  assert.equal(m.dependencies['dtcg-tokens-file'].expected_path_glob, 'assets/*.tokens.json');
});

test('preflight: emit-manifest hard-rejects unknown dependency name', async () => {
  const { dir, cleanup } = withFixture('populated');
  try {
    const stdin = JSON.stringify({
      tier: 'minimum',
      client: 'acme',
      stages: {},
      dependencies: { 'totally-not-real': { available: true, used_by: [] } },
    });
    const result = await runCli(['emit-manifest'], { cwd: dir, stdin });
    assert.notEqual(result.exitCode, 0);
    assert.match(result.stderr, /unknown dependency 'totally-not-real'/);
  } finally {
    cleanup();
  }
});

test('preflight: emit-manifest hard-rejects v1 mcps payload with migration message', async () => {
  const { dir, cleanup } = withFixture('populated');
  try {
    const stdin = JSON.stringify({
      version: '1',
      tier: 'minimum',
      client: 'acme',
      stages: {},
      mcps: { playwright: { available: true, used: [] } },
    });
    const result = await runCli(['emit-manifest'], { cwd: dir, stdin });
    assert.notEqual(result.exitCode, 0);
    assert.match(result.stderr, /version "2"/);
  } finally {
    cleanup();
  }
});
