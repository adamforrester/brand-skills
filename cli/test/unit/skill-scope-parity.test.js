import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const SKILL_PATH = resolve(__dirname, '../../../brand-context/skills/brand-extract/SKILL.md');
const skill = readFileSync(SKILL_PATH, 'utf-8');

test('SKILL prose mentions the .brand/.scope.json file path', () => {
  assert.ok(skill.includes('.brand/.scope.json'), 'SKILL.md must reference .brand/.scope.json by path');
});

test('SKILL prose mentions the brandrc-wins-on-conflict precedence rule', () => {
  // Match either the explicit phrase or a near-equivalent that names brandrc + conflict
  const mentionsRule =
    skill.includes('brandrc wins on conflict') ||
    /brandrc.*wins.*conflict|brandrc already had|kept brandrc/i.test(skill);
  assert.ok(mentionsRule, 'SKILL.md must explain that brandrc wins when scope and brandrc disagree');
});

test('SKILL prose references interactive_preflight: false embedded-mode bail behavior', () => {
  assert.ok(
    skill.includes('interactive_preflight') && skill.includes('missing_required_fields'),
    'SKILL.md must reference interactive_preflight: false bail path AND the missing_required_fields error code'
  );
});

test('SKILL prose references filledFromScope by name', () => {
  assert.ok(
    skill.includes('filledFromScope'),
    'SKILL.md must reference the filledFromScope set by name (used by Stage 0c-0e to skip questions)'
  );
});

test('SKILL prose references the delete-after-merge invariant', () => {
  // Match either "delete .brand/.scope.json" or "delete the scope file" or "rm .brand/.scope.json"
  const mentionsDelete =
    /delete .*\.scope\.json|delete the scope file|rm .*\.scope\.json/i.test(skill);
  assert.ok(mentionsDelete, 'SKILL.md must explain that .scope.json is deleted after a successful merge + brandrc write');
});
