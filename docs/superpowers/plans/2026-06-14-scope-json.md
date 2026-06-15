# `.brand/.scope.json` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an optional `.brand/.scope.json` file that `/brand-context:extract` reads at the start of Stage 0, merges into `.brandrc.yaml` (brandrc wins on conflict), and deletes after a successful Stage 0 completion. Closes the embedded-mode end-to-end path that started with `interactive_preflight: false` in the just-merged contract branch.

**Architecture:** Three-layer change. **Schema layer** adds `schema/brand/scope.schema.json`. **CLI layer** adds two utilities (`scope-loader`, `scope-merge`) plus a small lint subcommand (`brand-cli scope --validate`). **SKILL layer** inserts a new `§0a.5` section that reads/merges/deletes the scope file and threads a `filledFromScope` set through Stage 0c-0e to skip questions for pre-filled fields. Tests, fixtures, and docs cascade.

**Tech Stack:** Node.js ≥22, ESM (`"type": "module"`), `ajv@^8.20` (`ajv/dist/2020.js` for draft 2020-12), `ajv-formats`, `chalk`, `commander`, `node:test`, `yaml` (already a dep — used by emit-manifest for brandrc parsing).

---

## Source-of-truth references

- **Spec:** [`docs/superpowers/specs/2026-06-14-scope-json-design.md`](../specs/2026-06-14-scope-json-design.md) — read end to end before starting any task
- **Precedent (D-letter pattern + footguns):** [`docs/superpowers/plans/2026-06-13-mcp-fallback-contract-progress.md`](2026-06-13-mcp-fallback-contract-progress.md) — D1-D5 + recurring footguns

## Things to know that aren't obvious from the codebase

These have bitten every prior branch. Hoisted from the contract branch progress doc:

- **`ajv/dist/2020.js`, not `ajv`.** Draft 2020-12 schemas need the dist entry point. `import Ajv from 'ajv/dist/2020.js'` (ESM) — never plain `'ajv'`.
- **`ajv` is constructed with `{ allErrors: true, strict: true }`** to match `manifest-writer.js` / `health-writer.js` / `contract-loader.js`. `addFormats(ajv)` is called even when the schema doesn't use formats — precedent parity (see [D2] in the contract branch progress doc).
- **Per-task tempfiles for commit messages.** `/tmp/commit-msg.txt` is shared across tasks; the Write tool errors with "file modified since read" if multiple tasks edit it. Use `/tmp/commit-msg-task<N>.txt` per task. (See [CF-2] in contract branch progress doc.)
- **Apostrophes break heredoc commit messages.** Use Write tool → tempfile → `git commit -F`. Never heredoc with apostrophes.
- **`package-lock.json` is gitignored.** Don't `git add` it.
- **Don't bump the package version.** Don't touch `~/Documents/xd-toolkit`. Durable rules from `CLAUDE.md`.
- **Plan-pasted `node -e` snippets that mix `await import()` with `require()` are broken** under `"type":"module"`. Default to `node --input-type=module -e "..."` with named ESM imports.
- **Plan-pasted bash pipelines have shipped with typos.** Glance at any multi-line bash before pasting; verify the command before relying on it.
- **Long-running implementer agents can die mid-flight on token expiration.** If file edits are on disk but the agent didn't commit, run smoke-tests + commit yourself rather than re-dispatching. See [D3] in contract branch progress doc.
- **`engines.node >= 22.0.0`.** `node --test` glob support landed at Node 21; floor is at LTS 22.
- **Per-task two-stage review** (spec compliance, then code quality). Contract branch ran 5 of 16 tasks (31%) needing refinement — budget for it.
- **When the plan's pasted code contradicts the plan's pasted tests, the test is the contract.** Patch the code; surface as `DONE_WITH_CONCERNS`. See [D5] in contract branch progress doc.

## Cross-task contracts to preserve

These must stay in sync across **schema**, **scope-loader**, **scope-merge**, **CLI command**, **fixtures**, **SKILL prose**, and **repo docs**:

- **`filledFromScope` set shape** — `Set<string>` of dot-paths (`"client"`, `"sources.website"`, `"sources.social.twitter"`). Used by Stage 0c-0e to skip questions for pre-filled fields. Tested by `scope-merge.test.js`. SKILL prose references the dot-path convention.
- **"Empty" definition (per field type)** — defined in spec §1. The merge utility must implement this exact rule for strings (missing/`""`/null), arrays (missing/`[]`/null), objects (missing/`{}`/null, recurse leaf-by-leaf), booleans (missing only — `false` counts as set).
- **Embedded-mode required fields** — `client`, `tier`, AND at least one of `sources.{website, figma, brand_guide, screenshots, design_system_repo}`. `sources.social` and `sources.app_store` alone do NOT satisfy this. Referenced by both the SKILL's bail logic and any future `brand-cli scope --validate` runtime-mode check (out of scope for this branch — schema is permissive; runtime check lives in SKILL prose only).
- **Delete-after-merge invariant** — `.brand/.scope.json` is deleted only after Stage 0e successfully writes `.brandrc.yaml`. Failure modes don't delete (failure matrix in spec §6). Tested via SKILL parity prose; documented in CLAUDE.md file-write policies.
- **File location** — `.brand/.scope.json` (NOT project-root `.scope.json`). Single source: spec §3 `## File location`.

## File structure

### New files

| Path | Responsibility |
|---|---|
| `schema/brand/scope.schema.json` | JSON Schema 2020-12 validating `.scope.json` payloads (permissive at schema level; runtime requirements enforced by SKILL prose) |
| `cli/src/utils/scope-loader.js` | `loadScope(brandDir)` returns parsed scope or null; `validateScope(payload)` returns `{ valid, errorText }`; lazy schema compile cached for process lifetime |
| `cli/src/utils/scope-merge.js` | `mergeScopeIntoBrandrc(scope, brandrc)` returns `{ merged, filledFromScope, conflicts }`; pure function; no I/O |
| `cli/src/commands/scope.js` | `brand-cli scope --validate [--json]` |
| `cli/test/unit/scope-loader.test.js` | 6 tests: present/absent, malformed/valid, schema-rejection, additionalProperties enforcement |
| `cli/test/unit/scope-merge.test.js` | 5 tests: empty-fill, conflict-keeps-brandrc, partial pre-fill, leaf-by-leaf nesting, returned set |
| `cli/test/integration/scope-cli.test.js` | 3 tests for `brand-cli scope --validate` |
| `cli/test/integration/scope-fixtures-roundtrip.test.js` | 2 tests: full + invalid scope fixtures through the CLI |
| `cli/test/unit/skill-scope-parity.test.js` | 3 tests: SKILL prose mentions `.brand/.scope.json`, the merge precedence rule, and embedded-mode bail behavior |
| `cli/test/fixtures/scope/full.scope.json` | Every field populated |
| `cli/test/fixtures/scope/partial.scope.json` | `client`, `tier`, `sources.website` only |
| `cli/test/fixtures/scope/invalid.scope.json` | Has an unknown top-level field |

### Modified files

| Path | Reason |
|---|---|
| `cli/bin/brand-cli.js` | Register `scope` subcommand |
| `schema/brand/README.md` | Cross-link new scope schema |
| `brand-context/skills/brand-extract/SKILL.md` | New `§0a.5` section; modify `§0c`/`§0d`/`§0e` to honor `filledFromScope` |
| `CLAUDE.md` | File-write policies + arch diagram |
| `README.md` | Note `.scope.json` as optional embedded-mode pre-fill |
| `docs/DESIGN.md` | Multi-tenant section: end-to-end embedded path documented |
| `docs/tasks.md` | Mark #4 complete, #5 unblocked |

---

## Per-task dispatch protocol

Same as the contract branch (precedent doc). Per task:

