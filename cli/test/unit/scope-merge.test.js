import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mergeScopeIntoBrandrc } from '../../src/utils/scope-merge.js';

test('mergeScopeIntoBrandrc fills empty brandrc fields from scope (Case A)', () => {
  const scope = {
    client: 'ACME',
    tier: 'standard',
    sources: {
      website: 'https://acme.example.com',
      figma: ['abc123'],
    },
  };
  const brandrc = { client: '', tier: '', mode: 'standard', sources: {} };
  const r = mergeScopeIntoBrandrc(scope, brandrc);
  assert.equal(r.merged.client, 'ACME');
  assert.equal(r.merged.tier, 'standard');
  assert.equal(r.merged.sources.website, 'https://acme.example.com');
  assert.deepEqual(r.merged.sources.figma, ['abc123']);
  assert.equal(r.conflicts.length, 0);
  assert.ok(r.filledFromScope.has('client'));
  assert.ok(r.filledFromScope.has('sources.website'));
  assert.ok(r.filledFromScope.has('sources.figma'));
});

test('mergeScopeIntoBrandrc keeps brandrc value on conflict; logs the conflict (Case B)', () => {
  const scope = {
    sources: {
      website: 'https://stale.example.com',
      brand_guide: 'assets/guide.pdf',
    },
  };
  const brandrc = {
    client: 'ACME',
    tier: 'standard',
    mode: 'standard',
    sources: { website: 'https://acme.com', figma: ['abc123'] },
  };
  const r = mergeScopeIntoBrandrc(scope, brandrc);
  assert.equal(r.merged.sources.website, 'https://acme.com');
  assert.equal(r.merged.sources.brand_guide, 'assets/guide.pdf');
  assert.deepEqual(r.merged.sources.figma, ['abc123']);
  assert.equal(r.conflicts.length, 1);
  assert.equal(r.conflicts[0].field, 'sources.website');
  assert.equal(r.conflicts[0].scope_value, 'https://stale.example.com');
  assert.equal(r.conflicts[0].brandrc_value, 'https://acme.com');
  assert.ok(r.filledFromScope.has('sources.brand_guide'));
  assert.ok(!r.filledFromScope.has('sources.website'));
});

test('mergeScopeIntoBrandrc handles partial scope (some fields absent)', () => {
  const scope = { client: 'ACME', sources: { website: 'https://acme.com' } };
  const brandrc = { client: '', tier: '', mode: 'standard', sources: {} };
  const r = mergeScopeIntoBrandrc(scope, brandrc);
  assert.equal(r.merged.client, 'ACME');
  assert.equal(r.merged.tier, '');
  assert.equal(r.merged.sources.website, 'https://acme.com');
  assert.ok(r.filledFromScope.has('client'));
  assert.ok(r.filledFromScope.has('sources.website'));
  assert.ok(!r.filledFromScope.has('tier'));
});

test('mergeScopeIntoBrandrc descends nested objects leaf-by-leaf', () => {
  const scope = {
    sources: {
      social: { twitter: 'https://x.com/acme', instagram: 'https://instagram.com/acme' },
    },
  };
  const brandrc = {
    client: 'ACME',
    sources: { social: { twitter: 'https://x.com/old' } },
  };
  const r = mergeScopeIntoBrandrc(scope, brandrc);
  assert.equal(r.merged.sources.social.twitter, 'https://x.com/old');
  assert.equal(r.merged.sources.social.instagram, 'https://instagram.com/acme');
  assert.ok(r.filledFromScope.has('sources.social.instagram'));
  assert.ok(!r.filledFromScope.has('sources.social.twitter'));
  assert.equal(r.conflicts.length, 1);
  assert.equal(r.conflicts[0].field, 'sources.social.twitter');
});

test('mergeScopeIntoBrandrc returns interactive_preflight; false counts as set', () => {
  const scope = { interactive_preflight: false };
  const brandrcWithoutKey = { client: '', tier: '', mode: 'standard', sources: {} };
  const r1 = mergeScopeIntoBrandrc(scope, brandrcWithoutKey);
  assert.equal(r1.merged.interactive_preflight, false);
  assert.ok(r1.filledFromScope.has('interactive_preflight'));

  const brandrcWithFalse = { ...brandrcWithoutKey, interactive_preflight: false };
  const r2 = mergeScopeIntoBrandrc({ interactive_preflight: true }, brandrcWithFalse);
  assert.equal(r2.merged.interactive_preflight, false); // brandrc wins
  assert.equal(r2.conflicts.length, 1);
  assert.equal(r2.conflicts[0].field, 'interactive_preflight');
});

test('mergeScopeIntoBrandrc round-trips industry as a top-level string (#5 cross-task contract)', () => {
  const scope = { industry: 'fast-food QSR' };
  const brandrc = { client: '', tier: '', mode: 'standard', sources: {} };
  const r = mergeScopeIntoBrandrc(scope, brandrc);
  assert.equal(r.merged.industry, 'fast-food QSR');
  assert.ok(r.filledFromScope.has('industry'));
  assert.equal(r.conflicts.length, 0);

  // Brandrc-wins-on-conflict applies to industry too.
  const brandrcWithIndustry = { ...brandrc, industry: 'luxury ecommerce' };
  const r2 = mergeScopeIntoBrandrc({ industry: 'fast-food QSR' }, brandrcWithIndustry);
  assert.equal(r2.merged.industry, 'luxury ecommerce');
  assert.equal(r2.conflicts.length, 1);
  assert.equal(r2.conflicts[0].field, 'industry');
  assert.equal(r2.conflicts[0].scope_value, 'fast-food QSR');
  assert.equal(r2.conflicts[0].brandrc_value, 'luxury ecommerce');
  assert.ok(!r2.filledFromScope.has('industry'));
});
