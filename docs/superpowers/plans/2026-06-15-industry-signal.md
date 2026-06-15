# `industry` Signal Injection — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an optional top-level `industry: <string>` field to `.brandrc.yaml` and `.brand/.scope.json`. When set, Stages 3 and 4 of `/brand-context:extract` use it as a soft tie-breaker prior on inference and cite it inline as `*(industry context: <value>)*`. When absent, behavior is identical to today.

**Architecture:** Schema-and-prose change; no new CLI code. **Schema layer** appends one property to `schema/brand/scope.schema.json`. **SKILL layer** adds three additive blocks (§0a, §4c, §6b) to `brand-context/skills/brand-extract/SKILL.md`. **Test layer** extends two existing files: `scope-merge.test.js` (+1) and `skill-scope-parity.test.js` (+3). Existing scope-merge utility round-trips the new field with no code diff because the merge is generic and recursive.

**Tech Stack:** Node.js ≥22, ESM (`"type": "module"`), `ajv@^8.20` (`ajv/dist/2020.js` for draft 2020-12), `node:test`. No new dependencies.

---

## Source-of-truth references

- **Spec:** [`docs/superpowers/specs/2026-06-15-industry-signal-design.md`](../specs/2026-06-15-industry-signal-design.md) — read end to end before starting any task
- **Precedent (D-letter pattern + footguns):** [`docs/superpowers/plans/2026-06-14-scope-json-progress.md`](2026-06-14-scope-json-progress.md) — D1-D4 + recurring footguns
- **Cross-task contract origin:** spec for #4 [`docs/superpowers/specs/2026-06-14-scope-json-design.md`](../specs/2026-06-14-scope-json-design.md) §8 explicitly anticipated this change as a one-line append

## Things to know that aren't obvious from the codebase

These have bitten every prior branch. Hoisted from the scope-json branch progress doc:

- **`ajv/dist/2020.js`, not `ajv`.** Draft 2020-12 schemas need the dist entry point. The existing `scope-loader.js` already imports correctly; we don't touch loader code in this branch — flagged for parity context only.
- **Per-task tempfiles for commit messages.** `/tmp/commit-msg.txt` is shared across tasks; the Write tool errors with "file modified since read" if multiple tasks edit it. Use `/tmp/commit-msg-task<N>.txt` per task. (See [CF-2] in scope-json branch progress doc.)
- **Apostrophes break heredoc commit messages.** Use Write tool → tempfile → `git commit -F`. Never heredoc with apostrophes.
- **`package-lock.json` is gitignored.** Don't `git add` it.
- **Don't bump the package version.** Don't touch `~/Documents/xd-toolkit`. Durable rules from `CLAUDE.md`.
- **Plan-pasted `node -e` snippets that mix `await import()` with `require()` are broken** under `"type":"module"`. Default to `node --input-type=module -e "..."` with named ESM imports.
- **Plan-pasted bash pipelines have shipped with typos.** Glance at any multi-line bash before pasting; verify the command before relying on it.
- **Long-running implementer agents can die mid-flight on token expiration.** If file edits are on disk but the agent didn't commit, run smoke-tests + commit yourself rather than re-dispatching. See [D4] in scope-json branch progress doc.
- **`engines.node >= 22.0.0`.** `node --test` glob support landed at Node 21; floor is at LTS 22.
- **Per-task two-stage review** (spec compliance, then code quality). Smaller branches still warrant the full protocol.
- **When the plan's pasted code contradicts the plan's pasted tests, the test is the contract.** Patch the code; surface as `DONE_WITH_CONCERNS`.

## Cross-task contracts to preserve

These must stay in sync across **schema**, **scope-merge tests**, **SKILL prose**, **parity tests**, and **repo docs**:

- **Field placement** — `industry` is a **top-level sibling** of `client`/`tier`/`mode` in both `.brandrc.yaml` and `.brand/.scope.json`. NOT under `sources:` and NOT under any new `context:` block. Spec §1.
- **"Empty" rule** — `industry` is a string. Per `cli/src/utils/scope-merge.js` `isEmpty()`: missing key, `""`, and `null` all count as empty. The merge utility already implements this; no diff.
- **Citation marker literal** — exact string is `*(industry context: <value>)*`. The greppable substring `industry context:` is what the parity test asserts on. Used in both Stage 3 §4c and Stage 4 §6b prose.
- **Tie-breaker scope** — Stage 3 (all inference) and Stage 4 Brand Personality / Audience / Competitive Context only. Stage 4 Visual Language and brand self-test stay evidence-only. SKILL prose makes this explicit.
- **Threshold preservation** — the prior may NOT lower Stage 3's ≥3-supporting-samples-per-attribute threshold (§4d) or the <10-total-samples threshold (§4e). SKILL §4c spells this out as a hard rule.