1. **Open this plan**, copy the full task text inline (don't make subagents read the plan file).
2. **Dispatch implementer** (`general-purpose` subagent). Include: full task text; branch name `feat/scope-json`; pointer to this plan + spec + precedent progress doc; the "Things to know" footguns above; relevant D-letters from precedent.
3. **Spec compliance review** (`general-purpose` subagent). Read the actual code; don't trust the implementer's report.
4. **Code quality review** (`superpowers:code-reviewer` subagent). Pass `BASE_SHA` (commit before this task) and `HEAD_SHA`.
5. **If reviewer flags Critical or Important:** dispatch a refinement subagent. **If Minor only:** accept and proceed (per [D7] from manifest+health branch).
6. **Update progress doc** (`docs/superpowers/plans/2026-06-14-scope-json-progress.md`) with commit SHA(s), test delta, decisions.
7. **Mark task done** in the session task list.

---

## Task 1: Test harness sync + branch baseline

**Goal:** Confirm 85/85 tests pass on `feat/scope-json`, branch is one commit ahead of main (the spec), commit a progress doc shell.

**Files:**
- Create: `docs/superpowers/plans/2026-06-14-scope-json-progress.md`

- [ ] **Step 1: Verify branch state**

```bash
git rev-parse --abbrev-ref HEAD  # expect: feat/scope-json
git log --oneline main..HEAD     # expect: 1 commit (the spec)
git status                       # expect: clean
```

- [ ] **Step 2: Run the existing test suite**

```bash
npm test 2>&1 | tail -10
```

Expected: `# pass 85` / `# fail 0`.

- [ ] **Step 3: Create the progress doc shell**

Write to `docs/superpowers/plans/2026-06-14-scope-json-progress.md`:

```markdown
# `.brand/.scope.json` — Implementation Progress

Companion to [`2026-06-14-scope-json.md`](2026-06-14-scope-json.md). Tracks each task's commits, test delta, and decisions made during implementation.

**Status:** in progress on branch `feat/scope-json`.
**Branch base:** `main` at commit `c595a08` (post-merge cleanup for #3).
**Spec:** [`../specs/2026-06-14-scope-json-design.md`](../specs/2026-06-14-scope-json-design.md)
**Precedent (D-letter pattern reference):** [`2026-06-13-mcp-fallback-contract-progress.md`](2026-06-13-mcp-fallback-contract-progress.md)

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

All 11 tasks pending. See plan.

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
docs: implementation plan + progress doc shell for #4

Plan derived from spec at docs/superpowers/specs/2026-06-14-scope-json-design.md.
11 tasks. Same per-task dispatch protocol as the manifest+health and
contract branches (precedents in 2026-06-10-manifest-and-health-progress.md
and 2026-06-13-mcp-fallback-contract-progress.md).
```

```bash
git add docs/superpowers/plans/2026-06-14-scope-json.md \
        docs/superpowers/plans/2026-06-14-scope-json-progress.md
git commit -F /tmp/commit-msg-task1.txt
```

- [ ] **Step 5: Verify**

```bash
git log --oneline main..HEAD  # expect: 2 commits (spec + this plan/progress doc)
npm test 2>&1 | tail -5       # expect: 85 pass, 0 fail
```

---

## Task 2: Add `schema/brand/scope.schema.json`

**Goal:** JSON Schema 2020-12 validating `.scope.json` payloads. Permissive at schema level (no required fields); the SKILL enforces runtime requirements separately.

**Files:**
- Create: `schema/brand/scope.schema.json`
- Test: deferred to Task 3 (`scope-loader.test.js` exercises this schema)

- [ ] **Step 1: Write the schema**

Create `schema/brand/scope.schema.json`:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://github.com/adamforrester/brand-skills/schemas/scope.schema.json",
  "title": "brand-skills .brand/.scope.json",
  "description": "Optional pre-fill for .brandrc.yaml. Read once at SKILL §0a.5; merged into brandrc; deleted after successful Stage 0 completion. Spec: docs/superpowers/specs/2026-06-14-scope-json-design.md.",
  "type": "object",
  "additionalProperties": false,
  "properties": {
    "_comment": { "type": "string" },
    "client": { "type": "string", "minLength": 1 },
    "tier": { "enum": ["minimum", "standard", "comprehensive"] },
    "mode": { "enum": ["pitch", "standard", "comprehensive"] },
    "sources": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "website": { "type": "string", "minLength": 1 },
        "website_pages": {
          "type": "array",
          "items": { "type": "string", "minLength": 1 }
        },
        "figma": {
          "type": "array",
          "items": { "type": "string", "minLength": 1 }
        },
        "figma_variable_collections": {
          "type": "array",
          "items": { "type": "string", "minLength": 1 }
        },
        "brand_guide": { "type": "string", "minLength": 1 },
        "screenshots": {
          "type": "array",
          "items": { "type": "string", "minLength": 1 }
        },
        "social": {
          "type": "object",
          "additionalProperties": false,
          "properties": {
            "twitter": { "type": "string", "minLength": 1 },
            "instagram": { "type": "string", "minLength": 1 },
            "linkedin": { "type": "string", "minLength": 1 },
            "facebook": { "type": "string", "minLength": 1 },
            "tiktok": { "type": "string", "minLength": 1 }
          }
        },
        "app_store": {
          "type": "object",
          "additionalProperties": false,
          "properties": {
            "ios": { "type": "string", "minLength": 1 },
            "android": { "type": "string", "minLength": 1 }
          }
        },
        "design_system_repo": { "type": "string", "minLength": 1 }
      }
    },
    "interactive_preflight": { "type": "boolean" }
  }
}
```

- [ ] **Step 2: Sanity-validate the schema compiles under ajv**

```bash
node --input-type=module -e "
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { readFileSync } from 'node:fs';
const schema = JSON.parse(readFileSync('schema/brand/scope.schema.json', 'utf-8'));
const ajv = new Ajv({ allErrors: true, strict: true });
addFormats(ajv);
ajv.compile(schema);
console.log('OK');
"
```

Expected: prints `OK`. Any error means a strict-mode issue (likely if-then unsupported types). The schema above uses no conditionals so should be clean.

- [ ] **Step 3: Sanity-validate accept/reject behavior on representative payloads**

```bash
node --input-type=module -e "
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { readFileSync } from 'node:fs';
const schema = JSON.parse(readFileSync('schema/brand/scope.schema.json', 'utf-8'));
const ajv = new Ajv({ allErrors: true, strict: true });
addFormats(ajv);
const v = ajv.compile(schema);
console.log('empty {}:', v({}));                                    // expect true
console.log('full:', v({ client: 'A', tier: 'standard', mode: 'standard', sources: { website: 'https://x.y' }, interactive_preflight: false }));  // expect true
console.log('bad tier:', v({ tier: 'wrong' }), ajv.errorsText(v.errors)); // expect false + tier message
console.log('extra root:', v({ unknownTopLevel: 'foo' }), ajv.errorsText(v.errors)); // expect false + additionalProperties
"
```

Expected: `empty {}: true`, `full: true`, `bad tier: false ...`, `extra root: false ...`.

- [ ] **Step 4: Run the existing test suite (sanity)**

```bash
npm test 2>&1 | tail -5
```

Expected: still 85/85 — schema-only addition.

- [ ] **Step 5: Commit**

Write to `/tmp/commit-msg-task2.txt`:

```
feat(schema): add scope.schema.json (JSON Schema 2020-12)

