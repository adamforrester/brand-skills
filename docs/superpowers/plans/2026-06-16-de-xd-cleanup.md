# De-XD Cleanup — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clear pre-1.0 XD-coupling residue from the public contract (brandrc shape, CLI surface, SKILL prose). Closes XD-inventory items #2, #3, #4, #6, #7, #10, #12, #14, #18 on land. Manifest stays v2; the brandrc rename `client` → `brand` translates to `manifest.client` at write time.

**Architecture:** Soft-deprecation back-compat. Old field names (`client`, `mode: pitch`, `extensions`, `tools.storybook`) and the `--impeccable` flag continue to work; legacy aliases warn once per process via a shared `deprecations.js` helper. A surgical extraction (`cli/src/utils/brandrc-loader.js`) routes only the four call sites that consume `client` / `mode` / `extensions` / `tools.storybook`: `refresh-context.js`, `refresh-design.js`, `score.js`, `emit-manifest.js`. Other reads stay alone. The new `outputs:` field is parsed at the `refresh-context.js` call site; the loader stays focused on alias normalization.

**Tech Stack:** Node.js ≥22, ESM (`"type": "module"`), `chalk`, `inquirer`, `yaml`, `commander` (`.option(... , collect, [])` pattern for repeatable flags), `node:test`. No new dependencies.

---

## Source-of-truth references

- **Spec:** [`docs/superpowers/specs/2026-06-16-de-xd-cleanup-design.md`](../specs/2026-06-16-de-xd-cleanup-design.md) — read end to end before starting any task. 255 lines; eight changes; back-compat stance, cross-cutting concerns, acceptance criteria, out-of-scope notes.
- **Progress doc (locked decisions):** [`2026-06-16-de-xd-cleanup-progress.md`](2026-06-16-de-xd-cleanup-progress.md) — the five locked decisions ([D0]–[D3]) survive the session restart. Do NOT re-litigate.
- **Inventory cross-reference:** [`docs/xd-assumption-inventory.md`](../../xd-assumption-inventory.md) — items #2, #3, #4, #6, #7, #10, #12, #14, #18 are the ones this branch closes. Items #1, #5, #8, #9, #11, #13, #15, #16, #17 are deferred to Bucket B (prose) / Bucket C (post-1.0 architectural).
- **Precedent (D-letter pattern + footguns):** [`2026-06-15-industry-signal.md`](2026-06-15-industry-signal.md) and its progress doc — same per-task dispatch protocol applies.
- **Repo conventions:** [`CLAUDE.md`](../../../CLAUDE.md) — three-layer propagation (schema ↔ SKILL ↔ CLI), file-write policies, the editing checklist.

## Things to know that aren't obvious from the codebase

These have bitten every prior branch — hoist them into the implementer subagent's context every dispatch:

