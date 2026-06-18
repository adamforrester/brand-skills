# Design — De-XD cleanup (clear public-contract residue before 1.0)

**Status:** draft — awaiting approval
**Tasks closed on land:** XD-inventory items #2, #3, #4, #6, #7, #10, #12, #14, #18 ([`docs/xd-assumption-inventory.md`](../../xd-assumption-inventory.md)); unblocks the 1.0 release
**Manifest schema impact:** none (manifest stays v2; this is brandrc-schema and CLI-surface work)
**Back-compat stance:** soft deprecation. Old field names + flag continue to work; emit a one-line warning per use; document both old and new in schemas; removal slated for 2.0.

This spec clears the XD-coupling that would lock the public contract at 1.0. It addresses the **Bucket A** items from the de-XD triage (schema/behavior changes that semver-freeze on 1.0). Bucket B (user-facing prose: README quick-start, Wendy's examples, "personal GitHub" reword) is a follow-up docs branch. Bucket C (architectural rethink of the `comprehensive` tier, "practitioner" → "you" find-replace, undocumented caps) is explicitly post-1.0.

The logic: 1.0 freezes whatever shape the tool ships in. Anything that would commit us to XD vocabulary at 1.0 has to be cleared first. Anything that's only *prose* can be improved at any minor version without breaking users.

---

## 1. The eight changes

### Change 1 — `client` becomes optional, renamed to `brand` (inventory #2)

**Schema:**
- `schema/brand/brandrc.schema.md`: rename the `client` row to `brand`. Mark optional. Default value: directory name (`basename(projectDir)`). Description: "The brand this package describes — defaults to the project directory name. Older configs may use `client`; the alias is read but emits a deprecation warning."

**CLI:**
- `cli/src/commands/init.js`: prompt label changes from `Client name:` to `Brand name:`. Default-value autofill from `basename(projectDir)`. The `--client` flag remains as an alias of `--brand`.
- `cli/src/utils/brandrc-loader.js` (or wherever brandrc is read — needs to be located): if the parsed YAML has `client` but not `brand`, copy `client` → `brand` and emit `console.warn` with the deprecation message exactly once per process. If both are present, `brand` wins and we warn that `client` is being ignored.
- All consumers (`refresh-context.js`, `refresh-design.js`, `score.js`, `brand-context-generator.js`) read `cfg.brand` with `cfg.client` as fallback. Same warn-once-per-process behavior.

**Generators:**
- `brand-context-generator.js` heading template: `# Brand Context — ${brand}` (variable already named `brandName` in places, just renamed at source).
- `design-md-generator.js`: any reference to `client` updated similarly.

**SKILL prose:**
- `brand-context/skills/brand-extract/SKILL.md`: any prose that says "client" in the metadata sense gets reworded to "brand." Distinguished from "client" in the source-authority sense (e.g., "client-provided assets") which is a different word.

**Tests:**
- One unit test on the brandrc loader: legacy `client`-only file produces `cfg.brand === <client value>` and emits a deprecation warning.
- One unit test: file with both `client` and `brand` uses `brand`; warning fires.
- One unit test: file with neither uses `basename(projectDir)`.
- Existing tests that mock brandrc with `client` get a `brand` field added; assertions stay green.

---

### Change 2 — `mode: pitch` renamed to `public-sources-only` (inventory #4)

**Schema:**
- `schema/brand/brandrc.schema.md`: `mode` enum changes from `standard | pitch | comprehensive` to `standard | public-sources-only | comprehensive`. The schema-doc table notes `pitch` is accepted as a deprecated alias.

**CLI:**
- `init.js:42-44`: the three modes become `standard | public-sources-only | comprehensive`. Display label for `public-sources-only` reads: `public-sources-only — Public sources only: website, social, no internal access`.
- The brandrc loader normalizes `pitch` → `public-sources-only` with a one-line deprecation warning.

**SKILL prose:**
- `brand-context/skills/brand-extract/SKILL.md` Sections 4f, 5c, 6e, 8f currently use `pitch mode` and "PITCH MODE" disclaimer text. Reword to `public-sources-only mode` with disclaimer: `> ⚠️ PUBLIC-SOURCES-ONLY MODE — derived from public sources only. Not validated against internal brand standards.`
- Where the SKILL conditions on `mode === 'pitch'` (any reads of brandrc), accept either value (so legacy `.brandrc.yaml` files keep working pre-load-warning).

**Tests:**
- Unit test: brandrc with `mode: pitch` loads as `mode: public-sources-only` + warns.
- Unit test: brandrc with `mode: public-sources-only` loads cleanly with no warning.

---

### Change 3 — Stage 6 gate moves from `tier == comprehensive` to `sources.design_system_repo` set (inventory #3 + #7)

**SKILL:**
- `brand-context/skills/brand-extract/SKILL.md` §6 (Stage 6 — DS repo scan): the gating clause changes from `Run when tier == comprehensive` to `Run when sources.design_system_repo is set (any tier)`. The tier-based language is dropped from this section.

**Schema:**
- `schema/brand/brandrc.schema.md`: `sources.design_system_repo` description gets a sentence: "When set, Stage 6 runs and produces `.brand/components/*.md` regardless of tier."

**CLI:**
- `cli/src/commands/init.js`: the `comprehensive` tier no longer auto-scaffolds workflow files based on the assumption that DS scanning is bundled in. (The workflow scaffolding stays for now under `tier: comprehensive` — that's the architectural #1 question, deferred to Bucket C / post-1.0.)
- No CLI behavior change in `score.js` for this — `score` reads `.brand/components/*.md` if present regardless.

**Decoupling rationale:** today, getting the DS repo scan *requires* opting into prototype-workflow scaffolding. After this change, you opt into the DS scan by pointing at a repo. The XD prototype workflow still gates on `tier: comprehensive` as today — that part is unchanged here; rethinking the whole tier model is the architectural Bucket C item.

**Tests:**
- Update any existing test that fixtures `tier: comprehensive` *expecting* Stage 6 prose to fire. Switch the expectation to `sources.design_system_repo` set.
- Add: a test where `sources.design_system_repo` is set with `tier: standard` — Stage 6 prose fires.
- Add: a test where `sources.design_system_repo` is unset with `tier: comprehensive` — Stage 6 prose does **not** fire.

(Note: SKILL prose isn't covered by the test suite per CLAUDE.md. The "tests" here are skill-prose-parity tests like `skill-scope-parity.test.js` — assert that the SKILL contains the expected gating phrase. Same pattern as #4 and #5.)

---

### Change 4 — `--impeccable` generalized to `--also-write <path>` (inventory #6)

**CLI:**
- `cli/src/commands/refresh-context.js`: add `--also-write <path>` option (repeatable: commander's `.option('--also-write <path>', '...', collect, [])` pattern). After writing `brand.md`, mirror the same content to each `<path>`.
- `--impeccable` retained as an alias that resolves to `--also-write .impeccable.md` and emits a one-line deprecation notice. (Or: `--impeccable` keeps writing `.impeccable.md`; just routed through the same code path; same warn-once.)

**Schema:**
- `schema/brand/brandrc.schema.md`: add an optional `outputs` section (or `extra_outputs: [paths]` field — pick one shape during planning) so users can declare extra outputs declaratively without re-passing `--also-write` each time. Loaded by `refresh-context.js` and merged with the CLI flag.
- Reframe `schema/brand/overview.schema.md:8, 43` from naming Impeccable specifically to neutral language ("Used by AI agent context-gathering protocols").

**Tests:**
- Existing `refresh-context` test that exercises `--impeccable` continues to pass (alias path).
- New test: `--also-write /tmp/foo.md` writes the file; `--also-write /tmp/foo.md --also-write /tmp/bar.md` writes both.
- New test: `outputs: [.impeccable.md]` in brandrc produces the same file on `refresh-context` with no flag.

---

### Change 5 — `tools.agent` enum opens to `string` (inventory #10)

**Schema:**
- `schema/brand/brandrc.schema.md:53`: `tools.agent` enum changes to free-form string. Description gets a list of suggested values: `claude-code | cursor | vscode-copilot | codex | gemini | cline | aider | other`.

**Code:**
- Grep confirms `tools.agent` is read nowhere in `cli/src/` or `brand-context/skills/`. Schema-doc-only change. (Implementation Step 1: re-grep on the working tree to confirm; if a hit appears, handle it.)

**Tests:**
- None directly required — the field is documentation.

---

### Change 6 — `extensions` field dropped from brandrc (inventory #12)

**Schema:**
- `schema/brand/brandrc.schema.md:60`: remove the `extensions` row entirely. Note in the schema-doc changelog that `extensions` was removed in 1.0 because no extension contract was ever shipped; if/when an extension mechanism lands, the field will be re-introduced with a documented contract.

**Code:**
- Grep confirms no reads of `cfg.extensions` outside the schema doc. Drop any (init scaffolding doesn't appear to use it).

**Loader behavior:**
- Soft-deprecation note — if the loader sees an `extensions:` field in an existing brandrc, it warns once: "`extensions` is no longer recognized; ignored."

**Tests:**
- One unit test asserting an `extensions: [ds-pack]` field in brandrc loads with no error and emits the deprecation warning.

---

### Change 7 — `sources.asset_dir` configurable (inventory #14)

**Schema:**
- `schema/brand/brandrc.schema.md`: add `sources.asset_dir` (optional string, default `./assets`). Description: "Directory scanned for brand assets (PDFs, screenshots, DTCG token files). Defaults to `./assets`."

**SKILL:**
- `brand-context/skills/brand-extract/SKILL.md:35-41`: the asset-directory scan list changes from a hard-coded list to: "the directory specified in `sources.asset_dir` (defaults to `./assets`)." The other paths (`./brand-assets/`, `./.brand-assets/`, `./inputs/`, `./sources/`, project root) are preserved as a *fallback search* when `asset_dir` is unset and default `./assets` doesn't exist.

**CLI:**
- `init.js:152-177`: the `assets/` directory is created at the configured path. If the user pre-set `sources.asset_dir` via init flag (`--asset-dir`), use that. Otherwise default `./assets`.

**Tests:**
- Unit test: brandrc with `sources.asset_dir: ./brand-inputs` and a token file in that directory → SKILL prose references the override.
- (No SKILL behavior test — this is also a parity-test pattern.)

---

### Change 8 — Drop unused `tools.storybook` (inventory #18)

**Schema:**
- `schema/brand/brandrc.schema.md:54`: remove the `tools.storybook` row. No functional code referenced it.

**Loader behavior:**
- If the field appears in legacy brandrc, ignore silently — same pattern as `extensions` (above).

**Tests:**
- None. Schema-doc-only.

---

## 2. Cross-cutting concerns

### Soft-deprecation infrastructure

This spec introduces three deprecation paths:
- `client` → `brand` (alias, warn once)
- `mode: pitch` → `mode: public-sources-only` (alias, warn once)
- `--impeccable` → `--also-write .impeccable.md` (alias, warn once)
- `extensions` → ignored, warn once
- `tools.storybook` → ignored, silent (was never functional)

Implementation needs **one** small utility to handle the warn-once pattern across the brandrc loader. Likely shape:

```js
// cli/src/utils/deprecations.js
const warnedKeys = new Set();
export function warnDeprecated(key, message) {
  if (warnedKeys.has(key)) return;
  warnedKeys.add(key);
  console.warn(`[brand-skills] ${message}`);
}
```

Used at brandrc-load time and at CLI-flag-parse time. Module-scope `Set` makes the per-process semantics exact.

### Brandrc loader

Today brandrc is read in several places (`refresh-context.js`, `refresh-design.js`, `score.js`). Each calls a small helper or reads YAML inline. Several of these changes (alias mapping, deprecation warnings) need to happen exactly *once per process*, not once per read.

**Candidate refactor:** extract `cli/src/utils/brandrc-loader.js` with a `loadBrandrc(projectDir)` function that handles all alias mapping + deprecation warnings + default `brand` from dirname. All callers route through it. This is the right cleanup but also expands scope.

**Alternative:** add the helper but leave existing call sites alone for now; route only the *new* alias logic through the helper. Smaller diff.

**Decision needed:** during planning, pick one. My recommendation: extract the helper but keep diff minimal — only update call sites that actually need the alias logic (`refresh-context.js`, `score.js`, `brand-context-generator.js`); leave anything that doesn't read `client`/`mode` alone.

### Test goldens

Three test goldens reference fields that may move:
- `cli/test/golden/manifest-from-populated.json` — has `client` in payload; verify the manifest schema doesn't bake `client` into a required field. If so, golden may need a regen with `brand` as the new field name. (The manifest payload's `client` is probably independent of the brandrc field — needs verification during planning.)
- `cli/test/golden/manifest-from-skill.json` — same.
- Any fixture under `cli/test/fixtures/stage-data/` with `client` → likely no impact, but grep during planning.

### What this spec does NOT touch

- **Bucket B prose (next branch):** README quick-start, Wendy's examples (32 hits across schemas/utils), "personal GitHub" example wording, "Layout CLI" mystery field, conflicts hierarchy rewording.
- **Bucket C / post-1.0:** architectural rethink of `comprehensive` tier (`docs/xd-assumption-inventory.md` #1), "practitioner" → "you" prose pass (40+ hits), 50-component cap docs, `figma_variable_collections` clarification.

These are flagged in the inventory and tracked separately. Their existence does *not* block 1.0 because they're prose-only or non-public-contract.

### Manifest schema / scope schema

Untouched. This branch operates entirely on `schema/brand/brandrc.schema.md` (the brandrc shape) and CLI/SKILL surfaces. Manifest v2 stays. Scope v1 stays.

---

## 3. Sequencing / planning hint

The eight changes break naturally into ~6 tasks for the implementation plan:

1. **Test harness sync + branch baseline** (no code change; confirms 112/112).
2. **brandrc-loader refactor + deprecation helper** (Change 1 schema + alias infrastructure; covers `client` → `brand` + warn-once helper).
3. **mode: pitch → public-sources-only** (Change 2; rides the same deprecation helper).
4. **Stage 6 gate decoupling** (Change 3; SKILL prose + parity tests; small).
5. **`--also-write` + outputs section** (Change 4; biggest surface area in CLI).
6. **Schema-doc cleanup** (Changes 5, 6, 7, 8 batched — they're all `brandrc.schema.md` edits + loader silent/warn-once behavior + minimal tests).
7. **Repo docs propagation + final verification** (CLAUDE.md, README schema mentions, tasks.md inventory entry close-outs, version-bump deferred to release commit).

The version bump itself happens *after* this branch merges — as part of the 1.0 release commit, not bundled into this spec.

---

## 4. Acceptance criteria

- All XD-inventory items #2, #3, #4, #6, #7, #10, #12, #14, #18 closed.
- A `.brandrc.yaml` from before this change (with `client:` and `mode: pitch`) still loads and runs end-to-end. Two deprecation warnings fire, exactly once per process.
- A new `.brandrc.yaml` (with `brand:` and `mode: public-sources-only`) loads silently.
- Stage 6 SKILL prose fires when `sources.design_system_repo` is set, regardless of tier.
- `brand-cli refresh-context --also-write /tmp/foo.md` writes `brand.md` + `/tmp/foo.md`. `--impeccable` still works as an alias with a deprecation warning.
- `npm test` is green at 112+ tests (test count grows by ~10 from new alias/deprecation/parity tests).
- The XD-inventory items deferred to Bucket B and Bucket C are cross-linked in `docs/xd-assumption-inventory.md` so a future contributor knows what's pending vs intentional.

---

## 5. Out of scope (explicit non-goals)

- Renaming `mode: comprehensive` (the workflow-tier conflation). That's Bucket C, post-1.0.
- Rewriting "practitioner" prose throughout SKILLs. Bucket C.
- New extension mechanism. Removed today; re-added when the contract exists.
- npm publishing. Independent roadmap item.

---

## 6. Open questions for plan-writing

1. **Brandrc loader extraction scope:** full refactor (all call sites route through a single helper) or surgical (only the alias-aware sites)? Recommendation: surgical; leaves the broader cleanup as a future branch if drift accumulates.
2. **`outputs` declarative shape:** `outputs: [path1, path2]` (flat array) or `outputs: { agents: [...] }` (named buckets, future-extensible)? Recommendation: flat array — YAGNI on buckets until a second consumer asks.
3. **Default `brand` value when neither `brand` nor `client` is set:** `basename(projectDir)` (smart) or empty-string + warning (explicit)? Recommendation: `basename(projectDir)` — reduces required-field count by one, matches the "in-house team building their own product" use case from the inventory.