Validates .brand/.scope.json payloads. Permissive at schema level (no
required fields) — runtime requirements (client, tier, at least one
pipeline-runnable source) enforced by SKILL prose in embedded mode.
Mirrors .brandrc.yaml shape plus interactive_preflight. Spec §2.
```

```bash
git add schema/brand/scope.schema.json
git commit -F /tmp/commit-msg-task2.txt
```

---

## Task 3: `cli/src/utils/scope-loader.js` (TDD)

**Goal:** Single-import utility that loads `.brand/.scope.json` (returning parsed scope or null) and validates a payload against the schema. Lazy schema compile cached for process lifetime.

**Files:**
- Create: `cli/src/utils/scope-loader.js`
- Test: `cli/test/unit/scope-loader.test.js`

- [ ] **Step 1: Write the failing test**

Create `cli/test/unit/scope-loader.test.js`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadScope, validateScope } from '../../src/utils/scope-loader.js';

function tmpBrandDir(scopeContent) {
  const dir = mkdtempSync(join(tmpdir(), 'scope-loader-'));
  const brandDir = join(dir, '.brand');
  mkdirSync(brandDir, { recursive: true });
  if (scopeContent !== undefined) {
    writeFileSync(join(brandDir, '.scope.json'), scopeContent);
  }
  return { brandDir, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

test('loadScope returns null when .brand/.scope.json is absent', () => {
  const { brandDir, cleanup } = tmpBrandDir();
  try {
    assert.equal(loadScope(brandDir), null);
  } finally { cleanup(); }
});

test('loadScope returns parsed object when .scope.json is present and valid JSON', () => {
  const { brandDir, cleanup } = tmpBrandDir(JSON.stringify({ client: 'ACME', tier: 'standard' }));
  try {
    const s = loadScope(brandDir);
    assert.equal(s.client, 'ACME');
    assert.equal(s.tier, 'standard');
  } finally { cleanup(); }
});

test('loadScope throws with file path on malformed JSON', () => {
  const { brandDir, cleanup } = tmpBrandDir('{ "client": "ACME", '); // truncated
  try {
    assert.throws(
      () => loadScope(brandDir),
      (err) => /scope\.json/.test(err.message) && /not valid JSON/.test(err.message)
    );
  } finally { cleanup(); }
});

test('validateScope accepts an empty object', () => {
  const r = validateScope({});
  assert.equal(r.valid, true);
});

test('validateScope rejects bad tier value with ajv error text', () => {
  const r = validateScope({ tier: 'wrong' });
  assert.equal(r.valid, false);
  assert.match(r.errorText, /tier/);
});

test('validateScope rejects unknown top-level field (additionalProperties: false)', () => {
  const r = validateScope({ unknownTopLevel: 'foo' });
  assert.equal(r.valid, false);
  assert.match(r.errorText, /additional|unknownTopLevel/);
});
```

- [ ] **Step 2: Run test to confirm it fails (no module yet)**

```bash
node --test cli/test/unit/scope-loader.test.js 2>&1 | tail -10
```

Expected: `ERR_MODULE_NOT_FOUND` for `scope-loader.js`.

- [ ] **Step 3: Implement scope-loader.js**

Create `cli/src/utils/scope-loader.js`:

```javascript
/**
 * Loads .brand/.scope.json and validates payloads against the scope schema.
 * Schema is compiled lazily on first validateScope() call and cached for the
 * process lifetime. loadScope() returns null when the file is absent;
 * throws with the file path on malformed JSON.
 * Spec: docs/superpowers/specs/2026-06-14-scope-json-design.md §2.
 */

import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve, join } from 'node:path';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const SCHEMA_PATH = resolve(__dirname, '../../../schema/brand/scope.schema.json');

let cachedValidator = null;

function getValidator() {
  if (cachedValidator) return cachedValidator;
  const schema = JSON.parse(readFileSync(SCHEMA_PATH, 'utf-8'));
  const ajv = new Ajv({ allErrors: true, strict: true });
  addFormats(ajv);
  cachedValidator = ajv.compile(schema);
  cachedValidator.errorsTextFn = (errs) => ajv.errorsText(errs);
  return cachedValidator;
}

/**
 * Read .brand/.scope.json from the given brand directory.
 * Returns the parsed object if present, null if absent.
 * Throws Error with file-context message on malformed JSON.
 */
export function loadScope(brandDir) {
  const path = join(brandDir, '.scope.json');
  if (!existsSync(path)) return null;
  const raw = readFileSync(path, 'utf-8');
  try {
    return JSON.parse(raw);
  } catch (err) {
    throw new Error(`.brand/.scope.json at ${path} is not valid JSON: ${err.message}`);
  }
}

/**
 * Validate a parsed scope payload against the schema.
 * Returns { valid: boolean, errorText?: string }.
 * Does not read from disk; pass an already-parsed object.
 */
export function validateScope(payload) {
  const validate = getValidator();
  const ok = validate(payload);
  if (ok) return { valid: true };
  return { valid: false, errorText: validate.errorsTextFn(validate.errors) };
}
```

- [ ] **Step 4: Run test to confirm it passes**

```bash
node --test cli/test/unit/scope-loader.test.js 2>&1 | tail -10
```

Expected: 6 tests pass.

- [ ] **Step 5: Run full suite**

```bash
npm test 2>&1 | tail -5
```

Expected: 91 pass (85 + 6), 0 fail.

- [ ] **Step 6: Commit**

Write to `/tmp/commit-msg-task3.txt`:

```
feat(cli): add scope-loader utility (TDD)

loadScope(brandDir) reads .brand/.scope.json: returns parsed object,
null if absent, throws with file path on malformed JSON. validateScope(payload)
runs ajv against the schema and returns { valid, errorText }. Schema
compiled lazily + cached for process lifetime.

Mirrors contract-loader pattern with addFormats for precedent parity (D2).
Spec §2.
```

```bash
git add cli/src/utils/scope-loader.js cli/test/unit/scope-loader.test.js
git commit -F /tmp/commit-msg-task3.txt
```

---

## Task 4: `cli/src/utils/scope-merge.js` (TDD)

**Goal:** Pure function `mergeScopeIntoBrandrc(scope, brandrc)` returning `{ merged, filledFromScope, conflicts }`. Implements the "empty" rule per field type from spec §1. No I/O.

**Files:**
- Create: `cli/src/utils/scope-merge.js`
- Test: `cli/test/unit/scope-merge.test.js`

- [ ] **Step 1: Write the failing test**

Create `cli/test/unit/scope-merge.test.js`:

```javascript
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
```

- [ ] **Step 2: Run test to confirm it fails (no module yet)**

```bash
node --test cli/test/unit/scope-merge.test.js 2>&1 | tail -10
```

Expected: `ERR_MODULE_NOT_FOUND` for `scope-merge.js`.

- [ ] **Step 3: Implement scope-merge.js**

Create `cli/src/utils/scope-merge.js`:

```javascript
/**
 * Pure merge of a parsed scope payload into a parsed brandrc state.
 * brandrc wins on conflict (per spec §1). "Empty" definition matches spec §1
 * field-type table (string: missing/""/null; array: missing/[]/null;
 * object: missing/{}/null + recurse leaf-by-leaf; boolean: missing only).
 *
 * Returns { merged, filledFromScope: Set<dot-path>, conflicts: [{field, scope_value, brandrc_value}] }.
 *
 * No I/O. SKILL §0a.5 calls this; tests exercise it directly.
 * Spec: docs/superpowers/specs/2026-06-14-scope-json-design.md §3.
 */

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/**
 * Whether a brandrc value is considered "empty" for merge purposes.
 * Per-type rules from spec §1.
 */
function isEmpty(value) {
  if (value === undefined || value === null) return true;
  if (typeof value === 'string') return value === '';
  if (Array.isArray(value)) return value.length === 0;
  if (isPlainObject(value)) return Object.keys(value).length === 0;
  // Booleans and numbers count as set when present.
  return false;
}

function mergeAtPath(scopeVal, brandrcVal, pathPrefix, filledFromScope, conflicts) {
  // Object: recurse leaf-by-leaf. Even if brandrc has a non-empty object,
  // descend into it so leaf-level merges can happen.
  if (isPlainObject(scopeVal)) {
    const out = isPlainObject(brandrcVal) ? { ...brandrcVal } : {};
    for (const [k, sv] of Object.entries(scopeVal)) {
      if (k === '_comment') continue; // never merge into brandrc
      const childPath = pathPrefix ? `${pathPrefix}.${k}` : k;
      const bv = isPlainObject(brandrcVal) ? brandrcVal[k] : undefined;
      out[k] = mergeAtPath(sv, bv, childPath, filledFromScope, conflicts);
    }
    return out;
  }

  // Leaf: apply the "brandrc wins on conflict" rule.
  if (isEmpty(brandrcVal)) {
    filledFromScope.add(pathPrefix);
    return scopeVal;
  }
  // Brandrc has a set value. If scope provides a different value, log conflict.
  // Use JSON.stringify for deep-equal comparison on arrays/scalars.
  if (JSON.stringify(brandrcVal) !== JSON.stringify(scopeVal)) {
    conflicts.push({
      field: pathPrefix,
      scope_value: scopeVal,
      brandrc_value: brandrcVal,
    });
  }
  return brandrcVal;
}

/**
 * Merge a parsed scope payload into a parsed brandrc state.
 * Pure function; does not mutate inputs.
 */
export function mergeScopeIntoBrandrc(scope, brandrc) {
  const filledFromScope = new Set();
  const conflicts = [];
  const merged = mergeAtPath(scope, brandrc, '', filledFromScope, conflicts);
  return { merged, filledFromScope, conflicts };
}
```

