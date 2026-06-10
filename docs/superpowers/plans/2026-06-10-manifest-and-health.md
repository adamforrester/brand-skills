# Manifest + Health JSON — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Emit two machine-readable artifacts (`.brand/manifest.json` from `/brand-context:extract`, `.brand/.health.json` from `/brand-context:check`) so embedded host orchestrators can gate on brand-package readiness without human review.

**Architecture:** Manifest = facts emitted by extract; health = verdict emitted by check. Shared status vocabulary (`complete | partial | placeholder | missing | defaults`) and tier-weighted readiness formula. JSON Schema validation in CLI; SKILL fallback constructs JSON inline without validation. New `node:test` harness with unit + integration + golden-fixture coverage.

**Tech Stack:** Node ≥18 (ESM), commander, ajv@8 + ajv-formats@3 (new deps), node:test (built-in), existing chalk + yaml.

**Spec:** [`docs/superpowers/specs/2026-06-10-manifest-and-health-design.md`](../specs/2026-06-10-manifest-and-health-design.md)

---

## File Map

**New files:**

| Path | Responsibility |
|---|---|
| `schema/manifest.schema.json` | JSON Schema 2020-12 contract for `.brand/manifest.json` |
| `schema/health.schema.json` | JSON Schema 2020-12 contract for `.brand/.health.json` |
| `cli/src/utils/file-status.js` | Pure function: classify a file path → `complete | placeholder | missing` (the three a content-scan can detect) |
| `cli/src/utils/tier-weights.js` | Pure function: tier → weight map; `readiness()`; `tierLabel()`; `confidence()` |
| `cli/src/utils/manifest-writer.js` | Validate payload against schema, write `.brand/manifest.json` |
| `cli/src/utils/health-writer.js` | Build health payload from manifest (or content-scan), validate, write `.brand/.health.json` |
| `cli/src/utils/gap-actions.js` | Per-status / per-path lookup → `suggested_action` string |
| `cli/src/commands/emit-manifest.js` | CLI command body: read stdin, walk `.brand/`, build payload, delegate to manifest-writer |
| `cli/test/helpers/tmp-brand.js` | Test helper: copy a fixture into a tmpdir and return path |
| `cli/test/helpers/run-cli.js` | Test helper: spawn `brand-cli <args>` with stdin, capture stdout/stderr/exit |
| `cli/test/unit/file-status.test.js` | Unit tests for status classifier |
| `cli/test/unit/tier-weights.test.js` | Unit tests for weights, formula, boundaries |
| `cli/test/unit/manifest-writer.test.js` | Unit tests for manifest validation + write |
| `cli/test/unit/health-writer.test.js` | Unit tests for health build + validation |
| `cli/test/integration/emit-manifest.test.js` | End-to-end `brand-cli emit-manifest` |
| `cli/test/integration/score-emits-health.test.js` | End-to-end `brand-cli score` |
| `cli/test/integration/round-trip.test.js` | emit-manifest → score, assert coupling |
| `cli/test/integration/score-without-manifest.test.js` | Content-scan fallback behavior |
| `cli/test/integration/fresh-init.test.js` | `brand-cli init` then `score` |
| `cli/test/fixtures/populated/.brand/...` | Mostly-complete `.brand/` for tests |
| `cli/test/fixtures/fresh-init/.brand/...` | Placeholder `.brand/` mirroring init output |
| `cli/test/fixtures/mixed/.brand/...` | Mix of statuses |
| `cli/test/fixtures/stage-data/full-pipeline.json` | Stdin fixture: all stages ran |
| `cli/test/fixtures/stage-data/partial-pipeline.json` | Stdin fixture: stages 2+3 only |
| `cli/test/fixtures/stage-data/no-mcps.json` | Stdin fixture: no MCPs available |
| `cli/test/golden/manifest-from-populated.json` | Expected manifest output for `populated` fixture |
| `cli/test/golden/manifest-from-skill.json` | Reference shape SKILL fallback should produce |
| `cli/test/golden/health-from-populated.json` | Expected health output |

**Modified files:**

| Path | Change |
|---|---|
| `cli/src/commands/score.js` | Refactor to use shared `file-status.js`; emit `.health.json` after console output; preserve all current behavior |
| `cli/bin/brand-cli.js` | Register `emit-manifest` command |
| `package.json` | Add `ajv@^8`, `ajv-formats@^3`; replace `test` stub with `node --test cli/test/**/*.test.js`; add `test:watch` |
| `brand-context/skills/brand-extract/SKILL.md` | Section 11: add manifest-emission step (CLI shell-out + inline fallback). Phase 8 reminder: note manifest as Stage-8 output. |
| `brand-context/skills/brand-check/SKILL.md` | Step 1: note `.health.json` is also written |
| `CLAUDE.md` | File-write policies table: add manifest + health rows. Architecture diagram: add manifest/health as outputs. |
| `README.md` | "How the pipeline works": note manifest as final-stage artifact |
| `docs/tasks.md` | Mark #2 + #6 complete; note #3 unblocked |
| `schema/brand/README.md` | Cross-link to `../manifest.schema.json` and `../health.schema.json` |

---

## Task 1: Add dev dependencies and test scripts

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Add ajv + ajv-formats dependencies**

```bash
cd /Users/aforrester/Documents/brand-skills && npm install --save ajv@^8 ajv-formats@^3
```

Expected: `package.json` updated, `package-lock.json` written, `node_modules/` populated.

- [ ] **Step 2: Replace test stub script**

Edit `package.json`:

```json
"scripts": {
  "test": "node --test 'cli/test/**/*.test.js'",
  "test:watch": "node --test --watch 'cli/test/**/*.test.js'"
}
```

- [ ] **Step 3: Verify test command runs (no tests yet)**

Run: `npm test`
Expected: exits 0 with "tests 0", because the glob matches nothing yet.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -F /tmp/commit-msg.txt
```

Use a tempfile for the commit message (apostrophes break heredocs in this repo's shell):

```
deps: add ajv + ajv-formats; wire node:test harness

Prep work for #2 + #6 (manifest.json + .health.json validation
and test coverage). Two small deps for JSON Schema validation;
node:test is built-in.
```

---

## Task 2: Tier weights and readiness formula

**Files:**
- Create: `cli/src/utils/tier-weights.js`
- Test: `cli/test/unit/tier-weights.test.js`

- [ ] **Step 1: Write the failing test**

Create `cli/test/unit/tier-weights.test.js`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { weightsForTier, readiness, tierLabel, confidence } from '../../src/utils/tier-weights.js';

test('weightsForTier(minimum) returns 7 entries totaling 9', () => {
  const w = weightsForTier('minimum');
  assert.equal(Object.keys(w).length, 7);
  assert.equal(Object.values(w).reduce((a, b) => a + b, 0), 9);
  assert.equal(w['overview.md'], 2);
  assert.equal(w['voice.md'], 2);
  assert.equal(w['tokens/colors.md'], 1);
});

test('weightsForTier(standard) extends minimum with composition + conflicts + CHANGELOG', () => {
  const w = weightsForTier('standard');
  assert.equal(Object.keys(w).length, 12);
  assert.equal(w['composition/page-types.md'], 1);
  assert.equal(w['composition/patterns.md'], 1);
  assert.equal(w['composition/anti-patterns.md'], 1);
  assert.equal(w['conflicts.md'], 1);
  assert.equal(w['CHANGELOG.md'], 1);
});

test('weightsForTier(comprehensive) adds 4 workflow files', () => {
  const w = weightsForTier('comprehensive');
  assert.equal(Object.keys(w).length, 16);
  assert.equal(w['workflows/figma-to-code.md'], 1);
});

test('readiness counts complete and defaults; ignores partial/placeholder/missing', () => {
  const weights = { 'a.md': 2, 'b.md': 1, 'c.md': 1 };
  const files = { 'a.md': 'complete', 'b.md': 'defaults', 'c.md': 'placeholder' };
  // weighted_complete = 2 + 1 = 3, weighted_total = 4
  assert.equal(readiness(files, weights), 0.75);
});

test('readiness rounds to two decimals', () => {
  const weights = { 'a.md': 1, 'b.md': 1, 'c.md': 1 };
  const files = { 'a.md': 'complete', 'b.md': 'missing', 'c.md': 'missing' };
  // 1/3 = 0.333... → 0.33
  assert.equal(readiness(files, weights), 0.33);
});

test('readiness returns 0 for empty inputs', () => {
  assert.equal(readiness({}, {}), 0);
});

test('tierLabel boundaries', () => {
  assert.equal(tierLabel(0.95), 'ready');
  assert.equal(tierLabel(0.80), 'good');
  assert.equal(tierLabel(0.50), 'partial');
  assert.equal(tierLabel(0.49), 'incomplete');
  assert.equal(tierLabel(0), 'incomplete');
  assert.equal(tierLabel(1.0), 'ready');
});

test('confidence: HIGH when manifest seen and no defaults', () => {
  assert.equal(confidence({ manifestSeen: true, hasDefaults: false, scanCompleteRatio: 1 }), 'HIGH');
});

test('confidence: MEDIUM when manifest seen with defaults', () => {
  assert.equal(confidence({ manifestSeen: true, hasDefaults: true, scanCompleteRatio: 1 }), 'MEDIUM');
});

test('confidence: MEDIUM on content-scan with >=80% complete', () => {
  assert.equal(confidence({ manifestSeen: false, hasDefaults: false, scanCompleteRatio: 0.85 }), 'MEDIUM');
});

test('confidence: LOW on content-scan with <80% complete', () => {
  assert.equal(confidence({ manifestSeen: false, hasDefaults: false, scanCompleteRatio: 0.5 }), 'LOW');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --test-name-pattern='tier-weights'`
Expected: FAIL with "Cannot find module '../../src/utils/tier-weights.js'".

- [ ] **Step 3: Implement tier-weights.js**

Create `cli/src/utils/tier-weights.js`:

```javascript
const MINIMUM_WEIGHTS = {
  'overview.md': 2,
  'voice.md': 2,
  'tokens/colors.md': 1,
  'tokens/typography.md': 1,
  'tokens/spacing.md': 1,
  'tokens/motion.md': 1,
  'tokens/surfaces.md': 1,
};

const STANDARD_ADDITIONS = {
  'composition/page-types.md': 1,
  'composition/patterns.md': 1,
  'composition/anti-patterns.md': 1,
  'conflicts.md': 1,
  'CHANGELOG.md': 1,
};

const COMPREHENSIVE_ADDITIONS = {
  'workflows/figma-to-code.md': 1,
  'workflows/code-standards.md': 1,
  'workflows/deploy.md': 1,
  'workflows/qa-checklist.md': 1,
};

export function weightsForTier(tier) {
  if (tier === 'minimum') return { ...MINIMUM_WEIGHTS };
  if (tier === 'standard') return { ...MINIMUM_WEIGHTS, ...STANDARD_ADDITIONS };
  if (tier === 'comprehensive') return { ...MINIMUM_WEIGHTS, ...STANDARD_ADDITIONS, ...COMPREHENSIVE_ADDITIONS };
  throw new Error(`Unknown tier: ${tier}`);
}

const COMPLETE_LIKE = new Set(['complete', 'defaults']);

export function readiness(files, weights) {
  let weightedTotal = 0;
  let weightedComplete = 0;
  for (const [path, weight] of Object.entries(weights)) {
    weightedTotal += weight;
    if (COMPLETE_LIKE.has(files[path])) weightedComplete += weight;
  }
  if (weightedTotal === 0) return 0;
  return Math.round((weightedComplete / weightedTotal) * 100) / 100;
}

export function tierLabel(r) {
  if (r >= 0.95) return 'ready';
  if (r >= 0.80) return 'good';
  if (r >= 0.50) return 'partial';
  return 'incomplete';
}

export function confidence({ manifestSeen, hasDefaults, scanCompleteRatio }) {
  if (manifestSeen && !hasDefaults) return 'HIGH';
  if (manifestSeen && hasDefaults) return 'MEDIUM';
  if (!manifestSeen && scanCompleteRatio >= 0.8) return 'MEDIUM';
  return 'LOW';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --test-name-pattern='tier-weights'`
