import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runCli } from '../helpers/run-cli.js';

test('brand-cli init then score: readiness < 0.1, all in gaps', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'brand-fresh-'));
  try {
    const init = await runCli(['init', '--client', 'acme', '--mode', 'standard', '--force'], { cwd: dir });
    assert.equal(init.exitCode, 0, `init stderr: ${init.stderr}`);
    assert.equal(existsSync(join(dir, '.brand')), true);
    assert.equal(existsSync(join(dir, '.brandrc.yaml')), true);

    const score = await runCli(['score'], { cwd: dir });
    assert.equal(score.exitCode, 0);

    const health = JSON.parse(readFileSync(join(dir, '.brand', '.health.json'), 'utf-8'));
    assert(health.readiness < 0.1, `expected readiness < 0.1, got ${health.readiness}`);
    assert.equal(health.tier_label, 'incomplete');
    assert(health.gaps.length > 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
