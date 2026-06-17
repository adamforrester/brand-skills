import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { loadBrandrc } from '../../src/utils/brandrc-loader.js';
import { _resetWarnedKeysForTesting } from '../../src/utils/deprecations.js';

function mkProject(name, brandrcContent) {
  const dir = join(tmpdir(), `brandrc-loader-test-${name}-${process.pid}`);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  if (brandrcContent !== undefined) {
    writeFileSync(join(dir, '.brandrc.yaml'), brandrcContent, 'utf-8');
  }
  return dir;
}

beforeEach(() => {
  _resetWarnedKeysForTesting();
});

test('loadBrandrc: legacy `client` populates `brand` and warns once', () => {
  const dir = mkProject('client-only', 'client: ACME Corp\ntier: standard\nmode: standard\n');
  const original = console.warn;
  let warnings = 0;
  console.warn = () => { warnings++; };
  try {
    const cfg = loadBrandrc(dir);
    assert.equal(cfg.brand, 'ACME Corp');
    assert.equal(cfg.client, undefined);
    assert.equal(cfg.tier, 'standard');
    assert.equal(cfg.mode, 'standard');
    assert.equal(warnings, 1);
  } finally {
    console.warn = original;
    rmSync(dir, { recursive: true, force: true });
  }
});

test('loadBrandrc: both `client` and `brand` -> brand wins, alias warns', () => {
  const dir = mkProject('both', 'client: Old Name\nbrand: New Name\ntier: standard\n');
  const original = console.warn;
  let warnings = 0;
  console.warn = () => { warnings++; };
  try {
    const cfg = loadBrandrc(dir);
    assert.equal(cfg.brand, 'New Name');
    assert.equal(cfg.client, undefined);
    assert.equal(warnings, 1);
  } finally {
    console.warn = original;
    rmSync(dir, { recursive: true, force: true });
  }
});

test('loadBrandrc: neither set -> basename(projectDir) default', () => {
  const dir = mkProject('default-brand', 'tier: standard\nmode: standard\n');
  try {
    const cfg = loadBrandrc(dir);
    assert.ok(cfg.brand.startsWith('brandrc-loader-test-default-brand-'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('loadBrandrc: `mode: pitch` normalizes to `mode: public-sources-only` and warns', () => {
  const dir = mkProject('pitch', 'brand: ACME\ntier: minimum\nmode: pitch\n');
  const original = console.warn;
  let warnings = 0;
  console.warn = () => { warnings++; };
  try {
    const cfg = loadBrandrc(dir);
    assert.equal(cfg.mode, 'public-sources-only');
    assert.equal(warnings, 1);
  } finally {
    console.warn = original;
    rmSync(dir, { recursive: true, force: true });
  }
});

test('loadBrandrc: `extensions` field is dropped and warns', () => {
  const dir = mkProject('ext', 'brand: ACME\ntier: standard\nextensions:\n  - ds-pack\n');
  const original = console.warn;
  let warnings = 0;
  console.warn = () => { warnings++; };
  try {
    const cfg = loadBrandrc(dir);
    assert.equal(cfg.extensions, undefined);
    assert.equal(warnings, 1);
  } finally {
    console.warn = original;
    rmSync(dir, { recursive: true, force: true });
  }
});

test('loadBrandrc: `tools.storybook` is dropped silently', () => {
  const dir = mkProject('storybook', 'brand: ACME\ntools:\n  agent: claude-code\n  storybook: true\n');
  const original = console.warn;
  let warnings = 0;
  console.warn = () => { warnings++; };
  try {
    const cfg = loadBrandrc(dir);
    assert.equal(cfg.tools.agent, 'claude-code');
    assert.equal(cfg.tools.storybook, undefined);
    assert.equal(warnings, 0);
  } finally {
    console.warn = original;
    rmSync(dir, { recursive: true, force: true });
  }
});

test('loadBrandrc: missing .brandrc.yaml returns defaults-only', () => {
  const dir = mkProject('no-file', undefined);
  try {
    const cfg = loadBrandrc(dir);
    assert.ok(cfg.brand.startsWith('brandrc-loader-test-no-file-'));
    assert.deepEqual(cfg.sources, {});
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('loadBrandrc: warns fire exactly once even when called twice', () => {
  const dir = mkProject('warn-once', 'client: ACME\ntier: standard\n');
  const original = console.warn;
  let warnings = 0;
  console.warn = () => { warnings++; };
  try {
    loadBrandrc(dir);
    loadBrandrc(dir);
    loadBrandrc(dir);
    assert.equal(warnings, 1, 'client alias warning fires exactly once across multiple loads');
  } finally {
    console.warn = original;
    rmSync(dir, { recursive: true, force: true });
  }
});