- [ ] **Step 4: Run test to confirm it passes**

```bash
node --test cli/test/unit/scope-merge.test.js 2>&1 | tail -10
```

Expected: 5 tests pass.

- [ ] **Step 5: Run full suite**

```bash
npm test 2>&1 | tail -5
```

Expected: 96 pass (91 + 5), 0 fail.

- [ ] **Step 6: Commit**

Write to `/tmp/commit-msg-task4.txt`:

```
feat(cli): scope-merge utility (TDD)

mergeScopeIntoBrandrc(scope, brandrc) returns { merged, filledFromScope,
conflicts }. Pure function; no I/O. Implements the "empty" definition
per field type from spec §1: string (missing/""/null), array
(missing/[]/null), object (missing/{}/null + recurse leaf-by-leaf),
boolean (missing only — false counts as set). brandrc wins on conflict;
each conflict surfaces as { field, scope_value, brandrc_value }.
filledFromScope is a Set of dot-paths used by SKILL §0c-0e to skip
conversational questions for pre-filled fields.

Spec §3.
```

```bash
git add cli/src/utils/scope-merge.js cli/test/unit/scope-merge.test.js
git commit -F /tmp/commit-msg-task4.txt
```

---

## Task 5: Scope fixtures + `cli/src/commands/scope.js`

**Goal:** New `brand-cli scope --validate [--json]` subcommand. Reads `.brand/.scope.json` from the project's brand directory, validates against the schema via `scope-loader.validateScope()`, exits 0 on valid / 1 on invalid. `--json` flag emits structured output. Plus three fixture files used by Task 6.

**Files:**
- Create: `cli/src/commands/scope.js`
- Modify: `cli/bin/brand-cli.js` (register subcommand)
- Create: `cli/test/fixtures/scope/full.scope.json`
- Create: `cli/test/fixtures/scope/partial.scope.json`
- Create: `cli/test/fixtures/scope/invalid.scope.json`

- [ ] **Step 1: Write fixture `cli/test/fixtures/scope/full.scope.json`**

```json
{
  "_comment": "Full scope fixture used by scope-cli tests. Every field populated.",
  "client": "ACME Corp",
  "tier": "standard",
  "mode": "standard",
  "sources": {
    "website": "https://acme.example.com",
    "website_pages": ["/about", "/products"],
    "figma": ["abc123def456"],
    "figma_variable_collections": ["Primitives"],
    "brand_guide": "assets/brand-guide.pdf",
    "screenshots": ["assets/hero.png"],
    "social": {
      "twitter": "https://x.com/acmecorp"
    },
    "app_store": {
      "ios": "https://apps.apple.com/us/app/acme/id123"
    },
    "design_system_repo": "./packages/ds"
  },
  "interactive_preflight": false
}
```

- [ ] **Step 2: Write fixture `cli/test/fixtures/scope/partial.scope.json`**

```json
{
  "_comment": "Partial scope fixture: client + tier + sources.website only.",
  "client": "ACME Corp",
  "tier": "standard",
  "sources": {
    "website": "https://acme.example.com"
  }
}
```

- [ ] **Step 3: Write fixture `cli/test/fixtures/scope/invalid.scope.json`**

```json
{
  "_comment": "Invalid scope fixture: has unknown top-level field.",
  "client": "ACME Corp",
  "unknownTopLevel": "this should fail validation"
}
```

- [ ] **Step 4: Implement `cli/src/commands/scope.js`**

Create:

```javascript
/**
 * brand-cli scope --validate [--json]
 *
 * Reads .brand/.scope.json from the current working directory's .brand/
 * subdirectory and validates against schema/brand/scope.schema.json.
 *
 * Exits 0 on valid, 1 on invalid (or missing file). With --json, emits
 * structured stdout for embedded hosts.
 *
 * The command does not implement the merge — that lives in scope-merge.js
 * and is invoked by the SKILL at §0a.5.
 *
 * Spec: docs/superpowers/specs/2026-06-14-scope-json-design.md §4.
 */

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import chalk from 'chalk';
import { loadScope, validateScope } from '../utils/scope-loader.js';

const SCOPE_REL_PATH = '.brand/.scope.json';

export async function scopeCommand(opts) {
  if (!opts.validate) {
    console.error(chalk.red('brand-cli scope: --validate is required (no other actions yet).'));
    process.exit(1);
  }

  const projectDir = process.cwd();
  const brandDir = join(projectDir, '.brand');

  if (!existsSync(brandDir)) {
    if (opts.json) {
      console.log(JSON.stringify({ ok: false, error: 'no_brand_directory', path: SCOPE_REL_PATH }));
    } else {
      console.error(chalk.red(`No .brand/ directory at ${projectDir}.`));
    }
    process.exit(1);
  }

  let scope;
  try {
    scope = loadScope(brandDir);
  } catch (err) {
    if (opts.json) {
      console.log(JSON.stringify({ ok: false, error: 'malformed_json', path: SCOPE_REL_PATH, message: err.message }));
    } else {
      console.error(chalk.red(err.message));
    }
    process.exit(1);
  }

  if (scope === null) {
    if (opts.json) {
      console.log(JSON.stringify({ ok: false, error: 'no_scope_file', path: SCOPE_REL_PATH }));
    } else {
      console.error(chalk.red(`No ${SCOPE_REL_PATH} found at ${projectDir}.`));
    }
    process.exit(1);
  }

  const result = validateScope(scope);
  if (result.valid) {
    if (opts.json) {
      console.log(JSON.stringify({ ok: true, path: SCOPE_REL_PATH }));
    } else {
      console.log(chalk.green(`✓ ${SCOPE_REL_PATH} is valid`));
    }
    return;
  }

  if (opts.json) {
    console.log(JSON.stringify({ ok: false, error: 'schema_validation_failed', path: SCOPE_REL_PATH, errorText: result.errorText }));
  } else {
    console.error(chalk.red(`✗ ${SCOPE_REL_PATH} failed schema validation:`));
    console.error(`  ${result.errorText}`);
  }
  process.exit(1);
}
```

- [ ] **Step 5: Register subcommand in `cli/bin/brand-cli.js`**

Add the import alongside the other command imports (the existing block ends with `import { importTokensCommand } from '../src/commands/import-tokens.js';`):

```javascript
import { scopeCommand } from '../src/commands/scope.js';
```

Add a `program.command('scope')` block AFTER the `import-tokens` block (which is the last command before `program.parse()`):

```javascript
program
  .command('scope')
  .description('Validate .brand/.scope.json against the scope schema. Pre-flight check for embedded hosts before dispatching the SKILL.')
  .option('--validate', 'Validate the scope file (currently the only supported action)')
  .option('--json', 'Emit structured JSON output to stdout instead of human-readable text')
  .action(scopeCommand);
```

Use `Edit` with enough surrounding context to make the insertion unambiguous. Read the file first to confirm exact content.

- [ ] **Step 6: Smoke-test the new subcommand against fixtures**

```bash
mkdir -p /tmp/scope-smoke && cd /tmp/scope-smoke
mkdir -p .brand
cp /Users/aforrester/Documents/brand-skills/cli/test/fixtures/scope/full.scope.json .brand/.scope.json
node /Users/aforrester/Documents/brand-skills/cli/bin/brand-cli.js scope --validate
echo "exit: $?"

cp /Users/aforrester/Documents/brand-skills/cli/test/fixtures/scope/invalid.scope.json .brand/.scope.json
node /Users/aforrester/Documents/brand-skills/cli/bin/brand-cli.js scope --validate
echo "exit: $?"

rm .brand/.scope.json
node /Users/aforrester/Documents/brand-skills/cli/bin/brand-cli.js scope --validate --json
echo "exit: $?"

cd / && rm -rf /tmp/scope-smoke
```

