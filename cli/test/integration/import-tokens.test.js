import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, copyFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runCli } from '../helpers/run-cli.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const FIXTURES = resolve(__dirname, '../fixtures/dtcg-tokens');

function tmpProjectWith(fileNames) {
  const dir = mkdtempSync(join(tmpdir(), 'brand-import-'));
  const assetsDir = join(dir, 'assets');
  mkdirSync(assetsDir, { recursive: true });
  for (const name of fileNames) {
    copyFileSync(resolve(FIXTURES, name), join(assetsDir, name));
  }
  return { dir, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

test('import-tokens emits merged token state as JSON for assets/*.tokens.json', async () => {
  const { dir, cleanup } = tmpProjectWith(['colors.tokens.json', 'typography.tokens.json']);
  try {
    const result = await runCli(['import-tokens'], { cwd: dir });
    assert.equal(result.exitCode, 0, `stderr: ${result.stderr}`);
    const out = JSON.parse(result.stdout);
    assert.equal(out.colors.primary, '#E2231A');
    assert.equal(out.typography['family-base'], 'Inter, sans-serif');
    assert.deepEqual(out.unknown, []);
  } finally {
    cleanup();
  }
});

test('import-tokens fails when no assets/*.tokens.json files are present', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'brand-import-'));
  try {
    const result = await runCli(['import-tokens'], { cwd: dir });
    assert.notEqual(result.exitCode, 0);
    assert.match(result.stderr, /No DTCG token files/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('import-tokens --file <path> reads exactly that file', async () => {
  const { dir, cleanup } = tmpProjectWith(['colors.tokens.json', 'typography.tokens.json']);
  try {
    const result = await runCli(
      ['import-tokens', '--file', 'assets/colors.tokens.json'],
      { cwd: dir }
    );
    assert.equal(result.exitCode, 0);
    const out = JSON.parse(result.stdout);
    assert.equal(out.colors.primary, '#E2231A');
    assert.deepEqual(out.typography, {});
  } finally {
    cleanup();
  }
});

test('import-tokens --file <absolute-path> reads that file', async () => {
  const { dir, cleanup } = tmpProjectWith(['colors.tokens.json']);
  try {
    const abs = join(dir, 'assets', 'colors.tokens.json');
    const result = await runCli(['import-tokens', '--file', abs], { cwd: dir });
    assert.equal(result.exitCode, 0, `stderr: ${result.stderr}`);
    const out = JSON.parse(result.stdout);
    assert.equal(out.colors.primary, '#E2231A');
    assert.deepEqual(out.typography, {});
  } finally {
    cleanup();
  }
});

test('import-tokens emits empty-state shape for {} DTCG file', async () => {
  const { dir, cleanup } = tmpProjectWith(['empty.tokens.json']);
  try {
    const result = await runCli(['import-tokens'], { cwd: dir });
    assert.equal(result.exitCode, 0, `stderr: ${result.stderr}`);
    const out = JSON.parse(result.stdout);
    assert.deepEqual(out, {
      colors: {},
      typography: {},
      spacing: {},
      surfaces: {},
      motion: {},
      unknown: [],
    });
  } finally {
    cleanup();
  }
});

test('import-tokens fails with parse error on malformed DTCG', async () => {
  const { dir, cleanup } = tmpProjectWith(['malformed.tokens.json']);
  try {
    const result = await runCli(['import-tokens'], { cwd: dir });
    assert.notEqual(result.exitCode, 0);
    assert.match(result.stderr, /missing \$type/);
  } finally {
    cleanup();
  }
});
