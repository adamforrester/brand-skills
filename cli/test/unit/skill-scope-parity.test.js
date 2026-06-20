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

test('SKILL prose has no stale "Pitch mode" headings or prose blocks (de-XD #4)', () => {
  // Catches title-case "Pitch mode" prose that the all-caps PITCH MODE check misses.
  // Pattern matches `**Pitch mode**` (bold) and `Pitch mode` (heading-style) but NOT
  // the lowercase `mode: pitch` token, which is preserved as a deprecated alias mention.
  const stalePitchHeading = /\*\*Pitch mode\*\*|^### \d[a-z]?\. Pitch mode/m;
  assert.ok(
    !stalePitchHeading.test(skill),
    'SKILL.md must not contain "**Pitch mode**" or "### Nx. Pitch mode" — rename to Public-sources-only mode'
  );
});

test('SKILL Stage 6 gate is decoupled from comprehensive tier (de-XD #3 + #7)', () => {
  // The Stage 6 header should say "(any tier)" — this is the post-decoupling marker.
  // The legacy phrase "(comprehensive tier only)" must be absent from the Stage 6 header.
  assert.ok(
    /Stage 6 — Design-system repo scan \(any tier\)/.test(skill),
    'SKILL.md Stage 6 header must read "(any tier)" — the gate is now sources.design_system_repo, not tier'
  );
  assert.ok(
    !/Stage 6 — Design-system repo scan \(comprehensive tier only\)/.test(skill),
    'SKILL.md must not retain the legacy "(comprehensive tier only)" Stage 6 header'
  );
  // The §0d list must not require comprehensive tier for the DS-repo question.
  assert.ok(
    !/Design-system repo.*tier == comprehensive/.test(skill),
    'SKILL.md §0d must not gate the design-system repo question on tier == comprehensive'
  );
  // Catch any other "(comprehensive tier only)" parenthetical anywhere in the SKILL —
  // the Stage 6 header is one place; the top-level pipeline-output list bullet is another.
  // Both must say "any tier" or similar to reflect the decoupling.
  assert.ok(
    !/\(comprehensive tier only\)/.test(skill),
    'SKILL.md must not contain any "(comprehensive tier only)" parenthetical — Stage 6 is now gated by sources.design_system_repo, not tier'
  );
});

test('SKILL §0b honors sources.asset_dir override (de-XD #14)', () => {
  // The Stage 0b scan must reference sources.asset_dir as the primary scan target.
  assert.ok(
    skill.includes('sources.asset_dir'),
    'SKILL.md §0b must reference sources.asset_dir as the override path for the asset scan'
  );
});