## File structure

### Modified files (no new files except the spec/plan/progress docs)

| Path | Change |
|---|---|
| `schema/brand/scope.schema.json` | Append `industry` property at top level (one block) |
| `brand-context/skills/brand-extract/SKILL.md` | Three additive prose blocks: §0a edit, §4c bullet + worked example, §6b industry-prior paragraph |
| `cli/test/unit/scope-merge.test.js` | +1 test: `industry` round-trips through merge |
| `cli/test/unit/skill-scope-parity.test.js` | +3 tests: SKILL mentions field, citation marker literal, tie-breaker rule prose |
| `README.md` | One-line note (location depends on existing structure; Task 6 finds the right spot) |
| `docs/tasks.md` | Mark #5 complete on land |
| `docs/superpowers/plans/2026-06-15-industry-signal-progress.md` | Per-task progress log |

**No new code files.** No new utilities, no new CLI subcommand, no new fixtures, no new test files. Generators (`brand-context-generator.js`, `design-md-generator.js`) are unchanged. Schemas other than `scope.schema.json` are unchanged.

---

## Per-task dispatch protocol

Same as the scope-json branch (precedent doc). Per task:

1. **Open this plan**, copy the full task text inline (don't make subagents read the plan file).
2. **Dispatch implementer** (`general-purpose` subagent). Include: full task text; branch name `feat/industry-signal`; pointer to this plan + spec + precedent progress doc; the "Things to know" footguns above.
3. **Spec compliance review** (`general-purpose` subagent). Read the actual code; don't trust the implementer's report.
4. **Code quality review** (`superpowers:code-reviewer` subagent). Pass `BASE_SHA` (commit before this task) and `HEAD_SHA`.
5. **If reviewer flags Critical or Important:** dispatch a refinement subagent. **If Minor only:** accept and proceed (per [D7] from manifest+health branch).
6. **Update progress doc** (`docs/superpowers/plans/2026-06-15-industry-signal-progress.md`) with commit SHA(s), test delta, decisions.
7. **Mark task done** in the session task list.

---

## Task 1: Test harness sync + branch baseline

**Goal:** Confirm 108/108 tests pass on `feat/industry-signal`, branch is one commit ahead of main (the spec), commit the plan and a progress doc shell.

**Files:**
- Create: `docs/superpowers/plans/2026-06-15-industry-signal-progress.md`
- Already on disk (uncommitted in this task): `docs/superpowers/plans/2026-06-15-industry-signal.md` (this plan)

- [ ] **Step 1: Verify branch state**

```bash
git rev-parse --abbrev-ref HEAD
git log --oneline main..HEAD
git status
```

Expected: branch is `feat/industry-signal`; one commit ahead of main (the spec, `86ee39c`); working tree shows the plan file as untracked.

- [ ] **Step 2: Run the existing test suite**

```bash
npm test 2>&1 | tail -10
```

Expected: `# pass 108` / `# fail 0`.

- [ ] **Step 3: Create the progress doc shell**

Write to `docs/superpowers/plans/2026-06-15-industry-signal-progress.md`:

```markdown
# `industry` Signal Injection — Implementation Progress

Companion to [`2026-06-15-industry-signal.md`](2026-06-15-industry-signal.md). Tracks each task's commits, test delta, and decisions made during implementation.

**Status:** in progress on branch `feat/industry-signal`.
**Branch base:** `main` at commit `62546f3` (post-#4-merge cleanup).
**Spec:** [`../specs/2026-06-15-industry-signal-design.md`](../specs/2026-06-15-industry-signal-design.md)
**Precedent (D-letter pattern reference):** [`2026-06-14-scope-json-progress.md`](2026-06-14-scope-json-progress.md)

---

## Quick state check

```
$ git log --oneline main..HEAD
<paste current log here on each progress-doc commit>

$ npm test 2>&1 | tail -5
<paste pass/fail counts>
```

---

## Things that bite repeatedly (carried forward from precedent)

See the "Things to know" section in the plan. Hoist new branch-specific patterns here as they surface.

---

## Completed tasks

| # | Task | Commits | Tests added | Notes |
|---|---|---|---|---|

---

## Pending tasks

All 7 tasks pending. See plan.

---

## Decisions made during implementation (D-letter pattern)

(populated as decisions land)

---

## Open questions surfaced for upcoming tasks

(populated as questions surface)
```

- [ ] **Step 4: Commit plan + progress doc**

Write commit message to `/tmp/commit-msg-task1.txt`:

```
docs: implementation plan + progress doc shell for #5

Plan derived from spec at docs/superpowers/specs/2026-06-15-industry-signal-design.md.
7 tasks. Same per-task dispatch protocol as the scope-json branch (precedent
in 2026-06-14-scope-json-progress.md). Smaller surface than #4: schema
one-line append + three SKILL prose blocks + two test-file extensions.
```

```bash
git add docs/superpowers/plans/2026-06-15-industry-signal.md \
        docs/superpowers/plans/2026-06-15-industry-signal-progress.md
git commit -F /tmp/commit-msg-task1.txt
rm /tmp/commit-msg-task1.txt
```

- [ ] **Step 5: Verify**

```bash
git log --oneline main..HEAD
npm test 2>&1 | tail -5
```

Expected: 2 commits ahead of main (spec + plan/progress doc). Tests still 108/108.

---

## Task 2: Append `industry` to `schema/brand/scope.schema.json`

**Goal:** Add the new property to the scope schema. The merge utility and the loader pick up the change for free.

**Files:**
- Modify: `schema/brand/scope.schema.json` (one block, top-level `properties`)

- [ ] **Step 1: Read the current schema**

```bash
cat schema/brand/scope.schema.json
```

Confirm the current top-level `properties` object contains `_comment`, `client`, `tier`, `mode`, `sources`, `interactive_preflight`. Confirm `additionalProperties: false` at top level.

- [ ] **Step 2: Edit the schema**

Use the `Edit` tool (not `Write`) to insert the new `industry` property between `mode` and `sources`. Preserve the surrounding structure exactly:

`old_string`:
```json
    "mode": {
      "description": "Init-mode that drives cli/src/commands/init.js TIER_FOR_MODE mapping. Note: the enum is intentionally different from tier (pitch instead of minimum); they are not interchangeable.",
      "enum": ["pitch", "standard", "comprehensive"]
    },
    "sources": {
```

`new_string`:
```json
    "mode": {
      "description": "Init-mode that drives cli/src/commands/init.js TIER_FOR_MODE mapping. Note: the enum is intentionally different from tier (pitch instead of minimum); they are not interchangeable.",
      "enum": ["pitch", "standard", "comprehensive"]
    },
    "industry": {
      "description": "Free-form descriptive prior (e.g. 'fast-food QSR', 'B2B SaaS analytics', 'luxury fashion ecommerce'). Stages 3 + 4 use it as a soft tie-breaker on inference and cite it inline. Mirrored field in .brandrc.yaml; same shape.",
      "type": "string",
      "minLength": 1
    },
    "sources": {
```

- [ ] **Step 3: Validate the schema still compiles strict-mode-clean**

```bash
node --input-type=module -e "
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { readFileSync } from 'node:fs';
const schema = JSON.parse(readFileSync('schema/brand/scope.schema.json', 'utf-8'));
const ajv = new Ajv({ allErrors: true, strict: true });
addFormats(ajv);
const v = ajv.compile(schema);

// Positive case: industry as string
const ok = v({ client: 'ACME', industry: 'B2B SaaS analytics' });
if (!ok) throw new Error('expected positive case to validate: ' + ajv.errorsText(v.errors));

// Negative case: industry as number
const fail = v({ industry: 123 });
if (fail) throw new Error('expected number to fail validation');

// Negative case: empty string
const failEmpty = v({ industry: '' });
if (failEmpty) throw new Error('expected empty string to fail validation (minLength: 1)');

// Negative case: unknown top-level key
const failUnknown = v({ industry_thing: 'x' });
if (failUnknown) throw new Error('expected unknown key to fail validation (additionalProperties: false)');

console.log('schema validates: OK');
"
```

Expected: `schema validates: OK`. No strict-mode warnings.

- [ ] **Step 4: Run the test suite to confirm no existing test regresses**

```bash
npm test 2>&1 | tail -5
```

Expected: 108 pass, 0 fail.

- [ ] **Step 5: Commit**

Write commit message to `/tmp/commit-msg-task2.txt`:

```
schema: add industry field to scope.schema.json

One-line append per the #4 to #5 cross-task contract. Top-level
sibling of client/tier/mode; free-form string with minLength: 1.
Existing scope-merge utility round-trips it without code changes.
```

```bash
git add schema/brand/scope.schema.json
git commit -F /tmp/commit-msg-task2.txt
rm /tmp/commit-msg-task2.txt
```

- [ ] **Step 6: Verify**

```bash
git log --oneline main..HEAD
npm test 2>&1 | tail -5
```

Expected: 3 commits ahead of main. Tests still 108/108.

---

## Task 3: Extend `cli/test/unit/scope-merge.test.js` (+1 test)

**Goal:** Confirm `industry` round-trips through the existing merge utility as a top-level string. No code change to `scope-merge.js`; this is a regression guard for the cross-task contract.

**Files:**
- Modify: `cli/test/unit/scope-merge.test.js` (append one new test at end)

- [ ] **Step 1: Append the new test**

Use the `Edit` tool. `old_string` is the closing of the last existing test (line 94 — keep it visible in `old_string` for uniqueness):

`old_string`:
```javascript
  assert.equal(r2.conflicts[0].field, 'interactive_preflight');
});
```

`new_string`:
```javascript
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
```

- [ ] **Step 2: Run the focused test file to confirm it passes**

```bash
node --test cli/test/unit/scope-merge.test.js 2>&1 | tail -5
```

Expected: `pass 6` / `fail 0` (was 5; now 6).

- [ ] **Step 3: Run the full test suite**

```bash
npm test 2>&1 | tail -5
```

Expected: 109 pass, 0 fail.

- [ ] **Step 4: Commit**

Write commit message to `/tmp/commit-msg-task3.txt`:

```
test(scope-merge): add industry round-trip test (#5)

Asserts industry pre-fills empty brandrc and that brandrc-wins-on-conflict
applies to the new field too. No diff to scope-merge.js: the existing
generic recursive merge handles industry without special-casing.
```

```bash
git add cli/test/unit/scope-merge.test.js
git commit -F /tmp/commit-msg-task3.txt
rm /tmp/commit-msg-task3.txt
```

- [ ] **Step 5: Verify**

```bash
git log --oneline main..HEAD
npm test 2>&1 | tail -5
```

Expected: 4 commits ahead of main. Tests at 109/109.

---

## Task 4: SKILL prose — add §0a edit, §4c bullet, §6b paragraph

**Goal:** Three additive prose blocks in `brand-context/skills/brand-extract/SKILL.md`. No section is moved or restructured; only insertions.

**Files:**
- Modify: `brand-context/skills/brand-extract/SKILL.md` (three insertion points)

- [ ] **Step 1: §0a — note `industry` alongside `client`/`tier`/`mode`**

Use the `Edit` tool. Locate the §0a step-2 sentence in the SKILL (around line 31):

`old_string`:
```
2. Read the file. Note `client`, `tier`, `mode`, and any `sources.*` already populated. Existing values are kept unless the practitioner explicitly says otherwise.
```

`new_string`:
```
2. Read the file. Note `client`, `tier`, `mode`, and any `sources.*` already populated. Existing values are kept unless the practitioner explicitly says otherwise. Also note `industry` if present (free-form string, e.g. "fast-food QSR", "B2B SaaS analytics"). When set, Stages 3 and 4 use it as a soft tie-breaker prior on inference. When absent, behavior is identical to today.
```

- [ ] **Step 2: §4c — append the industry-prior bullet + worked example**

Locate the end of §4c's inference list (the "Channel deltas" bullet around line 380):

`old_string`:
```
- **Channel deltas** — note material differences (e.g., "Twitter copy is shorter and more irreverent than the website").
```

`new_string`:
```
- **Channel deltas** — note material differences (e.g., "Twitter copy is shorter and more irreverent than the website").
- **Industry prior (optional, soft tie-breaker).** If `.brandrc.yaml` has `industry` set, treat it as a tie-breaker on inference choices when the evidence is roughly balanced — for example, choosing between "clinical-but-warm" and "clinical-but-cold" when sample counts and tone signals are even. The prior may NOT lower the ≥3-supporting-samples-per-attribute threshold from §4d, NOR the <10-total-samples threshold from §4e, NOR invent claims that have no sample support. When the prior actually influenced a claim, cite it inline with `*(industry context: <value>)*` after the claim's other citations. When `industry` is unset, this bullet is a no-op.

  Example. Samples are split 4-and-4 between "playful" and "wry" as candidate voice attributes; both clear the threshold. With `industry: "fast-food QSR"`, the prior breaks the tie toward "playful". The voice.md entry reads: `**playful** *(MEDIUM — 8 samples)* — short irreverent CTAs and emoji in social posts *(industry context: fast-food QSR)*`. Without the prior, the SKILL would pick whichever the corpus narrowly favored or surface both as candidates.
```

- [ ] **Step 3: §6b — insert the industry-prior paragraph for Stage 4**

Locate the §6b "Anchor every claim in specific source material…" sentence (around line 562). The target sentence ends with: `Synthesize content for each required section of …. Anchor every claim in specific source material — cite page numbers for the PDF, filenames for screenshots, URLs for web captures.`

`old_string`:
```
Synthesize content for each required section of `schema/brand/overview.schema.md`. Anchor every claim in specific source material — cite page numbers for the PDF, filenames for screenshots, URLs for web captures.
```

`new_string`:
```
Synthesize content for each required section of `schema/brand/overview.schema.md`. Anchor every claim in specific source material — cite page numbers for the PDF, filenames for screenshots, URLs for web captures.

**Industry prior (optional, soft tie-breaker).** When `.brandrc.yaml` has `industry` set, the same soft-prior rule from §4c applies to the **Brand Personality**, **Audience**, and **Competitive Context** subsections — and only those. Visual Language and the brand self-test are evidence-only (screenshots and the guide's stated rules). When the prior influenced a claim, append `*(industry context: <value>)*` after the claim's other citations. The prior never overrides an explicit guide statement; it only disambiguates close calls grounded in evidence.
```

- [ ] **Step 4: Sanity-check the three insertions**

```bash
grep -c "industry" brand-context/skills/brand-extract/SKILL.md
grep -c "industry context:" brand-context/skills/brand-extract/SKILL.md
grep -c "tie-breaker" brand-context/skills/brand-extract/SKILL.md
```

Expected: at least 6 mentions of `industry` (the three new blocks each mention the word multiple times); at least 3 occurrences of the `industry context:` literal (once in §4c bullet, once in worked example, once in §6b paragraph); at least 3 occurrences of `tie-breaker`.

- [ ] **Step 5: Run the full test suite**

```bash
npm test 2>&1 | tail -5
```

Expected: 109 pass, 0 fail. (No SKILL-driven test exists yet; the parity tests for the new prose are added in Task 5.)

- [ ] **Step 6: Commit**

Write commit message to `/tmp/commit-msg-task4.txt`:

```
skill(brand-extract): add industry soft-prior to Stages 3 and 4 (#5)

Three additive prose blocks: section 0a notes the field exists; section
4c adds a tie-breaker bullet plus a worked example for Stage 3 voice
inference; section 6b adds a paragraph scoping the prior to Stage 4
Brand Personality, Audience, and Competitive Context only.

Citation marker: `*(industry context: <value>)*` (italicized parenthetical,
mirrors existing confidence-cite and source-cite patterns).

Threshold preservation: the prior may not lower section 4d (>=3 samples
per attribute) or section 4e (<10 total samples). When industry is unset,
the new bullets are no-ops.
```

```bash
git add brand-context/skills/brand-extract/SKILL.md
git commit -F /tmp/commit-msg-task4.txt
rm /tmp/commit-msg-task4.txt
```

- [ ] **Step 7: Verify**

```bash
git log --oneline main..HEAD
npm test 2>&1 | tail -5
```

Expected: 5 commits ahead of main. Tests still 109/109.

---

## Task 5: Extend `cli/test/unit/skill-scope-parity.test.js` (+3 tests)

**Goal:** Three new parity assertions guard against SKILL prose drift on the new field, citation marker, and tie-breaker rule. Mirrors the precedent's parity-test pattern.

**Files:**
- Modify: `cli/test/unit/skill-scope-parity.test.js` (append three tests at end)

- [ ] **Step 1: Append the new tests**

Use the `Edit` tool. `old_string` is the closing of the last existing test (line 42-43; keep enough context for uniqueness):

`old_string`:
```javascript
  assert.ok(mentionsDelete, 'SKILL.md must explain that .scope.json is deleted after a successful merge + brandrc write');
});
```

`new_string`:
```javascript
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
```

- [ ] **Step 2: Run the focused test file to confirm all pass**

```bash
node --test cli/test/unit/skill-scope-parity.test.js 2>&1 | tail -10
```

Expected: `pass 8` / `fail 0` (was 5; now 8).

- [ ] **Step 3: Run the full test suite**

```bash
npm test 2>&1 | tail -5
```

Expected: 112 pass, 0 fail.

- [ ] **Step 4: Commit**

Write commit message to `/tmp/commit-msg-task5.txt`:

```
test(skill-scope-parity): guard industry signal prose against drift (#5)

Three new assertions: SKILL mentions the industry field by name; SKILL
contains the literal `industry context:` citation marker; SKILL uses
the phrase "tie-breaker" and the threshold-preservation framing.
Together these catch the most likely drift modes (silent rename,
silent removal of the citation marker, silent escalation from soft
prior to hard heuristic).
```

```bash
git add cli/test/unit/skill-scope-parity.test.js
git commit -F /tmp/commit-msg-task5.txt
rm /tmp/commit-msg-task5.txt
```

- [ ] **Step 5: Verify**

```bash
git log --oneline main..HEAD
npm test 2>&1 | tail -5
```

Expected: 6 commits ahead of main. Tests at 112/112.

---

## Task 6: Repo docs propagation (README, tasks.md)

**Goal:** Surface the new field where readers will look for it, mark #5 complete in the active backlog (anticipating merge — actual merge SHA gets recorded post-merge in a separate cleanup commit, matching #4 precedent).

**Files:**
- Modify: `README.md` (add a one-line note in the existing pipeline structure)
- Modify: `docs/tasks.md` (move #5 from Active backlog → Completed)

- [ ] **Step 1: Add the README pointer (two specific edits)**

Two surgical edits to surface the new field where readers will look for it: the YAML example showing `.brandrc.yaml` shape, and the embedded-use paragraph describing the scope file. Use the `Edit` tool for each.

**Edit A — extend the YAML example.** The README has a `.brandrc.yaml` example block under "Then add your sources to `.brandrc.yaml`:" (around line 91-104). Insert `industry` as a top-level field between `mode` and `sources` to mirror the schema placement.

`old_string`:
```yaml
client: ACME Corp
tier: standard
mode: standard
sources:
  website: https://acme.example.com
```

`new_string`:
```yaml
client: ACME Corp
tier: standard
mode: standard
industry: B2B SaaS analytics       # optional, free-form; Stages 3+4 use it as a soft tie-breaker prior
sources:
  website: https://acme.example.com
```

**Edit B — extend the embedded-use paragraph.** The README's "How the pipeline works" section ends with a paragraph describing `.brand/.scope.json` (around line 135). Append a sentence noting that `industry` flows through both files.

Find the existing sentence ending `Standalone use is unchanged.` and insert a new sentence after it.

`old_string`:
```
For **embedded use** (a host orchestrator dispatching the SKILL non-interactively), drop a `.brand/.scope.json` file with structured answers to Stage 0's discovery questions. The SKILL pre-fills `.brandrc.yaml` from it, skips the conversational flow for any field already populated, and deletes `.scope.json` after a successful Stage 0 completion. Standalone use is unchanged. Schema: [`schema/brand/scope.schema.json`](schema/brand/scope.schema.json). Spec: [`docs/superpowers/specs/2026-06-14-scope-json-design.md`](docs/superpowers/specs/2026-06-14-scope-json-design.md).
```

`new_string`:
```
For **embedded use** (a host orchestrator dispatching the SKILL non-interactively), drop a `.brand/.scope.json` file with structured answers to Stage 0's discovery questions. The SKILL pre-fills `.brandrc.yaml` from it, skips the conversational flow for any field already populated, and deletes `.scope.json` after a successful Stage 0 completion. Standalone use is unchanged. Schema: [`schema/brand/scope.schema.json`](schema/brand/scope.schema.json). Spec: [`docs/superpowers/specs/2026-06-14-scope-json-design.md`](docs/superpowers/specs/2026-06-14-scope-json-design.md).

The optional top-level `industry` field flows through both `.brandrc.yaml` and `.brand/.scope.json` as a free-form descriptive string. When set, Stages 3 (voice) and 4 (overview) use it as a soft tie-breaker prior on inference and cite it inline as `*(industry context: <value>)*`. Safe to omit. Spec: [`docs/superpowers/specs/2026-06-15-industry-signal-design.md`](docs/superpowers/specs/2026-06-15-industry-signal-design.md).
```

- [ ] **Step 2: Update `docs/tasks.md`**

Move the `#5` entry out of "Active backlog → Unblocked" and into "Completed" (above #4 to keep newest-first ordering). Use the same shape as #4's completed entry: header line, "Output:" pointer to the spec, what landed, test count delta.

Use the `Edit` tool. Find #5's current entry under "Active backlog → Unblocked":

`old_string`:
```
#### #5 — Inject industry signal into voice + overview extraction
`industry:` field in `.brandrc.yaml` (and/or scope payload). Stages 3 + 4 read it; bias inference transparently. Cite the prior in voice.md / overview.md prose. Source: feedback item #4. Now unblocked by the #4 merge — the scope schema's `additionalProperties: false` at the top level means adding `industry: <string>` to `scope.schema.json` will be a one-line append.
```

`new_string` (leaves #5 listed under Active backlog as a placeholder note pointing to the in-flight branch — the actual move-to-Completed lands in the post-merge cleanup commit, mirroring how #4 handled it):
```
#### #5 — Inject industry signal into voice + overview extraction
**In flight on branch `feat/industry-signal`.** `industry:` field at the top of `.brandrc.yaml` and `.brand/.scope.json`. Stages 3 + 4 use it as a soft tie-breaker prior on inference; every prior-influenced claim cites `*(industry context: <value>)*` inline. Spec: [`docs/superpowers/specs/2026-06-15-industry-signal-design.md`](superpowers/specs/2026-06-15-industry-signal-design.md). Final move to Completed lands in the post-merge cleanup commit per #4 precedent.
```

(Rationale: #4's pattern was to mark Completed only after the actual `--no-ff` merge SHA was known, in a separate cleanup commit on `main`. Repeating the pattern keeps the historical convention.)

Also update the "Last updated" line at the top of `docs/tasks.md`. Find:

`old_string`:
```
**Last updated:** 2026-06-15 — #4 merged to `main` via local merge commit `97db05d` (no PR — `--no-ff` merged from `feat/scope-json`; the feature branch is preserved on origin for history).
```

`new_string`:
```
**Last updated:** 2026-06-15 — #5 (industry signal) in flight on `feat/industry-signal`; #4 merged to `main` via local merge commit `97db05d` (no PR — `--no-ff` merged from `feat/scope-json`; the feature branch is preserved on origin for history).
```

- [ ] **Step 3: Run the full test suite**

```bash
npm test 2>&1 | tail -5
```

Expected: 112 pass, 0 fail.

- [ ] **Step 4: Commit**

Write commit message to `/tmp/commit-msg-task6.txt`:

```
docs: propagate industry signal note to README and tasks.md (#5)

README adds a one-line pointer to the new optional industry field.
tasks.md notes the in-flight branch under #5 and updates the
"Last updated" line. Final move to Completed lands in the
post-merge cleanup commit, mirroring the #4 precedent.
```

```bash
git add README.md docs/tasks.md
git commit -F /tmp/commit-msg-task6.txt
rm /tmp/commit-msg-task6.txt
```

- [ ] **Step 5: Verify**

```bash
git log --oneline main..HEAD
npm test 2>&1 | tail -5
```

Expected: 7 commits ahead of main. Tests still 112/112.

---

## Task 7: Final verification + cross-branch code review

**Goal:** Verification, not build. No implementer subagent. Confirm `npm test` passes, smoke-test end-to-end against a real scope file, dispatch a single final code-reviewer subagent across the branch diff, update progress doc, hand off via `superpowers:finishing-a-development-branch`.

- [ ] **Step 1: Run the full test suite**

```bash
npm test 2>&1 | tail -10
```

Expected: 112 pass, 0 fail.

- [ ] **Step 2: End-to-end smoke test**

Walk a representative flow: scaffold a project, drop a scope file with `industry`, validate it via the CLI, confirm the merge utility populates the field. Avoid apostrophes in inline JSON; write to `/tmp/smoke-industry.json` first.

```bash
mkdir -p /tmp/industry-smoke && cd /tmp/industry-smoke
node "$OLDPWD/cli/bin/brand-cli.js" init --client acme --mode standard --force >/dev/null
mkdir -p .brand
cat > /tmp/smoke-industry.json <<JSON
{
  "client": "ACME",
  "tier": "standard",
  "industry": "B2B SaaS analytics",
  "sources": { "website": "https://example.com" },
  "interactive_preflight": false
}
JSON
cp /tmp/smoke-industry.json .brand/.scope.json

# Validate via the existing CLI subcommand
node "$OLDPWD/cli/bin/brand-cli.js" scope --validate --json
echo "validate exit: $?"

# Verify the merge populates industry end-to-end
node --input-type=module -e "
import { loadScope, validateScope } from '$OLDPWD/cli/src/utils/scope-loader.js';
import { mergeScopeIntoBrandrc } from '$OLDPWD/cli/src/utils/scope-merge.js';

const brandDir = '$PWD/.brand';
const s = loadScope(brandDir);
if (!s) throw new Error('loadScope returned null');
if (!validateScope(s).valid) throw new Error('validation failed');

const brandrc = { client: '', tier: '', mode: 'standard', sources: {} };
const r = mergeScopeIntoBrandrc(s, brandrc);
if (r.merged.industry !== 'B2B SaaS analytics') throw new Error('industry merge failed');
if (!r.filledFromScope.has('industry')) throw new Error('filledFromScope missing industry');
console.log('industry roundtrip OK');

// Brandrc-wins-on-conflict applies to industry
const brandrcWithIndustry = { ...brandrc, industry: 'fintech consumer' };
const r2 = mergeScopeIntoBrandrc(s, brandrcWithIndustry);
if (r2.merged.industry !== 'fintech consumer') throw new Error('brandrc-wins on industry failed');
if (r2.conflicts.length !== 1) throw new Error('expected 1 conflict on industry');
if (r2.conflicts[0].field !== 'industry') throw new Error('conflict field mismatch');
console.log('industry brandrc-wins OK');
"

cd "$OLDPWD"
rm -rf /tmp/industry-smoke /tmp/smoke-industry.json
```

Expected: `validate` JSON has `"ok":true`, exit 0. Roundtrip prints `industry roundtrip OK` then `industry brandrc-wins OK`.

- [ ] **Step 3: `git status` clean + commit count**

```bash
git status
git log --oneline main..HEAD | wc -l
```

Expected: clean working tree. Commit count: 7 (1 spec + 1 plan/progress doc + 5 task commits) plus any refinement commits from the per-task review protocol.

- [ ] **Step 4: Spec coverage skim**

Open `docs/superpowers/specs/2026-06-15-industry-signal-design.md` and confirm every requirement maps to a landed task:

| Spec section | Landed in task |
|---|---|
| §1 Field shape and location (top-level, free-form, "empty" semantics) | Task 2 (schema) + Task 3 (round-trip test) |
| §2 Schema layer | Task 2 (schema) |
| §3 SKILL prose (§0a, §4c, §6b) | Task 4 |
| §4 Test layer (parity +3, scope-merge +1) | Task 3 (scope-merge) + Task 5 (parity) |
| §5 CLI layer — no code changes | (no task; verified in Step 2 smoke test) |
| §6 Docs layer | Task 6 |
| §7 Error handling + edge cases | Task 4 prose covers behavioral edge cases; Task 2 schema covers validation cases (number, empty string, unknown key) |
| §8 Considered alternatives | (rejected per spec; nothing to land) |
| §9 Out of scope | (nothing to land) |
| §10 Three-layer propagation summary | Tasks 2 (schema), 4 (SKILL), 3 + 5 (tests), 6 (docs) |

If anything is uncovered, file a follow-up task and note it in the progress doc.

- [ ] **Step 5: Final cross-branch code review**

Confirm BASE + HEAD SHAs:

```bash
git merge-base main HEAD  # BASE_SHA
git rev-parse HEAD        # HEAD_SHA
```

Dispatch a single `superpowers:code-reviewer` subagent across the entire branch diff. Pass:

- BASE_SHA = `git merge-base main HEAD` output
- HEAD_SHA = `git rev-parse HEAD` output
- Scope: full branch review — "is the whole feature ready to merge?"
- Focus areas:
  - **Cross-task contract sync** — `industry` field placement consistent across schema, scope-merge tests, SKILL prose, parity tests, README. Citation marker `*(industry context: <value>)*` literal matches in §4c and §6b. Tie-breaker framing consistent with the spec's hard rules (no threshold lowering; no claim invention).
  - **Scope of the prior is enforced in prose** — Stage 3 §4c bullet covers all Stage 3 inference; Stage 4 §6b paragraph names Brand Personality / Audience / Competitive Context AND explicitly excludes Visual Language and brand self-test.
  - **No code changes to scope-merge.js / scope-loader.js / generators / init.js** — branch is schema + prose + tests only. If any code change snuck in, surface it.
  - **Schema strict-mode parity** — `industry` block follows the existing description-then-type-then-constraints pattern of the other top-level properties; no orphaned fields; no ajv strict warnings.

If reviewer flags Critical or Important: dispatch a refinement subagent. Minor: accept per [D7].

- [ ] **Step 6: Update progress doc with final state**

In `docs/superpowers/plans/2026-06-15-industry-signal-progress.md`:

- Add Task 7 to the "Completed tasks" table with the cross-branch reviewer verdict.
- Add a "Final-stage handoff" section listing what landed (5 commits across schema, SKILL, scope-merge test, parity test, docs; +4 tests).
- Update the "Quick state check" block with the final commit + test counts.

Write commit message to `/tmp/commit-msg-task7-progress.txt`:

```
docs: progress doc through Task 7 — feature ready for merge
```

```bash
git add docs/superpowers/plans/2026-06-15-industry-signal-progress.md
git commit -F /tmp/commit-msg-task7-progress.txt
rm /tmp/commit-msg-task7-progress.txt
```

- [ ] **Step 7: Hand off via `superpowers:finishing-a-development-branch`**

Invoke that skill (separate, same as the scope-json branch's final move). Pass it: spec link, plan link, progress doc link, test delta (108 → 112; +4 tests), commit count, cross-branch reviewer verdict.

After merge: update `docs/tasks.md` "Last updated" line with the merge SHA, move #5 from Active backlog to Completed (with the post-merge SHA in the Output line), and hoist any new footguns surfaced during this branch into the next progress doc's "things to know" appendix.

---

## Self-review notes

Spec coverage per §10 propagation table is mapped to specific tasks above (Step 4 of Task 7 has the matrix). Type/identifier consistency: the field name `industry` is used identically across all tasks; the citation marker literal `*(industry context: <value>)*` is the same in spec §3 and Task 4 prose; the tie-breaker phrasing matches between spec §3 and Task 4 prose; the parity-test substrings (`industry context:`, `tie-breaker`, threshold-preservation regex) match the SKILL prose Task 4 inserts. No placeholders remain; every code/prose block is the actual content the engineer pastes.
