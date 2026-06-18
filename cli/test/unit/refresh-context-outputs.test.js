import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { _resetWarnedKeysForTesting } from '../../src/utils/deprecations.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const CLI_BIN = resolve(__dirname, '../../bin/brand-cli.js');

function mkProject(name, brandrcContent) {
  const dir = join(tmpdir(), `refresh-ctx-test-${name}-${process.pid}`);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(join(dir, '.brand'), { recursive: true });
  writeFileSync(join(dir, '.brand', 'overview.md'), '# Overview\n\nseed.', 'utf-8');
  writeFileSync(join(dir, '.brandrc.yaml'), brandrcContent, 'utf-8');
  return dir;
}

function runRefresh(dir, args = []) {
  return execFileSync('node', [CLI_BIN, 'refresh-context', ...args], {
    cwd: dir,
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf-8',
  });
}

beforeEach(() => {
  _resetWarnedKeysForTesting();
});

test('refresh-context: --also-write writes a mirror file (de-XD #6)', () => {
  const dir = mkProject('also-write', 'brand: ACME\ntier: standard\nmode: standard\n');
  try {
    runRefresh(dir, ['--also-write', './mirror.md']);
    assert.ok(existsSync(join(dir, 'brand.md')), 'brand.md should be written');
    assert.ok(existsSync(join(dir, 'mirror.md')), '--also-write target should be written');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('refresh-context: outputs: [path] in brandrc produces the same result as --also-write (de-XD #6)', () => {
  const dir = mkProject('outputs-field', 'brand: ACME\ntier: standard\nmode: standard\noutputs:\n  - .impeccable.md\n');
  try {
    runRefresh(dir);
    assert.ok(existsSync(join(dir, 'brand.md')), 'brand.md should be written');
    assert.ok(existsSync(join(dir, '.impeccable.md')), 'outputs[0] target should be written');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('refresh-context: --impeccable writes .impeccable.md (de-XD #6 alias)', () => {
  const dir = mkProject('impeccable-alias', 'brand: ACME\ntier: standard\nmode: standard\n');
  try {
    runRefresh(dir, ['--impeccable']);
    assert.ok(existsSync(join(dir, '.impeccable.md')), '.impeccable.md should be written by alias path');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('refresh-context: outputs entry pointing at brand.md is deduplicated (de-XD #6 dedup)', () => {
  // Seeds outputs: [./brand.md] in brandrc plus --also-write brand.md on the command line.
  // Both should resolve to the mandatory brand.md write target and be silently coalesced.
  // The CLI must print exactly one "regenerated" line for brand.md, not three.
  const dir = mkProject('dedup-brand-md', 'brand: ACME\ntier: standard\nmode: standard\noutputs:\n  - ./brand.md\n');
  try {
    const output = runRefresh(dir, ['--also-write', 'brand.md']);
    const matches = output.match(/brand\.md regenerated/g) || [];
    assert.equal(matches.length, 1, `brand.md should be written exactly once, got ${matches.length} writes:\n${output}`);
    assert.ok(existsSync(join(dir, 'brand.md')), 'brand.md should be written');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