test('SKILL pipeline-final §10c triggers refresh-design after Stage 5 + Stage 8 (R1)', () => {
  // The bug R1 fixes: extraction wrote design.md and brand.md at the end but left
  // style-guide.html as the empty-state init artifact. The fix is an explicit final
  // pass that runs `brand-cli refresh-design` AFTER conflict resolution + brand.md
  // refresh, regenerating BOTH design.md and style-guide.html from the final state.
  // These three assertions guard the trigger against prose drift.

  // 1. The §10c section header exists.
  assert.ok(
    /## 10c\. Final design-surface refresh/.test(skill),
    'SKILL.md must contain a `## 10c. Final design-surface refresh` section header'
  );
  // 2. The §10c block names refresh-design AND style-guide.html in proximity, so the
  //    trigger pairing is visible without scanning the whole SKILL.
  const sectionMatch = skill.match(/## 10c\. Final design-surface refresh[\s\S]*?(?=^## )/m);
  assert.ok(sectionMatch, '§10c section must be locatable for the proximity check');
  const sectionText = sectionMatch[0];
  assert.ok(
    sectionText.includes('brand-cli refresh-design') && sectionText.includes('style-guide.html'),
    '§10c must mention BOTH `brand-cli refresh-design` AND `style-guide.html` (the trigger pairing)'
  );
  // 3. The block is explicitly required (so the SKILL doesn't treat it as optional).
  assert.ok(
    /required.*do not skip|required, not optional/i.test(sectionText),
    '§10c must mark itself as required (matches the §8 design.md regen wording precedent)'
  );
});

test('SKILL §8 first-pass design.md regen forward-points at the §10c second pass (R1)', () => {
  // §8 regenerates design.md after Stages 1–4 token writes — but conflicts.md hasn't
  // been written yet at that point, so style-guide.html's active-conflicts banner
  // would reflect placeholder state. The forward-pointer note documents that §10c
  // re-runs the regen post-walkthrough. Without this signpost, a future reader may
  // collapse the two passes into one and reintroduce the bug.
  //
  // Scope the assertion to the §8 section body so deleting the forward-pointer is
  // actually caught — `§10c` appears in the §10c block itself, so a SKILL-wide
  // `includes('§10c')` would pass even after the §8 note was removed.
  const sectionMatch = skill.match(/## 8\. Regenerate design\.md[\s\S]*?(?=^## (?:9|10|10b|10c|11)\. )/m);
  assert.ok(sectionMatch, 'SKILL.md §8 section must be locatable for the forward-pointer check');
  const section8 = sectionMatch[0];
  assert.ok(
    /this regen runs twice in the pipeline|second.*mandatory pass|§10c/i.test(section8),
    'SKILL.md §8 must signpost that refresh-design runs again at §10c (post-Stage 5)'
  );
});

test('SKILL §8d conflict walkthrough is a hard pipeline gate (R2)', () => {
  // The Wendy's tryout (2026-06-18) detected 6 active conflicts and skipped the
  // walkthrough, writing them all as `unresolved` and proceeding to Final summary.
  // Practitioner had to ask "how do I resolve those?" after the run. The fix is an
  // explicit pre-summary gate that the agent cannot slip past — these assertions
  // pin the load-bearing prose against drift.
  const sectionMatch = skill.match(/### 8d\. Walk the practitioner through[\s\S]*?(?=^### 8e\. )/m);
  assert.ok(sectionMatch, '§8d section must be locatable for the gate-language check');
  const section8d = sectionMatch[0];

  // 1. The gate framing must call out that the pipeline cannot advance until the
  //    walkthrough has run. Without this, the agent treats Final summary as the
  //    natural endpoint (the bug R2 fixes).
  assert.ok(
    /hard pipeline gate|must not advance|do not skip to summary/i.test(section8d),
    '§8d must declare itself a hard pipeline gate that blocks summary emission'
  );

  // 2. The full label set across all three passes must be visible verbatim in
  //    the prose so the agent renders the same UI every run. Paraphrasing is
  //    allowed in practice, but the canonical labels must appear in the SKILL
  //    itself. The §8d "Walkthrough discipline" block calls these out as
  //    "the four / three / three semantic choices" — guarding all ten matches
  //    that contract.
  const pass1Labels = ['Resolve', 'Override', 'Mark intentional', 'Skip for now'];
  const pass2Labels = ['Confirm intentional', "It's actually a conflict", 'Skip'];
  const pass3Labels = ['Confirm auto-resolved', 'Re-add as active', 'Skip'];
  for (const label of [...pass1Labels, ...pass2Labels, ...pass3Labels]) {
    assert.ok(
      section8d.includes(label),
      `§8d must include the canonical walkthrough label "${label}"`
    );
  }

  // 3. Discipline: prompts go one at a time, never batched. Drift here would
  //    re-introduce the batch-prompt failure mode the Wendy's run actually hit.
  assert.ok(
    /one item at a time|never batch-prompt|do not batch-prompt/i.test(section8d),
    '§8d must enforce one-item-at-a-time prompting (no batch-prompt)'
  );

  // 4. Mid-walkthrough abort handling must be documented so the pipeline doesn't
  //    deadlock if the practitioner says "stop" or "I'll resolve later."
  assert.ok(
    /aborts mid-walkthrough|abort mid-walkthrough|practitioner.*stop/i.test(section8d),
    '§8d must document the mid-walkthrough abort path'
  );
});

test('SKILL §8e write policy mirrors §8d Mark-intentional re-classification (R2)', () => {
  // §8d's Pass 1 "Mark intentional" choice rebuilds the conflict as an Intentional
  // Adaptation. §8e's Active Conflicts / Intentional Adaptations lists must agree
  // with that — otherwise the in-memory state diverges from what gets written.
  const sectionMatch = skill.match(/### 8e\. Apply the additive policy[\s\S]*?(?=^### 8f\. )/m);
  assert.ok(sectionMatch, '§8e section must be locatable for the write-policy check');
  const section8e = sectionMatch[0];
  assert.ok(
    /Mark intentional/i.test(section8e),
    '§8e must reference §8d\'s "Mark intentional" choice so the write policy mirrors the walkthrough state'
  );
});

test('SKILL Stage 8 documents the style-guide.html inline-fallback (visual-style-guide #1)', () => {
  // Three load-bearing assertions:
  //   1. SKILL.md mentions style-guide.html somewhere in Stage 8 prose.
  //   2. SKILL.md points at the canonical generator file path so the fallback
  //      author has a reference to mirror.
  //   3. SKILL.md surfaces the byte-identical parity contract so future drift
  //      between CLI and SKILL is caught at review time.
  assert.ok(
    skill.includes('style-guide.html'),
    'SKILL.md must reference style-guide.html (Stage 8 inline-fallback)'
  );
  assert.ok(
    skill.includes('cli/src/utils/style-guide-generator.js'),
    'SKILL.md must point at the canonical generator path so the inline fallback can mirror it'
  );
  assert.ok(
    /byte-identical/i.test(skill),
    'SKILL.md must surface the byte-identical parity contract for the visual style guide'
  );
});