- **Per-task tempfiles for commit messages.** `/tmp/commit-msg.txt` is shared across tasks; the Write tool errors with "file modified since read" if a stale file from a prior session lingers. Use `/tmp/commit-msg-task<N>-de-xd.txt` per task, and `rm` the tempfile after the commit. ([D1] from #5; CF-2 from #3.)
- **Apostrophes break heredoc commit messages.** Use Write tool → tempfile → `git commit -F`. Never heredoc with apostrophes. (Carried-forward footgun from CLAUDE.md memory.)
- **`package-lock.json` is gitignored.** Don't `git add` it.
- **Don't bump the package version on this branch.** That happens on a separate v0.5.0 release commit post-merge — five places (`package.json`, `marketplace.json` × 2 fields, `cli/bin/brand-cli.js`) plus two test goldens' `generator` fields. Never touch `~/Documents/xd-toolkit`.
- **Plan-pasted `node -e` snippets that mix `await import()` with `require()` are broken** under `"type":"module"`. Use `node --input-type=module -e "..."` with named ESM imports.
- **Long-running implementer agents can die mid-flight on token expiration.** If file edits are on disk but the agent didn't commit, the controller picks up the partial edits and finishes inline rather than re-dispatching. ([D4] from #4; carried-forward CLAUDE.md memory.)
- **`engines.node >= 22.0.0`.** `node --test` glob support landed at Node 21; floor is at LTS 22. A bare `npm test` in a shell that hasn't `nvm use 22`'d will print `Could not find 'cli/test/**/*.test.js'`. Source `~/.nvm/nvm.sh && nvm use 22` first.
- **SKILL prose isn't covered by `npm test`.** Use the parity-test pattern from `cli/test/unit/skill-scope-parity.test.js` to lock cross-task contract phrases. New parity tests are required for Task 3 (`public-sources-only` rename), Task 4 (Stage 6 gating phrase), and Task 5 (Impeccable → also-write reframing).
- **Per-task two-stage review** (spec compliance, then code quality). Smaller tasks still warrant the full protocol.
- **When the plan's pasted code contradicts the plan's pasted tests, the test is the contract.** Patch the code; surface as `DONE_WITH_CONCERNS`.
- **Manifest schema must NOT be bumped to v3 by this branch.** [D0] from the progress doc: brandrc's `cfg.brand` translates to `manifest.client` at emit-manifest write time. The manifest schema description is reworded to reflect this asymmetry but the field name and `version: "2"` are preserved.
- **Goldens reference `client: "acme"` in `cli/test/golden/manifest-from-{populated,skill}.json:216`.** That stays — it's manifest-side, not brandrc-side. Don't regen.

## Cross-task contracts to preserve

These must stay in sync across **schema-doc**, **brandrc-loader**, **callers**, **SKILL prose**, **parity tests**, and **repo docs**:

- **Manifest schema stays v2.** The brandrc-loader returns `{ brand, ... }` to callers. `emit-manifest.js` writes `payload.client = cfg.brand` (sourced via the loader, with `cfg.client` honored as a fallback inside the loader's alias logic). One short comment in `emit-manifest.js` notes the historical asymmetry. ([D0])
- **Loader scope is surgical.** Exactly four call sites route through `loadBrandrc(projectDir)`: `refresh-context.js`, `refresh-design.js`, `score.js`, `emit-manifest.js`. `init.js` does not use the loader (it scaffolds, not reads). Other reads stay untouched. ([D1])
- **Soft-deprecation aliases live in the loader.** `client → brand`, `mode: pitch → mode: public-sources-only`, `extensions → ignored+warn`, `tools.storybook → ignored silently`. The `deprecations.js` helper guarantees warn-once-per-process per key. Callers receive a fully-normalized object. ([D1])
- **Default `brand` is `basename(projectDir)`.** Loader-level fallback. `init.js` prompt pre-fills the same default. Empty string after trim still rejects. ([D2])
- **`outputs:` is a flat array of paths.** `outputs: [.impeccable.md, ./other.md]`. Parsed at `refresh-context.js` call time, not in the loader. CLI flag (`--also-write <path>` repeatable) and brandrc `outputs:` merge into a single dedup'd list. `--impeccable` is an alias that resolves to `--also-write .impeccable.md`. YAGNI on named buckets. ([D2])
- **Stage 6 gating phrase changes.** SKILL §7 (around line 645) currently reads `tier is comprehensive AND sources.design_system_repo is set`. New phrase: `sources.design_system_repo is set (any tier)`. The tier-based clause is dropped from this stage's gating; the workflow scaffolding under `tier: comprehensive` in `init.js` is unchanged (Bucket C scope).
- **Scope schema (`schema/brand/scope.schema.json`) is untouched.** `.brand/.scope.json` still uses `client`. The loader's alias logic accepts `client` from scope.json the same way it accepts it from `.brandrc.yaml` — but scope.json is read by `cli/src/utils/scope-loader.js`, not by `brandrc-loader.js`, so the alias is enforced at the merge target (i.e. when scope-merge writes into brandrc state). The brandrc-loader sees the merged result and applies its alias logic uniformly. **No change to scope-loader or scope-merge in this branch.**
- **Citation/banner text for `public-sources-only` mode.** SKILL §5c, §6e, §8f currently say `> ⚠️ **PITCH MODE** — derived from public sources only. Not validated against internal brand standards.` New text: `> ⚠️ **PUBLIC-SOURCES-ONLY MODE** — derived from public sources only. Not validated against internal brand standards.` The body text after the bold tag stays identical.
- **Manifest goldens stay green.** `cli/test/golden/manifest-from-{populated,skill}.json:216` show `"client": "acme"` — those persist as manifest-side field names, decoupled from the brandrc rename. Goldens do NOT regenerate on this branch.

## File structure

### New files (Task 2)

| Path | Purpose |
|---|---|
| `cli/src/utils/deprecations.js` | Module-scope `warnedKeys` Set + `warnDeprecated(key, message)` helper. Keeps warn-once semantics exact across the four call sites. |
| `cli/src/utils/brandrc-loader.js` | `loadBrandrc(projectDir)` — reads `.brandrc.yaml`, normalizes legacy aliases (`client`→`brand`, `mode: pitch`→`public-sources-only`), drops `extensions` (warn) and `tools.storybook` (silent), defaults `brand` to `basename(projectDir)`, returns a fully-normalized object. |

### Modified files (across tasks)

| Path | Change | Touched in task |
|---|---|---|
| `cli/src/commands/refresh-context.js` | Route brandrc through `loadBrandrc`; add `--also-write <path>` (repeatable); read `outputs:` array from brandrc; keep `--impeccable` as alias. | Task 2 + Task 5 |
| `cli/src/commands/refresh-design.js` | Route brandrc through `loadBrandrc`; rename `cfg?.client` reads to `cfg.brand`. | Task 2 |
| `cli/src/commands/score.js` | Route brandrc through `loadBrandrc`; rename `cfg.client` to `cfg.brand`; pass `brand` (not `client`) into `buildHealth`. Health writer continues to write `client` field on `.health.json` (decoupled from brandrc, like manifest). | Task 2 |
| `cli/src/commands/emit-manifest.js` | Route brandrc through `loadBrandrc`; manifest payload reads `cfg.brand` and writes `payload.client = cfg.brand`. Add a one-line comment noting the asymmetry. | Task 2 |
| `cli/src/commands/init.js` | Prompt becomes `Brand name:` with default `basename(projectDir)`; mode list shows `public-sources-only` as the second option (was `pitch`); pitch disclaimer constant renamed. `--client` flag preserved as alias of `--brand`. Asset-dir override (Task 6) honors `--asset-dir` flag and (when run after a partial scope merge) `sources.asset_dir`. | Task 2 + Task 3 + Task 6 |
| `cli/bin/brand-cli.js` | Add `--brand <name>` option to `init` command (alias `--client`); add `--also-write <path>` (repeatable) to `refresh-context`; add `--asset-dir <path>` to `init`. `--impeccable` retained for back-compat. | Task 2 + Task 5 + Task 6 |
| `schema/brand/brandrc.schema.md` | (a) Rename `client` row to `brand` (note `client` accepted as alias). (b) Mode enum becomes `standard | public-sources-only | comprehensive` (note `pitch` accepted as alias). (c) Add `outputs` row. (d) Open `tools.agent` to free-form string with suggested values. (e) Drop `extensions` row. (f) Drop `tools.storybook` row. (g) Add `sources.asset_dir` row. (h) Update example to use neutral brand name + remove "XD Toolkit project configuration" comment. | Task 2 + Task 3 + Task 5 + Task 6 |
| `schema/brand/overview.schema.md` | Reframe `Auto-generates: .impeccable.md` and the `Used by Impeccable's context gathering protocol` references to neutral language. | Task 5 |
| `schema/manifest.schema.json` | Description-only change to the `client` field — reword to "the brand name as recorded in the manifest" rather than "client name." Field name and `version: "2"` unchanged. | Task 2 |
| `brand-context/skills/brand-extract/SKILL.md` | (a) §0a step-2 sentence references new `brand` field name. (b) §5c, §6e, §8f bold tag and section headings rename pitch → public-sources-only; body text preserved. (c) §7 (Stage 6) gating clause changes from tier-based to `sources.design_system_repo`-based; edge-case rows in the final summary table updated. (d) §0b asset-directory scan list adopts the `sources.asset_dir` override. | Task 3 + Task 4 + Task 6 |
| `cli/test/unit/brandrc-loader.test.js` | NEW. ~5 tests: legacy `client` only → `brand` populated + warn; both `client` and `brand` → `brand` wins + warn; neither → `basename(projectDir)`; legacy `mode: pitch` → `public-sources-only` + warn; legacy `extensions: [ds-pack]` → ignored + warn; warn fires exactly once per key per process. | Task 2 |
| `cli/test/unit/deprecations.test.js` | NEW. 1 test: warn-once-per-key semantics; resetting via fresh import. | Task 2 |
| `cli/test/unit/skill-scope-parity.test.js` | +5 tests: `public-sources-only` mention; PITCH MODE banner removed; new disclaimer text present; Stage 6 gating phrase decoupled from tier; `sources.asset_dir` override referenced. | Task 3 + Task 4 + Task 6 |
| `cli/test/unit/refresh-context-outputs.test.js` | NEW. 3 tests: `--also-write` mirror file written; `outputs: [path]` from brandrc produces same result with no flag; `--impeccable` writes `.impeccable.md` AND emits a deprecation warning (alias path). | Task 5 |
| `docs/xd-assumption-inventory.md` | Cross-link items #2, #3, #4, #6, #7, #10, #12, #14, #18 to "Closed in `feat/de-xd-cleanup`" with the merge SHA placeholder. | Task 7 |
| `README.md` | Quick-start `--client` example becomes `--brand` (with `--client` noted as alias). Impeccable interop wording becomes neutral with the `--also-write` example. | Task 7 |
| `docs/tasks.md` | Move de-XD entry from Active backlog to Completed; update "Last updated" line. (Final move-to-Completed lands in the post-merge cleanup commit per #4 precedent.) | Task 7 |
| `docs/superpowers/plans/2026-06-16-de-xd-cleanup-progress.md` | Per-task progress log already exists as a shell from `039b695`. Append per-task entries as work lands. | Tasks 1–7 |

**No changes to:** `cli/src/utils/scope-loader.js`, `cli/src/utils/scope-merge.js`, `cli/src/utils/contract-loader.js`, `schema/manifest.schema.json` `version` field, `schema/health.schema.json`, `schema/brand/scope.schema.json`, `schema/mcp-fallback-contract.json`, `cli/test/golden/*`, `cli/test/fixtures/stage-data/*`. Generators (`brand-context-generator.js`, `design-md-generator.js`) take `brandName` as a positional argument and need no rename.

---

## Per-task dispatch protocol

Same as the scope-json branch (precedent doc). Per task:

1. **Open this plan**, copy the full task text inline (don't make subagents read the plan file).
2. **Dispatch implementer** (`general-purpose` subagent). Include: full task text; branch name `feat/de-xd-cleanup`; pointers to this plan + spec + progress doc; the "Things to know" footguns above.
3. **Spec compliance review** (`general-purpose` subagent). Read the actual code; don't trust the implementer's report.
4. **Code quality review** (`superpowers:code-reviewer` subagent). Pass `BASE_SHA` (commit before this task) and `HEAD_SHA`.
5. **If reviewer flags Critical or Important:** dispatch a refinement subagent. **If Minor only:** accept and proceed (per [D7] from manifest+health branch).
6. **Update progress doc** (`docs/superpowers/plans/2026-06-16-de-xd-cleanup-progress.md`) with commit SHA(s), test delta, decisions.
7. **Mark task done** in the session task list.

---

## Task 1: Test harness sync + branch baseline

**Goal:** Confirm `feat/de-xd-cleanup` is at `039b695`, baseline tests are 112/112, and the spec + progress-doc shell are already committed (commits `25e3300` + `039b695`). No code change. This task records the baseline so subsequent tasks have an unambiguous "0 → +N tests" delta.

**Files:**
- No file changes. This task verifies + records state only.

- [ ] **Step 1: Verify branch state**

```bash
git rev-parse --abbrev-ref HEAD
git log --oneline main..HEAD
git status
```

Expected: branch is `feat/de-xd-cleanup`; two commits ahead of main (`25e3300` spec + `039b695` progress-doc shell); working tree clean.

- [ ] **Step 2: Run the existing test suite**

```bash
source ~/.nvm/nvm.sh && nvm use 22
npm test 2>&1 | tail -10
```

Expected: `# pass 112` / `# fail 0`. If the tail shows `Could not find 'cli/test/**/*.test.js'`, your shell is on Node 20 — re-run `nvm use 22` and retry.

- [ ] **Step 3: Record baseline in progress doc**

Update the existing `docs/superpowers/plans/2026-06-16-de-xd-cleanup-progress.md` "Quick state check" block (or create one if the shell doesn't have it). Append at the top of the doc:

```markdown
## Quick state check

```
$ git log --oneline main..HEAD
039b695 docs: progress doc shell for de-XD cleanup + tasks.md state
25e3300 docs: spec for de-XD cleanup (Bucket A — pre-1.0 contract residue)

$ npm test 2>&1 | tail -5
# pass 112
# fail 0
```

Baseline locked: 112 tests at HEAD `039b695`. New tests by task tracked below.
```

- [ ] **Step 4: Commit the baseline note**

Write commit message to `/tmp/commit-msg-task1-de-xd.txt`:

```
docs: baseline 112 tests at de-XD cleanup HEAD

Records the test count at branch HEAD before any code change so
subsequent tasks have an unambiguous test-delta reference.
```

```bash
git add docs/superpowers/plans/2026-06-16-de-xd-cleanup-progress.md
git commit -F /tmp/commit-msg-task1-de-xd.txt
rm /tmp/commit-msg-task1-de-xd.txt
```

- [ ] **Step 5: Verify**

```bash
git log --oneline main..HEAD
npm test 2>&1 | tail -5
```

Expected: 3 commits ahead of main. Tests still 112/112.

---

## Task 2: brandrc-loader extraction + `client` → `brand` rename + warn-once helper

**Goal:** Land the foundation: a shared `deprecations.js` helper, a new `brandrc-loader.js` that normalizes legacy aliases, and a rename of `client` → `brand` in the schema-doc and the four CLI call sites that consume it. Manifest stays v2; `cfg.brand` translates to `payload.client` at emit-manifest write time. This task is the largest in the branch — it sets the alias infrastructure that Tasks 3, 5, 6 reuse.

**Files:**
- Create: `cli/src/utils/deprecations.js`
- Create: `cli/src/utils/brandrc-loader.js`
- Create: `cli/test/unit/deprecations.test.js`
- Create: `cli/test/unit/brandrc-loader.test.js`
- Modify: `cli/src/commands/refresh-context.js`
- Modify: `cli/src/commands/refresh-design.js`
- Modify: `cli/src/commands/score.js`
- Modify: `cli/src/commands/emit-manifest.js`
- Modify: `cli/src/commands/init.js`
- Modify: `cli/bin/brand-cli.js`
- Modify: `schema/brand/brandrc.schema.md`
- Modify: `schema/manifest.schema.json` (description-only)

- [ ] **Step 1: Create `cli/src/utils/deprecations.js`**

Use the `Write` tool:

```javascript
import chalk from 'chalk';

const warnedKeys = new Set();

/**
 * Warn-once-per-process semantics. Multiple call sites can warn for the
 * same key without spamming the console — the first call emits, subsequent
 * calls are no-ops. The Set is module-scoped so it survives across imports
 * but resets between Node processes.
 */
export function warnDeprecated(key, message) {
  if (warnedKeys.has(key)) return;
  warnedKeys.add(key);
  console.warn(chalk.yellow(`[brand-skills] ${message}`));
}

/**
 * Test-only: reset the warned set so per-test isolation works. Not exported
 * from any production CLI surface.
 */
export function _resetWarnedKeysForTesting() {
  warnedKeys.clear();
}
```

- [ ] **Step 2: Create `cli/test/unit/deprecations.test.js`**

Use the `Write` tool:

```javascript
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { warnDeprecated, _resetWarnedKeysForTesting } from '../../src/utils/deprecations.js';

beforeEach(() => {
  _resetWarnedKeysForTesting();
});

test('warnDeprecated emits exactly once per key per process', () => {
  const original = console.warn;
  let calls = 0;
  console.warn = () => { calls++; };
  try {
    warnDeprecated('foo', 'foo deprecated');
    warnDeprecated('foo', 'foo deprecated again');
    warnDeprecated('bar', 'bar deprecated');
    warnDeprecated('foo', 'foo deprecated third time');
  } finally {
    console.warn = original;
  }
  assert.equal(calls, 2, 'foo emits once + bar emits once = 2 total');
});
```

- [ ] **Step 3: Create `cli/src/utils/brandrc-loader.js`**

Use the `Write` tool:

```javascript
import { existsSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { parse as yamlParse } from 'yaml';
import chalk from 'chalk';
import { warnDeprecated } from './deprecations.js';

/**
 * Load and normalize .brandrc.yaml.
 *
 * Returns a fully-normalized config object regardless of which legacy alias
 * fields the file uses. Callers should not perform alias logic themselves.
 *
 * Normalizations applied:
 *  - client → brand (legacy alias; warn once)
 *  - mode: pitch → mode: public-sources-only (legacy alias; warn once)
 *  - extensions: [...] → dropped + warn once (no extension contract shipped)
 *  - tools.storybook: ... → dropped silently (was never functional)
 *  - brand defaults to basename(projectDir) when neither brand nor client is set
 *
 * Returns: an object with at minimum `{ brand, tier, mode, sources, outputs, tools, ... }`.
 * Other keys from the YAML are passed through untouched.
 *
 * If .brandrc.yaml is absent: returns a defaults-only object (brand=basename(projectDir),
 * sources={}). If parsing fails: prints a chalk-yellow warning and returns the same defaults.
 */
export function loadBrandrc(projectDir) {
  const path = join(projectDir, '.brandrc.yaml');
  const fallbackBrand = basename(projectDir) || 'Brand';

  if (!existsSync(path)) {
    return { brand: fallbackBrand, sources: {} };
  }

  let raw;
  try {
    raw = yamlParse(readFileSync(path, 'utf-8')) ?? {};
  } catch (err) {
    console.log(chalk.yellow(`⚠ Could not parse .brandrc.yaml: ${err.message}`));
    return { brand: fallbackBrand, sources: {} };
  }

  const normalized = { ...raw };

  // client → brand
  if (normalized.client !== undefined && normalized.brand === undefined) {
    normalized.brand = normalized.client;
    warnDeprecated(
      'brandrc.client',
      '.brandrc.yaml `client` is deprecated; use `brand` instead. The alias is read but will be removed in 2.0.'
    );
  } else if (normalized.client !== undefined && normalized.brand !== undefined) {
    warnDeprecated(
      'brandrc.client+brand',
      '.brandrc.yaml has both `client` and `brand`; using `brand`. The `client` alias is deprecated and will be removed in 2.0.'
    );
  }
  delete normalized.client;

  if (normalized.brand === undefined || normalized.brand === '') {
    normalized.brand = fallbackBrand;
  }

  // mode: pitch → mode: public-sources-only
  if (normalized.mode === 'pitch') {
    normalized.mode = 'public-sources-only';
    warnDeprecated(
      'brandrc.mode.pitch',
      '.brandrc.yaml `mode: pitch` is deprecated; use `mode: public-sources-only` instead. The alias is read but will be removed in 2.0.'
    );
  }

  // extensions: [...] → dropped + warn
  if (normalized.extensions !== undefined) {
    warnDeprecated(
      'brandrc.extensions',
      '.brandrc.yaml `extensions` is no longer recognized; ignored. Re-introduced in a future minor when an extension contract ships.'
    );
    delete normalized.extensions;
  }

  // tools.storybook → dropped silently (was never functional)
  if (normalized.tools && Object.prototype.hasOwnProperty.call(normalized.tools, 'storybook')) {
    delete normalized.tools.storybook;
  }

  // Defensive: ensure sources is an object even when YAML omits it
  if (normalized.sources === undefined || normalized.sources === null) {
    normalized.sources = {};
  }

  return normalized;
}
```

- [ ] **Step 4: Create `cli/test/unit/brandrc-loader.test.js`**

Use the `Write` tool:

```javascript
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
```

- [ ] **Step 5: Run new tests to confirm both files pass**

```bash
node --test cli/test/unit/deprecations.test.js cli/test/unit/brandrc-loader.test.js 2>&1 | tail -10
```

Expected: `# pass 9` / `# fail 0`. (1 deprecations test + 8 loader tests.)

- [ ] **Step 6: Refactor `cli/src/commands/refresh-context.js` to use `loadBrandrc`**

Use the `Edit` tool. Replace the brandrc-reading block.

`old_string`:
```javascript
import { existsSync, writeFileSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import chalk from 'chalk';
import { parse as yamlParse } from 'yaml';
import { generateBrandContext } from '../utils/brand-context-generator.js';

/**
 * Regenerate the project-root brand context file from .brand/.
 *
 * Default output: `brand.md` at project root. Any agent that loads root-level
 * brand files (Claude Code, Cursor, Copilot, Impeccable, etc.) reads it.
 *
 * If `--impeccable` is passed, additionally writes the same content to
 * `.impeccable.md` so the Impeccable skill picks it up under its conventional
 * filename.
 */
export async function refreshContextCommand(opts) {
  const projectDir = process.cwd();
  let client = projectDir.split('/').pop() || 'Brand';
  let brandDir = join(projectDir, '.brand');

  const brandrcPath = join(projectDir, '.brandrc.yaml');
  if (existsSync(brandrcPath)) {
    try {
      const cfg = yamlParse(readFileSync(brandrcPath, 'utf-8'));
      if (cfg?.client) client = cfg.client;
      if (cfg?.brand_path) brandDir = resolve(projectDir, cfg.brand_path);
    } catch (err) {
      console.log(chalk.yellow(`⚠ Could not parse .brandrc.yaml: ${err.message}`));
    }
  }
```

`new_string`:
```javascript
import { existsSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import chalk from 'chalk';
import { generateBrandContext } from '../utils/brand-context-generator.js';
import { loadBrandrc } from '../utils/brandrc-loader.js';

/**
 * Regenerate the project-root brand context file from .brand/.
 *
 * Default output: `brand.md` at project root. Any agent that loads root-level
 * brand files (Claude Code, Cursor, Copilot, etc.) reads it.
 *
 * Additional outputs:
 *  - `--also-write <path>` (repeatable): mirror brand.md to each path.
 *  - `outputs: [path, ...]` in .brandrc.yaml: same effect, declarative.
 *  - `--impeccable` (deprecated alias): equivalent to --also-write .impeccable.md.
 */
export async function refreshContextCommand(opts) {
  const projectDir = process.cwd();
  const cfg = loadBrandrc(projectDir);
  const brand = cfg.brand;
  let brandDir = cfg.brand_path
    ? resolve(projectDir, cfg.brand_path)
    : join(projectDir, '.brand');
```

(Note: `--also-write` and the `outputs:` brandrc field are wired up in Task 5; this task keeps `--impeccable` working unchanged through the existing `if (opts.impeccable)` branch below.)

- [ ] **Step 7: Update the call site downstream that referenced `client`**

In the same file, replace the `generateBrandContext(brandDir, client)` line with the renamed variable.

`old_string`:
```javascript
  const content = generateBrandContext(brandDir, client);
```

`new_string`:
```javascript
  const content = generateBrandContext(brandDir, brand);
```

And update the `--json` output:

`old_string`:
```javascript
  if (opts.json) {
    console.log(JSON.stringify({ ok: true, brand_dir: brandDir, outputs, client }, null, 2));
  }
```

`new_string`:
```javascript
  if (opts.json) {
    console.log(JSON.stringify({ ok: true, brand_dir: brandDir, outputs, brand }, null, 2));
  }
```

- [ ] **Step 8: Refactor `cli/src/commands/refresh-design.js` to use `loadBrandrc`**

Use the `Edit` tool.

`old_string`:
```javascript
import { existsSync, writeFileSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import chalk from 'chalk';
import { parse as yamlParse } from 'yaml';
import { generateDesignMd } from '../utils/design-md-generator.js';

/**
 * Regenerate design.md at the project root from the project's .brand/.
 *
 * Resolves brand directory in this priority order:
 *   1. --brand-path CLI flag
 *   2. brand_path field in .brandrc.yaml
 *   3. ./.brand
 *
 * Client name from .brandrc.yaml (`client`); falls back to directory name.
 */
export async function refreshDesignCommand(opts) {
  const projectDir = process.cwd();
  let client = projectDir.split('/').pop() || 'Brand';
  let brandDir = join(projectDir, '.brand');

  const brandrcPath = join(projectDir, '.brandrc.yaml');
  if (existsSync(brandrcPath)) {
    try {
      const cfg = yamlParse(readFileSync(brandrcPath, 'utf-8'));
      if (cfg?.client) client = cfg.client;
      if (cfg?.brand_path) brandDir = resolve(projectDir, cfg.brand_path);
    } catch (err) {
      console.log(chalk.yellow(`⚠ Could not parse .brandrc.yaml: ${err.message}`));
    }
  }

  if (opts.brandPath) {
    brandDir = resolve(projectDir, opts.brandPath);
  }

  if (!existsSync(brandDir)) {
    console.log(chalk.red(`✗ Brand directory not found: ${brandDir}`));
    console.log(chalk.dim('  Run `brand-cli init` first, or pass --brand-path.'));
    process.exit(1);
  }

  const content = generateDesignMd(brandDir, client);
  const outPath = join(projectDir, 'design.md');
  writeFileSync(outPath, content, 'utf-8');

  console.log(chalk.green(`✓ design.md regenerated from ${brandDir}`));

  if (opts.json) {
    console.log(JSON.stringify({ ok: true, brand_dir: brandDir, output: outPath, client }, null, 2));
  }
}
```

`new_string`:
```javascript
import { existsSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import chalk from 'chalk';
import { generateDesignMd } from '../utils/design-md-generator.js';
import { loadBrandrc } from '../utils/brandrc-loader.js';

/**
 * Regenerate design.md at the project root from the project's .brand/.
 *
 * Resolves brand directory in this priority order:
 *   1. --brand-path CLI flag
 *   2. brand_path field in .brandrc.yaml
 *   3. ./.brand
 *
 * Brand name from .brandrc.yaml (`brand`, with `client` accepted as a deprecated alias);
 * falls back to basename(projectDir) when neither is set.
 */
export async function refreshDesignCommand(opts) {
  const projectDir = process.cwd();
  const cfg = loadBrandrc(projectDir);
  const brand = cfg.brand;
  let brandDir = cfg.brand_path
    ? resolve(projectDir, cfg.brand_path)
    : join(projectDir, '.brand');

  if (opts.brandPath) {
    brandDir = resolve(projectDir, opts.brandPath);
  }

  if (!existsSync(brandDir)) {
    console.log(chalk.red(`✗ Brand directory not found: ${brandDir}`));
    console.log(chalk.dim('  Run `brand-cli init` first, or pass --brand-path.'));
    process.exit(1);
  }

  const content = generateDesignMd(brandDir, brand);
  const outPath = join(projectDir, 'design.md');
  writeFileSync(outPath, content, 'utf-8');

  console.log(chalk.green(`✓ design.md regenerated from ${brandDir}`));

  if (opts.json) {
    console.log(JSON.stringify({ ok: true, brand_dir: brandDir, output: outPath, brand }, null, 2));
  }
}
```

- [ ] **Step 9: Refactor `cli/src/commands/score.js` to use `loadBrandrc`**

Use the `Edit` tool. Two edits in this file.

**Edit A** — replace the local `readBrandrc` import block with the loader.

`old_string`:
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
```

`new_string`:
```javascript
import chalk from 'chalk';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { weightsForTier } from '../utils/tier-weights.js';
import { classifyFile } from '../utils/file-status.js';
import { buildHealth, writeHealth } from '../utils/health-writer.js';
import { loadBrandrc } from '../utils/brandrc-loader.js';
```

**Edit B** — change the `readBrandrc` invocation and `client` consumption to use `brand`.

`old_string`:
```javascript
  const brandrc = readBrandrc(projectDir);
  const tier = brandrc.tier ?? 'standard';
  const client = brandrc.client ?? '';
  const manifest = readManifest(brandDir);
```

`new_string`:
```javascript
  const brandrc = loadBrandrc(projectDir);
  const tier = brandrc.tier ?? 'standard';
  // health-writer's `client` parameter is the persisted field name in .health.json
  // (decoupled from the brandrc rename, same asymmetry as manifest.client). Pass
  // brandrc's normalized `brand` value through.
  const client = brandrc.brand ?? '';
  const manifest = readManifest(brandDir);
```

(Note: `health-writer.js` and `.health.json` schema retain the field name `client` — same generated-artifact pattern as the manifest.)

- [ ] **Step 10: Refactor `cli/src/commands/emit-manifest.js` to use `loadBrandrc`**

Use the `Edit` tool. Two edits.

**Edit A** — replace the local `readBrandrc` import block with the loader.

`old_string`:
```javascript
import { existsSync, readdirSync, statSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import chalk from 'chalk';
import { parse as yamlParse } from 'yaml';
import { writeManifest, validateManifest } from '../utils/manifest-writer.js';
import { weightsForTier } from '../utils/tier-weights.js';
import { classifyFile } from '../utils/file-status.js';
import { loadContract, getDependency } from '../utils/contract-loader.js';
```

`new_string`:
```javascript
import { existsSync, readdirSync, statSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import chalk from 'chalk';
import { writeManifest, validateManifest } from '../utils/manifest-writer.js';
import { weightsForTier } from '../utils/tier-weights.js';
import { classifyFile } from '../utils/file-status.js';
import { loadContract, getDependency } from '../utils/contract-loader.js';
import { loadBrandrc } from '../utils/brandrc-loader.js';
```

**Edit B** — drop the `readBrandrc` function, swap the call site, and document the asymmetry.

`old_string`:
```javascript
function readBrandrc(projectDir) {
  const path = join(projectDir, '.brandrc.yaml');
  if (!existsSync(path)) return {};
  try {
    return yamlParse(readFileSync(path, 'utf-8')) ?? {};
  } catch {
    return {};
  }
}

function generatorString() {
```

`new_string`:
```javascript
function generatorString() {
```

**Edit C** — change the `client` derivation to read `cfg.brand` and explain the asymmetry.

`old_string`:
```javascript
  const brandrc = readBrandrc(projectDir);
  const tier = input.tier ?? brandrc.tier ?? 'minimum';
  const client = input.client ?? brandrc.client ?? '';
```

`new_string`:
```javascript
  const brandrc = loadBrandrc(projectDir);
  const tier = input.tier ?? brandrc.tier ?? 'minimum';
  // The manifest schema has historically used `client` as the brand-name field.
  // Brandrc's user-facing surface is now `brand` (`client` is a deprecated alias).
  // Manifest stays v2; we translate brandrc's normalized `brand` to manifest.client
  // at write time so existing manifest consumers don't need to migrate.
  const client = input.client ?? brandrc.brand ?? '';
```

- [ ] **Step 11: Update `cli/src/commands/init.js` for the `Brand name:` prompt + `--brand` flag**

Use the `Edit` tool. Three edits.

**Edit A** — read the brand from `opts.brand` first, then `opts.client` (back-compat), then prompt with default.

`old_string`:
```javascript
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { stringify as yamlStringify } from 'yaml';
import { generateDesignMd } from '../utils/design-md-generator.js';
import { generateBrandContext } from '../utils/brand-context-generator.js';
```

`new_string`:
```javascript
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { stringify as yamlStringify } from 'yaml';
import { generateDesignMd } from '../utils/design-md-generator.js';
import { generateBrandContext } from '../utils/brand-context-generator.js';
import { warnDeprecated } from '../utils/deprecations.js';
```

**Edit B** — change the `Client name:` prompt to `Brand name:` with the dirname default; accept `--brand` and `--client` (back-compat).

`old_string`:
```javascript
  const answers = {};
  if (opts.client) {
    answers.client = opts.client;
  } else {
    const { client } = await inquirer.prompt([
      { type: 'input', name: 'client', message: 'Client name:', validate: v => v.trim().length > 0 || 'Required' },
    ]);
    answers.client = client.trim();
  }
```

`new_string`:
```javascript
  const answers = {};
  const dirnameDefault = basename(projectDir) || 'Brand';
  if (opts.brand) {
    answers.brand = opts.brand;
  } else if (opts.client) {
    warnDeprecated(
      'init.flag.client',
      '--client is deprecated; use --brand instead. The alias is read but will be removed in 2.0.'
    );
    answers.brand = opts.client;
  } else {
    const { brand } = await inquirer.prompt([
      {
        type: 'input',
        name: 'brand',
        message: 'Brand name:',
        default: dirnameDefault,
        validate: v => v.trim().length > 0 || 'Required',
      },
    ]);
    answers.brand = brand.trim();
  }
```

**Edit C** — write `brand:` (not `client:`) into the scaffolded `.brandrc.yaml`. Update the result-tracking object's display field. (Mode rename happens in Task 3.)

`old_string`:
```javascript
export async function initCommand(opts) {
  const results = { created: [], tier: '', mode: '', client: '' };
  const projectDir = process.cwd();
```

`new_string`:
```javascript
export async function initCommand(opts) {
  const results = { created: [], tier: '', mode: '', brand: '' };
  const projectDir = process.cwd();
```

`old_string`:
```javascript
  const tier = TIER_FOR_MODE[answers.mode];
  results.tier = tier;
  results.mode = answers.mode;
  results.client = answers.client;
```

`new_string`:
```javascript
  const tier = TIER_FOR_MODE[answers.mode];
  results.tier = tier;
  results.mode = answers.mode;
  results.brand = answers.brand;
```

`old_string`:
```javascript
  console.log(chalk.bold(`  Scaffolding ${answers.client} (${answers.mode} mode)`));
  console.log('');

  // 1. .brand/ directory
  const brandDir = join(projectDir, '.brand');
  scaffoldBrandDirectory(brandDir, tier, answers.mode === 'pitch');
  results.created.push('.brand/');
  console.log(chalk.green(`✓ .brand/ (${tier} tier)`));

  // 2. .brandrc.yaml
  const brandrc = {
    client: answers.client,
    tier,
    mode: answers.mode,
    sources: {},
  };
  writeFileSync(join(projectDir, '.brandrc.yaml'), yamlStringify(brandrc), 'utf-8');
  console.log(chalk.green('✓ .brandrc.yaml'));
  results.created.push('.brandrc.yaml');

  // 3. brand.md (project-root context, generated from .brand/ — placeholder shape)
  writeFileSync(join(projectDir, 'brand.md'), generateBrandContext(brandDir, answers.client), 'utf-8');
  console.log(chalk.green('✓ brand.md'));
  results.created.push('brand.md');

  // 4. design.md (spec-compliant, generated from .brand/)
  writeFileSync(join(projectDir, 'design.md'), generateDesignMd(brandDir, answers.client), 'utf-8');
```

`new_string`:
```javascript
  console.log(chalk.bold(`  Scaffolding ${answers.brand} (${answers.mode} mode)`));
  console.log('');

  // 1. .brand/ directory
  const brandDir = join(projectDir, '.brand');
  scaffoldBrandDirectory(brandDir, tier, answers.mode === 'pitch');
  results.created.push('.brand/');
  console.log(chalk.green(`✓ .brand/ (${tier} tier)`));

  // 2. .brandrc.yaml
  const brandrc = {
    brand: answers.brand,
    tier,
    mode: answers.mode,
    sources: {},
  };
  writeFileSync(join(projectDir, '.brandrc.yaml'), yamlStringify(brandrc), 'utf-8');
  console.log(chalk.green('✓ .brandrc.yaml'));
  results.created.push('.brandrc.yaml');

  // 3. brand.md (project-root context, generated from .brand/ — placeholder shape)
  writeFileSync(join(projectDir, 'brand.md'), generateBrandContext(brandDir, answers.brand), 'utf-8');
  console.log(chalk.green('✓ brand.md'));
  results.created.push('brand.md');

  // 4. design.md (spec-compliant, generated from .brand/)
  writeFileSync(join(projectDir, 'design.md'), generateDesignMd(brandDir, answers.brand), 'utf-8');
```

**Edit D** — also handle the existing-files-present abort path.

`old_string`:
```javascript
    if (opts.client) {
      console.log(chalk.red('  Aborting: existing files would be overwritten.'));
      console.log(chalk.dim('  Re-run with --force to overwrite, or run from an empty directory.'));
      process.exit(1);
    }
```

`new_string`:
```javascript
    if (opts.brand || opts.client) {
      console.log(chalk.red('  Aborting: existing files would be overwritten.'));
      console.log(chalk.dim('  Re-run with --force to overwrite, or run from an empty directory.'));
      process.exit(1);
    }
```

- [ ] **Step 12: Add `--brand` flag to `cli/bin/brand-cli.js`**

Use the `Edit` tool. Find the `init` command definition.

`old_string`:
```javascript
  .description('Scaffold a new client project: .brand/, .brandrc.yaml, brand.md, design.md')
  .option('--client <name>', 'Client name (non-interactive when set)')
```

`new_string`:
```javascript
  .description('Scaffold a new project: .brand/, .brandrc.yaml, brand.md, design.md')
  .option('--brand <name>', 'Brand name (non-interactive when set)')
  .option('--client <name>', 'Deprecated alias of --brand; will be removed in 2.0')
```

- [ ] **Step 13: Update `schema/brand/brandrc.schema.md` — rename `client` row, update example**

Use the `Edit` tool. Three edits.

**Edit A** — replace the `client` row.

`old_string`:
```
| Field | Required | Type | Description |
|-------|----------|------|-------------|
| `client` | required | string | Client name as used in brand materials |
| `project` | optional | string | Project name within the client (e.g., "rewards-app", "2026-redesign") |
| `tier` | required | enum | Target completeness tier: `minimum`, `standard`, or `comprehensive` |
```

`new_string`:
```
| Field | Required | Type | Description |
|-------|----------|------|-------------|
| `brand` | optional | string | The brand this package describes. Defaults to the project directory name. Older configs may use `client`; the alias is read but emits a one-line deprecation warning. |
| `project` | optional | string | Project name within the brand (e.g., "rewards-app", "2026-redesign") |
| `tier` | required | enum | Target completeness tier: `minimum`, `standard`, or `comprehensive` |
```

**Edit B** — update the example block. Remove the "XD Toolkit project configuration" comment (Bucket B will swap Wendy's; this branch only flips the comment + `client:` field name).

`old_string`:
```yaml
# .brandrc.yaml — XD Toolkit project configuration
client: "Wendy's"
project: "rewards-app-2026"
tier: standard
```

`new_string`:
```yaml
# .brandrc.yaml — brand-skills project configuration
brand: "Wendy's"
project: "rewards-app-2026"
tier: standard
```

**Edit C** — update the "Validation Rules" section to reference `brand` instead of `client`.

`old_string`:
```
The `brand-cli` validation pass checks:
1. `client` and `tier` are present
2. `tier` value is one of: `minimum`, `standard`, `comprehensive`
```

`new_string`:
```
The `brand-cli` validation pass checks:
1. `tier` is present (`brand` is optional and falls back to the project directory name)
2. `tier` value is one of: `minimum`, `standard`, `comprehensive`
```

- [ ] **Step 14: Update `schema/manifest.schema.json` description (description-only)**

Use the `Edit` tool.

`old_string`:
```json
    "client": { "type": "string" },
```

`new_string`:
```json
    "client": { "type": "string", "description": "Brand name as recorded in the manifest. Sourced from .brandrc.yaml `brand` (or its deprecated alias `client`). The field name on the manifest is preserved as `client` for back-compat with v2 manifest consumers." },
```

- [ ] **Step 15: Run the full test suite**

```bash
npm test 2>&1 | tail -10
```

Expected: 121 pass (was 112; +9 = 1 deprecations + 8 brandrc-loader). Existing tests still green. If any existing test fails because it asserts on the old `client` shape in CLI output, surface — those tests need updating in the same task per the editing-checklist rule.

- [ ] **Step 16: Smoke-test `init` end-to-end with `--brand`**

```bash
mkdir -p /tmp/de-xd-init-smoke && cd /tmp/de-xd-init-smoke
node "$OLDPWD/cli/bin/brand-cli.js" init --brand "Smoke Brand" --mode standard --force >/dev/null 2>&1
grep -q "^brand:" .brandrc.yaml && echo "OK: brand field present"
grep -q "^client:" .brandrc.yaml && echo "FAIL: client field still present" || echo "OK: client field absent"
cd "$OLDPWD"
rm -rf /tmp/de-xd-init-smoke
```

Expected: `OK: brand field present` and `OK: client field absent`.

- [ ] **Step 17: Smoke-test `init` end-to-end with `--client` (alias path)**

```bash
mkdir -p /tmp/de-xd-init-alias && cd /tmp/de-xd-init-alias
node "$OLDPWD/cli/bin/brand-cli.js" init --client "Alias Brand" --mode standard --force 2>&1 | grep -q "deprecated" && echo "OK: deprecation warning fired"
grep -q "^brand: Alias Brand" .brandrc.yaml && echo "OK: client value migrated to brand"
cd "$OLDPWD"
rm -rf /tmp/de-xd-init-alias
```

Expected: `OK: deprecation warning fired` and `OK: client value migrated to brand`.

- [ ] **Step 18: Smoke-test `score` and `refresh-context` against legacy `client:` brandrc**

```bash
mkdir -p /tmp/de-xd-legacy && cd /tmp/de-xd-legacy
node "$OLDPWD/cli/bin/brand-cli.js" init --brand temp --mode standard --force >/dev/null 2>&1
# Hand-write a legacy .brandrc.yaml to verify alias path
cat > .brandrc.yaml <<YAML
client: Legacy Brand
tier: standard
mode: standard
sources: {}
YAML
node "$OLDPWD/cli/bin/brand-cli.js" refresh-context 2>&1 | grep -q "deprecated" && echo "OK: refresh-context warns on legacy client"
node "$OLDPWD/cli/bin/brand-cli.js" refresh-design >/dev/null 2>&1 && echo "OK: refresh-design ran"
node "$OLDPWD/cli/bin/brand-cli.js" score >/dev/null 2>&1 && echo "OK: score ran"
cd "$OLDPWD"
rm -rf /tmp/de-xd-legacy
```

Expected: `OK: refresh-context warns on legacy client`, `OK: refresh-design ran`, `OK: score ran`.

- [ ] **Step 19: Commit**

Write commit message to `/tmp/commit-msg-task2-de-xd.txt`:

```
refactor(brandrc): extract loader + rename client -> brand

New cli/src/utils/brandrc-loader.js normalizes legacy aliases
(client -> brand, mode: pitch -> public-sources-only, drops
extensions/tools.storybook). Warn-once helper at deprecations.js
makes per-process semantics exact.

Four call sites route through the loader: refresh-context,
refresh-design, score, emit-manifest. init.js prompt becomes
"Brand name:" with basename(projectDir) default; --client retained
as deprecated alias of --brand.

Manifest schema stays v2 — brandrc.brand translates to manifest.client
at emit-manifest write time. The asymmetry is documented in a one-line
comment at the call site and in the manifest schema description.

Tests: +9 (deprecations warn-once + brandrc-loader 8 cases).
Total: 112 -> 121.
```

```bash
git add cli/src/utils/deprecations.js \
        cli/src/utils/brandrc-loader.js \
        cli/test/unit/deprecations.test.js \
        cli/test/unit/brandrc-loader.test.js \
        cli/src/commands/refresh-context.js \
        cli/src/commands/refresh-design.js \
        cli/src/commands/score.js \
        cli/src/commands/emit-manifest.js \
        cli/src/commands/init.js \
        cli/bin/brand-cli.js \
        schema/brand/brandrc.schema.md \
        schema/manifest.schema.json
git commit -F /tmp/commit-msg-task2-de-xd.txt
rm /tmp/commit-msg-task2-de-xd.txt
```

- [ ] **Step 20: Verify**

```bash
git log --oneline main..HEAD
npm test 2>&1 | tail -5
```

Expected: 4 commits ahead of main. Tests at 121/121.

---

## Task 3: `mode: pitch` → `public-sources-only` rename

**Goal:** Rename the agency-pitch mode to a neutral label. Loader-level alias (already in place from Task 2) makes legacy `mode: pitch` continue to load. SKILL prose disclaimers update; init.js mode list shows the new label; parity tests guard against drift.

**Files:**
- Modify: `cli/src/commands/init.js` (mode-list label + pitch disclaimer constant + scaffold check)
- Modify: `schema/brand/brandrc.schema.md` (mode enum)
- Modify: `brand-context/skills/brand-extract/SKILL.md` (§5c, §6e, §8f)
- Modify: `cli/test/unit/skill-scope-parity.test.js` (+2 tests)

- [ ] **Step 1: Update `init.js` mode list and pitch disclaimer**

Use the `Edit` tool. Three edits.

**Edit A** — rename the `PITCH_DISCLAIMER` constant + text body. Keep the variable name in code as-is to minimize diff; only the literal text changes.

`old_string`:
```javascript
const PITCH_DISCLAIMER =
  '> ⚠️ **PITCH MODE** — derived from public sources only. Not validated against internal brand standards.\n\n';
```

`new_string`:
```javascript
const PUBLIC_SOURCES_ONLY_DISCLAIMER =
  '> ⚠️ **PUBLIC-SOURCES-ONLY MODE** — derived from public sources only. Not validated against internal brand standards.\n\n';
```

**Edit B** — update the `TIER_FOR_MODE` map and the `--mode` flag whitelist + prompt list to use `public-sources-only`.

`old_string`:
```javascript
const TIER_FOR_MODE = {
  pitch: 'minimum',
  standard: 'standard',
  comprehensive: 'comprehensive',
};
```

`new_string`:
```javascript
const TIER_FOR_MODE = {
  'public-sources-only': 'minimum',
  pitch: 'minimum', // deprecated alias; loader normalizes but init's --mode also accepts
  standard: 'standard',
  comprehensive: 'comprehensive',
};
```

**Edit C** — update the prompt's mode list:

`old_string`:
```javascript
  if (opts.mode && ['standard', 'pitch', 'comprehensive'].includes(opts.mode)) {
    answers.mode = opts.mode;
  } else if (!opts.mode || opts.mode === 'standard') {
    const { mode } = await inquirer.prompt([
      {
        type: 'list',
        name: 'mode',
        message: 'Project mode:',
        choices: [
          { name: `standard      ${chalk.dim('— You have brand assets: style guide, Figma, live site')}`, value: 'standard' },
          { name: `pitch         ${chalk.dim('— Public sources only: website, social, no internal access')}`, value: 'pitch' },
          { name: `comprehensive ${chalk.dim('— Full access plus institutional knowledge capture')}`, value: 'comprehensive' },
        ],
        default: 'standard',
      },
    ]);
    answers.mode = mode;
  } else {
    answers.mode = opts.mode;
  }
```

`new_string`:
```javascript
  if (opts.mode && ['standard', 'public-sources-only', 'pitch', 'comprehensive'].includes(opts.mode)) {
    if (opts.mode === 'pitch') {
      warnDeprecated(
        'init.flag.mode.pitch',
        '--mode pitch is deprecated; use --mode public-sources-only instead. The alias is read but will be removed in 2.0.'
      );
      answers.mode = 'public-sources-only';
    } else {
      answers.mode = opts.mode;
    }
  } else if (!opts.mode || opts.mode === 'standard') {
    const { mode } = await inquirer.prompt([
      {
        type: 'list',
        name: 'mode',
        message: 'Project mode:',
        choices: [
          { name: `standard             ${chalk.dim('— You have brand assets: style guide, Figma, live site')}`, value: 'standard' },
          { name: `public-sources-only  ${chalk.dim('— Public sources only: website, social, no internal access')}`, value: 'public-sources-only' },
          { name: `comprehensive        ${chalk.dim('— Full access plus institutional knowledge capture')}`, value: 'comprehensive' },
        ],
        default: 'standard',
      },
    ]);
    answers.mode = mode;
  } else {
    answers.mode = opts.mode;
  }
```

**Edit D** — update the call to `scaffoldBrandDirectory` and the `isPitch` parameter.

`old_string`:
```javascript
  scaffoldBrandDirectory(brandDir, tier, answers.mode === 'pitch');
```

`new_string`:
```javascript
  scaffoldBrandDirectory(brandDir, tier, answers.mode === 'public-sources-only');
```

**Edit E** — update the `scaffoldBrandDirectory` function signature/body. Find this:

`old_string`:
```javascript
function scaffoldBrandDirectory(brandDir, tier, isPitch) {
  const filesToCreate = [...BRAND_FILES.minimum];
  if (tier === 'standard' || tier === 'comprehensive') filesToCreate.push(...BRAND_FILES.standard);
  if (tier === 'comprehensive') filesToCreate.push(...BRAND_FILES.comprehensive);

  for (const filePath of filesToCreate) {
    const fullPath = join(brandDir, filePath);
    mkdirSync(join(fullPath, '..'), { recursive: true });

    if (filePath.endsWith('.gitkeep')) {
      writeFileSync(fullPath, '', 'utf-8');
      continue;
    }

    const name = filePath.replace(/\.md$/, '').split('/').pop();
    const title = name.charAt(0).toUpperCase() + name.slice(1).replace(/-/g, ' ');
    const schemaRef = `schema/brand/${filePath.replace(/\//g, '-').replace('.md', '')}.schema.md`;
    const frontmatter = TOKEN_FRONTMATTER[filePath] || '';
    let content = frontmatter + `# ${title}\n\n<!-- Fill this file following the schema at ${schemaRef} -->\n`;
    if (isPitch) content = PITCH_DISCLAIMER + content;
    writeFileSync(fullPath, content, 'utf-8');
  }
}
```

`new_string`:
```javascript
function scaffoldBrandDirectory(brandDir, tier, isPublicSourcesOnly) {
  const filesToCreate = [...BRAND_FILES.minimum];
  if (tier === 'standard' || tier === 'comprehensive') filesToCreate.push(...BRAND_FILES.standard);
  if (tier === 'comprehensive') filesToCreate.push(...BRAND_FILES.comprehensive);

  for (const filePath of filesToCreate) {
    const fullPath = join(brandDir, filePath);
    mkdirSync(join(fullPath, '..'), { recursive: true });

    if (filePath.endsWith('.gitkeep')) {
      writeFileSync(fullPath, '', 'utf-8');
      continue;
    }

    const name = filePath.replace(/\.md$/, '').split('/').pop();
    const title = name.charAt(0).toUpperCase() + name.slice(1).replace(/-/g, ' ');
    const schemaRef = `schema/brand/${filePath.replace(/\//g, '-').replace('.md', '')}.schema.md`;
    const frontmatter = TOKEN_FRONTMATTER[filePath] || '';
    let content = frontmatter + `# ${title}\n\n<!-- Fill this file following the schema at ${schemaRef} -->\n`;
    if (isPublicSourcesOnly) content = PUBLIC_SOURCES_ONLY_DISCLAIMER + content;
    writeFileSync(fullPath, content, 'utf-8');
  }
}
```

- [ ] **Step 2: Update `schema/brand/brandrc.schema.md` mode-related rows**

Currently the schema doc only mentions modes implicitly via `tier`; per the spec, document the mode enum in the brandrc YAML structure. Find the example block's `mode:` line in the example. Use the `Edit` tool.

`old_string`:
```yaml
brand: "Wendy's"
project: "rewards-app-2026"
tier: standard
```

`new_string`:
```yaml
brand: "Wendy's"
project: "rewards-app-2026"
tier: standard
mode: standard
```

(The mode field is implicit in the existing schema-doc; adding it in the example surfaces the new enum value. The full mode enum write-up lands as part of Task 6's schema-doc batch.)

- [ ] **Step 3: SKILL §5c — rename pitch disclaimer**

Use the `Edit` tool.

`old_string`:
```
### 5c. Pitch mode

If `mode: pitch` in `.brandrc.yaml`, prepend the disclaimer:

```
> ⚠️ **PITCH MODE** — derived from public sources only. Not validated against internal brand standards.
```
```

`new_string`:
```
### 5c. Public-sources-only mode

If `mode: public-sources-only` in `.brandrc.yaml`, prepend the disclaimer:

```
> ⚠️ **PUBLIC-SOURCES-ONLY MODE** — derived from public sources only. Not validated against internal brand standards.
```

(The legacy `mode: pitch` value is normalized by the brandrc loader to `public-sources-only` before this stage runs; treat them identically.)
```

- [ ] **Step 4: SKILL §6e — rename pitch disclaimer**

Use the `Edit` tool.

`old_string`:
```
### 6e. Pitch mode

In pitch mode (`mode: pitch`), prepend the disclaimer block to `overview.md`:

```markdown
> ⚠️ **PITCH MODE** — derived from public sources only. Not validated against internal brand standards.
```
```

`new_string`:
```
### 6e. Public-sources-only mode

In public-sources-only mode (`mode: public-sources-only`, or its deprecated alias `mode: pitch`), prepend the disclaimer block to `overview.md`:

```markdown
> ⚠️ **PUBLIC-SOURCES-ONLY MODE** — derived from public sources only. Not validated against internal brand standards.
```
```

- [ ] **Step 5: SKILL §8f — rename pitch handling**

Use the `Edit` tool.

`old_string`:
```
### 8f. Pitch mode

In pitch mode (`mode: pitch`), do not run the practitioner walkthrough — there's no internal access to resolve conflicts authoritatively. Instead:
- Detect conflicts as usual
- Write all detected items as `unresolved` with `Recommended resolution: pending — pitch mode (public sources only)`
- Surface the count in the Final summary so the practitioner can resolve later when client access is available
```

`new_string`:
```
### 8f. Public-sources-only mode

In public-sources-only mode (`mode: public-sources-only`, or its deprecated alias `mode: pitch`), do not run the practitioner walkthrough — there's no internal access to resolve conflicts authoritatively. Instead:
- Detect conflicts as usual
- Write all detected items as `unresolved` with `Recommended resolution: pending — public-sources-only mode (public sources only)`
- Surface the count in the Final summary so the practitioner can resolve later when internal access is available
```

- [ ] **Step 6: Add parity tests in `cli/test/unit/skill-scope-parity.test.js`**

Use the `Edit` tool. Append after the last existing test (line 69 closing).

`old_string`:
```javascript
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

`new_string`:
```javascript
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
```

- [ ] **Step 7: Run focused tests**

```bash
node --test cli/test/unit/skill-scope-parity.test.js 2>&1 | tail -5
```

Expected: `# pass 10` / `# fail 0` (was 8; now +2).

- [ ] **Step 8: Run full suite**

```bash
npm test 2>&1 | tail -5
```

Expected: 123 pass (was 121; +2).

- [ ] **Step 9: Smoke-test the alias path on the legacy `mode: pitch`**

```bash
mkdir -p /tmp/de-xd-pitch-alias && cd /tmp/de-xd-pitch-alias
cat > .brandrc.yaml <<YAML
brand: Legacy Pitch Brand
tier: minimum
mode: pitch
sources: {}
YAML
mkdir -p .brand
node "$OLDPWD/cli/bin/brand-cli.js" refresh-context 2>&1 | grep -q "deprecated" && echo "OK: pitch alias warns"
cd "$OLDPWD"
rm -rf /tmp/de-xd-pitch-alias
```

Expected: `OK: pitch alias warns`.

- [ ] **Step 10: Commit**

Write commit message to `/tmp/commit-msg-task3-de-xd.txt`:

```
refactor(mode): rename pitch -> public-sources-only

The agency-pitch label is replaced with neutral mode value across
SKILL prose (§5c, §6e, §8f) and init.js prompt list. Loader-level
alias (added in Task 2) keeps legacy `mode: pitch` brandrc files
loading; init's --mode pitch flag is preserved as a deprecated alias
that emits a one-line warning.

Tests: +2 parity tests guarding the new banner and the absence of the
legacy PITCH MODE label. Total: 121 -> 123.
```

```bash
git add cli/src/commands/init.js \
        schema/brand/brandrc.schema.md \
        brand-context/skills/brand-extract/SKILL.md \
        cli/test/unit/skill-scope-parity.test.js
git commit -F /tmp/commit-msg-task3-de-xd.txt
rm /tmp/commit-msg-task3-de-xd.txt
```

- [ ] **Step 11: Verify**

```bash
git log --oneline main..HEAD
npm test 2>&1 | tail -5
```

Expected: 5 commits ahead of main. Tests at 123/123.

---

## Task 4: Stage 6 gate — `tier == comprehensive` → `sources.design_system_repo` set

**Goal:** Decouple the design-system repo scan from the prototype-workflow tier. Stage 6 fires whenever `sources.design_system_repo` is set, regardless of tier. The init-time scaffolding under `tier: comprehensive` (workflow files) is unchanged — that's Bucket C scope.

**Files:**
- Modify: `brand-context/skills/brand-extract/SKILL.md` (Section 7 / Stage 6 gating + final-summary table edge cases)
- Modify: `schema/brand/brandrc.schema.md` (`sources.design_system_repo` description gets a sentence)
- Modify: `cli/test/unit/skill-scope-parity.test.js` (+1 test)

- [ ] **Step 1: SKILL §7 — change the gating clause**

Use the `Edit` tool. Find the Stage 6 header + gating block (around line 645).

`old_string`:
```
## 7. Stage 6 — Design-system repo scan (comprehensive tier only)

This stage runs only when **both** are true:
- `.brandrc.yaml` `tier` is `comprehensive`
- `.brandrc.yaml` `sources.design_system_repo` is set (local path or remote git URL)

If either is false, skip Stage 6 with a one-line log and move to Section 8 (design.md regen).
```

`new_string`:
```
## 7. Stage 6 — Design-system repo scan (any tier)

This stage runs when:
- `.brandrc.yaml` `sources.design_system_repo` is set (local path or remote git URL)

Tier no longer gates Stage 6. Any project that points at a design-system repo gets the inventory — `comprehensive` tier no longer carries an implicit DS-scan opt-in. If `sources.design_system_repo` is unset, skip Stage 6 with a one-line log and move to Section 8 (design.md regen).
```

- [ ] **Step 2: SKILL §0d step 5 — drop the tier gate on the DS-repo question**

Use the `Edit` tool. Find the §0d list (around line 131).

`old_string`:
```
5. **Design-system repo** — only ask if `tier == comprehensive`. Local path or remote git URL.
```

`new_string`:
```
5. **Design-system repo** — local path or remote git URL. When set, Stage 6 produces `.brand/components/*.md` regardless of tier.
```

- [ ] **Step 3: SKILL final-summary edge-case table — drop the tier-based row**

Use the `Edit` tool. Find the edge-case table (around line 972).

`old_string`:
```
| Stage 6: tier is not comprehensive | Skip silently. Note in summary. |
| Stage 6: `sources.design_system_repo` not set | Skip silently. Note in summary. |
```

`new_string`:
```
| Stage 6: `sources.design_system_repo` not set | Skip silently. Note in summary. |
```

- [ ] **Step 4: SKILL pipeline-summary line — update the gloss**

Use the `Edit` tool. Find the bottom-of-file summary block (around line 992).

`old_string`:
```
- Stage 6: Design-system repo scan → components/*.md + components/inventory.md (comprehensive tier only)
```

`new_string`:
```
- Stage 6: Design-system repo scan → components/*.md + components/inventory.md (when `sources.design_system_repo` is set, any tier)
```

- [ ] **Step 5: schema/brand/brandrc.schema.md — extend `sources.design_system_repo` description**

The current schema-doc doesn't have a `sources.design_system_repo` row (the field is referenced in SKILL but not in the schema-doc table per the read above). Use the `Edit` tool to insert a row. Find the existing `sources.live_urls` row in the table.

`old_string`:
```
| `sources.live_urls` | optional | string[] | Live product URLs for token extraction via Layout CLI |
| `sources.brand_guide` | optional | string | Path to brand guide PDF (relative to project root) |
| `sources.screenshots` | optional | string[] | Paths to brand reference screenshots |
```

`new_string`:
```
| `sources.live_urls` | optional | string[] | Live product URLs for token extraction via Layout CLI |
| `sources.brand_guide` | optional | string | Path to brand guide PDF (relative to project root) |
| `sources.screenshots` | optional | string[] | Paths to brand reference screenshots |
| `sources.design_system_repo` | optional | string | Local path or remote git URL of a design-system repo. When set, Stage 6 of `/brand-context:extract` runs and produces `.brand/components/*.md` regardless of tier. |
```

- [ ] **Step 6: Add a parity test for the new gating phrase**

Use the `Edit` tool on `cli/test/unit/skill-scope-parity.test.js`. Append after the test added in Task 3.

`old_string`:
```javascript
test('SKILL prose mentions public-sources-only mode value by name (de-XD #4)', () => {
  assert.ok(
    skill.includes('public-sources-only'),
    'SKILL.md must reference the new mode value `public-sources-only` so prose drift is caught early'
  );
});
```

`new_string`:
```javascript
test('SKILL prose mentions public-sources-only mode value by name (de-XD #4)', () => {
  assert.ok(
    skill.includes('public-sources-only'),
    'SKILL.md must reference the new mode value `public-sources-only` so prose drift is caught early'
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
});
```

- [ ] **Step 7: Run focused tests**

```bash
node --test cli/test/unit/skill-scope-parity.test.js 2>&1 | tail -5
```

Expected: `# pass 11` / `# fail 0` (was 10; now +1).

- [ ] **Step 8: Run full suite**

```bash
npm test 2>&1 | tail -5
```

Expected: 124 pass (was 123; +1).

- [ ] **Step 9: Commit**

Write commit message to `/tmp/commit-msg-task4-de-xd.txt`:

```
skill(stage-6): decouple DS-repo scan from comprehensive tier

Stage 6 now fires whenever sources.design_system_repo is set, regardless
of tier. Closes XD-inventory #3 + #7: the previous gate forced practitioners
to opt into the prototype-workflow tier just to get the component scan.
Init-time scaffolding under tier: comprehensive (workflow files) is
unchanged — that's Bucket C scope.

Schema-doc row added for sources.design_system_repo with the new
gating note. Parity test guards against the legacy "(comprehensive
tier only)" phrase reappearing.

Tests: +1 parity. Total: 123 -> 124.
```

```bash
git add brand-context/skills/brand-extract/SKILL.md \
        schema/brand/brandrc.schema.md \
        cli/test/unit/skill-scope-parity.test.js
git commit -F /tmp/commit-msg-task4-de-xd.txt
rm /tmp/commit-msg-task4-de-xd.txt
```

- [ ] **Step 10: Verify**

```bash
git log --oneline main..HEAD
npm test 2>&1 | tail -5
```

Expected: 6 commits ahead of main. Tests at 124/124.

---

## Task 5: `--impeccable` → `--also-write <path>` + brandrc `outputs:` field

**Goal:** Generalize `--impeccable` (XD-internal-first) into a neutral `--also-write <path>` repeatable flag plus a declarative `outputs: [path, ...]` brandrc field. `--impeccable` is preserved as an alias that resolves to `--also-write .impeccable.md` and emits a one-line deprecation. Schema-doc reframes Impeccable as one of many AI-agent context-gathering protocols.

**Files:**
- Modify: `cli/src/commands/refresh-context.js` (read `outputs`, merge with `--also-write`, alias `--impeccable`)
- Modify: `cli/bin/brand-cli.js` (add `--also-write` repeatable; keep `--impeccable`)
- Modify: `schema/brand/brandrc.schema.md` (add `outputs` row)
- Modify: `schema/brand/overview.schema.md` (reframe Impeccable references)
- Create: `cli/test/unit/refresh-context-outputs.test.js` (3 tests)

- [ ] **Step 1: Add `--also-write` collector to `cli/bin/brand-cli.js`**

Use the `Edit` tool. Find the `refresh-context` command definition.

`old_string`:
```javascript
  .description('Regenerate brand.md (and optionally .impeccable.md) at project root from .brand/')
  .option('--impeccable', 'Also write .impeccable.md (same content as brand.md, Impeccable-conventional filename)')
```

`new_string`:
```javascript
  .description('Regenerate brand.md at project root from .brand/, optionally mirroring to additional paths')
  .option('--also-write <path>', 'Mirror brand.md to an additional path (repeatable)', collectAlsoWrite, [])
  .option('--impeccable', 'Deprecated alias of --also-write .impeccable.md; will be removed in 2.0')
```

Then add the `collectAlsoWrite` helper at the top of the file (after the imports, before the first `.command(...)` chain). Find an existing helper for context — if none, insert after the imports block:

```javascript
function collectAlsoWrite(value, previous) {
  return previous.concat([value]);
}
```

(If a similar collector helper already exists in `brand-cli.js` from a prior change, reuse it instead of adding a duplicate. Verify with `grep -n 'function collect' cli/bin/brand-cli.js` first.)

- [ ] **Step 2: Wire the outputs list into `refresh-context.js`**

Use the `Edit` tool. Find the existing outputs block (whose surrounding code was changed in Task 2 Step 7).

`old_string`:
```javascript
  const content = generateBrandContext(brandDir, brand);
  const outputs = [join(projectDir, 'brand.md')];

  if (opts.impeccable) {
    outputs.push(join(projectDir, '.impeccable.md'));
  }

  for (const outPath of outputs) {
    writeFileSync(outPath, content, 'utf-8');
    console.log(chalk.green(`✓ ${outPath.replace(projectDir + '/', '')} regenerated from ${brandDir.replace(projectDir + '/', '')}`));
  }
```

`new_string`:
```javascript
  const content = generateBrandContext(brandDir, brand);

  // Build the output list: brand.md is always written. Then merge:
  //  1. brandrc `outputs: [path, ...]` (relative paths resolved from projectDir)
  //  2. CLI `--also-write <path>` flag (repeatable)
  //  3. `--impeccable` alias (resolves to .impeccable.md + deprecation warning)
  // Dedup by absolute path so the same path passed twice writes once.
  const extraOutputs = new Set();

  if (Array.isArray(cfg.outputs)) {
    for (const p of cfg.outputs) {
      if (typeof p === 'string' && p.length > 0) extraOutputs.add(resolve(projectDir, p));
    }
  }

  if (Array.isArray(opts.alsoWrite)) {
    for (const p of opts.alsoWrite) extraOutputs.add(resolve(projectDir, p));
  }

  if (opts.impeccable) {
    warnDeprecated(
      'cli.refresh-context.impeccable',
      '--impeccable is deprecated; use --also-write .impeccable.md instead. The alias is read but will be removed in 2.0.'
    );
    extraOutputs.add(resolve(projectDir, '.impeccable.md'));
  }

  const outputs = [join(projectDir, 'brand.md'), ...extraOutputs];

  for (const outPath of outputs) {
    writeFileSync(outPath, content, 'utf-8');
    console.log(chalk.green(`✓ ${outPath.replace(projectDir + '/', '')} regenerated from ${brandDir.replace(projectDir + '/', '')}`));
  }
```

Then ensure the import block at the top of `refresh-context.js` includes `warnDeprecated`:

`old_string`:
```javascript
import { existsSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import chalk from 'chalk';
import { generateBrandContext } from '../utils/brand-context-generator.js';
import { loadBrandrc } from '../utils/brandrc-loader.js';
```

`new_string`:
```javascript
import { existsSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import chalk from 'chalk';
import { generateBrandContext } from '../utils/brand-context-generator.js';
import { loadBrandrc } from '../utils/brandrc-loader.js';
import { warnDeprecated } from '../utils/deprecations.js';
```

- [ ] **Step 3: Add `outputs` row to `schema/brand/brandrc.schema.md`**

Use the `Edit` tool. Insert above the `### Tool Configuration (optional)` section.

`old_string`:
```
| `sources.design_system_repo` | optional | string | Local path or remote git URL of a design-system repo. When set, Stage 6 of `/brand-context:extract` runs and produces `.brand/components/*.md` regardless of tier. |

### Tool Configuration (optional)
```

`new_string`:
```
| `sources.design_system_repo` | optional | string | Local path or remote git URL of a design-system repo. When set, Stage 6 of `/brand-context:extract` runs and produces `.brand/components/*.md` regardless of tier. |

### Outputs (optional)

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| `outputs` | optional | string[] | Additional paths to mirror `brand.md` into when `brand-cli refresh-context` runs. Each entry is a path relative to project root. Equivalent to passing `--also-write <path>` for each entry; flag and field are merged and deduplicated. |

### Tool Configuration (optional)
```

- [ ] **Step 4: Reframe Impeccable references in `schema/brand/overview.schema.md`**

Use the `Edit` tool. Two edits.

**Edit A** — `Auto-generates` line.

`old_string`:
```
**Auto-generates:** `.impeccable.md` in project root (for Impeccable skill brand context)
```

`new_string`:
```
**Mirrored by `brand-cli refresh-context`** — the same content as `brand.md` is mirrored into any paths declared in `.brandrc.yaml` `outputs:` or passed via `--also-write <path>`. Common targets include `.impeccable.md` (Impeccable), `.cursor/rules/brand.md` (Cursor), and `.github/copilot-instructions.md` (Copilot).
```

**Edit B** — `Used by Impeccable's context gathering protocol` line.

`old_string`:
```
| `Key use cases` | optional | Primary tasks users perform — the jobs they're trying to get done (e.g., "order food for pickup", "check loyalty points", "browse the menu"). Used by Impeccable's context gathering protocol. |
```

`new_string`:
```
| `Key use cases` | optional | Primary tasks users perform — the jobs they're trying to get done (e.g., "order food for pickup", "check loyalty points", "browse the menu"). Used by AI-agent context-gathering protocols (Impeccable, Cursor, Copilot, etc.). |
```

- [ ] **Step 5: Create `cli/test/unit/refresh-context-outputs.test.js`**

Use the `Write` tool:

```javascript
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { _resetWarnedKeysForTesting } from '../../src/utils/deprecations.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const CLI_BIN = resolve(__dirname, '../../bin/brand-cli.js');

function mkProject(name, brandrcContent) {
  const dir = join(tmpdir(), `refresh-ctx-test-${name}-${process.pid}`);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(join(dir, '.brand'), { recursive: true });
  writeFileSync(join(dir, '.brand', 'overview.md'), '# Overview\n\nseed.', 'utf-8');
  writeFileSync(join(dir, '.brandrc.yaml'), brandrcContent, 'utf-8');
  return dir;
}

function runRefresh(dir, args = []) {
  return execFileSync('node', [CLI_BIN, 'refresh-context', ...args], {
    cwd: dir,
    stdio: ['ignore', 'pipe', 'pipe'],
    encoding: 'utf-8',
  });
}

beforeEach(() => {
  _resetWarnedKeysForTesting();
});

test('refresh-context: --also-write writes a mirror file (de-XD #6)', () => {
  const dir = mkProject('also-write', 'brand: ACME\ntier: standard\nmode: standard\n');
  try {
    runRefresh(dir, ['--also-write', './mirror.md']);
    assert.ok(existsSync(join(dir, 'brand.md')), 'brand.md should be written');
    assert.ok(existsSync(join(dir, 'mirror.md')), '--also-write target should be written');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('refresh-context: outputs: [path] in brandrc produces the same result as --also-write (de-XD #6)', () => {
  const dir = mkProject('outputs-field', 'brand: ACME\ntier: standard\nmode: standard\noutputs:\n  - .impeccable.md\n');
  try {
    runRefresh(dir);
    assert.ok(existsSync(join(dir, 'brand.md')), 'brand.md should be written');
    assert.ok(existsSync(join(dir, '.impeccable.md')), 'outputs[0] target should be written');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('refresh-context: --impeccable writes .impeccable.md and warns (de-XD #6 alias)', () => {
  const dir = mkProject('impeccable-alias', 'brand: ACME\ntier: standard\nmode: standard\n');
  try {
    let stderr = '';
    try {
      execFileSync('node', [CLI_BIN, 'refresh-context', '--impeccable'], {
        cwd: dir,
        stdio: ['ignore', 'pipe', 'pipe'],
        encoding: 'utf-8',
      });
    } catch (err) {
      stderr = err.stderr ?? '';
      throw err;
    }
    // exec succeeded — capture stderr via execFileSync's options instead. (Fall back: re-run.)
    const result = execFileSync('node', [CLI_BIN, 'refresh-context', '--impeccable'], {
      cwd: dir,
      stdio: ['ignore', 'pipe', 'pipe'],
      encoding: 'utf-8',
    });
    assert.ok(existsSync(join(dir, '.impeccable.md')), '.impeccable.md should be written by alias path');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
```

(Note: deprecation warnings go to `stderr` via chalk-yellow; the test confirms file presence, which is the user-visible contract. Stderr-warning capture is verified by the brandrc-loader unit tests already.)

- [ ] **Step 6: Run focused tests**

```bash
node --test cli/test/unit/refresh-context-outputs.test.js 2>&1 | tail -10
```

Expected: `# pass 3` / `# fail 0`.

- [ ] **Step 7: Run full suite**

```bash
npm test 2>&1 | tail -5
```

Expected: 127 pass (was 124; +3).

- [ ] **Step 8: Commit**

Write commit message to `/tmp/commit-msg-task5-de-xd.txt`:

```
feat(refresh-context): generalize --impeccable to --also-write + outputs

Replaces the XD-internal-first --impeccable flag with a neutral
--also-write <path> (repeatable) and a declarative outputs: [path]
brandrc field. Both merge into a single dedup'd list of mirror targets.
--impeccable is preserved as a deprecated alias that resolves to
--also-write .impeccable.md and warns once.

Schema-doc adds the outputs row. overview.schema.md reframes the
Impeccable-specific references to neutral "AI-agent context-gathering
protocols" language.

Tests: +3 in cli/test/unit/refresh-context-outputs.test.js.
Total: 124 -> 127.
```

```bash
git add cli/src/commands/refresh-context.js \
        cli/bin/brand-cli.js \
        schema/brand/brandrc.schema.md \
        schema/brand/overview.schema.md \
        cli/test/unit/refresh-context-outputs.test.js
git commit -F /tmp/commit-msg-task5-de-xd.txt
rm /tmp/commit-msg-task5-de-xd.txt
```

- [ ] **Step 9: Verify**

```bash
git log --oneline main..HEAD
npm test 2>&1 | tail -5
```

Expected: 7 commits ahead of main. Tests at 127/127.

---

## Task 6: Schema-doc cleanup batch + `sources.asset_dir` configurable

**Goal:** Four small schema-doc edits batched: (a) `tools.agent` opens to free-form string with suggested values; (b) `extensions` row dropped; (c) `tools.storybook` row dropped; (d) `sources.asset_dir` row added with init-flag + SKILL prose support. The loader behavior for the dropped fields was already wired in Task 2; this task is mostly schema-doc + init flag + SKILL prose.

**Files:**
- Modify: `schema/brand/brandrc.schema.md` (4 row changes + example update)
- Modify: `cli/src/commands/init.js` (`--asset-dir` flag, asset directory creation)
- Modify: `cli/bin/brand-cli.js` (`--asset-dir` option on init)
- Modify: `brand-context/skills/brand-extract/SKILL.md` (§0b asset-dir override prose)
- Modify: `cli/test/unit/skill-scope-parity.test.js` (+1 test)

- [ ] **Step 1: schema/brand/brandrc.schema.md — `tools.agent` enum to string**

Use the `Edit` tool.

`old_string`:
```
| `tools.agent` | optional | enum | Primary agent tool: `claude-code`, `cursor`, `vscode-copilot`, `codex`, `gemini` |
| `tools.storybook` | optional | boolean | Whether this project uses Storybook |
```

`new_string`:
```
| `tools.agent` | optional | string | Primary agent tool. Free-form. Common values: `claude-code`, `cursor`, `vscode-copilot`, `codex`, `gemini`, `cline`, `aider`, `other`. |
```

- [ ] **Step 2: schema/brand/brandrc.schema.md — drop the `extensions` row + example block**

Use the `Edit` tool. Two edits.

**Edit A** — drop the row.

`old_string`:
```

### Extensions (optional)

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| `extensions` | optional | string[] | Active extensions: `ds-pack`, `ux-design-skills` |

```

`new_string`:
```

```

**Edit B** — drop the example trailing lines.

`old_string`:
```yaml
tools:
  agent: claude-code
  storybook: true

extensions:
  - ds-pack
```

`new_string`:
```yaml
tools:
  agent: claude-code
```

- [ ] **Step 3: schema/brand/brandrc.schema.md — add `sources.asset_dir` row**

Use the `Edit` tool. Find the existing `sources.screenshots` row and insert above `sources.design_system_repo`.

`old_string`:
```
| `sources.screenshots` | optional | string[] | Paths to brand reference screenshots |
| `sources.design_system_repo` | optional | string | Local path or remote git URL of a design-system repo. When set, Stage 6 of `/brand-context:extract` runs and produces `.brand/components/*.md` regardless of tier. |
```

`new_string`:
```
| `sources.screenshots` | optional | string[] | Paths to brand reference screenshots |
| `sources.asset_dir` | optional | string | Directory scanned for brand assets (PDFs, screenshots, DTCG token files). Defaults to `./assets`. When set, the SKILL's Stage 0 asset scan honors this path before falling back to legacy alternatives. |
| `sources.design_system_repo` | optional | string | Local path or remote git URL of a design-system repo. When set, Stage 6 of `/brand-context:extract` runs and produces `.brand/components/*.md` regardless of tier. |
```

- [ ] **Step 4: cli/bin/brand-cli.js — add `--asset-dir` to `init`**

Use the `Edit` tool. Find the `init` command's `--client` line (now alongside `--brand`).

`old_string`:
```javascript
  .description('Scaffold a new project: .brand/, .brandrc.yaml, brand.md, design.md')
  .option('--brand <name>', 'Brand name (non-interactive when set)')
  .option('--client <name>', 'Deprecated alias of --brand; will be removed in 2.0')
```

`new_string`:
```javascript
  .description('Scaffold a new project: .brand/, .brandrc.yaml, brand.md, design.md')
  .option('--brand <name>', 'Brand name (non-interactive when set)')
  .option('--client <name>', 'Deprecated alias of --brand; will be removed in 2.0')
  .option('--asset-dir <path>', 'Directory to create for brand assets (default: ./assets)')
```

- [ ] **Step 5: cli/src/commands/init.js — honor `--asset-dir`**

Use the `Edit` tool. Find the `assets/` directory creation block.

`old_string`:
```javascript
  // 5. assets/ directory with a brief README so practitioners know where to drop files
  const assetsDir = join(projectDir, 'assets');
  if (!existsSync(assetsDir)) {
    mkdirSync(assetsDir, { recursive: true });
    writeFileSync(
      join(assetsDir, 'README.md'),
      [
        '# Brand assets',
        '',
        'Drop client brand assets here — `/brand-context:extract` (in Claude Code) will discover and use them automatically.',
        '',
        '**Supported:**',
        '- `.pdf` — brand guides, style guides, voice docs',
        '- `.png` / `.jpg` / `.jpeg` / `.webp` / `.gif` — reference screenshots',
        '- `.svg` — logos, hero assets',
        '',
        '**Not directly readable** (export to PDF first):',
        '- `.docx` / `.pptx` / `.key` / `.numbers`',
        '',
        'You don\'t need to edit `.brandrc.yaml` by hand — the skill scans this directory, classifies what it finds, and asks you to confirm before extracting.',
        '',
      ].join('\n'),
      'utf-8'
    );
    console.log(chalk.green('✓ assets/ (drop brand files here)'));
    results.created.push('assets/');
  }
```

`new_string`:
```javascript
  // 5. asset directory (default ./assets, override via --asset-dir or sources.asset_dir).
  // Records the chosen path on .brandrc.yaml's sources.asset_dir so the SKILL's Stage 0
  // scan honors the override on subsequent runs.
  const assetDirRel = opts.assetDir || 'assets';
  const assetsDir = join(projectDir, assetDirRel);
  if (!existsSync(assetsDir)) {
    mkdirSync(assetsDir, { recursive: true });
    writeFileSync(
      join(assetsDir, 'README.md'),
      [
        '# Brand assets',
        '',
        'Drop brand assets here — `/brand-context:extract` (in Claude Code) will discover and use them automatically.',
        '',
        '**Supported:**',
        '- `.pdf` — brand guides, style guides, voice docs',
        '- `.png` / `.jpg` / `.jpeg` / `.webp` / `.gif` — reference screenshots',
        '- `.svg` — logos, hero assets',
        '',
        '**Not directly readable** (export to PDF first):',
        '- `.docx` / `.pptx` / `.key` / `.numbers`',
        '',
        "You don't need to edit `.brandrc.yaml` by hand — the skill scans this directory, classifies what it finds, and asks you to confirm before extracting.",
        '',
      ].join('\n'),
      'utf-8'
    );
    console.log(chalk.green(`✓ ${assetDirRel}/ (drop brand files here)`));
    results.created.push(`${assetDirRel}/`);
  }
  if (assetDirRel !== 'assets') {
    // Persist the override into sources.asset_dir so subsequent SKILL runs honor it.
    brandrc.sources.asset_dir = assetDirRel;
    writeFileSync(join(projectDir, '.brandrc.yaml'), yamlStringify(brandrc), 'utf-8');
  }
```

Then update the "Next steps" log to use `assetDirRel`:

`old_string`:
```javascript
  console.log(`  1. Drop brand assets (PDFs, screenshots, logos) into ${chalk.cyan('./assets/')}`);
```

`new_string`:
```javascript
  console.log(`  1. Drop brand assets (PDFs, screenshots, logos) into ${chalk.cyan(`./${assetDirRel}/`)}`);
```

- [ ] **Step 6: brand-context/skills/brand-extract/SKILL.md — §0b asset-dir override**

Use the `Edit` tool. Find the §0b asset-scan list.

`old_string`:
```
### 0b. Scan the project for asset files

Look for assets the practitioner may have dropped into the project. Check these directories in order; use whichever exists:
- `./assets/`
- `./brand-assets/`
- `./.brand-assets/`
- `./inputs/`
- `./sources/`
- Project root (loose files only — be selective; ignore obvious code/config/dotfiles)
```

`new_string`:
```
### 0b. Scan the project for asset files

Look for assets the practitioner may have dropped into the project. The scan order:

1. **`sources.asset_dir`** from `.brandrc.yaml` if set (e.g. `./brand-inputs/`).
2. **`./assets/`** — the default scaffold path.
3. **Legacy fallbacks** — checked only when neither (1) nor (2) yields any assets:
   - `./brand-assets/`
   - `./.brand-assets/`
   - `./inputs/`
   - `./sources/`
   - Project root (loose files only — be selective; ignore obvious code/config/dotfiles)

When `sources.asset_dir` is set, prefer it for the "drop your assets here" prompt and any rescan loops. The legacy fallback list is preserved for projects that never ran `brand-cli init` and have assets sitting in older conventional locations.
```

- [ ] **Step 7: Add a parity test for the asset_dir override prose**

Use the `Edit` tool on `cli/test/unit/skill-scope-parity.test.js`. Append after the Stage 6 test from Task 4.

`old_string`:
```javascript
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
});
```

`new_string`:
```javascript
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
});

test('SKILL §0b honors sources.asset_dir override (de-XD #14)', () => {
  // The Stage 0b scan must reference sources.asset_dir as the primary scan target.
  assert.ok(
    skill.includes('sources.asset_dir'),
    'SKILL.md §0b must reference sources.asset_dir as the override path for the asset scan'
  );
});
```

- [ ] **Step 8: Run focused tests**

```bash
node --test cli/test/unit/skill-scope-parity.test.js 2>&1 | tail -5
```

Expected: `# pass 12` / `# fail 0` (was 11; now +1).

- [ ] **Step 9: Run full suite**

```bash
npm test 2>&1 | tail -5
```

Expected: 128 pass (was 127; +1).

- [ ] **Step 10: Smoke-test `init --asset-dir`**

```bash
mkdir -p /tmp/de-xd-asset-dir && cd /tmp/de-xd-asset-dir
node "$OLDPWD/cli/bin/brand-cli.js" init --brand temp --mode standard --asset-dir ./brand-inputs --force >/dev/null 2>&1
[ -d ./brand-inputs ] && echo "OK: brand-inputs created"
grep -q "asset_dir: brand-inputs" .brandrc.yaml && echo "OK: asset_dir persisted in brandrc"
cd "$OLDPWD"
rm -rf /tmp/de-xd-asset-dir
```

Expected: `OK: brand-inputs created` and `OK: asset_dir persisted in brandrc`.

- [ ] **Step 11: Smoke-test legacy `extensions:` field is silently dropped**

```bash
mkdir -p /tmp/de-xd-ext && cd /tmp/de-xd-ext
mkdir -p .brand
cat > .brandrc.yaml <<YAML
brand: ACME
tier: standard
mode: standard
sources: {}
extensions:
  - ds-pack
YAML
node "$OLDPWD/cli/bin/brand-cli.js" refresh-context 2>&1 | grep -q "extensions" && echo "OK: extensions warning fired"
cd "$OLDPWD"
rm -rf /tmp/de-xd-ext
```

Expected: `OK: extensions warning fired`.

- [ ] **Step 12: Commit**

Write commit message to `/tmp/commit-msg-task6-de-xd.txt`:

```
schema: cleanup batch + sources.asset_dir configurable

Four small schema-doc edits batched (closes XD-inventory #10, #12, #14, #18):
- tools.agent: enum -> free-form string with suggested values
- extensions: row removed (no extension contract ever shipped)
- tools.storybook: row removed (was never functional)
- sources.asset_dir: row added; init --asset-dir flag persists the override

The brandrc-loader (Task 2) already drops/warns on extensions and silently
drops tools.storybook. SKILL §0b prose updated to honor the asset_dir
override before falling back to legacy paths.

Tests: +1 parity for the asset_dir override prose. Total: 127 -> 128.
```

```bash
git add schema/brand/brandrc.schema.md \
        cli/src/commands/init.js \
        cli/bin/brand-cli.js \
        brand-context/skills/brand-extract/SKILL.md \
        cli/test/unit/skill-scope-parity.test.js
git commit -F /tmp/commit-msg-task6-de-xd.txt
rm /tmp/commit-msg-task6-de-xd.txt
```

- [ ] **Step 13: Verify**

```bash
git log --oneline main..HEAD
npm test 2>&1 | tail -5
```

Expected: 8 commits ahead of main. Tests at 128/128.

---

## Task 7: Repo docs propagation + final verification + cross-branch code review

**Goal:** Surface the renames in user-facing docs (README, xd-assumption-inventory close-outs, tasks.md state). Run a final smoke test end-to-end. Dispatch a cross-branch code-reviewer subagent. Hand off via `superpowers:finishing-a-development-branch`. Version bump (v0.5.0) is deferred to a separate post-merge release commit per CLAUDE.md "Versioning + release."

**Files:**
- Modify: `README.md` (quick-start `--client` → `--brand` with alias note; impeccable interop wording)
- Modify: `docs/xd-assumption-inventory.md` (cross-link items #2/#3/#4/#6/#7/#10/#12/#14/#18 to "Closed in `feat/de-xd-cleanup`")
- Modify: `docs/tasks.md` (Last updated line; in-flight notation)
- Modify: `docs/superpowers/plans/2026-06-16-de-xd-cleanup-progress.md` (final state)

- [ ] **Step 1: Update `README.md` quick-start example**

Use the `Edit` tool. Find the quick-start command + example.

`old_string`:
```
mkdir my-client && cd my-client
brand-cli init --client "ACME Corp"
```

`new_string`:
```
mkdir my-brand && cd my-brand
brand-cli init --brand "ACME Corp"  # `--client` is accepted as a deprecated alias
```

Then update the example brandrc snippet:

`old_string`:
```
client: ACME Corp
tier: standard
```

`new_string`:
```
brand: ACME Corp
tier: standard
```

- [ ] **Step 2: Reframe Impeccable interop wording**

Use the `Edit` tool.

`old_string`:
```
- **Impeccable interop.** If you use [Impeccable](https://github.com/pbakaus/impeccable), pass `--impeccable` to `brand-cli refresh-context` and the same content is mirrored to `.impeccable.md`.
```

`new_string`:
```
- **AI-agent context-gathering interop.** Mirror `brand.md` to additional paths via `brand-cli refresh-context --also-write <path>` (repeatable) or by listing them under `outputs: [path, ...]` in `.brandrc.yaml`. Common targets: `.impeccable.md` ([Impeccable](https://github.com/pbakaus/impeccable)), `.cursor/rules/brand.md` (Cursor), `.github/copilot-instructions.md` (Copilot). The legacy `--impeccable` flag is preserved as a deprecated alias of `--also-write .impeccable.md`.
```

- [ ] **Step 3: Update `docs/xd-assumption-inventory.md` close-outs**

Use the `Edit` tool. Append a "Status" line to each closed finding. Closed by this branch: #2, #3, #4, #6, #7, #10, #12, #14, #18.

For each finding, locate the `**Disruption to loosen:**` line (the last bold line) and append a new line below. **Repeat the same edit pattern nine times**, once per finding ID. Verbatim insertion:

For finding #2:

`old_string`:
```
**Disruption to loosen:** **Small.** Rename to `brand` (already what `brandName` is called in the generator). Make `init` accept the directory name as default. Frame the field as "the brand this package describes" instead of "client name." No structural change.
```

`new_string`:
```
**Disruption to loosen:** **Small.** Rename to `brand` (already what `brandName` is called in the generator). Make `init` accept the directory name as default. Frame the field as "the brand this package describes" instead of "client name." No structural change.

**Status:** Closed in `feat/de-xd-cleanup`. `client` accepted as a deprecated alias; manifest schema retains `client` as the persisted artifact field name (see [D0] in the de-XD progress doc).
```

For finding #3:

`old_string`:
```
**Disruption to loosen:** **Medium.** Decouple the two axes. Either: (a) introduce an "extensions" model where `xd-prototype-workflow` is one extension and the base tiers stay focused on brand knowledge, or (b) reorder tiers so the DS-repo scan moves to `standard` and `comprehensive` becomes purely the prototype-workflow extension.
```

`new_string`:
```
**Disruption to loosen:** **Medium.** Decouple the two axes. Either: (a) introduce an "extensions" model where `xd-prototype-workflow` is one extension and the base tiers stay focused on brand knowledge, or (b) reorder tiers so the DS-repo scan moves to `standard` and `comprehensive` becomes purely the prototype-workflow extension.

**Status:** Partially closed in `feat/de-xd-cleanup` — Stage 6 gate decoupled from tier (#7 below). The architectural rethink of the `comprehensive` tier itself is deferred to Bucket C / post-1.0.
```

For finding #4:

`old_string`:
```
**Disruption to loosen:** **Small.** Rename `mode: pitch` to `mode: public-sources-only` (or similar — `public`, `external`). Capability is unchanged. Disclaimer text updated. Probably worth keeping `pitch` as an alias for backward compat with xd-toolkit users.
```

`new_string`:
```
**Disruption to loosen:** **Small.** Rename `mode: pitch` to `mode: public-sources-only` (or similar — `public`, `external`). Capability is unchanged. Disclaimer text updated. Probably worth keeping `pitch` as an alias for backward compat with xd-toolkit users.

**Status:** Closed in `feat/de-xd-cleanup`. Loader-level alias keeps legacy `mode: pitch` brandrc files loading; SKILL §5c, §6e, §8f banner reworded to PUBLIC-SOURCES-ONLY MODE.
```

For finding #6:

`old_string`:
```
**Disruption to loosen:** **Medium.** Generalize to `--also-write <path>` or a `[outputs]` section in `.brandrc.yaml` listing additional files to mirror `brand.md` into. Keep `--impeccable` as a convenience alias. Schema files referencing Impeccable as an authoritative consumer should be reframed neutrally (`Used by AI agent context-gathering protocols`).
```

`new_string`:
```
**Disruption to loosen:** **Medium.** Generalize to `--also-write <path>` or a `[outputs]` section in `.brandrc.yaml` listing additional files to mirror `brand.md` into. Keep `--impeccable` as a convenience alias. Schema files referencing Impeccable as an authoritative consumer should be reframed neutrally (`Used by AI agent context-gathering protocols`).

**Status:** Closed in `feat/de-xd-cleanup`. `--also-write <path>` (repeatable) + `outputs: [path]` brandrc field replace the bespoke flag; `--impeccable` retained as a deprecated alias.
```

For finding #7:

`old_string`:
```
**Disruption to loosen:** **Medium.** Decouple Stage 6 from the tier gate. Make it conditional on `sources.design_system_repo` being set, not on `tier == comprehensive`. A user can then opt into the DS scan without opting into the prototype workflows. Pairs naturally with finding #3.
```

`new_string`:
```
**Disruption to loosen:** **Medium.** Decouple Stage 6 from the tier gate. Make it conditional on `sources.design_system_repo` being set, not on `tier == comprehensive`. A user can then opt into the DS scan without opting into the prototype workflows. Pairs naturally with finding #3.

**Status:** Closed in `feat/de-xd-cleanup`. SKILL §7 header now reads "(any tier)"; the `tier == comprehensive` gating clause is dropped from §0d, §7, the final-summary edge-case table, and the pipeline-summary line.
```

For finding #10:

`old_string`:
```
**Disruption to loosen:** **Small.** Open the enum — change `enum` to `string` with the list as suggested values. Or drop `tools.agent` entirely; nothing in the codebase appears to read it.
```

`new_string`:
```
**Disruption to loosen:** **Small.** Open the enum — change `enum` to `string` with the list as suggested values. Or drop `tools.agent` entirely; nothing in the codebase appears to read it.

**Status:** Closed in `feat/de-xd-cleanup`. `tools.agent` opens to free-form string; suggested values include `cline`, `aider`, and `other`.
```

For finding #12:

`old_string`:
```
**Disruption to loosen:** **Medium.** Document an extension contract (what an extension can register, where it gets read) — or remove the field until the contract exists. Closed enums without an extension mechanism are worse than no field at all.
```

`new_string`:
```
**Disruption to loosen:** **Medium.** Document an extension contract (what an extension can register, where it gets read) — or remove the field until the contract exists. Closed enums without an extension mechanism are worse than no field at all.

**Status:** Closed in `feat/de-xd-cleanup`. `extensions` field removed; loader silently drops it from legacy brandrc files with a one-line warning. Re-introduced in a future minor when an extension contract ships.
```

For finding #14:

`old_string`:
```
**Disruption to loosen:** **Small.** Allow `.brandrc.yaml` `sources.asset_dir` to override the default. SKILL respects it; init creates only the configured directory.
```

`new_string`:
```
**Disruption to loosen:** **Small.** Allow `.brandrc.yaml` `sources.asset_dir` to override the default. SKILL respects it; init creates only the configured directory.

**Status:** Closed in `feat/de-xd-cleanup`. `sources.asset_dir` row added to brandrc schema; `brand-cli init --asset-dir <path>` persists the override; SKILL §0b honors it before falling back to legacy paths.
```

For finding #18:

`old_string`:
```
**Disruption to loosen:** **Small.** Drop or wire up.
```

`new_string`:
```
**Disruption to loosen:** **Small.** Drop or wire up.

**Status:** Closed in `feat/de-xd-cleanup`. `tools.storybook` row removed from brandrc schema; loader silently drops it from legacy brandrc files.
```

- [ ] **Step 4: Update `docs/tasks.md` "Last updated" line**

Use the `Edit` tool.

`old_string`:
```
**Last updated:** 2026-06-16 — De-XD cleanup brainstorm complete; spec committed on `feat/de-xd-cleanup`; **plan-writing paused mid-session due to recurring API errors**, will resume in fresh session. Earlier today: C9 resolved (scope-loader pattern unification); #8 closed as won't-do (Token Press canonical DTCG producer).
```

`new_string`:
```
**Last updated:** 2026-06-17 — De-XD cleanup (Bucket A) ready for merge on `feat/de-xd-cleanup`; closes XD-inventory items #2, #3, #4, #6, #7, #10, #12, #14, #18 and unblocks 1.0 release. Final move to Completed lands in the post-merge cleanup commit per #4 precedent.
```

Then update the Active backlog entry to reflect ready-for-merge state.

`old_string`:
```
#### De-XD cleanup (Bucket A — pre-1.0 contract residue)
**Status:** spec committed (`25e3300`); plan-writing **paused** mid-session due to recurring API errors. Resume by reading [`docs/superpowers/plans/2026-06-16-de-xd-cleanup-progress.md`](superpowers/plans/2026-06-16-de-xd-cleanup-progress.md) "Resume from here" section. All brainstorm decisions locked in that progress doc — no re-litigation needed.

Closes XD-inventory items #2, #3, #4, #6, #7, #10, #12, #14, #18 on land. Unblocks 1.0 release.

Spec: [2026-06-16-de-xd-cleanup-design.md](superpowers/specs/2026-06-16-de-xd-cleanup-design.md).
```

`new_string`:
```
#### De-XD cleanup (Bucket A — pre-1.0 contract residue)
**Status:** ready for merge on `feat/de-xd-cleanup`. Plan: [`docs/superpowers/plans/2026-06-16-de-xd-cleanup.md`](superpowers/plans/2026-06-16-de-xd-cleanup.md). Spec: [2026-06-16-de-xd-cleanup-design.md](superpowers/specs/2026-06-16-de-xd-cleanup-design.md).

Closes XD-inventory items #2, #3, #4, #6, #7, #10, #12, #14, #18 on land. Unblocks 1.0 release. Final move to Completed lands in the post-merge cleanup commit per #4 precedent.
```

- [ ] **Step 5: Run the full test suite**

```bash
npm test 2>&1 | tail -10
```

Expected: 128 pass, 0 fail.

- [ ] **Step 6: End-to-end smoke test**

Walk a representative flow: scaffold a project with `--brand` + `--asset-dir`, hand-add `outputs:` to brandrc, run `refresh-context`, verify the mirror file appears.

```bash
mkdir -p /tmp/de-xd-final-smoke && cd /tmp/de-xd-final-smoke
node "$OLDPWD/cli/bin/brand-cli.js" init \
  --brand "Final Smoke" \
  --mode public-sources-only \
  --asset-dir ./inputs \
  --force >/dev/null 2>&1

grep -q "^brand: Final Smoke" .brandrc.yaml && echo "OK: brand field"
grep -q "mode: public-sources-only" .brandrc.yaml && echo "OK: public-sources-only mode"
grep -q "asset_dir: inputs" .brandrc.yaml && echo "OK: asset_dir persisted"
[ -d ./inputs ] && echo "OK: inputs/ directory created"

# Add outputs: to brandrc and re-run refresh-context
node --input-type=module -e "
import { readFileSync, writeFileSync } from 'node:fs';
import { parse, stringify } from 'yaml';
const cfg = parse(readFileSync('.brandrc.yaml', 'utf-8'));
cfg.outputs = ['./mirror.md', '.cursor-brand.md'];
writeFileSync('.brandrc.yaml', stringify(cfg), 'utf-8');
"

node "$OLDPWD/cli/bin/brand-cli.js" refresh-context >/dev/null 2>&1
[ -f ./mirror.md ] && echo "OK: outputs[0] mirror written"
[ -f ./.cursor-brand.md ] && echo "OK: outputs[1] mirror written"

# Test --also-write merging with brandrc outputs
node "$OLDPWD/cli/bin/brand-cli.js" refresh-context --also-write ./extra.md >/dev/null 2>&1
[ -f ./extra.md ] && echo "OK: --also-write flag honored alongside brandrc outputs"

# Test --impeccable alias still works + warns
node "$OLDPWD/cli/bin/brand-cli.js" refresh-context --impeccable 2>&1 | grep -q "deprecated" && echo "OK: --impeccable warns"
[ -f ./.impeccable.md ] && echo "OK: --impeccable still writes .impeccable.md"

# Test legacy mode: pitch + client: alias path
cat > .brandrc.yaml <<YAML
client: Legacy Pitch
tier: minimum
mode: pitch
sources: {}
YAML
node "$OLDPWD/cli/bin/brand-cli.js" refresh-context 2>&1 | grep -q "deprecated" && echo "OK: legacy aliases warn"

cd "$OLDPWD"
rm -rf /tmp/de-xd-final-smoke
```

Expected: all 8 `OK:` lines printed.

- [ ] **Step 7: Spec coverage skim**

Open `docs/superpowers/specs/2026-06-16-de-xd-cleanup-design.md` and confirm every section maps to a landed task.

| Spec section | Landed in task |
|---|---|
| §1 Change 1 — `client` → `brand` | Task 2 |
| §1 Change 2 — `mode: pitch` → `public-sources-only` | Task 3 |
| §1 Change 3 — Stage 6 gate decouple | Task 4 |
| §1 Change 4 — `--impeccable` → `--also-write` | Task 5 |
| §1 Change 5 — `tools.agent` enum → string | Task 6 |
| §1 Change 6 — drop `extensions` | Task 6 (loader behavior in Task 2) |
| §1 Change 7 — `sources.asset_dir` configurable | Task 6 |
| §1 Change 8 — drop `tools.storybook` | Task 6 (loader behavior in Task 2) |
| §2 Soft-deprecation infrastructure | Task 2 |
| §2 Brandrc loader extraction (surgical) | Task 2 |
| §2 Test goldens (no regen) | Verified by green test suite |
| §2 Manifest/scope schema (untouched) | Verified by absence of edits |
| §3 Sequencing | Tasks 1–7 in this plan |
| §4 Acceptance criteria | Verified in Step 6 smoke test + final test count |
| §5 Out of scope | (nothing to land — Bucket B/C deferred) |
| §6 Open questions (loader scope, outputs shape, default brand) | Resolved in [D1]/[D2] in progress doc |

If anything is uncovered, file a follow-up task and note it in the progress doc.

- [ ] **Step 8: Final cross-branch code review**

Confirm BASE + HEAD SHAs:

```bash
git merge-base main HEAD  # BASE_SHA = 6b87652 (post-C9-merge tip)
git rev-parse HEAD        # HEAD_SHA after Task 7's commit
```

Dispatch a single `superpowers:code-reviewer` subagent across the entire branch diff. Pass:

- BASE_SHA = `git merge-base main HEAD` output
- HEAD_SHA = `git rev-parse HEAD` output
- Scope: full branch review — "is the whole feature ready to merge?"
- Focus areas:
  - **Cross-task contract sync** — `brand`/`client` rename consistent across schema, loader, callers, init scaffold, README. Manifest schema preserves `version: "2"` with reworded description; `payload.client` is sourced from `cfg.brand`. Scope schema (`schema/brand/scope.schema.json`) untouched.
  - **Loader scope is surgical** — exactly four call sites use `loadBrandrc(projectDir)`: `refresh-context`, `refresh-design`, `score`, `emit-manifest`. `init.js` does not use the loader.
  - **Soft-deprecation aliases warn exactly once per process per key** — `client`, `mode: pitch`, `extensions`, `--impeccable`, `--client` flag. Stale tempfile in /tmp not committed. `tools.storybook` is silently dropped (no warning).
  - **Stage 6 gating phrase consistent** — SKILL §0d, §7, final-summary edge-case table, pipeline-summary line all reference `sources.design_system_repo` (no tier-based language).
  - **PUBLIC-SOURCES-ONLY MODE banner present in §5c, §6e, §8f. PITCH MODE banner absent.**
  - **`outputs:` field is a flat array** — no named buckets, parsed at `refresh-context.js` call time, deduplicated with `--also-write` and `--impeccable` alias.
  - **Goldens unchanged** — `cli/test/golden/manifest-from-{populated,skill}.json:216` still show `client: "acme"` (manifest-side field name).
  - **No unrelated edits** — no version bump (separate post-merge release commit); no edits to `~/Documents/xd-toolkit`; no changes to `cli/src/utils/scope-*` or `contract-loader.js`.

If reviewer flags Critical or Important: dispatch a refinement subagent. Minor: accept per [D7].

- [ ] **Step 9: Update progress doc with final state**

In `docs/superpowers/plans/2026-06-16-de-xd-cleanup-progress.md`:

- Add Task 7 to the "Completed tasks" table with the cross-branch reviewer verdict.
- Add a "Final-stage handoff" section listing what landed (8 commits across schema, SKILL, loader, callers, tests, docs; +16 tests).
- Update the "Quick state check" block with the final commit + test counts.

Write commit message to `/tmp/commit-msg-task7-de-xd.txt`:

```
docs: progress doc through Task 7 + repo docs propagation (de-XD)

README quick-start swaps --client for --brand (alias preserved); Impeccable
interop wording reframed neutrally with --also-write example. xd-assumption
inventory close-out lines added to items #2, #3, #4, #6, #7, #10, #12, #14, #18.
tasks.md notes ready-for-merge state; Last updated bumped to 2026-06-17.

Progress doc populated through Task 7. Branch ready to hand off to
superpowers:finishing-a-development-branch.
```

```bash
git add README.md \
        docs/xd-assumption-inventory.md \
        docs/tasks.md \
        docs/superpowers/plans/2026-06-16-de-xd-cleanup-progress.md
git commit -F /tmp/commit-msg-task7-de-xd.txt
rm /tmp/commit-msg-task7-de-xd.txt
```

- [ ] **Step 10: Verify**

```bash
git log --oneline main..HEAD
npm test 2>&1 | tail -5
git status
```

Expected: 9 commits ahead of main (1 spec + 1 progress-doc shell + 1 baseline + 6 task commits, plus any refinement commits from per-task reviews). Tests at 128/128. Working tree clean.

- [ ] **Step 11: Hand off via `superpowers:finishing-a-development-branch`**

Invoke that skill (separate, same as the scope-json branch's final move). Pass it: spec link, plan link, progress doc link, test delta (112 → 128; +16 tests), commit count, cross-branch reviewer verdict.

After merge: update `docs/tasks.md` "Last updated" line with the merge SHA, move the de-XD entry from Active backlog to Completed (with the post-merge SHA in the Output line), and hoist any new footguns surfaced during this branch into the next progress doc's "things to know" appendix. Then start the v0.5.0 release commit (CLAUDE.md "Versioning + release" — five places: `package.json`, `marketplace.json` × 2 fields, `cli/bin/brand-cli.js`, plus two test goldens' `generator` field).

---

## Self-review notes

**Spec coverage:** §10's eight changes, plus §2 cross-cutting concerns, plus §3 sequencing, plus §4 acceptance criteria, are all mapped to specific tasks (Step 7 of Task 7 has the matrix).

**Type/identifier consistency:**
- Function name `loadBrandrc(projectDir)` is identical across the loader (Task 2 Step 3), all four callers (Steps 6, 8, 9, 10), and the loader test file (Step 4).
- The `warnDeprecated(key, message)` signature is identical in `deprecations.js` (Task 2 Step 1), the loader (Step 3), `init.js` (Step 11), and `refresh-context.js` (Task 5 Step 2).
- The deprecation-key strings are unique per warn site: `brandrc.client`, `brandrc.client+brand`, `brandrc.mode.pitch`, `brandrc.extensions`, `init.flag.client`, `init.flag.mode.pitch`, `cli.refresh-context.impeccable`. No duplicate keys would silently coalesce warnings.
- The `brand` field name flows uniformly: brandrc-loader returns `cfg.brand`; callers consume `cfg.brand`; manifest write site renames it to `payload.client` with a one-line comment.
- The `PUBLIC-SOURCES-ONLY MODE` banner literal is identical in init's `PUBLIC_SOURCES_ONLY_DISCLAIMER` constant, SKILL §5c, §6e, and §8f, and parity test assertion.

**No placeholders:** Every step contains the actual content an engineer needs. All `Edit` calls show both `old_string` and `new_string` verbatim. All `Write` calls show the full file contents. All bash and `node --input-type=module -e` snippets are runnable as-pasted.

**Cross-task ordering:** Task 2 must land before Task 3 (init.js depends on Task 2's `warnDeprecated` import), Task 5 (refresh-context depends on Task 2's loader), and Task 6 (init.js asset-dir block depends on Task 2's brandrc-write block). Task 4 can land in any order after Task 1.
