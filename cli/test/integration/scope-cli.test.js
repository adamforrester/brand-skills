import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runCli } from '../helpers/run-cli.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const FIXTURES = resolve(__dirname, '../fixtures/scope');

function tmpProjectWithScope(fixtureName) {
  const dir = mkdtempSync(join(tmpdir(), 'scope-cli-'));
  const brandDir = join(dir, '.brand');
  mkdirSync(brandDir, { recursive: true });
  if (fixtureName) {
    copyFileSync(resolve(FIXTURES, fixtureName), join(brandDir, '.scope.json'));
  }
  return { dir, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

test('scope --validate exits 0 on a valid full scope', async () => {
  const { dir, cleanup } = tmpProjectWithScope('full.scope.json');
  try {
    const result = await runCli(['scope', '--validate'], { cwd: dir });
    assert.equal(result.exitCode, 0, `stderr: ${result.stderr}`);
    assert.match(result.stdout, /is valid/);
  } finally { cleanup(); }
});

test('scope --validate exits 0 on a valid partial scope', async () => {
  const { dir, cleanup } = tmpProjectWithScope('partial.scope.json');
  try {
    const result = await runCli(['scope', '--validate'], { cwd: dir });
    assert.equal(result.exitCode, 0, `stderr: ${result.stderr}`);
  } finally { cleanup(); }
});

test('scope --validate exits 1 with ajv error on invalid file', async () => {
  const { dir, cleanup } = tmpProjectWithScope('invalid.scope.json');
  try {
    const result = await runCli(['scope', '--validate'], { cwd: dir });
    assert.notEqual(result.exitCode, 0);
    assert.match(result.stderr, /failed schema validation|additional|unknownTopLevel/);
  } finally { cleanup(); }
});

test('scope --validate exits 1 when .scope.json is absent', async () => {
  const { dir, cleanup } = tmpProjectWithScope(); // no fixture
  try {
    const result = await runCli(['scope', '--validate'], { cwd: dir });
    assert.notEqual(result.exitCode, 0);
    assert.match(result.stderr, /No .brand\/\.scope\.json|no_scope_file/);
  } finally { cleanup(); }
});

test('scope --validate --json emits structured output for valid', async () => {
  const { dir, cleanup } = tmpProjectWithScope('full.scope.json');
  try {
    const result = await runCli(['scope', '--validate', '--json'], { cwd: dir });
    assert.equal(result.exitCode, 0);
    const out = JSON.parse(result.stdout);
    assert.equal(out.ok, true);
    assert.equal(out.path, '.brand/.scope.json');
  } finally { cleanup(); }
});
