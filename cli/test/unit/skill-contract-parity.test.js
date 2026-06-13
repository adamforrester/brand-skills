import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadContract } from '../../src/utils/contract-loader.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const SKILL_PATH = resolve(__dirname, '../../../brand-context/skills/brand-extract/SKILL.md');
const skill = readFileSync(SKILL_PATH, 'utf-8');

test('SKILL prose mentions every contract dependency by name', () => {
  const contract = loadContract();
  const missing = [];
  for (const name of Object.keys(contract.dependencies)) {
    if (!skill.includes(name)) missing.push(name);
  }
  assert.deepEqual(missing, [], `SKILL.md is missing dependency references: ${missing.join(', ')}`);
});

test('SKILL prose mentions every contract stage key', () => {
  const contract = loadContract();
  const missing = [];
  for (const key of Object.keys(contract.stages)) {
    if (!skill.includes(key)) missing.push(key);
  }
  assert.deepEqual(missing, [], `SKILL.md is missing stage-key references: ${missing.join(', ')}`);
});

test('SKILL prose includes the four fallback_decision verbs', () => {
  for (const verb of ['none', 'DOWNGRADE', 'SKIP', 'HALT']) {
    assert.ok(skill.includes(verb), `SKILL.md missing fallback_decision verb: ${verb}`);
  }
});

test('SKILL prose references the contract DTCG glob verbatim', () => {
  const glob = loadContract().dependencies['dtcg-tokens-file'].expected_path_glob;
  assert.ok(skill.includes(glob), `SKILL.md must mention the DTCG glob '${glob}' verbatim`);
});

test('SKILL prose references the manifest schema version "2"', () => {
  assert.ok(
    skill.includes('"2"') || skill.includes('version: 2') || skill.includes('version: "2"'),
    'SKILL.md must reference manifest schema version "2"'
  );
});
