import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync, copyFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runCli } from '../helpers/run-cli.js';
import { loadScope, validateScope } from '../../src/utils/scope-loader.js';
import { mergeScopeIntoBrandrc } from '../../src/utils/scope-merge.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const FIXTURES = resolve(__dirname, '../fixtures/scope');

function tmpProjectWithScope(fixtureName) {
  const dir = mkdtempSync(join(tmpdir(), 'scope-roundtrip-'));
  const brandDir = join(dir, '.brand');
  mkdirSync(brandDir, { recursive: true });
  copyFileSync(resolve(FIXTURES, fixtureName), join(brandDir, '.scope.json'));
  return { dir, brandDir, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

test('roundtrip: full fixture → loadScope → validateScope → CLI exits 0', async () => {
  const { dir, brandDir, cleanup } = tmpProjectWithScope('full.scope.json');
  try {
    // Direct loader/validator path
    const scope = loadScope(brandDir);
    assert.equal(scope.client, 'ACME Corp');
    assert.equal(validateScope(scope).valid, true);

    // Merge against an empty brandrc to verify the full surface composes
    const empty = { client: '', tier: '', mode: 'standard', sources: {} };
    const r = mergeScopeIntoBrandrc(scope, empty);
    assert.equal(r.merged.client, 'ACME Corp');
    assert.equal(r.merged.sources.website, 'https://acme.example.com');
    assert.equal(r.conflicts.length, 0);

    // CLI path agrees
    const result = await runCli(['scope', '--validate'], { cwd: dir });
    assert.equal(result.exitCode, 0);
  } finally { cleanup(); }
});

test('roundtrip: invalid fixture rejected by both validateScope and CLI', async () => {
  const { dir, brandDir, cleanup } = tmpProjectWithScope('invalid.scope.json');
  try {
    const scope = loadScope(brandDir);
    const direct = validateScope(scope);
    assert.equal(direct.valid, false);

    const result = await runCli(['scope', '--validate'], { cwd: dir });
    assert.notEqual(result.exitCode, 0);
  } finally { cleanup(); }
});