Expected: PASS, 11 tests.

- [ ] **Step 5: Commit**

```bash
git add cli/src/utils/tier-weights.js cli/test/unit/tier-weights.test.js
git commit -F /tmp/commit-msg.txt
```

Message:
```
feat(cli): tier-weights utility — readiness formula + boundaries

Pure module: weightsForTier, readiness, tierLabel, confidence.
Hardcoded weights per spec section 3.4. Covers minimum/standard/
comprehensive tiers; 11 unit tests on boundaries.
```

---

## Task 3: File-status classifier

**Files:**
- Create: `cli/src/utils/file-status.js`
- Test: `cli/test/unit/file-status.test.js`

The existing `score.js` `hasContent()` lives inline; this task extracts it into a shared module without behavior change. `score.js` will switch to using it in Task 9.

- [ ] **Step 1: Write the failing test**

Create `cli/test/unit/file-status.test.js`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { classifyFile } from '../../src/utils/file-status.js';

function withTmpFile(content, fn) {
  const dir = mkdtempSync(join(tmpdir(), 'brand-test-'));
  const path = join(dir, 'test.md');
  if (content !== null) writeFileSync(path, content);
  try {
    return fn(path);
  } finally {
    rmSync(dir, { recursive: true });
  }
}

test('classifyFile returns missing when file does not exist', () => {
  const dir = mkdtempSync(join(tmpdir(), 'brand-test-'));
  try {
    assert.equal(classifyFile(join(dir, 'nope.md')), 'missing');
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('classifyFile returns placeholder when scaffold marker present', () => {
  withTmpFile('# Title\n\n<!-- Fill this file following the schema at schema/foo.md -->\n', (p) => {
    assert.equal(classifyFile(p), 'placeholder');
  });
});

test('classifyFile returns placeholder when frontmatter is fully commented and body is short', () => {
  const content = '---\ncolors:\n  # primary: "#000000"\n  # neutral: "#FFFFFF"\n---\n\n# Title\n';
  withTmpFile(content, (p) => {
    assert.equal(classifyFile(p), 'placeholder');
  });
});

test('classifyFile returns complete when body has substantial content', () => {
  const content = '# Title\n\nThis is a fully populated document with more than fifty characters of body content.';
  withTmpFile(content, (p) => {
    assert.equal(classifyFile(p), 'complete');
  });
});

test('classifyFile returns complete when frontmatter has uncommented values', () => {
  const content = '---\ncolors:\n  primary: "#FF0000"\n---\n\n# Title\n\nShort body.\n';
  withTmpFile(content, (p) => {
    assert.equal(classifyFile(p), 'complete');
  });
});

test('classifyFile strips H1 and HTML comments before measuring body', () => {
  const content = '# Title\n<!-- comment one -->\n<!-- comment two -->\n\nshort\n';
  withTmpFile(content, (p) => {
    // Body after strip is just "short" (5 chars) — should be placeholder-equivalent
    // but no scaffold marker, no frontmatter, so falls into the body-length branch
    assert.equal(classifyFile(p), 'placeholder');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --test-name-pattern='classifyFile'`
Expected: FAIL with module-not-found.

- [ ] **Step 3: Implement file-status.js**

Create `cli/src/utils/file-status.js`. Behavior is the existing `hasContent()` from `score.js`, but returns one of the three scan-detectable statuses instead of a boolean.

```javascript
import { existsSync, readFileSync } from 'node:fs';

const PLACEHOLDER_MARKER = '<!-- Fill this file following the schema';

/**
 * Classify a brand file by scanning its content.
 * Returns one of: 'missing' | 'placeholder' | 'complete'.
 *
 * The 'partial' and 'defaults' statuses cannot be detected by content scan —
 * they require producer-side stage-execution data and are emitted by extract.
 * When this returns 'complete', the producer may downgrade it to 'partial'
 * or 'defaults' before the manifest is written.
 */
export function classifyFile(absPath) {
  if (!existsSync(absPath)) return 'missing';

  const raw = readFileSync(absPath, 'utf-8');

  if (raw.includes(PLACEHOLDER_MARKER)) return 'placeholder';

  // Strip frontmatter and inspect remaining body.
  let body = raw;
  const trimmed = body.trimStart();
  if (trimmed.startsWith('---')) {
    const rest = trimmed.slice(3);
    const end = rest.indexOf('\n---');
    if (end !== -1) body = rest.slice(end + 4);
  }

  // Strip leading H1, HTML comments, blank lines.
  body = body
    .replace(/^#\s+[^\n]+\n+/, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .trim();

  // Frontmatter: if every value line is commented and body is short, it's a placeholder.
  const fm = raw.match(/^---\n([\s\S]*?)\n---/);
  if (fm) {
    const fmLines = fm[1].split('\n').filter((l) => l.trim());
    const valueLines = fmLines.filter((l) => /^\s+/.test(l));
    const allCommented = valueLines.length > 0 && valueLines.every((l) => /^\s*#/.test(l));
    if (allCommented && body.length < 50) return 'placeholder';
  }

  return body.length >= 50 ? 'complete' : 'placeholder';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --test-name-pattern='classifyFile'`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add cli/src/utils/file-status.js cli/test/unit/file-status.test.js
git commit -F /tmp/commit-msg.txt
```

Message:
```
feat(cli): file-status utility — extract classifyFile from score.js

Pure module returns 'missing' | 'placeholder' | 'complete' from a
content scan. Behavior identical to score.js hasContent() but
returns the three statuses content-scan can detect rather than a
boolean. score.js will switch to it in a follow-up task.
```

---

## Task 4: Gap-action lookup

**Files:**
- Create: `cli/src/utils/gap-actions.js`

This file is small; tested via the integration tests rather than its own unit test (a per-status string-lookup table). No behavior to verify in isolation that the integration tests don't already cover.

- [ ] **Step 1: Implement gap-actions.js**

Create `cli/src/utils/gap-actions.js`:

```javascript
const PER_FILE_ACTIONS = {
  'voice.md': {
    placeholder: 'Run /brand-context:extract Stage 3, or paste brand voice document into voice.md',
    missing: 'Run /brand-context:extract Stage 3, or paste brand voice document into voice.md',
    partial: 'Re-run /brand-context:extract Stage 3 with more web sources, or hand-author missing sections',
  },
  'overview.md': {
    placeholder: 'Drop a brand-guide PDF into ./assets/ and run /brand-context:extract Stage 4',
    missing: 'Drop a brand-guide PDF into ./assets/ and run /brand-context:extract Stage 4',
    partial: 'Provide additional reference sources and re-run /brand-context:extract Stage 4',
  },
  'CHANGELOG.md': {
    placeholder: 'Created automatically on next /brand-context:extract',
    missing: 'Created automatically on next /brand-context:extract',
  },
};

const PER_PREFIX_ACTIONS = {
  'tokens/': {
    placeholder: 'Run /brand-context:extract Stage 1 (Figma) or Stage 2 (web with Playwright), or paste tokens manually',
    missing: 'Run /brand-context:extract Stage 1 (Figma) or Stage 2 (web with Playwright), or paste tokens manually',
  },
  'composition/': {
    placeholder: 'Hand-author per schema/brand/composition-{filename}.schema.md',
    missing: 'Hand-author per schema/brand/composition-{filename}.schema.md',
  },
  'workflows/': {
    placeholder: 'Hand-author per schema/brand/workflows-{filename}.schema.md (comprehensive tier)',
    missing: 'Hand-author per schema/brand/workflows-{filename}.schema.md (comprehensive tier)',
  },
};

export function suggestedAction(filePath, status) {
  const exact = PER_FILE_ACTIONS[filePath];
  if (exact && exact[status]) return exact[status];

  for (const [prefix, actions] of Object.entries(PER_PREFIX_ACTIONS)) {
    if (filePath.startsWith(prefix)) {
      const template = actions[status];
      if (!template) continue;
      const filename = filePath.slice(prefix.length).replace(/\.md$/, '');
      return template.replace('{filename}', filename);
    }
  }

  // Generic fallback.
  return `Populate ${filePath} per schema/brand/${filePath.replace(/\//g, '-').replace(/\.md$/, '.schema.md')}`;
}
```

- [ ] **Step 2: Commit**

```bash
git add cli/src/utils/gap-actions.js
git commit -F /tmp/commit-msg.txt
```

Message:
```
feat(cli): gap-actions utility — suggested-action lookup

Per-file overrides (voice/overview/CHANGELOG) plus per-prefix
templates (tokens/, composition/, workflows/) plus generic
fallback. Used by health-writer to populate health.gaps[*].
suggested_action.
```

---

## Task 5: JSON Schemas

**Files:**
- Create: `schema/manifest.schema.json`
- Create: `schema/health.schema.json`
- Modify: `schema/brand/README.md`

- [ ] **Step 1: Write manifest.schema.json**

Create `schema/manifest.schema.json`:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://github.com/adamforrester/brand-skills/schemas/manifest.schema.json",
  "title": "brand-skills manifest",
  "description": "Facts emitted by /brand-context:extract about the .brand/ package state.",
  "type": "object",
  "required": ["version", "generated_at", "generator", "tier", "files", "stages", "mcps"],
  "additionalProperties": false,
  "properties": {
    "_comment": { "type": "string" },
    "version": { "const": "1" },
    "generated_at": { "type": "string", "format": "date-time" },
    "generator": { "type": "string", "pattern": "^(brand-cli|brand-extract-skill)@" },
    "tier": { "enum": ["minimum", "standard", "comprehensive"] },
    "client": { "type": "string" },
    "files": {
      "type": "object",
      "additionalProperties": {
        "type": "object",
        "required": ["status"],
        "additionalProperties": false,
        "properties": {
          "status": { "$ref": "#/$defs/status" },
          "bytes": { "type": "integer", "minimum": 0 },
          "note": { "type": "string", "maxLength": 120 }
        }
      }
    },
    "stages": {
      "type": "object",
      "additionalProperties": false,
      "patternProperties": {
        "^[1-8]_[a-z_]+$": {
          "type": "object",
          "required": ["ran"],
          "additionalProperties": false,
          "properties": {
            "ran": { "type": "boolean" },
            "wrote": { "type": "array", "items": { "type": "string" } },
            "reason": { "type": "string" },
            "confidence": { "$ref": "#/$defs/confidence" },
            "samples": { "type": "integer", "minimum": 0 },
            "active": { "type": "integer", "minimum": 0 },
            "sources": { "type": "array", "items": { "type": "string" } }
          }
        }
      }
    },
    "mcps": {
      "type": "object",
      "additionalProperties": {
        "type": "object",
        "required": ["available", "used"],
        "additionalProperties": false,
        "properties": {
          "available": { "type": "boolean" },
          "used": { "type": "array", "items": { "type": "string" } }
        }
      }
    }
  },
  "$defs": {
    "status": { "enum": ["complete", "partial", "placeholder", "missing", "defaults"] },
    "confidence": { "enum": ["HIGH", "MEDIUM", "LOW"] }
  }
}
```

- [ ] **Step 2: Write health.schema.json**

Create `schema/health.schema.json`:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://github.com/adamforrester/brand-skills/schemas/health.schema.json",
  "title": "brand-skills health verdict",
  "description": "Verdict emitted by /brand-context:check about brand-package readiness.",
  "type": "object",
  "required": [
    "version", "generated_at", "generator", "tier", "readiness", "tier_label",
    "manifest_seen", "weights", "weighted_complete", "weighted_total",
    "confidence", "files", "gaps", "downgrades"
  ],
  "additionalProperties": false,
  "properties": {
    "_comment": { "type": "string" },
    "version": { "const": "1" },
    "generated_at": { "type": "string", "format": "date-time" },
    "generator": { "type": "string", "pattern": "^(brand-cli|brand-check-skill)@" },
    "tier": { "enum": ["minimum", "standard", "comprehensive"] },
    "client": { "type": "string" },
    "readiness": { "type": "number", "minimum": 0, "maximum": 1 },
    "tier_label": { "enum": ["ready", "good", "partial", "incomplete"] },
    "manifest_seen": { "type": "boolean" },
    "manifest_generated_at": { "type": "string", "format": "date-time" },
    "weights": {
      "type": "object",
      "additionalProperties": { "type": "integer", "minimum": 0 }
    },
    "weighted_complete": { "type": "integer", "minimum": 0 },
    "weighted_total": { "type": "integer", "minimum": 0 },
    "confidence": { "enum": ["HIGH", "MEDIUM", "LOW"] },
    "files": {
      "type": "object",
      "additionalProperties": {
        "enum": ["complete", "partial", "placeholder", "missing", "defaults"]
      }
    },
    "gaps": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["file", "status", "suggested_action"],
        "additionalProperties": false,
        "properties": {
          "file": { "type": "string" },
          "status": { "enum": ["partial", "placeholder", "missing"] },
          "suggested_action": { "type": "string" }
        }
      }
    },
    "downgrades": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["file", "reason"],
        "additionalProperties": false,
        "properties": {
          "file": { "type": "string" },
          "reason": { "type": "string" }
        }
      }
    }
  }
}
```

- [ ] **Step 3: Cross-link from schema/brand/README.md**

Read the file first to get its current content:

```bash
cat schema/brand/README.md
```

Append at the end:

```markdown

## Related schemas

These two schemas validate machine-readable artifacts emitted by the toolkit (one level up, at `schema/`):

- [`../manifest.schema.json`](../manifest.schema.json) — `.brand/manifest.json`, emitted by `/brand-context:extract`
- [`../health.schema.json`](../health.schema.json) — `.brand/.health.json`, emitted by `/brand-context:check`

They live at `schema/` rather than `schema/brand/` because they describe toolkit-output JSON, not `.brand/*.md` source content.
```

- [ ] **Step 4: Commit**

```bash
git add schema/manifest.schema.json schema/health.schema.json schema/brand/README.md
git commit -F /tmp/commit-msg.txt
```

Message:
```
feat(schema): JSON Schemas for manifest.json + .health.json

JSON Schema 2020-12 contracts for the two new machine-readable
artifacts. additionalProperties: false at every level except
patternProperties on stages. Cross-linked from schema/brand/README.md.
```

---

## Task 6: Manifest writer

**Files:**
- Create: `cli/src/utils/manifest-writer.js`
- Test: `cli/test/unit/manifest-writer.test.js`

- [ ] **Step 1: Write the failing test**

Create `cli/test/unit/manifest-writer.test.js`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { writeManifest, validateManifest } from '../../src/utils/manifest-writer.js';

function validPayload() {
  return {
    version: '1',
    generated_at: '2026-06-10T14:23:11Z',
    generator: 'brand-cli@0.4.0',
    tier: 'minimum',
    client: 'acme',
    files: {
      'overview.md': { status: 'complete', bytes: 1000 },
    },
    stages: {
      '4_overview': { ran: true, wrote: ['overview.md'] },
    },
    mcps: {
      playwright: { available: false, used: [] },
    },
  };
}

test('validateManifest accepts a valid payload', () => {
  const result = validateManifest(validPayload());
  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, null);
});

test('validateManifest rejects missing required field', () => {
  const p = validPayload();
  delete p.tier;
  const result = validateManifest(p);
  assert.equal(result.valid, false);
  assert.match(result.errorText, /tier/);
});

test('validateManifest rejects invalid status enum', () => {
  const p = validPayload();
  p.files['overview.md'].status = 'unknown';
  const result = validateManifest(p);
  assert.equal(result.valid, false);
});

test('validateManifest rejects unknown root key', () => {
  const p = validPayload();
  p.bogus = true;
  const result = validateManifest(p);
  assert.equal(result.valid, false);
});

test('validateManifest accepts _comment at root', () => {
  const p = validPayload();
  p._comment = 'Generated; do not hand-edit.';
  const result = validateManifest(p);
  assert.equal(result.valid, true);
});

test('writeManifest writes valid JSON to disk and pretty-prints', () => {
  const dir = mkdtempSync(join(tmpdir(), 'brand-test-'));
  try {
    const path = join(dir, 'manifest.json');
    writeManifest(path, validPayload());
    const raw = readFileSync(path, 'utf-8');
    const parsed = JSON.parse(raw);
    assert.equal(parsed.version, '1');
    // 2-space indent
    assert.match(raw, /\n {2}"version"/);
    // trailing newline
    assert.equal(raw.endsWith('\n'), true);
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('writeManifest throws on invalid payload', () => {
  const dir = mkdtempSync(join(tmpdir(), 'brand-test-'));
  try {
    const path = join(dir, 'manifest.json');
    const p = validPayload();
    delete p.version;
    assert.throws(() => writeManifest(path, p), /failed schema validation/);
  } finally {
    rmSync(dir, { recursive: true });
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --test-name-pattern='validateManifest|writeManifest'`
Expected: FAIL with module-not-found.

- [ ] **Step 3: Implement manifest-writer.js**

Create `cli/src/utils/manifest-writer.js`:

```javascript
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const SCHEMA_PATH = resolve(__dirname, '../../../schema/manifest.schema.json');
const schema = JSON.parse(readFileSync(SCHEMA_PATH, 'utf-8'));

const ajv = new Ajv({ allErrors: true, strict: true });
addFormats(ajv);
const validate = ajv.compile(schema);

export function validateManifest(payload) {
  const valid = validate(payload);
  if (valid) return { valid: true, errors: null, errorText: null };
  return {
    valid: false,
    errors: validate.errors,
    errorText: ajv.errorsText(validate.errors),
  };
}

export function writeManifest(absPath, payload) {
  const result = validateManifest(payload);
  if (!result.valid) {
    throw new Error(`manifest.json failed schema validation: ${result.errorText}`);
  }
  writeFileSync(absPath, JSON.stringify(payload, null, 2) + '\n');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --test-name-pattern='validateManifest|writeManifest'`
Expected: PASS, 7 tests.

- [ ] **Step 5: Commit**

```bash
git add cli/src/utils/manifest-writer.js cli/test/unit/manifest-writer.test.js
git commit -F /tmp/commit-msg.txt
```

Message:
```
feat(cli): manifest-writer — schema-validated emission

Compile schema/manifest.schema.json with ajv at module load.
validateManifest returns structured result; writeManifest throws on
invalid payload. 7 unit tests cover the validation matrix and on-disk
shape (2-space indent, trailing newline).
```

---

## Task 7: Health writer

**Files:**
- Create: `cli/src/utils/health-writer.js`
- Test: `cli/test/unit/health-writer.test.js`

- [ ] **Step 1: Write the failing test**

Create `cli/test/unit/health-writer.test.js`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildHealth, writeHealth, validateHealth } from '../../src/utils/health-writer.js';

function makeManifest() {
  return {
    version: '1',
    generated_at: '2026-06-10T14:23:11Z',
    generator: 'brand-cli@0.4.0',
    tier: 'minimum',
    client: 'acme',
    files: {
      'overview.md': { status: 'complete', bytes: 4000 },
      'voice.md': { status: 'placeholder' },
      'tokens/colors.md': { status: 'complete' },
      'tokens/typography.md': { status: 'defaults', note: 'single-page sample' },
      'tokens/spacing.md': { status: 'missing' },
      'tokens/motion.md': { status: 'missing' },
      'tokens/surfaces.md': { status: 'complete' },
    },
    stages: { '2_web': { ran: true, wrote: [] } },
    mcps: { playwright: { available: true, used: ['2_web'] } },
  };
}

test('buildHealth from manifest computes readiness from weights', () => {
  const h = buildHealth({ manifest: makeManifest(), now: '2026-06-10T14:25:42Z' });
  // weights: overview=2, voice=2, colors=1, typography=1, spacing=1, motion=1, surfaces=1 = 9
  // complete-or-defaults: overview(2) + colors(1) + typography(1, defaults) + surfaces(1) = 5
  // 5 / 9 = 0.555... → 0.56
  assert.equal(h.readiness, 0.56);
  assert.equal(h.weighted_complete, 5);
  assert.equal(h.weighted_total, 9);
  assert.equal(h.tier_label, 'partial');
});

test('buildHealth marks manifest_seen true and echoes manifest timestamp', () => {
  const h = buildHealth({ manifest: makeManifest(), now: '2026-06-10T14:25:42Z' });
  assert.equal(h.manifest_seen, true);
  assert.equal(h.manifest_generated_at, '2026-06-10T14:23:11Z');
});

test('buildHealth confidence is MEDIUM when defaults present', () => {
  const h = buildHealth({ manifest: makeManifest(), now: '2026-06-10T14:25:42Z' });
  assert.equal(h.confidence, 'MEDIUM');
});

test('buildHealth populates downgrades for defaults files', () => {
  const h = buildHealth({ manifest: makeManifest(), now: '2026-06-10T14:25:42Z' });
  assert.deepEqual(h.downgrades, [
    { file: 'tokens/typography.md', reason: 'single-page sample' },
  ]);
});

test('buildHealth gaps lists every non-complete non-defaults file', () => {
  const h = buildHealth({ manifest: makeManifest(), now: '2026-06-10T14:25:42Z' });
  const files = h.gaps.map((g) => g.file).sort();
  assert.deepEqual(files, ['tokens/motion.md', 'tokens/spacing.md', 'voice.md']);
  for (const g of h.gaps) {
    assert.match(g.suggested_action, /\S/); // non-empty
  }
});

test('buildHealth without manifest scans content; manifest_seen false; downgrades empty', () => {
  const dir = mkdtempSync(join(tmpdir(), 'brand-test-'));
  try {
    const h = buildHealth({
      manifest: null,
      brandDir: dir,
      tier: 'minimum',
      client: 'acme',
      now: '2026-06-10T14:25:42Z',
    });
    assert.equal(h.manifest_seen, false);
    assert.equal(h.downgrades.length, 0);
    // All files missing → readiness 0
    assert.equal(h.readiness, 0);
    assert.equal(h.tier_label, 'incomplete');
    // confidence cap: scanCompleteRatio = 0/9 = 0 → LOW
    assert.equal(h.confidence, 'LOW');
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('writeHealth writes valid JSON', () => {
  const dir = mkdtempSync(join(tmpdir(), 'brand-test-'));
  try {
    const path = join(dir, '.health.json');
    const h = buildHealth({ manifest: makeManifest(), now: '2026-06-10T14:25:42Z' });
    writeHealth(path, h);
    const parsed = JSON.parse(readFileSync(path, 'utf-8'));
    assert.equal(parsed.version, '1');
    assert.equal(parsed.readiness, 0.56);
  } finally {
    rmSync(dir, { recursive: true });
  }
});

test('validateHealth rejects readiness > 1', () => {
  const h = buildHealth({ manifest: makeManifest(), now: '2026-06-10T14:25:42Z' });
  h.readiness = 1.5;
  const r = validateHealth(h);
  assert.equal(r.valid, false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --test-name-pattern='buildHealth|writeHealth|validateHealth'`
Expected: FAIL with module-not-found.

- [ ] **Step 3: Implement health-writer.js**

Create `cli/src/utils/health-writer.js`:

```javascript
import { writeFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, join } from 'node:path';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { weightsForTier, readiness as computeReadiness, tierLabel, confidence as computeConfidence } from './tier-weights.js';
import { classifyFile } from './file-status.js';
import { suggestedAction } from './gap-actions.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const SCHEMA_PATH = resolve(__dirname, '../../../schema/health.schema.json');
const schema = JSON.parse(readFileSync(SCHEMA_PATH, 'utf-8'));

const ajv = new Ajv({ allErrors: true, strict: true });
addFormats(ajv);
const validate = ajv.compile(schema);

const GENERATOR_PREFIX = 'brand-cli';
let cachedVersion = null;
function generatorString() {
  if (cachedVersion) return cachedVersion;
  const pkgPath = resolve(__dirname, '../../../package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
  cachedVersion = `${GENERATOR_PREFIX}@${pkg.version}`;
  return cachedVersion;
}

export function buildHealth({ manifest, brandDir, tier, client, now }) {
  const generated_at = now ?? new Date().toISOString();

  let resolvedTier;
  let resolvedClient;
  let files;
  let downgrades = [];
  let manifest_seen = false;
  let manifest_generated_at;

  if (manifest) {
    resolvedTier = manifest.tier;
    resolvedClient = manifest.client;
    files = Object.fromEntries(
      Object.entries(manifest.files).map(([p, entry]) => [p, entry.status])
    );
    downgrades = Object.entries(manifest.files)
      .filter(([, entry]) => entry.status === 'defaults')
      .map(([file, entry]) => ({ file, reason: entry.note ?? 'producer-marked defaults' }));
    manifest_seen = true;
    manifest_generated_at = manifest.generated_at;
  } else {
    if (!brandDir || !tier) {
      throw new Error('buildHealth requires either {manifest} or {brandDir, tier}');
    }
    resolvedTier = tier;
    resolvedClient = client;
    const weights = weightsForTier(tier);
    files = {};
    for (const path of Object.keys(weights)) {
      files[path] = classifyFile(join(brandDir, path));
    }
  }

  const weights = weightsForTier(resolvedTier);
  const r = computeReadiness(files, weights);
  const weightedComplete = Object.entries(weights).reduce((sum, [path, w]) => {
    return sum + (files[path] === 'complete' || files[path] === 'defaults' ? w : 0);
  }, 0);
  const weightedTotal = Object.values(weights).reduce((a, b) => a + b, 0);

  const hasDefaults = downgrades.length > 0;
  const completeCount = Object.entries(weights).filter(([p]) => files[p] === 'complete' || files[p] === 'defaults').length;
  const totalCount = Object.keys(weights).length;
  const scanCompleteRatio = totalCount === 0 ? 0 : completeCount / totalCount;
  const conf = computeConfidence({ manifestSeen: manifest_seen, hasDefaults, scanCompleteRatio });

  const gaps = Object.entries(weights)
    .filter(([p]) => ['partial', 'placeholder', 'missing'].includes(files[p]))
    .map(([file]) => ({
      file,
      status: files[file],
      suggested_action: suggestedAction(file, files[file]),
    }));

  const out = {
    _comment: 'Generated by brand-cli score. Do not hand-edit.',
    version: '1',
    generated_at,
    generator: generatorString(),
    tier: resolvedTier,
    readiness: r,
    tier_label: tierLabel(r),
    manifest_seen,
    weights,
    weighted_complete: weightedComplete,
    weighted_total: weightedTotal,
    confidence: conf,
    files,
    gaps,
    downgrades,
  };

  if (resolvedClient) out.client = resolvedClient;
  if (manifest_generated_at) out.manifest_generated_at = manifest_generated_at;

  return out;
}

export function validateHealth(payload) {
  const valid = validate(payload);
  if (valid) return { valid: true, errors: null, errorText: null };
  return {
    valid: false,
    errors: validate.errors,
    errorText: ajv.errorsText(validate.errors),
  };
}

export function writeHealth(absPath, payload) {
  const result = validateHealth(payload);
  if (!result.valid) {
    throw new Error(`.health.json failed schema validation: ${result.errorText}`);
  }
  writeFileSync(absPath, JSON.stringify(payload, null, 2) + '\n');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --test-name-pattern='buildHealth|writeHealth|validateHealth'`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add cli/src/utils/health-writer.js cli/test/unit/health-writer.test.js
git commit -F /tmp/commit-msg.txt
```

Message:
```
feat(cli): health-writer — readiness verdict from manifest or scan

buildHealth({manifest}) consumes manifest verbatim. buildHealth({
brandDir, tier}) falls back to content scan when manifest absent.
validateHealth + writeHealth follow the manifest-writer pattern.
8 unit tests cover the formula, both code paths, and the
manifest_seen distinction.
```

---

## Task 8: emit-manifest CLI command

**Files:**
- Create: `cli/src/commands/emit-manifest.js`
- Modify: `cli/bin/brand-cli.js`

- [ ] **Step 1: Implement emit-manifest.js**

Create `cli/src/commands/emit-manifest.js`:

```javascript
import { existsSync, readdirSync, statSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import chalk from 'chalk';
import { parse as yamlParse } from 'yaml';
import { writeManifest, validateManifest } from '../utils/manifest-writer.js';
import { weightsForTier } from '../utils/tier-weights.js';
import { classifyFile } from '../utils/file-status.js';

function readStdin() {
  return new Promise((resolve, reject) => {
    let data = '';
    process.stdin.setEncoding('utf-8');
    process.stdin.on('data', (chunk) => { data += chunk; });
    process.stdin.on('end', () => resolve(data));
    process.stdin.on('error', reject);
  });
}

function readBrandrc(projectDir) {
  const path = join(projectDir, '.brandrc.yaml');
  if (!existsSync(path)) return {};
  try {
    return yamlParse(readFileSync(path, 'utf-8')) ?? {};
  } catch {
    return {};
  }
}

function generatorString(projectDir) {
  // Reuse the CLI's package version. fileURLToPath is not stable from a tmp cwd,
  // so resolve via the package this module ships in.
  const pkgPath = new URL('../../../package.json', import.meta.url);
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
  return `brand-cli@${pkg.version}`;
}

function listExistingComponentFiles(brandDir) {
  const dir = join(brandDir, 'components');
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.md') && f !== 'inventory.md')
    .map((f) => `components/${f}`);
}

function buildFilesMap({ brandDir, tier, stageOverrides }) {
  const weights = weightsForTier(tier);
  const files = {};

  for (const path of Object.keys(weights)) {
    const abs = join(brandDir, path);
    const status = classifyFile(abs);
    const entry = { status };
    if (status !== 'missing' && existsSync(abs)) {
      entry.bytes = statSync(abs).size;
    }
    files[path] = entry;
  }

  // Out-of-tier files that exist on disk: surface them.
  for (const path of Object.keys(stageOverrides ?? {})) {
    if (files[path]) continue; // already in-tier
    const abs = join(brandDir, path);
    if (!existsSync(abs)) continue;
    const status = classifyFile(abs);
    files[path] = { status, bytes: statSync(abs).size };
  }

  // Components (comprehensive only): surface each file.
  if (tier === 'comprehensive') {
    for (const path of listExistingComponentFiles(brandDir)) {
      const abs = join(brandDir, path);
      files[path] = { status: classifyFile(abs), bytes: statSync(abs).size };
    }
  }

  // Apply per-file overrides from stdin (status, note) — producer can mark
  // 'partial' or 'defaults' here.
  for (const [path, override] of Object.entries(stageOverrides ?? {})) {
    if (!files[path]) continue;
    if (override.status) files[path].status = override.status;
    if (override.note) files[path].note = override.note;
  }

  return files;
}

export async function emitManifestCommand(opts) {
  const projectDir = process.cwd();
  const brandDir = join(projectDir, '.brand');

  if (!existsSync(brandDir)) {
    console.error(chalk.red(`No .brand/ directory at ${projectDir}.`));
    process.exit(1);
  }

  const stdinRaw = await readStdin();
  let input = {};
  if (stdinRaw.trim()) {
    try {
      input = JSON.parse(stdinRaw);
    } catch (err) {
      console.error(chalk.red(`Failed to parse stdin as JSON: ${err.message}`));
      process.exit(1);
    }
  }

  const brandrc = readBrandrc(projectDir);
  const tier = input.tier ?? brandrc.tier ?? 'minimum';
  const client = input.client ?? brandrc.client ?? '';

  const files = buildFilesMap({
    brandDir,
    tier,
    stageOverrides: input.file_overrides,
  });

  const payload = {
    _comment: 'Generated by brand-cli. Do not hand-edit — overwritten on every /brand-context:extract run.',
    version: '1',
    generated_at: input.generated_at ?? new Date().toISOString(),
    generator: generatorString(projectDir),
    tier,
    files,
    stages: input.stages ?? {},
    mcps: input.mcps ?? {},
  };
  if (client) payload.client = client;

  const validation = validateManifest(payload);
  if (!validation.valid) {
    console.error(chalk.red(`Manifest validation failed: ${validation.errorText}`));
    process.exit(1);
  }

  if (opts.dryRun) {
    process.stdout.write(JSON.stringify(payload, null, 2) + '\n');
    return;
  }

  writeManifest(join(brandDir, 'manifest.json'), payload);
  if (opts.json) {
    console.log(JSON.stringify({ ok: true, path: '.brand/manifest.json' }));
  } else {
    console.log(chalk.green(`Wrote .brand/manifest.json (tier: ${tier})`));
  }
}
```

- [ ] **Step 2: Register the command**

Edit `cli/bin/brand-cli.js`. Add the import and command registration:

```javascript
import { emitManifestCommand } from '../src/commands/emit-manifest.js';
```

After the `score` command block, add:

```javascript
program
  .command('emit-manifest')
  .description('Emit .brand/manifest.json from .brand/ + stage data on stdin')
  .option('--dry-run', 'Print manifest to stdout instead of writing to disk')
  .option('--json', 'Output result as JSON')
  .action(emitManifestCommand);
```

- [ ] **Step 3: Smoke-test the command manually**

```bash
mkdir -p /tmp/emit-test/.brand && cd /tmp/emit-test && \
  node /Users/aforrester/Documents/brand-skills/cli/bin/brand-cli.js init --client smoketest --mode standard
echo '{"tier":"minimum","client":"smoketest","stages":{"4_overview":{"ran":false,"reason":"smoke test"}},"mcps":{}}' | \
  node /Users/aforrester/Documents/brand-skills/cli/bin/brand-cli.js emit-manifest --dry-run | head -40
```

Expected: prints valid JSON with `version: "1"`, `tier: "minimum"`, files block populated, `stages` includes the override, exits 0.

- [ ] **Step 4: Clean up smoke-test directory**

```bash
rm -rf /tmp/emit-test
```

- [ ] **Step 5: Commit**

```bash
git add cli/src/commands/emit-manifest.js cli/bin/brand-cli.js
git commit -F /tmp/commit-msg.txt
```

Message:
```
feat(cli): emit-manifest command — write .brand/manifest.json

Reads stage data + file overrides from stdin, walks .brand/, applies
shared file-status.classifyFile, validates, writes manifest.json (or
prints to stdout with --dry-run). Smoke-tested end-to-end.
```

---

## Task 9: Refactor score.js to use shared utils + emit health

**Files:**
- Modify: `cli/src/commands/score.js`

The existing `score.js` has its own `hasContent()` and tier file map. Switch it to use `file-status.js` and `tier-weights.js`, preserve all current console output, and add `.health.json` emission.

- [ ] **Step 1: Read score.js current state**

```bash
cat cli/src/commands/score.js
```

- [ ] **Step 2: Rewrite score.js**

Replace the entire file with:

```javascript
import chalk from 'chalk';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parse as yamlParse } from 'yaml';
import { weightsForTier } from '../utils/tier-weights.js';
import { classifyFile } from '../utils/file-status.js';
import { buildHealth, writeHealth } from '../utils/health-writer.js';

function readBrandrc(projectDir) {
  const path = join(projectDir, '.brandrc.yaml');
  if (!existsSync(path)) return {};
  try {
    return yamlParse(readFileSync(path, 'utf-8')) ?? {};
  } catch {
    return {};
  }
}

function readManifest(brandDir) {
  const path = join(brandDir, 'manifest.json');
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch {
    return null;
  }
}

const TIER_DISPLAY = {
  minimum: ['overview.md', 'voice.md', 'tokens/colors.md', 'tokens/typography.md', 'tokens/spacing.md', 'tokens/motion.md', 'tokens/surfaces.md'],
  standard: ['composition/page-types.md', 'composition/patterns.md', 'composition/anti-patterns.md', 'CHANGELOG.md', 'conflicts.md'],
  comprehensive: ['workflows/figma-to-code.md', 'workflows/code-standards.md', 'workflows/deploy.md', 'workflows/qa-checklist.md'],
};

function labelForFile(path) {
  const labels = {
    'overview.md': 'Brand overview',
    'voice.md': 'Voice & tone',
    'tokens/colors.md': 'Color tokens',
    'tokens/typography.md': 'Typography tokens',
    'tokens/spacing.md': 'Spacing tokens',
    'tokens/motion.md': 'Motion tokens',
    'tokens/surfaces.md': 'Surface tokens',
    'composition/page-types.md': 'Page types',
    'composition/patterns.md': 'Composition patterns',
    'composition/anti-patterns.md': 'Anti-patterns',
    'CHANGELOG.md': 'Changelog',
    'conflicts.md': 'Conflicts',
    'workflows/figma-to-code.md': 'Figma-to-code workflow',
    'workflows/code-standards.md': 'Code standards',
    'workflows/deploy.md': 'Deploy workflow',
    'workflows/qa-checklist.md': 'QA checklist',
  };
  return labels[path] ?? path;
}

export async function scoreCommand(opts) {
  const projectDir = process.cwd();
  const brandDir = join(projectDir, '.brand');

  if (!existsSync(brandDir)) {
    console.log('');
    console.log(chalk.red('  No .brand/ directory found in the current directory.'));
    console.log(chalk.dim(`  Run ${chalk.cyan('brand-cli init')} first.`));
    console.log('');
    if (opts.json) {
      console.log(JSON.stringify({ ok: false, error: 'no .brand/ directory' }));
    }
    return;
  }

  console.log('');
  console.log(chalk.bold('  brand-skills — Brand Package Score'));
  console.log('');

  const brandrc = readBrandrc(projectDir);
  const tier = brandrc.tier ?? 'standard';
  const client = brandrc.client ?? '';
  const manifest = readManifest(brandDir);

  // Console output: unchanged tier-by-tier listing, but driven by classifyFile.
  const results = { tier: 'none', completeness: 0, files: {}, gaps: [] };
  let totalFiles = 0;
  let populatedFiles = 0;

  for (const [tierName, paths] of Object.entries(TIER_DISPLAY)) {
    console.log(chalk.bold(`  ${tierName.charAt(0).toUpperCase() + tierName.slice(1)} tier`));

    for (const path of paths) {
      totalFiles++;
      const abs = join(brandDir, path);
      const status = manifest?.files?.[path]?.status ?? classifyFile(abs);

      if (status === 'complete' || status === 'defaults') {
        const tag = status === 'defaults' ? chalk.dim(' (defaults — low confidence)') : '';
        console.log(chalk.green(`    ✓ ${labelForFile(path)}${tag}`));
        populatedFiles++;
        results.files[path] = status;
      } else if (status === 'partial' || status === 'placeholder') {
        console.log(chalk.yellow(`    ◐ ${labelForFile(path)} ${chalk.dim(`(${status})`)}`));
        results.files[path] = status;
        results.gaps.push(path);
      } else {
        console.log(chalk.dim(`    ○ ${labelForFile(path)}`));
        results.files[path] = 'missing';
        results.gaps.push(path);
      }
    }

    if (tierName === 'standard') {
      const componentsDir = join(brandDir, 'components');
      if (existsSync(componentsDir)) {
        const components = readdirSync(componentsDir).filter((f) => f.endsWith('.md'));
        if (components.length > 0) {
          console.log(chalk.green(`    ✓ ${components.length} component files`));
        } else {
          console.log(chalk.yellow('    ◐ components/ (empty)'));
          results.gaps.push('components/*.md');
        }
      }
    }

    console.log('');
  }

  const minimumComplete = TIER_DISPLAY.minimum.every((p) => {
    const s = manifest?.files?.[p]?.status ?? classifyFile(join(brandDir, p));
    return s === 'complete' || s === 'defaults';
  });
  const standardComplete = minimumComplete && TIER_DISPLAY.standard.every((p) => {
    const s = manifest?.files?.[p]?.status ?? classifyFile(join(brandDir, p));
    return s === 'complete' || s === 'defaults';
  });
  const comprehensiveComplete = standardComplete && TIER_DISPLAY.comprehensive.every((p) => {
    const s = manifest?.files?.[p]?.status ?? classifyFile(join(brandDir, p));
    return s === 'complete' || s === 'defaults';
  });

  if (comprehensiveComplete) results.tier = 'comprehensive';
  else if (standardComplete) results.tier = 'standard';
  else if (minimumComplete) results.tier = 'minimum';
  else results.tier = 'incomplete';

  results.completeness = Math.round((populatedFiles / totalFiles) * 100);

  const tierColor = results.tier === 'incomplete' ? chalk.red : chalk.green;
  console.log(chalk.bold('  Summary'));
  console.log(`    Tier: ${tierColor(results.tier)}`);
  console.log(`    Completeness: ${results.completeness}% (${populatedFiles}/${totalFiles} files populated)`);
  if (results.gaps.length > 0) {
    console.log(`    Gaps: ${results.gaps.length} files need content`);
  }
  console.log('');

  // Always emit .health.json.
  const health = buildHealth({ manifest, brandDir, tier, client });
  writeHealth(join(brandDir, '.health.json'), health);

  if (opts.json) {
    console.log(JSON.stringify(results, null, 2));
  }
}
```

- [ ] **Step 3: Smoke-test against an existing fixture**

```bash
cd /tmp && rm -rf score-smoke && mkdir score-smoke && cd score-smoke && \
  node /Users/aforrester/Documents/brand-skills/cli/bin/brand-cli.js init --client smoke --mode standard
node /Users/aforrester/Documents/brand-skills/cli/bin/brand-cli.js score
ls -la .brand/.health.json
cat .brand/.health.json | head -20
```

Expected: console output unchanged (still shows tier-by-tier listing); `.brand/.health.json` exists; `readiness < 0.1`; `manifest_seen: false`.

- [ ] **Step 4: Clean up**

```bash
rm -rf /tmp/score-smoke
```

- [ ] **Step 5: Commit**

```bash
git add cli/src/commands/score.js
git commit -F /tmp/commit-msg.txt
```

Message:
```
feat(cli): score command emits .health.json + uses shared utils

Switches score.js to file-status.classifyFile + tier-weights so
status detection lives in one place. Console output preserved; the
yellow-circle line now distinguishes 'placeholder' vs 'partial'
(both still degrade the score the same way). Always writes
.brand/.health.json. Reads .brand/manifest.json when present;
falls back to content scan otherwise.
```

---

## Task 10: Test helpers

**Files:**
- Create: `cli/test/helpers/tmp-brand.js`
- Create: `cli/test/helpers/run-cli.js`

- [ ] **Step 1: Implement tmp-brand.js**

Create `cli/test/helpers/tmp-brand.js`:

```javascript
import { mkdtempSync, rmSync, cpSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const FIXTURE_DIR = resolve(__dirname, '../fixtures');

/**
 * Copy a fixture into a fresh tmpdir. Returns { dir, brandDir, cleanup }.
 * Pass the fixture name (e.g. 'populated', 'fresh-init', 'mixed').
 */
export function withFixture(fixtureName) {
  const dir = mkdtempSync(join(tmpdir(), `brand-test-${fixtureName}-`));
  const src = join(FIXTURE_DIR, fixtureName);
  cpSync(src, dir, { recursive: true });
  return {
    dir,
    brandDir: join(dir, '.brand'),
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  };
}

/**
 * Make a tmpdir with an empty .brand/ and a minimal .brandrc.yaml.
 * Used when a test wants to control file creation explicitly.
 */
export function emptyBrandDir({ tier = 'minimum', client = 'acme' } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'brand-test-empty-'));
  mkdirSync(join(dir, '.brand'), { recursive: true });
  writeFileSync(join(dir, '.brandrc.yaml'), `client: ${client}\ntier: ${tier}\nmode: ${tier}\nsources: {}\n`);
  return {
    dir,
    brandDir: join(dir, '.brand'),
    cleanup: () => rmSync(dir, { recursive: true, force: true }),
  };
}
```

- [ ] **Step 2: Implement run-cli.js**

Create `cli/test/helpers/run-cli.js`:

```javascript
import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const CLI_BIN = resolve(__dirname, '../../bin/brand-cli.js');

/**
 * Spawn `node brand-cli.js <args>` with optional cwd and stdin.
 * Returns { exitCode, stdout, stderr } when the process closes.
 */
export function runCli(args, { cwd, stdin } = {}) {
  return new Promise((resolveP, rejectP) => {
    const proc = spawn('node', [CLI_BIN, ...args], {
      cwd: cwd ?? process.cwd(),
      env: { ...process.env, NO_COLOR: '1' },
    });
    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d) => { stdout += d.toString(); });
    proc.stderr.on('data', (d) => { stderr += d.toString(); });
    proc.on('error', rejectP);
    proc.on('close', (exitCode) => resolveP({ exitCode, stdout, stderr }));
    if (stdin !== undefined) {
      proc.stdin.end(stdin);
    } else {
      proc.stdin.end();
    }
  });
}
```

- [ ] **Step 3: Commit**

```bash
git add cli/test/helpers/tmp-brand.js cli/test/helpers/run-cli.js
git commit -F /tmp/commit-msg.txt
```

Message:
```
test: add tmp-brand + run-cli helpers for integration tests

withFixture copies a committed fixture into a tmpdir; emptyBrandDir
scaffolds a minimal .brand/. runCli spawns the CLI with stdin and
captures stdout/stderr/exit. NO_COLOR set so assertions don't have
to strip ANSI codes.
```

---

## Task 11: Test fixtures

**Files:**
- Create: `cli/test/fixtures/populated/.brand/...`
- Create: `cli/test/fixtures/fresh-init/.brand/...`
- Create: `cli/test/fixtures/mixed/.brand/...`
- Create: `cli/test/fixtures/stage-data/full-pipeline.json`
- Create: `cli/test/fixtures/stage-data/partial-pipeline.json`
- Create: `cli/test/fixtures/stage-data/no-mcps.json`

These fixtures are reused across multiple integration tests. Build them once.

- [ ] **Step 1: Create fresh-init fixture**

This mirrors what `brand-cli init --mode standard` produces: every required file scaffolded with the placeholder marker. The fastest way to get a faithful copy is to actually run init into the fixture dir.

```bash
cd /Users/aforrester/Documents/brand-skills && \
  mkdir -p cli/test/fixtures/fresh-init && \
  cd cli/test/fixtures/fresh-init && \
  node ../../../bin/brand-cli.js init --client acme --mode standard --force
```

Expected: produces `.brand/`, `.brandrc.yaml`, `brand.md`, `design.md` in `cli/test/fixtures/fresh-init/`.

Verify nothing leaked outside the fixture dir:
```bash
git -C /Users/aforrester/Documents/brand-skills status --short
```
The only untracked entries should be under `cli/test/fixtures/fresh-init/`.

- [ ] **Step 2: Create populated fixture by editing fresh-init's content**

```bash
cp -r /Users/aforrester/Documents/brand-skills/cli/test/fixtures/fresh-init /Users/aforrester/Documents/brand-skills/cli/test/fixtures/populated
```

Edit each of these files to remove the placeholder marker and add real content. The body must be ≥50 chars after frontmatter/H1 stripping for `classifyFile` to return `complete`.

`cli/test/fixtures/populated/.brand/overview.md`:
```markdown
# Brand overview

Acme is a fictitious test brand used by brand-skills test fixtures. The brand exists only to exercise the manifest and health code paths in unit and integration tests.

## Personality
Direct, technical, intentionally generic.
```

`cli/test/fixtures/populated/.brand/voice.md`:
```markdown
# Voice

Acme writes in plain sentences. We avoid jargon. Sentence-case CTAs.

## Observed Voice (live channels)
_Stub for tests; not extracted._
```

`cli/test/fixtures/populated/.brand/tokens/colors.md`:
```markdown
---
colors:
  primary: "#1A73E8"
  neutral: "#202124"
---

# Color tokens

Primary blue + neutral charcoal. Used in tests; not a real palette.
```

Repeat the same pattern for `tokens/typography.md`, `tokens/spacing.md`, `tokens/motion.md`, `tokens/surfaces.md` — each one needs uncommented frontmatter and ≥50 chars of body.

`cli/test/fixtures/populated/.brand/composition/page-types.md`:
```markdown
# Page types

Marketing pages, product pages, dashboards. Used in tests; brief by design.
```

Same for `composition/patterns.md`, `composition/anti-patterns.md`, `conflicts.md`, `CHANGELOG.md`.

- [ ] **Step 3: Verify populated fixture classifies correctly**

```bash
cd /Users/aforrester/Documents/brand-skills/cli/test/fixtures/populated && \
  node -e "import('../../../src/utils/file-status.js').then(m => { ['overview.md','voice.md','tokens/colors.md','tokens/typography.md','tokens/spacing.md','tokens/motion.md','tokens/surfaces.md','composition/page-types.md','composition/patterns.md','composition/anti-patterns.md','conflicts.md','CHANGELOG.md'].forEach(p => console.log(p, m.classifyFile('.brand/'+p))); });"
```

Expected: all paths print `complete`. If any prints `placeholder`, the body in that fixture file is too short — extend it.

- [ ] **Step 4: Create mixed fixture**

```bash
cp -r /Users/aforrester/Documents/brand-skills/cli/test/fixtures/populated /Users/aforrester/Documents/brand-skills/cli/test/fixtures/mixed
```

Then revert these specific files in `mixed/.brand/` to their `fresh-init/` counterparts so they have placeholder markers:

```bash
cd /Users/aforrester/Documents/brand-skills/cli/test/fixtures && \
  cp fresh-init/.brand/tokens/motion.md mixed/.brand/tokens/motion.md && \
  cp fresh-init/.brand/composition/page-types.md mixed/.brand/composition/page-types.md
```

And delete one to make it `missing`:
```bash
rm /Users/aforrester/Documents/brand-skills/cli/test/fixtures/mixed/.brand/composition/anti-patterns.md
```

- [ ] **Step 5: Create stage-data JSON fixtures**

`cli/test/fixtures/stage-data/full-pipeline.json`:
```json
{
  "tier": "standard",
  "client": "acme",
  "stages": {
    "1_figma":     { "ran": false, "reason": "skipped: sources.figma unset" },
    "2_web":       { "ran": true,  "wrote": ["tokens/colors.md","tokens/typography.md","tokens/spacing.md","tokens/surfaces.md"], "confidence": "MEDIUM" },
    "3_voice":     { "ran": true,  "wrote": ["voice.md"], "samples": 14, "confidence": "MEDIUM" },
    "4_overview":  { "ran": true,  "wrote": ["overview.md"], "sources": ["pdf:brand-guide.pdf"] },
    "5_conflicts": { "ran": true,  "wrote": ["conflicts.md"], "active": 0 },
    "6_components":{ "ran": false, "reason": "skipped: tier != comprehensive" },
    "8_brand_md":  { "ran": true,  "wrote": ["../brand.md","../design.md"] }
  },
  "mcps": {
    "playwright":    { "available": true,  "used": ["2_web","3_voice"] },
    "figma_console": { "available": false, "used": [] }
  }
}
```

`cli/test/fixtures/stage-data/partial-pipeline.json`:
```json
{
  "tier": "minimum",
  "client": "acme",
  "stages": {
    "2_web":   { "ran": true,  "wrote": ["tokens/colors.md"], "confidence": "LOW" },
    "3_voice": { "ran": true,  "wrote": ["voice.md"], "samples": 6, "confidence": "LOW" },
    "4_overview": { "ran": false, "reason": "skipped: no PDF, no screenshots, no Stage 2 captures" }
  },
  "mcps": {
    "playwright": { "available": true, "used": ["2_web","3_voice"] }
  },
  "file_overrides": {
    "voice.md":           { "status": "defaults", "note": "<10 samples; LOW confidence" },
    "tokens/colors.md":   { "status": "defaults", "note": "single-page sample" }
  }
}
```

`cli/test/fixtures/stage-data/no-mcps.json`:
```json
{
  "tier": "minimum",
  "client": "acme",
  "stages": {
    "1_figma":   { "ran": false, "reason": "skipped: figma-console MCP unavailable" },
    "2_web":     { "ran": false, "reason": "skipped: playwright MCP unavailable" },
    "3_voice":   { "ran": true,  "wrote": ["voice.md"], "samples": 8, "confidence": "LOW" },
    "4_overview":{ "ran": true,  "wrote": ["overview.md"], "sources": ["pdf:brand-guide.pdf"] },
    "8_brand_md":{ "ran": true,  "wrote": ["../brand.md","../design.md"] }
  },
  "mcps": {
    "playwright":    { "available": false, "used": [] },
    "figma_console": { "available": false, "used": [] }
  }
}
```

- [ ] **Step 6: Commit fixtures**

```bash
git add cli/test/fixtures/
git commit -F /tmp/commit-msg.txt
```

Message:
```
test: fixtures for manifest + health integration tests

Three .brand/ fixtures (populated/fresh-init/mixed) and three
stdin payloads (full-pipeline/partial-pipeline/no-mcps).
populated has substantive content in every required file;
fresh-init mirrors brand-cli init output; mixed combines
complete/placeholder/missing.
```

---

## Task 12: Integration test — emit-manifest end-to-end

**Files:**
- Create: `cli/test/integration/emit-manifest.test.js`
- Create: `cli/test/golden/manifest-from-populated.json`

- [ ] **Step 1: Write the failing test**

Create `cli/test/integration/emit-manifest.test.js`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { withFixture } from '../helpers/tmp-brand.js';
import { runCli } from '../helpers/run-cli.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const FIXTURES = resolve(__dirname, '../fixtures');
const GOLDEN = resolve(__dirname, '../golden');

test('emit-manifest writes a schema-valid manifest from populated fixture', async () => {
  const { dir, brandDir, cleanup } = withFixture('populated');
  try {
    const stdin = readFileSync(join(FIXTURES, 'stage-data/full-pipeline.json'), 'utf-8');
    const result = await runCli(['emit-manifest'], { cwd: dir, stdin });
    assert.equal(result.exitCode, 0, `stderr: ${result.stderr}`);

    const manifestPath = join(brandDir, 'manifest.json');
    assert.equal(existsSync(manifestPath), true);

    const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
    assert.equal(manifest.version, '1');
    assert.equal(manifest.tier, 'standard');
    assert.equal(manifest.client, 'acme');
    assert.equal(manifest.stages['2_web'].ran, true);
    assert.equal(manifest.mcps.playwright.available, true);

    // Compare to golden, excluding generated_at + generator (volatile).
    const golden = JSON.parse(readFileSync(join(GOLDEN, 'manifest-from-populated.json'), 'utf-8'));
    delete manifest.generated_at;
    delete manifest.generator;
    delete golden.generated_at;
    delete golden.generator;
    assert.deepEqual(manifest, golden);
  } finally {
    cleanup();
  }
});

test('emit-manifest --dry-run prints to stdout instead of writing', async () => {
  const { dir, brandDir, cleanup } = withFixture('populated');
  try {
    const stdin = readFileSync(join(FIXTURES, 'stage-data/full-pipeline.json'), 'utf-8');
    const result = await runCli(['emit-manifest', '--dry-run'], { cwd: dir, stdin });
    assert.equal(result.exitCode, 0);
    assert.equal(existsSync(join(brandDir, 'manifest.json')), false);
    const parsed = JSON.parse(result.stdout);
    assert.equal(parsed.version, '1');
  } finally {
    cleanup();
  }
});

test('emit-manifest applies file_overrides to mark defaults', async () => {
  const { dir, brandDir, cleanup } = withFixture('populated');
  try {
    const stdin = readFileSync(join(FIXTURES, 'stage-data/partial-pipeline.json'), 'utf-8');
    const result = await runCli(['emit-manifest'], { cwd: dir, stdin });
    assert.equal(result.exitCode, 0);
    const manifest = JSON.parse(readFileSync(join(brandDir, 'manifest.json'), 'utf-8'));
    assert.equal(manifest.files['voice.md'].status, 'defaults');
    assert.equal(manifest.files['voice.md'].note, '<10 samples; LOW confidence');
    assert.equal(manifest.files['tokens/colors.md'].status, 'defaults');
  } finally {
    cleanup();
  }
});

test('emit-manifest fails when .brand/ is absent', async () => {
  const { dir, brandDir, cleanup } = withFixture('populated');
  try {
    // Remove .brand/
    const { rmSync } = await import('node:fs');
    rmSync(brandDir, { recursive: true });
    const result = await runCli(['emit-manifest'], { cwd: dir, stdin: '{}' });
    assert.notEqual(result.exitCode, 0);
    assert.match(result.stderr, /No .brand\/ directory/);
  } finally {
    cleanup();
  }
});
```

- [ ] **Step 2: Generate the golden file from the test**

The golden file is the canonical expected output. To produce it, run emit-manifest once against the fixture and capture the result, then commit. This is intentional one-time bootstrapping — after this, the golden file pins the contract.

```bash
cd /Users/aforrester/Documents/brand-skills && \
  TMP=$(mktemp -d) && cp -r cli/test/fixtures/populated/* "$TMP/" && \
  cat cli/test/fixtures/stage-data/full-pipeline.json | \
    (cd "$TMP" && node /Users/aforrester/Documents/brand-skills/cli/bin/brand-cli.js emit-manifest --dry-run) | \
    > cli/test/golden/manifest-from-populated.json
rm -rf "$TMP"
```

Open the golden file and verify it looks reasonable (correct tier, files block populated, stages echoed). Commit as-is.

- [ ] **Step 3: Run the integration test**

Run: `npm test -- --test-name-pattern='emit-manifest'`
Expected: PASS, 4 tests.

- [ ] **Step 4: Commit**

```bash
git add cli/test/integration/emit-manifest.test.js cli/test/golden/manifest-from-populated.json
git commit -F /tmp/commit-msg.txt
```

Message:
```
test: integration coverage for emit-manifest

End-to-end via runCli helper. Asserts schema-valid output, --dry-run
behavior, file_overrides applying defaults markers, error path when
.brand/ absent. Golden fixture committed as the canonical expected
output for the populated fixture + full-pipeline stage data.
```

---

## Task 13: Integration test — score emits health

**Files:**
- Create: `cli/test/integration/score-emits-health.test.js`
- Create: `cli/test/golden/health-from-populated.json`

- [ ] **Step 1: Write the failing test**

Create `cli/test/integration/score-emits-health.test.js`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { withFixture } from '../helpers/tmp-brand.js';
import { runCli } from '../helpers/run-cli.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const GOLDEN = resolve(__dirname, '../golden');

test('score writes .health.json from populated fixture', async () => {
  const { dir, brandDir, cleanup } = withFixture('populated');
  try {
    const result = await runCli(['score'], { cwd: dir });
    assert.equal(result.exitCode, 0);
    const healthPath = join(brandDir, '.health.json');
    assert.equal(existsSync(healthPath), true);
    const health = JSON.parse(readFileSync(healthPath, 'utf-8'));
    assert.equal(health.version, '1');
    assert.equal(health.manifest_seen, false); // no manifest in this fixture
    assert.equal(health.tier, 'standard');
  } finally {
    cleanup();
  }
});

test('score against populated fixture matches golden health', async () => {
  const { dir, brandDir, cleanup } = withFixture('populated');
  try {
    await runCli(['score'], { cwd: dir });
    const health = JSON.parse(readFileSync(join(brandDir, '.health.json'), 'utf-8'));
    const golden = JSON.parse(readFileSync(join(GOLDEN, 'health-from-populated.json'), 'utf-8'));
    delete health.generated_at;
    delete health.generator;
    delete golden.generated_at;
    delete golden.generator;
    assert.deepEqual(health, golden);
  } finally {
    cleanup();
  }
});

test('score still exits 0 and prints summary on incomplete .brand/', async () => {
  const { dir, brandDir, cleanup } = withFixture('fresh-init');
  try {
    const result = await runCli(['score'], { cwd: dir });
    assert.equal(result.exitCode, 0);
    assert.match(result.stdout, /Summary/);
    assert.match(result.stdout, /incomplete/);
    const health = JSON.parse(readFileSync(join(brandDir, '.health.json'), 'utf-8'));
    assert(health.readiness < 0.1, `expected readiness < 0.1, got ${health.readiness}`);
    assert.equal(health.tier_label, 'incomplete');
  } finally {
    cleanup();
  }
});
```

- [ ] **Step 2: Generate the golden health file**

```bash
cd /Users/aforrester/Documents/brand-skills && \
  TMP=$(mktemp -d) && cp -r cli/test/fixtures/populated/* "$TMP/" && \
  (cd "$TMP" && node /Users/aforrester/Documents/brand-skills/cli/bin/brand-cli.js score >/dev/null) && \
  cp "$TMP/.brand/.health.json" cli/test/golden/health-from-populated.json && \
  rm -rf "$TMP"
```

Open the golden and verify it looks right (readiness ≈ 1.0 since populated has all required content, `manifest_seen: false`, `confidence: MEDIUM`).

- [ ] **Step 3: Run the integration test**

Run: `npm test -- --test-name-pattern='score'`
Expected: PASS, 3 tests.

- [ ] **Step 4: Commit**

```bash
git add cli/test/integration/score-emits-health.test.js cli/test/golden/health-from-populated.json
git commit -F /tmp/commit-msg.txt
```

Message:
```
test: integration coverage for score → .health.json

Asserts .health.json emitted, golden-match against populated
fixture, fresh-init produces readiness < 0.1.
```

---

## Task 14: Integration test — round-trip and content-scan fallback

**Files:**
- Create: `cli/test/integration/round-trip.test.js`
- Create: `cli/test/integration/score-without-manifest.test.js`

- [ ] **Step 1: Write the round-trip test**

Create `cli/test/integration/round-trip.test.js`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { withFixture } from '../helpers/tmp-brand.js';
import { runCli } from '../helpers/run-cli.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const FIXTURES = resolve(__dirname, '../fixtures');

test('round-trip: emit-manifest then score uses manifest as input', async () => {
  const { dir, brandDir, cleanup } = withFixture('populated');
  try {
    const stdin = readFileSync(join(FIXTURES, 'stage-data/full-pipeline.json'), 'utf-8');
    const emit = await runCli(['emit-manifest'], { cwd: dir, stdin });
    assert.equal(emit.exitCode, 0);

    const score = await runCli(['score'], { cwd: dir });
    assert.equal(score.exitCode, 0);

    const manifest = JSON.parse(readFileSync(join(brandDir, 'manifest.json'), 'utf-8'));
    const health = JSON.parse(readFileSync(join(brandDir, '.health.json'), 'utf-8'));

    assert.equal(health.manifest_seen, true);
    assert.equal(health.manifest_generated_at, manifest.generated_at);
    // Populated fixture has all content; full-pipeline overrides nothing → all complete.
    assert.equal(health.confidence, 'HIGH');
    assert.equal(health.downgrades.length, 0);
  } finally {
    cleanup();
  }
});

test('round-trip with defaults: confidence drops to MEDIUM, downgrades populated', async () => {
  const { dir, brandDir, cleanup } = withFixture('populated');
  try {
    const stdin = readFileSync(join(FIXTURES, 'stage-data/partial-pipeline.json'), 'utf-8');
    await runCli(['emit-manifest'], { cwd: dir, stdin });
    await runCli(['score'], { cwd: dir });

    const health = JSON.parse(readFileSync(join(brandDir, '.health.json'), 'utf-8'));
    assert.equal(health.manifest_seen, true);
    assert.equal(health.confidence, 'MEDIUM');
    assert.equal(health.downgrades.length, 2);
    const files = health.downgrades.map((d) => d.file).sort();
    assert.deepEqual(files, ['tokens/colors.md', 'voice.md']);
  } finally {
    cleanup();
  }
});
```

- [ ] **Step 2: Write the no-manifest fallback test**

Create `cli/test/integration/score-without-manifest.test.js`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { withFixture } from '../helpers/tmp-brand.js';
import { runCli } from '../helpers/run-cli.js';

test('score without manifest: manifest_seen false, no defaults marked', async () => {
  const { dir, brandDir, cleanup } = withFixture('mixed');
  try {
    assert.equal(existsSync(join(brandDir, 'manifest.json')), false);
    await runCli(['score'], { cwd: dir });
    const health = JSON.parse(readFileSync(join(brandDir, '.health.json'), 'utf-8'));
    assert.equal(health.manifest_seen, false);
    assert.equal(health.downgrades.length, 0);
    // No file should be 'partial' or 'defaults' from a content-scan-only run.
    for (const status of Object.values(health.files)) {
      assert(['complete', 'placeholder', 'missing'].includes(status), `unexpected status: ${status}`);
    }
  } finally {
    cleanup();
  }
});

test('score without manifest: confidence capped at MEDIUM', async () => {
  const { dir, brandDir, cleanup } = withFixture('populated');
  try {
    await runCli(['score'], { cwd: dir });
    const health = JSON.parse(readFileSync(join(brandDir, '.health.json'), 'utf-8'));
    // Populated fixture is fully complete by content scan, so scanCompleteRatio = 1.0
    // confidence should be MEDIUM (manifest_seen: false caps it)
    assert.equal(health.manifest_seen, false);
    assert.equal(health.confidence, 'MEDIUM');
  } finally {
    cleanup();
  }
});
```

- [ ] **Step 3: Run all integration tests**

Run: `npm test`
Expected: all unit + integration tests pass.

- [ ] **Step 4: Commit**

```bash
git add cli/test/integration/round-trip.test.js cli/test/integration/score-without-manifest.test.js
git commit -F /tmp/commit-msg.txt
```

Message:
```
test: round-trip + content-scan fallback integration coverage

round-trip asserts manifest+health coupling rules (manifest_seen,
manifest_generated_at echo, confidence with vs. without defaults).
score-without-manifest asserts the content-scan path: no partial/
defaults statuses, confidence capped at MEDIUM.
```

---

## Task 15: SKILL fallback reference golden + fresh-init test

**Files:**
- Create: `cli/test/golden/manifest-from-skill.json`
- Create: `cli/test/integration/fresh-init.test.js`

- [ ] **Step 1: Write fresh-init integration test**

Create `cli/test/integration/fresh-init.test.js`:

```javascript
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
```

- [ ] **Step 2: Generate the SKILL fallback reference**

This is the shape the SKILL is expected to produce when constructing the manifest inline (no CLI). It's identical to the CLI output except `generator: brand-extract-skill@<plugin-version>`. Easiest way: copy the existing populated golden and rename the generator.

```bash
cd /Users/aforrester/Documents/brand-skills && \
  cat cli/test/golden/manifest-from-populated.json | \
    sed 's|"brand-cli@[^"]*"|"brand-extract-skill@0.4.0"|' \
    > cli/test/golden/manifest-from-skill.json
```

Verify the result is still valid against the schema (the `generator` regex accepts both prefixes):

```bash
node -e "
import('./cli/src/utils/manifest-writer.js').then(m => {
  const p = JSON.parse(require('fs').readFileSync('cli/test/golden/manifest-from-skill.json','utf-8'));
  const r = m.validateManifest(p);
  console.log(r.valid ? 'OK' : r.errorText);
});
"
```

Expected: prints `OK`.

- [ ] **Step 3: Run all tests**

Run: `npm test`
Expected: all pass. Total test count should be approximately 35+ (11 tier-weights + 6 file-status + 7 manifest-writer + 8 health-writer + 4 emit-manifest + 3 score-emits-health + 2 round-trip + 2 score-without-manifest + 1 fresh-init).

- [ ] **Step 4: Commit**

```bash
git add cli/test/golden/manifest-from-skill.json cli/test/integration/fresh-init.test.js
git commit -F /tmp/commit-msg.txt
```

Message:
```
test: fresh-init integration + SKILL-fallback reference golden

fresh-init asserts brand-cli init → score round-trip produces
readiness < 0.1. manifest-from-skill.json committed as reference
shape; not actively executed (SKILL prose can't be unit-tested
without an extraction harness — future work).
```

---

## Task 16: SKILL updates

**Files:**
- Modify: `brand-context/skills/brand-extract/SKILL.md`
- Modify: `brand-context/skills/brand-check/SKILL.md`

- [ ] **Step 1: Add manifest emission to brand-extract Section 11**

Read the current Section 11:
```bash
grep -n "## 11. Final summary" brand-context/skills/brand-extract/SKILL.md
```

Insert this new subsection before "## 11. Final summary":

```markdown
## 10b. Emit `.brand/manifest.json`

After Stages 1–8 complete and before the final summary, emit a machine-readable manifest of what just ran. Hosts gate on it; humans don't read it.

**CLI path:**

Build the stage payload from what just ran. Pass via stdin:

\`\`\`bash
cat <<'JSON' | brand-cli emit-manifest
{
  "tier": "{tier}",
  "client": "{client}",
  "stages": {
    "1_figma":     {"ran": <bool>, "wrote": [<paths>], "reason": "<if skipped>"},
    "2_web":       {"ran": <bool>, "wrote": [<paths>], "confidence": "<HIGH|MEDIUM|LOW>"},
    "3_voice":     {"ran": <bool>, "wrote": ["voice.md"], "samples": <n>, "confidence": "<...>"},
    "4_overview":  {"ran": <bool>, "wrote": ["overview.md"], "sources": [<sources>]},
    "5_conflicts": {"ran": <bool>, "wrote": ["conflicts.md"], "active": <n>},
    "6_components":{"ran": <bool>, "wrote": [<paths>], "reason": "<if skipped>"},
    "8_brand_md":  {"ran": true, "wrote": ["../brand.md","../design.md"]}
  },
  "mcps": {
    "playwright":    {"available": <bool>, "used": [<stage_keys>]},
    "figma_console": {"available": <bool>, "used": [<stage_keys>]}
  },
  "file_overrides": {
    "<path>": {"status": "defaults", "note": "<reason>"}
  }
}
JSON
\`\`\`

Use `file_overrides` to mark any file `defaults` (low-confidence inferred content) or `partial` (sections missing). Without overrides, the CLI scans `.brand/` and reports `complete` / `placeholder` / `missing` from content alone.

**Inline fallback (CLI absent):**

Construct the same JSON in memory using `Read` to inspect each `.brand/` file (apply the same content-scan logic — placeholder marker, frontmatter inspection, body length), fold in stage-execution data accumulated through the run, and `Write` to `.brand/manifest.json`. Use `generator: brand-extract-skill@<plugin-version>`. The reference shape is at `cli/test/golden/manifest-from-skill.json` in the brand-skills repo.

```

Insert at the end of "## Phase 8 scope reminder", in the "Implemented (complete pipeline):" list:

```markdown
- Manifest emission (Section 10b) — every extract run now writes `.brand/manifest.json`
```

- [ ] **Step 2: Update brand-check SKILL Step 1**

Read the current Step 1:
```bash
grep -n "## Step 1" brand-context/skills/brand-check/SKILL.md
```

Replace the existing Step 1 with this updated version that mentions `.health.json`:

```markdown
## Step 1 — Get the score

Try the deterministic CLI first:

\`\`\`bash
brand-cli score --json
\`\`\`

`brand-cli score` always also writes `.brand/.health.json` — a machine-readable verdict (readiness, tier_label, gaps, downgrades) for hosts that gate on the package programmatically. Humans read the console output; hosts read the JSON.

If `brand-cli` is not installed, score manually:

1. Read `.brandrc.yaml` for `tier` and `mode`.
2. List required files for the tier (see `schema/brand/` or the table below).
3. For each file, classify:
   - **Missing** — file doesn't exist
   - **Placeholder** — file exists but only contains the `<!-- Fill this file following the schema… -->` marker
   - **Partial** — file has content but obvious gaps (frontmatter empty, multiple TODO markers, or sections missing)
   - **Complete** — schema sections populated with real content
4. Compute overall completeness as % of files that are at least Partial, weighted by required-vs-optional.
5. **Also write `.brand/.health.json`** with the per-file statuses, readiness score, and gaps. The schema is at `schema/health.schema.json` in the brand-skills repo. If `manifest.json` is also present, read it for `defaults`/`partial` statuses (a content scan can't detect those); otherwise the inline fallback only emits `complete` / `placeholder` / `missing`.
```

- [ ] **Step 3: Run tests**

Run: `npm test`
Expected: all still pass — SKILL changes don't affect the test harness.

- [ ] **Step 4: Commit**

```bash
git add brand-context/skills/brand-extract/SKILL.md brand-context/skills/brand-check/SKILL.md
git commit -F /tmp/commit-msg.txt
```

Message:
```
docs(skill): brand-extract emits manifest.json; brand-check writes .health.json

brand-extract Section 10b covers CLI shell-out + inline fallback for
manifest.json emission. brand-check Step 1 mentions .health.json as
an always-written sidecar; CLI-absent path documented for the SKILL
fallback.
```

---

## Task 17: Repo docs (CLAUDE.md, README.md, tasks.md)

**Files:**
- Modify: `CLAUDE.md`
- Modify: `README.md`
- Modify: `docs/tasks.md`

- [ ] **Step 1: Add file-write policy rows to CLAUDE.md**

In `CLAUDE.md`'s "File-write policies" table (the one with `tokens/{...}.md`, `voice.md`, etc.), add two rows after `audits/*.md`:

```markdown
| `manifest.json` | **Overwrite wholesale every run** | Generated artifact; source of truth is `.brand/*.md`. Same as `design.md`/`brand.md`. Emitted by `/brand-context:extract` end-of-pipeline. |
| `.health.json` | **Overwrite wholesale every run** | Verdict cache emitted by `/brand-context:check` (and `brand-cli score`). Reproducible from manifest + tier weights. |
```

- [ ] **Step 2: Update CLAUDE.md architecture diagram**

In the architecture block:

```
schema/brand/*.schema.md      ← source of truth for .brand/ file shapes
schema/{manifest,health}.schema.json ← machine-validation contracts (NEW)
       ↓
brand-context/skills/*/SKILL.md   ← AI agent instructions (what to write)
       ↓
cli/src/                      ← deterministic regen (init, refresh-design, refresh-context, score, emit-manifest)
```

Update the "score" line in the diagram to read `score, emit-manifest` (matches what's in the CLI bin).

- [ ] **Step 3: Update README "How the pipeline works"**

Read the current section:
```bash
grep -n "How the pipeline works" README.md
```

In the table (or list) of pipeline outputs, add:
```
- `.brand/manifest.json` — machine-readable record of what extract just did (per-file status, per-stage outcome, MCP availability). Hosts gate on it.
- `.brand/.health.json` — readiness verdict written every time `brand-cli score` (or `/brand-context:check`) runs.
```

- [ ] **Step 4: Update docs/tasks.md**

Move #2 and #6 from "Active backlog → Unblocked" to "Completed":

```markdown
### #2 — Emit `.brand/manifest.json` from `/brand-context:extract` ✅
**Output:** `.brand/manifest.json` per `schema/manifest.schema.json`. Per-file statuses + per-stage outcomes + MCP availability. Emitted at end of Stage 8.

### #6 — Emit `.brand/.health.json` from `/brand-context:check` ✅
**Output:** `.brand/.health.json` per `schema/health.schema.json`. Tier-weighted readiness, gaps, downgrades. Emitted by every `brand-cli score` run.
```

In the "Blocked" section, mark #3 as no longer blocked:

```markdown
### #3 — Explicit MCP-fallback contract per stage in `brand-extract`
Per stage, declare which MCPs are required vs recommended; on absence emit HALT / DOWNGRADE / SKIP. Decisions land in `manifest.json`. Source: feedback item #2.
**Status:** Unblocked — manifest schema accommodates `stages[*].reason` and `mcps[*].used`. Implementation can begin.
```

Update the "Last updated" line at the top.

- [ ] **Step 5: Run tests one more time**

Run: `npm test`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add CLAUDE.md README.md docs/tasks.md
git commit -F /tmp/commit-msg.txt
```

Message:
```
docs: CLAUDE.md + README + tasks reflect manifest + health

File-write policy rows added. Architecture diagram includes
schema/{manifest,health}.schema.json and emit-manifest CLI command.
README pipeline section lists both new artifacts. tasks.md moves
#2 + #6 to Completed; marks #3 unblocked.
```

---

## Task 18: Final verification

- [ ] **Step 1: Run the full test suite**

```bash
cd /Users/aforrester/Documents/brand-skills && npm test
```

Expected: every test passes. Note the total count — should be ≥35.

- [ ] **Step 2: Smoke-test the full extract → check loop manually**

```bash
TMP=$(mktemp -d) && cd "$TMP" && \
  node /Users/aforrester/Documents/brand-skills/cli/bin/brand-cli.js init --client smoketest --mode standard --force && \
  echo '{"tier":"standard","stages":{"4_overview":{"ran":true,"wrote":["overview.md"]}},"mcps":{}}' | \
    node /Users/aforrester/Documents/brand-skills/cli/bin/brand-cli.js emit-manifest && \
  node /Users/aforrester/Documents/brand-skills/cli/bin/brand-cli.js score && \
  echo "--- manifest.json ---" && head -30 .brand/manifest.json && \
  echo "--- .health.json ---" && head -30 .brand/.health.json
cd / && rm -rf "$TMP"
```

Expected:
- init succeeds
- emit-manifest writes `.brand/manifest.json` with `tier: standard`
- score writes `.brand/.health.json` with `manifest_seen: true`
- Both files are valid JSON with expected shape

- [ ] **Step 3: Confirm no untracked or modified files remain**

```bash
git status
```

Expected: working tree clean.

- [ ] **Step 4: Confirm spec is fully covered**

Open `docs/superpowers/specs/2026-06-10-manifest-and-health-design.md` and skim each section. Every requirement should map to a task above. If anything is uncovered, file a follow-up task.

---

## Self-review notes

This plan covers spec sections 1–9. Test harness is wired in Task 1; integration golden fixtures pin the contracts; SKILL/CLI/docs propagation in Tasks 16–17. The two type-consistency risks I checked:

- Status enum (`complete | partial | placeholder | missing | defaults`) — used identically across `tier-weights.js` (filtered set), `manifest-writer.js` (schema enum), `health-writer.js` (schema enum), and integration tests. No drift.
- `confidence` enum (`HIGH | MEDIUM | LOW`) — same. Schema, util, tests all agree.

One spec requirement I almost missed and added back: spec Section 4 says `init.js` does NOT scaffold either file. Task 1 doesn't touch `init.js`; Task 11's fresh-init fixture is generated by the existing `init` (which doesn't scaffold them); Task 18 verifies this implicitly. No explicit init.js change needed — the spec's "init does not scaffold" is the absence of a change rather than a positive deliverable.