Expected:
- First: `✓ .brand/.scope.json is valid`, exit 0.
- Second: `✗ .brand/.scope.json failed schema validation: ...`, exit 1.
- Third: `{"ok":false,"error":"no_scope_file",...}`, exit 1.

- [ ] **Step 7: Run full suite (sanity)**

```bash
npm test 2>&1 | tail -5
```

Expected: still 96 pass / 0 fail (no new tests yet — Task 6 adds them).

- [ ] **Step 8: Commit**

Write to `/tmp/commit-msg-task5.txt`:

```
feat(cli): brand-cli scope --validate subcommand + fixtures

Reads .brand/.scope.json from cwd, validates against scope schema via
scope-loader. Exits 0/1 with chalk-prose or --json structured output.
The merge lives in scope-merge.js (unchanged) — this command is purely
a lint surface for embedded hosts to run before dispatching the SKILL.

Three fixtures added: full / partial / invalid. Used by Task 6 tests.

Spec §4.
```

```bash
git add cli/src/commands/scope.js \
        cli/bin/brand-cli.js \
        cli/test/fixtures/scope/
git commit -F /tmp/commit-msg-task5.txt
```

---

## Task 6: Integration tests for `brand-cli scope --validate`

**Goal:** End-to-end tests exercising the new subcommand against the three fixtures. Confirms the CLI registration is correct and validation paths fire as expected.

**Files:**
- Create: `cli/test/integration/scope-cli.test.js`

- [ ] **Step 1: Write the test**

Create `cli/test/integration/scope-cli.test.js`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runCli } from '../helpers/run-cli.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const FIXTURES = resolve(__dirname, '../fixtures/scope');

