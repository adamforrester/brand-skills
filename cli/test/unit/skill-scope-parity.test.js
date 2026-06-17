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

test('SKILL prose mentions the industry field by name (#5)', () => {
  assert.ok(skill.includes('industry'), 'SKILL.md must reference the industry field');
});

test('SKILL prose contains the `industry context:` citation marker (#5)', () => {
  assert.ok(
    skill.includes('industry context:'),
    'SKILL.md must document the `*(industry context: <value>)*` citation marker so prose drift is caught early'
  );
});

test('SKILL prose explains the soft-prior tie-breaker rule (#5)', () => {
  // The rule must be visible in prose: "tie-breaker" (or "tie breaker") in proximity
  // to the word "industry". This guards against silently dropping the soft-prior framing
  // and lapsing into a hard heuristic.
  const tieBreakerMatch = /tie[- ]breaker/i.test(skill);
  assert.ok(tieBreakerMatch, 'SKILL.md must use the phrase "tie-breaker" when describing the industry prior');
  // And the threshold-preservation rule must be present (the prior may not lower the
  // sample thresholds in section 4d or section 4e).
  const preservesThreshold =
    /may NOT lower|may not lower|never lowers|never invent|may NOT invent/i.test(skill);
  assert.ok(
    preservesThreshold,
    'SKILL.md must explicitly state the prior may not lower thresholds or invent claims'
  );
});

test('SKILL prose uses PUBLIC-SOURCES-ONLY MODE banner (de-XD #4)', () => {
  // The disclaimer banner reads PUBLIC-SOURCES-ONLY MODE in three places (sections 5c, 6e, 8f).
  // Drift here would mean the SKILL silently reverted to the agency-pitch label.
  assert.ok(
    skill.includes('PUBLIC-SOURCES-ONLY MODE'),
    'SKILL.md must use the PUBLIC-SOURCES-ONLY MODE banner (renamed from PITCH MODE in de-XD cleanup)'
  );
});

test('SKILL prose does not contain legacy PITCH MODE banner (de-XD #4)', () => {
  // The bare "PITCH MODE" banner (case-sensitive) should be absent — the alias note
  // mentioning `mode: pitch` is fine, but the banner shouldn't appear.
  assert.ok(
    !skill.includes('PITCH MODE'),
    'SKILL.md must not contain the legacy PITCH MODE banner; rename to PUBLIC-SOURCES-ONLY MODE'
  );
});

test('SKILL prose mentions public-sources-only mode value by name (de-XD #4)', () => {
  assert.ok(
    skill.includes('public-sources-only'),
    'SKILL.md must reference the new mode value `public-sources-only` so prose drift is caught early'
  );
});