function tmpProjectWithScope(fixtureName) {
  const dir = mkdtempSync(join(tmpdir(), 'scope-cli-'));
  const brandDir = join(dir, '.brand');
  mkdirSync(brandDir, { recursive: true });
  if (fixtureName) {
    copyFileSync(resolve(FIXTURES, fixtureName), join(brandDir, '.scope.json'));
  }
  return { dir, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

test('scope --validate exits 0 on a valid full scope', async () => {
  const { dir, cleanup } = tmpProjectWithScope('full.scope.json');
  try {
    const result = await runCli(['scope', '--validate'], { cwd: dir });
    assert.equal(result.exitCode, 0, `stderr: ${result.stderr}`);
    assert.match(result.stdout, /is valid/);
  } finally { cleanup(); }
});

test('scope --validate exits 0 on a valid partial scope', async () => {
  const { dir, cleanup } = tmpProjectWithScope('partial.scope.json');
  try {
    const result = await runCli(['scope', '--validate'], { cwd: dir });
    assert.equal(result.exitCode, 0, `stderr: ${result.stderr}`);
  } finally { cleanup(); }
});

test('scope --validate exits 1 with ajv error on invalid file', async () => {
  const { dir, cleanup } = tmpProjectWithScope('invalid.scope.json');
  try {
    const result = await runCli(['scope', '--validate'], { cwd: dir });
    assert.notEqual(result.exitCode, 0);
    assert.match(result.stderr, /failed schema validation|additional|unknownTopLevel/);
  } finally { cleanup(); }
});

test('scope --validate exits 1 when .scope.json is absent', async () => {
  const { dir, cleanup } = tmpProjectWithScope(); // no fixture
  try {
    const result = await runCli(['scope', '--validate'], { cwd: dir });
    assert.notEqual(result.exitCode, 0);
    assert.match(result.stderr, /No .brand\/\.scope\.json|no_scope_file/);
  } finally { cleanup(); }
});

test('scope --validate --json emits structured output for valid', async () => {
  const { dir, cleanup } = tmpProjectWithScope('full.scope.json');
  try {
    const result = await runCli(['scope', '--validate', '--json'], { cwd: dir });
    assert.equal(result.exitCode, 0);
    const out = JSON.parse(result.stdout);
    assert.equal(out.ok, true);
    assert.equal(out.path, '.brand/.scope.json');
  } finally { cleanup(); }
});
```

- [ ] **Step 2: Run the test**

```bash
node --test cli/test/integration/scope-cli.test.js 2>&1 | tail -15
```

Expected: 5 tests pass.

- [ ] **Step 3: Run full suite**

```bash
npm test 2>&1 | tail -5
```

Expected: 101 pass (96 + 5), 0 fail.

- [ ] **Step 4: Commit**

Write to `/tmp/commit-msg-task6.txt`:

```
test(integration): scope-cli covers valid / invalid / absent / --json

Five tests against the three new fixtures + an absent-file path: full
scope passes, partial scope passes, invalid scope rejects with ajv
error, missing file rejects, --json emits structured ok:true on valid.
Establishes the embedded-host pattern for ahead-of-time scope validation.
```

```bash
git add cli/test/integration/scope-cli.test.js
git commit -F /tmp/commit-msg-task6.txt
```

---

## Task 7: Roundtrip integration test (scope → CLI → exit-code)

**Goal:** Lock in that the schema, loader, validator, and CLI all agree on what's valid. Slightly different framing from Task 6: instead of testing the CLI's behavior directly, this test exercises the FULL chain (loader reads → validator runs → CLI exits accordingly) with two scenarios that span the surface.

**Files:**
- Create: `cli/test/integration/scope-fixtures-roundtrip.test.js`

- [ ] **Step 1: Write the test**

Create `cli/test/integration/scope-fixtures-roundtrip.test.js`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync, copyFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runCli } from '../helpers/run-cli.js';
import { loadScope, validateScope } from '../../src/utils/scope-loader.js';
import { mergeScopeIntoBrandrc } from '../../src/utils/scope-merge.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const FIXTURES = resolve(__dirname, '../fixtures/scope');

function tmpProjectWithScope(fixtureName) {
  const dir = mkdtempSync(join(tmpdir(), 'scope-roundtrip-'));
  const brandDir = join(dir, '.brand');
  mkdirSync(brandDir, { recursive: true });
  copyFileSync(resolve(FIXTURES, fixtureName), join(brandDir, '.scope.json'));
  return { dir, brandDir, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

test('roundtrip: full fixture → loadScope → validateScope → CLI exits 0', async () => {
  const { dir, brandDir, cleanup } = tmpProjectWithScope('full.scope.json');
  try {
    // Direct loader/validator path
    const scope = loadScope(brandDir);
    assert.equal(scope.client, 'ACME Corp');
    assert.equal(validateScope(scope).valid, true);

    // Merge against an empty brandrc to verify the full surface composes
    const empty = { client: '', tier: '', mode: 'standard', sources: {} };
    const r = mergeScopeIntoBrandrc(scope, empty);
    assert.equal(r.merged.client, 'ACME Corp');
    assert.equal(r.merged.sources.website, 'https://acme.example.com');
    assert.equal(r.conflicts.length, 0);

    // CLI path agrees
    const result = await runCli(['scope', '--validate'], { cwd: dir });
    assert.equal(result.exitCode, 0);
  } finally { cleanup(); }
});

test('roundtrip: invalid fixture rejected by both validateScope and CLI', async () => {
  const { dir, brandDir, cleanup } = tmpProjectWithScope('invalid.scope.json');
  try {
    const scope = loadScope(brandDir);
    const direct = validateScope(scope);
    assert.equal(direct.valid, false);

    const result = await runCli(['scope', '--validate'], { cwd: dir });
    assert.notEqual(result.exitCode, 0);
  } finally { cleanup(); }
});
```

- [ ] **Step 2: Run the test**

```bash
node --test cli/test/integration/scope-fixtures-roundtrip.test.js 2>&1 | tail -10
```

Expected: 2 tests pass.

- [ ] **Step 3: Run full suite**

```bash
npm test 2>&1 | tail -5
```

Expected: 103 pass (101 + 2), 0 fail.

- [ ] **Step 4: Commit**

Write to `/tmp/commit-msg-task7.txt`:

```
test(integration): scope fixtures roundtrip through loader + validator + CLI + merge

Two tests verifying the full chain agrees on valid/invalid: full fixture
passes loader → validator → CLI; merge against an empty brandrc produces
expected output with no conflicts. Invalid fixture fails at both the
direct validator and the CLI. Establishes the cross-utility tripwire
matching the contract branch's preflight test pattern.
```

```bash
git add cli/test/integration/scope-fixtures-roundtrip.test.js
git commit -F /tmp/commit-msg-task7.txt
```

---

## Task 8: SKILL `§0a.5` — read, merge, delete prose

**Goal:** Insert the new SKILL section between `§0a` (read brandrc) and `§0b` (scan asset folder). Documents the read-merge-delete flow, threads `filledFromScope` into Stage 0c-0e, and specifies bail behavior for embedded mode + missing required fields.

**Files:**
- Modify: `brand-context/skills/brand-extract/SKILL.md` — insert `§0a.5` and modify `§0c`/`§0d`/`§0e` to honor `filledFromScope`

- [ ] **Step 1: Read the current `§0a` and `§0b` boundaries to ground the insert**

The current `§0a. Read existing config` block is at lines ~28-31; `§0b. Scan the project for asset files` heading is at line ~33. Read those lines first to confirm exact byte content before constructing the Edit.

- [ ] **Step 2: Insert `§0a.5` between `§0a` and `§0b`**

Use `Edit` with the exact `### 0b. Scan the project for asset files` heading line as `old_string`, and replace with the new `§0a.5` block followed by the unchanged `### 0b.` heading. The new section content:

```markdown
### 0a.5. Read `.brand/.scope.json` (if present) and pre-fill brandrc

If `.brand/.scope.json` exists, the practitioner (or an embedded host) has pre-answered some or all of Stage 0d's discovery questions. Read the file once at the start of Stage 0, merge into the in-memory brandrc state, and delete the scope file after `§0e` writes the brandrc successfully.

**Read.** `Read` `.brand/.scope.json`. If absent: skip this entire subsection and continue to `§0b`. If present and malformed JSON: bail with a chalk-red error mentioning the file path; exit. If present and parses but fails schema validation: bail with the ajv error text; exit. (Practitioners can run `brand-cli scope --validate` to lint scope files before invoking the SKILL — see spec §4.)

**Merge.** Apply the merge rule from `cli/src/utils/scope-merge.js` (the canonical implementation). Per spec §1: brandrc wins on conflict; "empty" brandrc fields get pre-filled from scope; non-empty conflicts are recorded for `§0e` to surface as chalk-yellow log lines. The merge produces:
- An updated in-memory brandrc state (merged values).
- A `filledFromScope` set of dot-paths (e.g. `"client"`, `"sources.website"`, `"sources.social.twitter"`) — every brandrc key that scope filled. Stage 0c-0e read this set to skip conversational questions for already-populated fields.
- A `conflicts` array of `{field, scope_value, brandrc_value}` records for `§0e` to log.

When `brand-cli` is installed, prefer to invoke `cli/src/utils/scope-merge.js` indirectly via the scope-loader. When `brand-cli` is absent, read `.brand/.scope.json` directly and apply the same merge algorithm inline (the scope-merge utility's algorithm is documented in spec §3 — implement it in-prose by walking scope leaf-by-leaf, comparing each leaf against the corresponding brandrc value via the per-type "empty" rule from spec §1).

**Embedded-mode bail.** If the merged scope sets `interactive_preflight: false` (or the env var `BRAND_SKILLS_NONINTERACTIVE=1` is set — env wins on disagreement), check that all of these are present after the merge:
- `client` (non-empty string)
- `tier` (non-empty enum value)
- At least one of: `sources.website`, `sources.figma` (non-empty array), `sources.brand_guide`, `sources.screenshots` (non-empty array), `sources.design_system_repo`. `sources.social` and `sources.app_store` alone do **not** satisfy this — they're voice/copy supplements, not standalone pipeline inputs.

If any required field is empty, bail. Print a chalk-red one-line problem statement, then emit a JSON object to stderr for embedded host parsing:

```
.scope.json is missing required fields for embedded mode: <comma-separated field names>.
Add the missing fields and re-author .scope.json before dispatching the SKILL.
See docs/superpowers/specs/2026-06-14-scope-json-design.md §3.

{"error":"missing_required_fields","missing":["client","tier"],"hint":"<one-line hint>"}
```

Exit 1. **Do not delete the scope file** — the host needs it to fix and retry.

**Hold.** Pass `filledFromScope` and the merged brandrc state forward in memory. Don't write `.brandrc.yaml` yet — `§0e` does that after the rest of Stage 0 completes.

```

(Confirm the indentation/spacing matches the surrounding sections; markdown headings + paragraph blank lines must be preserved.)

- [ ] **Step 3: Update `§0c` to skip the asset-confirmation prompt when scope filled brand_guide/screenshots in embedded mode**

Find the existing `§0c` block. The three cases (1: assets found / 2: empty assets / 3: no assets dir) currently always prompt. Add a leading paragraph immediately under the `### 0c. Surface findings and confirm` heading:

```markdown
**If `filledFromScope` (from `§0a.5`) contains `sources.brand_guide` or `sources.screenshots` AND `interactive_preflight: false`:** treat the corresponding asset entries as pre-confirmed. Skip the "sound good?" prompt for those entries; proceed silently. Asset rescan logic (Cases 2 + 3) still applies as today — pre-filled scope doesn't manifest files that don't exist on disk.
```

Use `Edit` with the section heading + first line as the old_string anchor.

- [ ] **Step 4: Update `§0d` to skip questions for pre-filled fields**

Find the existing `§0d. Ask for non-file sources` block. The five questions are bullet-numbered (1-5). Add a leading paragraph:

```markdown
**Pre-filled-from-scope fields:** for each question below, check whether the corresponding `sources.*` key is in `filledFromScope` (from `§0a.5`). If yes, skip the question silently — the value is already in the merged brandrc state. If `interactive_preflight: false` AND a required field (per `§0a.5` runtime requirements) is still empty, bail with the structured error from `§0a.5` rather than asking. Otherwise, ask conversationally.
```

- [ ] **Step 5: Update `§0e` to log conflicts and delete the scope file on success**

Find the existing `§0e. Write the populated config` block. Append two paragraphs after the existing content:

```markdown
**Conflicts from `§0a.5`:** for each entry in the `conflicts` array, surface a chalk-yellow log line:

> Note: scope provided `<field>: <scope_value>` but brandrc already had `<brandrc_value>`. Kept brandrc's value.

This is informational only — the merge already honored brandrc. No action needed.

**Delete `.brand/.scope.json` on success.** After the `Edit` to `.brandrc.yaml` completes successfully (Stage 0e writes through), delete `.brand/.scope.json` via `Bash rm` or the equivalent. The scope file is a one-shot input; subsequent runs use brandrc only. **Do NOT delete on failure** — if the brandrc write itself failed, the state is inconsistent and the host needs the scope file to retry. Failures earlier in `§0a.5` (parse, validation, embedded-mode bail) also do not delete.
```

- [ ] **Step 6: Render-check the SKILL — heading counts, line growth**

```bash
grep -c "^## " brand-context/skills/brand-extract/SKILL.md
grep -c "^### " brand-context/skills/brand-extract/SKILL.md
wc -l brand-context/skills/brand-extract/SKILL.md
```

Expected: `^### ` count up by 1 (the new `### 0a.5`); total lines up by ~50-70.

```bash
git diff brand-context/skills/brand-extract/SKILL.md | head -200
```

Visually confirm the inserts are in the right places.

- [ ] **Step 7: Run the suite (no test changes — sanity)**

```bash
npm test 2>&1 | tail -5
```

Expected: still 103 pass / 0 fail. SKILL prose isn't covered by current tests yet; Task 9 adds parity coverage.

- [ ] **Step 8: Commit**

Write to `/tmp/commit-msg-task8.txt`:

```
feat(skill): add §0a.5 read-merge-delete for .brand/.scope.json

Inserts a new section between §0a (read brandrc) and §0b (scan assets):
reads .brand/.scope.json if present, merges into the in-memory brandrc
state via the scope-merge algorithm (brandrc wins on conflict), threads
a filledFromScope dot-path set into §0c-0e to skip conversational
questions for pre-filled fields, deletes the scope file after a
successful §0e brandrc write, bails with a structured stderr JSON error
when interactive_preflight: false and required fields are missing.

Stage 0c skips asset confirmation in embedded mode when scope filled
brand_guide/screenshots. Stage 0d skips per-question when filledFromScope
contains the relevant source key. Stage 0e logs conflicts inline and
deletes the scope file on successful brandrc write.

Spec §3.
```

```bash
git add brand-context/skills/brand-extract/SKILL.md
git commit -F /tmp/commit-msg-task8.txt
```

---

## Task 9: SKILL ↔ scope parity test

**Goal:** Unit test that verifies SKILL prose mentions the scope file path, the merge precedence rule, and the embedded-mode bail behavior. Mirrors the contract branch's `skill-contract-parity.test.js` pattern.

**Files:**
- Create: `cli/test/unit/skill-scope-parity.test.js`

- [ ] **Step 1: Write the test**

Create `cli/test/unit/skill-scope-parity.test.js`:

```javascript
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
```

- [ ] **Step 2: Run the test**

```bash
node --test cli/test/unit/skill-scope-parity.test.js 2>&1 | tail -15
```

Expected: 5 tests pass. If any fail, fix the SKILL prose — the spec is the source of truth.

- [ ] **Step 3: Run full suite**

```bash
npm test 2>&1 | tail -5
```

Expected: 108 pass (103 + 5), 0 fail.

- [ ] **Step 4: Commit**

Write to `/tmp/commit-msg-task9.txt`:

```
test(unit): SKILL <-> scope parity

Five assertions guarding SKILL prose against drift from the scope spec:
the .brand/.scope.json path is mentioned by name; the brandrc-wins-on-
conflict rule is documented; interactive_preflight + missing_required_
fields bail path is referenced; the filledFromScope set is named; the
delete-after-merge invariant is stated. Mirrors the contract branch's
skill-contract-parity test pattern.
```

```bash
git add cli/test/unit/skill-scope-parity.test.js
git commit -F /tmp/commit-msg-task9.txt
```

---

## Task 10: Repo docs propagation

**Goal:** CLAUDE.md, README.md, schema/brand/README.md, docs/DESIGN.md, and docs/tasks.md updates so the new schema layer + scope semantics are discoverable.

**Files:**
- Modify: `CLAUDE.md`
- Modify: `README.md`
- Modify: `schema/brand/README.md`
- Modify: `docs/DESIGN.md`
- Modify: `docs/tasks.md`

- [ ] **Step 1: Update `CLAUDE.md` "File-write policies" table**

Find the `File-write policies` table. Add a new row after the `audits/*.md` row (or wherever fits the existing structure). The new row:

```markdown
| `.scope.json` | **Read-once + delete-after-merge** — the SKILL `§0a.5` reads `.brand/.scope.json` if present, merges into the in-memory brandrc state, deletes the file only after `§0e` successfully writes `.brandrc.yaml`. Failure modes (parse, validation, embedded-mode bail, brandrc-write fail) do **not** delete. | Transient pre-fill for `.brandrc.yaml`; brandrc remains the single source of truth. Embedded hosts re-author it before each invocation. |
```

Use `Edit` with enough surrounding row context to make the insertion unambiguous.

- [ ] **Step 2: Update `CLAUDE.md` "Architecture" diagram**

Find the architecture block. Add `schema/brand/scope.schema.json` to the schema layer line. The current line near the architecture block is:

```
schema/mcp-fallback-contract.{json,schema.json} ← per-stage fallback contract data + validator
```

Add immediately after:

```
schema/brand/scope.schema.json                  ← validator for optional .brand/.scope.json pre-fill
```

(Confirm exact indentation matches the existing arch block.)

- [ ] **Step 3: Update `README.md` to mention `.scope.json` as embedded-mode entry**

Find the "How the pipeline works" section. After the existing "fallback chains as data" paragraph (added by the contract branch — locate via `grep -n 'fallback chains'`), add a new paragraph:

```markdown
For **embedded use** (a host orchestrator dispatching the SKILL non-interactively), drop a `.brand/.scope.json` file with structured answers to Stage 0's discovery questions. The SKILL pre-fills `.brandrc.yaml` from it, skips the conversational flow for any field already populated, and deletes `.scope.json` after a successful Stage 0 completion. Standalone use is unchanged. Schema: [`schema/brand/scope.schema.json`](schema/brand/scope.schema.json). Spec: [`docs/superpowers/specs/2026-06-14-scope-json-design.md`](docs/superpowers/specs/2026-06-14-scope-json-design.md).
```

- [ ] **Step 4: Update `schema/brand/README.md` cross-links**

Find the existing schema cross-link block (added in the contract branch). Add a new bullet:

```markdown
- [`scope.schema.json`](scope.schema.json) — JSON Schema validating optional `.brand/.scope.json` pre-fill (read-once → merged into `.brandrc.yaml` → deleted at SKILL `§0a.5`)
```

- [ ] **Step 5: Update `docs/DESIGN.md` multi-tenant section**

Read `docs/DESIGN.md` and find the multi-tenant or "embedded use" section (likely heading "Decoupling principles" or similar). Add a paragraph or sub-section documenting the end-to-end embedded path:

```markdown
**End-to-end embedded path.** A host orchestrator dispatches the SKILL non-interactively as follows:

1. `brand-cli init --client "<name>" --mode standard --force` — non-interactive scaffold; writes the minimal `.brand/` + `.brandrc.yaml`.
2. Author `.brand/.scope.json` with the host's known answers to Stage 0's discovery questions, including `interactive_preflight: false`.
3. Optionally validate ahead of time: `brand-cli scope --validate --json`.
4. Dispatch `/brand-context:extract` (or the SKILL via whatever the host's invocation mechanism is). The SKILL reads `.scope.json` at `§0a.5`, merges into brandrc, deletes the scope file, runs §0.5 pre-flight, then proceeds through Stages 1-8.
5. After completion, `.brand/manifest.json` is the machine-readable record the host gates on.

This path is the missing half of the multi-tenant story alongside the manifest+health work (#2, #6) and the MCP-fallback contract (#3).
```

- [ ] **Step 6: Update `docs/tasks.md` — move #4 to Completed**

Find the `#### #4 — Support \`.brand/.scope.json\`` block under `## Active backlog → ### Unblocked`. Move it to a new `### #4 — ... ✅` entry under `## Completed`, after the most recent completed entry. Convert the heading depth from `####` to `###` and append `✅`.

The new Completed entry should enumerate what landed:
- Scope schema (`schema/brand/scope.schema.json`)
- Two CLI utilities: `scope-loader`, `scope-merge`
- New `brand-cli scope --validate` subcommand
- New SKILL `§0a.5` section + Stage 0c/0d/0e modifications
- SKILL ↔ scope parity test

Update the `#5` block: it was previously blocked by #4. Move it from `### Blocked` to `### Unblocked` (or keep marking it blocked if there's another upstream — re-read the existing #5 description first to confirm).

Update the "Last updated" line at the top: `2026-06-14 — #4 ready for merge on \`feat/scope-json\`` (PR number filled in post-merge).

- [ ] **Step 7: Run full suite (sanity)**

```bash
npm test 2>&1 | tail -5
```

Expected: still 108 pass / 0 fail (doc-only changes).

- [ ] **Step 8: Commit**

Write to `/tmp/commit-msg-task10.txt`:

```
docs: propagate .brand/.scope.json to repo-level docs

CLAUDE.md: file-write policy row for .scope.json (read-once + delete-
after-merge); schema arch diagram updated. README.md: pipeline section
gains an embedded-mode-via-.scope.json paragraph. schema/brand/README.md:
cross-link to scope.schema.json. docs/DESIGN.md: end-to-end embedded
path documented (init → author scope → validate → dispatch SKILL).
docs/tasks.md: #4 moved to Completed; #5 unblocked; Last updated bumped.
```

```bash
git add CLAUDE.md README.md schema/brand/README.md docs/DESIGN.md docs/tasks.md
git commit -F /tmp/commit-msg-task10.txt
```

---

## Task 11: Final verification + cross-branch code review

**Goal:** Verification, not build. No implementer subagent. Confirm `npm test` passes, smoke-test end-to-end against a real scope file, dispatch a single final code-reviewer subagent across the branch diff, update progress doc, hand off via `superpowers:finishing-a-development-branch`.

- [ ] **Step 1: Run the full test suite**

```bash
npm test 2>&1 | tail -10
```

Expected: 108 pass, 0 fail.

- [ ] **Step 2: End-to-end smoke test**

Walk a representative embedded-mode flow against a tempdir. Avoid apostrophes in inline JSON; write to `/tmp/smoke-scope.json` first.

```bash
mkdir -p /tmp/scope-smoke-final && cd /tmp/scope-smoke-final
node "$OLDPWD/cli/bin/brand-cli.js" init --client acme --mode standard --force >/dev/null
mkdir -p .brand
cat > /tmp/smoke-scope.json <<JSON
{
  "client": "ACME",
  "tier": "standard",
  "sources": { "website": "https://example.com" },
  "interactive_preflight": false
}
JSON
cp /tmp/smoke-scope.json .brand/.scope.json

# Validate via the new CLI subcommand
node "$OLDPWD/cli/bin/brand-cli.js" scope --validate --json
echo "validate exit: $?"

# Verify utilities compose end-to-end without the SKILL
node --input-type=module -e "
import { loadScope, validateScope } from '$OLDPWD/cli/src/utils/scope-loader.js';
import { mergeScopeIntoBrandrc } from '$OLDPWD/cli/src/utils/scope-merge.js';

const brandDir = '$PWD/.brand';
const s = loadScope(brandDir);
if (!s) throw new Error('loadScope returned null');
if (!validateScope(s).valid) throw new Error('validation failed');

const brandrc = { client: '', tier: '', mode: 'standard', sources: {} };
const r = mergeScopeIntoBrandrc(s, brandrc);
if (r.merged.client !== 'ACME') throw new Error('client merge failed');
if (r.merged.sources.website !== 'https://example.com') throw new Error('website merge failed');
if (r.conflicts.length !== 0) throw new Error('unexpected conflicts');
if (!r.filledFromScope.has('client')) throw new Error('filledFromScope missing client');
if (!r.filledFromScope.has('sources.website')) throw new Error('filledFromScope missing website');
console.log('roundtrip OK');
"

cd "$OLDPWD"
rm -rf /tmp/scope-smoke-final /tmp/smoke-scope.json
```

Expected: `validate` JSON has `"ok":true`, exit 0. Roundtrip prints `roundtrip OK`.

- [ ] **Step 3: `git status` clean + commit count**

```bash
git status
git log --oneline main..HEAD | wc -l
```

Expected: clean working tree. Commit count: ~12-14 (1 spec + 1 plan/progress doc + 9 task commits + plus refinements).

- [ ] **Step 4: Spec coverage skim**

Open `docs/superpowers/specs/2026-06-14-scope-json-design.md` and confirm every requirement maps to a landed task:

| Spec section | Landed in task |
|---|---|
| §1 Relationship + precedence + "empty" rule | Task 4 (scope-merge) implements; Task 8 (SKILL §0a.5) documents |
| §2 Schema | Task 2 (schema) + Task 3 (loader/validator) |
| §3 Merge algorithm + Stage 0c-e behavior + file location | Task 4 (algorithm) + Task 8 (SKILL) |
| §4 CLI surface (`brand-cli scope --validate`) | Task 5 (command) + Task 6 (tests) |
| §5 Three-layer propagation | Tasks 2/3/4/5 + Task 8 + Task 10 |
| §6 Failure matrix + error message conventions + embedded-host pattern | Task 5 (CLI errors) + Task 8 (SKILL bail prose) + Task 10 (DESIGN.md docs) |
| §7 Considered alternatives | (rejected per spec; nothing to land) |
| §8 Out of scope | C2 doctor + #5 industry signal both already filed in tasks.md |

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
  - **Cross-task contract sync** — `filledFromScope` dot-path convention used consistently across `scope-merge.js`, tests, and SKILL prose; "empty" rule per field type matches between spec §1 and `scope-merge.js`; embedded-mode required-fields list matches between spec §3, SKILL §0a.5 prose, and any test that exercises bail behavior.
  - **Delete-after-merge correctness** — SKILL §0a.5 + §0e prose are unambiguous about *when* the file is deleted (only after successful brandrc write). No code path in scope-loader or scope-merge writes anywhere or deletes — those are SKILL-only side effects.
  - **`.brandrc.yaml` not touched in this branch** — the merge runs in memory; the SKILL writes brandrc via the existing `§0e` Edit. Verify no new code path writes to the brandrc file.
  - **CLI scope command is read-only** — does not modify the scope file or brandrc.

If reviewer flags Critical or Important: dispatch a refinement subagent. Minor: accept per [D7].

- [ ] **Step 6: Update progress doc with final state**

In `docs/superpowers/plans/2026-06-14-scope-json-progress.md`:

- Add Task 11 to the "Completed tasks" table with the cross-branch reviewer verdict.
- Add a "Final-stage handoff" section listing what landed.
- Update the "Quick state check" block with the final commit + test counts.

```bash
echo "docs: progress doc through Task 11 — feature ready for merge" > /tmp/commit-msg-task11.txt
git add docs/superpowers/plans/2026-06-14-scope-json-progress.md
git commit -F /tmp/commit-msg-task11.txt
```

- [ ] **Step 7: Hand off via `superpowers:finishing-a-development-branch`**

Invoke that skill (separate, same as the contract branch's final move). Pass it: spec link, plan link, progress doc link, test delta (85 → 108; +23 tests), commit count, cross-branch reviewer verdict.

After merge: update `docs/tasks.md` "Last updated" line with the merged-PR or merge-commit reference. Hoist any new footguns surfaced during this branch into the next progress doc's "things to know" appendix.

---

## Self-review checklist (controller-run during Task 11 spec-coverage skim)

After all 11 tasks land, all of these must be true:

- [ ] `schema/brand/scope.schema.json` exists, validates clean under ajv `strict: true`, mirrors `.brandrc.yaml` shape + `interactive_preflight`.
- [ ] `cli/src/utils/scope-loader.js` exists; `loadScope()` returns null for absent / parsed object for present / throws with file path on malformed JSON; `validateScope()` returns `{valid, errorText}`.
- [ ] `cli/src/utils/scope-merge.js` is a pure function; implements per-type "empty" rule from spec §1; returns `{merged, filledFromScope, conflicts}`.
- [ ] `cli/src/commands/scope.js` exists; `brand-cli scope --validate` exits 0 on valid / 1 on invalid; `--json` flag emits structured output.
- [ ] `cli/bin/brand-cli.js` registers `scope` subcommand.
- [ ] SKILL has new `§0a.5` section; `§0c`/`§0d`/`§0e` updated to honor `filledFromScope`; SKILL ↔ scope parity test passes.
- [ ] Three fixtures committed under `cli/test/fixtures/scope/`.
- [ ] CLAUDE.md, README.md, schema/brand/README.md, docs/DESIGN.md, docs/tasks.md all reflect the new layer.
- [ ] `npm test` is 108 pass / 0 fail on Node ≥ 22.
- [ ] `git status` clean; branch is N commits ahead of main.
- [ ] Package version unchanged (`0.4.0`); `engines.node` unchanged (`>= 22.0.0`).
- [ ] Manifest schema unchanged (`version: "2"`); no schema bump in this branch.
