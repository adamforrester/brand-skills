# MCP Fallback Contract Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Formalize the per-stage MCP-fallback contract for `/brand-context:extract` as machine-readable data, expand it with two new fallback tiers (DTCG-import for Stage 1, Jina-Reader for Stage 3), and bump the manifest schema to `version: "2"` so manifest emissions record per-stage fallback decisions.

**Architecture:** Three-layer change. **Schema layer** adds two new files (contract data + contract validator) and bumps the manifest schema. **CLI layer** adds three new utilities (`contract-loader`, `dtcg-import`, `jina-fetch`), one new command (`import-tokens`), and modifies `emit-manifest` + `score` to consume the renamed `dependencies` field. **SKILL layer** adds a new pre-flight section (`§0.5`) that reads contract metadata into user-facing notices, and updates Stage 1/2/3/10b prose to reference contract chains. Tests, goldens, and fixtures cascade from the schema change.

**Tech Stack:** Node.js ≥22, ESM (`"type": "module"`), `ajv@^8.20` (`ajv/dist/2020.js` for draft 2020-12), `ajv-formats`, `chalk`, `commander`, `node:test`, native `fetch` (no new HTTP dependency).

---

## Source-of-truth references

- **Spec:** [`docs/superpowers/specs/2026-06-13-mcp-fallback-contract-design.md`](../specs/2026-06-13-mcp-fallback-contract-design.md) — read end to end before starting any task
- **Resume note:** [`docs/superpowers/plans/2026-06-13-mcp-fallback-contract-resume.md`](2026-06-13-mcp-fallback-contract-resume.md) — decisions made during brainstorm not in the spec
- **Precedent:** [`docs/superpowers/plans/2026-06-10-manifest-and-health-progress.md`](2026-06-10-manifest-and-health-progress.md) — D-letter pattern + footguns

## Things to know that aren't obvious from the codebase

These have bitten every prior branch. Hoisted from the manifest+health progress doc:

- **`ajv/dist/2020.js`, not `ajv`.** Draft 2020-12 schemas need the dist entry point. `import Ajv from 'ajv/dist/2020.js'` (ESM) — never plain `'ajv'`.
- **Apostrophes break heredoc commit messages.** Always write the message to `/tmp/commit-msg.txt` and use `git commit -F /tmp/commit-msg.txt`. Tell every implementer subagent this explicitly.
- **`package-lock.json` is gitignored.** Don't `git add` it.
- **Don't bump the package version.** Don't touch `~/Documents/xd-toolkit`. Durable rules from `CLAUDE.md`.
- **Plan-pasted `node -e` snippets that use `require()` are broken.** This repo is `"type": "module"`. Default to `node --input-type=module -e "..."` with named ESM imports.
- **Plan-pasted bash pipelines have shipped with typos.** Glance at any multi-line bash before pasting; better still, tell the implementer to verify the command before relying on it.
- **Long-running implementer agents can die mid-flight on token expiration.** If file edits are on disk but the agent didn't commit, run smoke-tests + commit yourself rather than re-dispatching.
- **Goldens are coupled to fixture bytes.** Any edit to a populated-fixture file shifts byte counts and breaks deepEqual. The strip list (`generated_at`, `generator`) covers volatility — anything else volatile must be added.
- **`engines.node >= 22.0.0`.** `node --test` glob support landed at Node 21; floor is at LTS 22.
- **Per-task two-stage review** (spec compliance, then code quality). Manifest+health branch ran 8/18 tasks (47%) needing refinement. Budget for it.

## Cross-task contracts to preserve

These must stay in sync across **contract data**, **contract schema**, **manifest schema**, **goldens**, **fixtures**, **SKILL prose**, and **repo docs**:

- **`kind` enum** — `"mcp" | "http" | "user_artifact" | "native_tool"`. Used in `mcp-fallback-contract.schema.json` (chain entries + dependency entries) and in `manifest.schema.json` (per-dependency `kind` field). All four values must appear in both schemas.
- **`fallback_decision` enum** — `"none" | "DOWNGRADE" | "SKIP" | "HALT"`. Manifest schema only; SKILL prose mirrors the meanings.
- **`quality_label` enum** — `"full" | "degraded"`. Contract schema only; flows through manifest's `chain_entry_used`.
- **Stage keys** — `1_figma`, `2_web`, `3_voice`, `4_overview`, `5_conflicts`, `6_components`, `8_brand_md`. No Stage 7. Manifest's existing `^[1-8]_[a-z_]+$` pattern accepts these; contract data uses the same keys.
- **DTCG file glob** — `assets/*.tokens.json`. Single source: contract dependency entry's `expected_path_glob`. SKILL prose, CLI `import-tokens` default, fixtures all reference this glob.
- **Pre-flight notice text lives in SKILL prose**; contract supplies structured fields (`install_hint`, `install_caveat`, `fidelity_note`, `user_action_hint`). Tests verify SKILL prose covers all contract dependency entries.

## File structure

### New files

| Path | Responsibility |
|---|---|
| `schema/mcp-fallback-contract.schema.json` | JSON Schema 2020-12 validating contract data |
| `schema/mcp-fallback-contract.json` | Canonical contract data (chains + dependency metadata) |
| `cli/src/utils/contract-loader.js` | Loads + validates contract on import; exports `loadContract()`, `getStageContract(key)`, `getDependency(name)` |
| `cli/src/utils/dtcg-import.js` | Reads `assets/*.tokens.json`, validates DTCG shape, returns in-memory token state |
| `cli/src/utils/jina-fetch.js` | Keyless `r.jina.ai` GET wrapper; rate-limit-aware; handles error responses |
| `cli/src/commands/import-tokens.js` | `brand-cli import-tokens` — ingest DTCG into in-memory token state (Stage 1 fallback path) |
| `cli/test/unit/contract-loader.test.js` | Schema validation, lookup helpers, error paths |
| `cli/test/unit/dtcg-import.test.js` | Happy path, malformed-DTCG, multi-file, unknown DTCG type |
| `cli/test/unit/jina-fetch.test.js` | Mocked HTTP responses (happy / 429 / 5xx); no real network |
| `cli/test/integration/preflight.test.js` | Fixtures with various dependency-availability shapes — verifies decision math |
| `cli/test/integration/import-tokens.test.js` | End-to-end DTCG ingestion via `runCli` |
| `cli/test/fixtures/dtcg-tokens/colors.tokens.json` | Sample DTCG color export |
| `cli/test/fixtures/dtcg-tokens/typography.tokens.json` | Sample DTCG typography export |
| `cli/test/fixtures/dtcg-tokens/malformed.tokens.json` | Invalid DTCG (missing `$type` on a token) for error-path tests |

### Modified files

| Path | Reason |
|---|---|
| `schema/manifest.schema.json` | `version: "1"` → `"2"`; `mcps` → `dependencies`; new per-stage fields; new per-dependency `kind` |
| `schema/brand/README.md` | Cross-link new contract schema |
| `cli/src/commands/emit-manifest.js` | Accept `dependencies` payload; populate new per-stage fields; reject v1 input |
| `cli/src/commands/score.js` | Read renamed `dependencies` field; reject v1 manifests |
| `cli/src/utils/manifest-writer.js` | No code change — schema swap propagates via existing ajv compile |
| `cli/bin/brand-cli.js` | Register `import-tokens` subcommand |
| `cli/test/unit/manifest-writer.test.js` | Update `validPayload()` to v2 shape |
| `cli/test/integration/emit-manifest.test.js` | Update for `dependencies` rename + new per-stage fields |
| `cli/test/integration/round-trip.test.js` | Same |
| `cli/test/integration/score-emits-health.test.js` | Verify v2 manifest passes through health-writer |
| `cli/test/integration/score-without-manifest.test.js` | Sanity — no manifest path doesn't reference v1 anywhere |
| `cli/test/integration/fresh-init.test.js` | Sanity — fresh init still scores cleanly under v2 |
| `cli/test/golden/manifest-from-populated.json` | Regenerated to v2 shape |
| `cli/test/golden/manifest-from-skill.json` | Regenerated to v2 shape |
| `cli/test/fixtures/stage-data/full-pipeline.json` | Rename `mcps` → `dependencies`; add per-stage `fallback_decision`/`chain_entry_used`/etc. |
| `cli/test/fixtures/stage-data/partial-pipeline.json` | Same |
| `cli/test/fixtures/stage-data/no-mcps.json` | Same |
| `brand-context/skills/brand-extract/SKILL.md` | New `§0.5` pre-flight section; updates to §1, §2, §3 (Jina), §10b |
| `CLAUDE.md` | File-write policies + arch diagram + versioning section additions |
| `README.md` | Pipeline-table fallback chain notes |
| `docs/tasks.md` | Mark #3 complete on land |
| `docs/DESIGN.md` | "No required MCP installs" decoupling bullet expanded with chain enumeration |

---

## Per-task dispatch protocol

Same as manifest+health branch (precedent doc). Per task:

1. **Open this plan**, copy the full task text inline (don't make subagents read the plan file — they don't always honor task boundaries).
2. **Dispatch implementer** (`general-purpose` subagent). Include: full task text; branch name `feat/mcp-fallback-contract`; pointer to this plan + spec + resume note + precedent progress doc; the "Things to know" footguns above; relevant D-letters from precedent.
3. **Spec compliance review** (`general-purpose` subagent). Read the actual code; don't trust the implementer's report.
4. **Code quality review** (`superpowers:code-reviewer` subagent). Pass `BASE_SHA` (commit before this task) and `HEAD_SHA`.
5. **If reviewer flags Critical or Important:** dispatch a refinement subagent. **If Minor only:** accept and proceed.
6. **Update progress doc** (`docs/superpowers/plans/2026-06-13-mcp-fallback-contract-progress.md`) with commit SHA(s), test delta, decisions, D-letters.
7. **Mark task done** in the session task list.

---

## Task 1: Test harness sync + branch baseline

**Goal:** Confirm 47/47 tests pass, branch is clean, plan + progress docs are committed.

**Files:**
- Create: `docs/superpowers/plans/2026-06-13-mcp-fallback-contract-progress.md`

- [ ] **Step 1: Verify branch state**

```bash
git rev-parse --abbrev-ref HEAD  # expect: feat/mcp-fallback-contract
git log --oneline main..HEAD     # expect: 1 commit (the spec) + later this plan + progress doc commit
git status                       # expect: clean (or only untracked plan/progress docs)
```

- [ ] **Step 2: Run the existing test suite**

```bash
npm test 2>&1 | tail -10
```

Expected: `# pass 47` / `# fail 0`.

- [ ] **Step 3: Create the progress doc shell**

Write to `docs/superpowers/plans/2026-06-13-mcp-fallback-contract-progress.md`:

```markdown
# MCP Fallback Contract — Implementation Progress

Companion to [`2026-06-13-mcp-fallback-contract.md`](2026-06-13-mcp-fallback-contract.md). Tracks each task's commits, test delta, and decisions made during implementation that deviated from or extended the plan.

**Status:** in progress on branch `feat/mcp-fallback-contract`.
**Branch base:** `main` at the post-merge tip of PR #1 (commit `3041891`).
**Spec:** [`../specs/2026-06-13-mcp-fallback-contract-design.md`](../specs/2026-06-13-mcp-fallback-contract-design.md)
**Resume note:** [`2026-06-13-mcp-fallback-contract-resume.md`](2026-06-13-mcp-fallback-contract-resume.md)
**Precedent (D-letter pattern reference):** [`2026-06-10-manifest-and-health-progress.md`](2026-06-10-manifest-and-health-progress.md)

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

See the "Things to know that aren't obvious from the codebase" section in the plan. Hoist new branch-specific patterns here as they surface.

---

## Completed tasks

| # | Task | Commits | Tests added | Notes |
|---|---|---|---|---|

---

## Pending tasks

All 16 tasks pending. See plan.

---

## Decisions made during implementation (D-letter pattern)

(populated as decisions land)

---

## Open questions surfaced for upcoming tasks

(populated as questions surface)
```

- [ ] **Step 4: Commit plan + progress doc**

Write commit message to `/tmp/commit-msg.txt` (apostrophes are safe via `-F`):

```
docs: implementation plan + progress doc shell for #3

Plan derived from spec at docs/superpowers/specs/2026-06-13-mcp-fallback-contract-design.md.
16 tasks. Same per-task dispatch protocol as the manifest+health branch (precedent in
2026-06-10-manifest-and-health-progress.md).
```

```bash
git add docs/superpowers/plans/2026-06-13-mcp-fallback-contract.md \
        docs/superpowers/plans/2026-06-13-mcp-fallback-contract-progress.md
git commit -F /tmp/commit-msg.txt
```

- [ ] **Step 5: Verify**

```bash
git log --oneline main..HEAD  # expect: 2 commits (spec + this plan/progress doc)
npm test 2>&1 | tail -5       # expect: 47 pass, 0 fail
```

---

## Task 2: Add `schema/mcp-fallback-contract.schema.json`

**Goal:** JSON Schema 2020-12 that validates the canonical contract data file. Lands first so Task 3's data file has a validator to test against.

**Files:**
- Create: `schema/mcp-fallback-contract.schema.json`
- Test: deferred to Task 4 (`contract-loader.test.js` will exercise this schema via the loader)

- [ ] **Step 1: Write the schema**

Create `schema/mcp-fallback-contract.schema.json`:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://github.com/adamforrester/brand-skills/schemas/mcp-fallback-contract.schema.json",
  "title": "brand-skills MCP fallback contract",
  "description": "Per-stage fallback chains and dependency metadata consumed by /brand-context:extract pre-flight + manifest emission. Spec: docs/superpowers/specs/2026-06-13-mcp-fallback-contract-design.md.",
  "type": "object",
  "required": ["version", "stages", "dependencies"],
  "additionalProperties": false,
  "properties": {
    "_comment": { "type": "string" },
    "version": { "const": "1" },
    "stages": {
      "type": "object",
      "additionalProperties": false,
      "patternProperties": {
        "^[1-8]_[a-z_]+$": { "$ref": "#/$defs/stageEntry" }
      }
    },
    "dependencies": {
      "type": "object",
      "additionalProperties": { "$ref": "#/$defs/dependencyEntry" }
    }
  },
  "$defs": {
    "kind": { "enum": ["mcp", "http", "user_artifact", "native_tool"] },
    "qualityLabel": { "enum": ["full", "degraded"] },
    "stageEntry": {
      "type": "object",
      "required": ["purpose", "preconditions", "chain", "skip_behavior"],
      "additionalProperties": false,
      "properties": {
        "purpose": { "type": "string", "minLength": 1 },
        "preconditions": {
          "type": "array",
          "items": {
            "oneOf": [
              {
                "type": "object",
                "required": ["type", "key", "required"],
                "additionalProperties": false,
                "properties": {
                  "type": { "const": "source" },
                  "key": { "type": "string", "pattern": "^[a-z_]+(\\.[a-z_]+)*$" },
                  "required": { "type": "boolean" }
                }
              },
              {
                "type": "object",
                "required": ["type", "min", "required"],
                "additionalProperties": false,
                "properties": {
                  "type": { "const": "tier" },
                  "min": { "enum": ["minimum", "standard", "comprehensive"] },
                  "required": { "type": "boolean" }
                }
              }
            ]
          }
        },
        "chain": {
          "type": "array",
          "minItems": 1,
          "items": {
            "type": "object",
            "required": ["kind", "name", "quality_label", "fidelity_note"],
            "additionalProperties": false,
            "properties": {
              "kind": { "$ref": "#/$defs/kind" },
              "name": { "type": "string", "minLength": 1 },
              "quality_label": { "$ref": "#/$defs/qualityLabel" },
              "fidelity_note": { "type": "string", "minLength": 1 }
            }
          }
        },
        "skip_behavior": {
          "oneOf": [
            { "type": "null" },
            {
              "type": "object",
              "required": ["writes_files", "files_left_as", "downstream_impact"],
              "additionalProperties": false,
              "properties": {
                "writes_files": { "type": "array", "items": { "type": "string" } },
                "files_left_as": { "enum": ["complete", "partial", "placeholder", "missing", "defaults"] },
                "downstream_impact": { "type": "string", "minLength": 1 }
              }
            }
          ]
        }
      }
    },
    "dependencyEntry": {
      "type": "object",
      "required": ["kind", "enables_stages"],
      "properties": {
        "kind": { "$ref": "#/$defs/kind" },
        "enables_stages": {
          "type": "array",
          "minItems": 1,
          "items": { "type": "string", "pattern": "^[1-8]_[a-z_]+$" }
        },
        "homepage": { "type": ["string", "null"] },
        "install_hint": { "type": "string" },
        "install_caveat": { "type": ["string", "null"] },
        "endpoint": { "type": "string" },
        "auth": { "enum": ["none", "key"] },
        "rate_limit_hint": { "type": "string" },
        "expected_path_glob": { "type": "string" },
        "format": { "type": "string" },
        "user_action_hint": { "type": "string" },
        "always_available": { "const": true }
      },
      "allOf": [
        {
          "if": { "properties": { "kind": { "const": "mcp" } }, "required": ["kind"] },
          "then": { "required": ["install_hint"] }
        },
        {
          "if": { "properties": { "kind": { "const": "http" } }, "required": ["kind"] },
          "then": { "required": ["endpoint", "auth"] }
        },
        {
          "if": { "properties": { "kind": { "const": "user_artifact" } }, "required": ["kind"] },
          "then": { "required": ["expected_path_glob", "user_action_hint"] }
        },
        {
          "if": { "properties": { "kind": { "const": "native_tool" } }, "required": ["kind"] },
          "then": { "required": ["always_available"] }
        }
      ]
    }
  }
}
```

- [ ] **Step 2: Sanity-validate the schema itself compiles under ajv**

```bash
node --input-type=module -e "
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { readFileSync } from 'node:fs';
const schema = JSON.parse(readFileSync('schema/mcp-fallback-contract.schema.json', 'utf-8'));
const ajv = new Ajv({ allErrors: true, strict: true });
addFormats(ajv);
ajv.compile(schema);
console.log('OK');
"
```

Expected: prints `OK`. Any error means the schema itself has a problem; fix before continuing.

- [ ] **Step 3: Run the existing test suite (sanity)**

```bash
npm test 2>&1 | tail -5
```

Expected: still 47/47 passing — this task only added a file.

- [ ] **Step 4: Commit**

```bash
echo "feat(schema): add mcp-fallback-contract.schema.json (JSON Schema 2020-12)

Validates the canonical contract data added in the next task. Top-level
\`stages\` (per-stage chains) + \`dependencies\` (per-dependency metadata).
\`kind\` enum: mcp | http | user_artifact | native_tool. Per-kind required
fields enforced via if/then. Spec §3." > /tmp/commit-msg.txt
git add schema/mcp-fallback-contract.schema.json
git commit -F /tmp/commit-msg.txt
```

---

## Task 3: Add `schema/mcp-fallback-contract.json` (canonical contract data)

**Goal:** The actual contract data — stage chains + dependency metadata — that the SKILL and CLI both consume.

**Files:**
- Create: `schema/mcp-fallback-contract.json`

- [ ] **Step 1: Write the contract data**

Create `schema/mcp-fallback-contract.json`. This is hand-edited canonical data; bump `version` only on breaking shape changes (which are validated by the schema added in Task 2). All values copied from spec §2 + §3:

```json
{
  "_comment": "Source of truth for MCP-fallback contract. Read by SKILL prose (mirrored as a markdown table) and by brand-cli. See schema/mcp-fallback-contract.schema.json for validation. Spec: docs/superpowers/specs/2026-06-13-mcp-fallback-contract-design.md.",
  "version": "1",
  "stages": {
    "1_figma": {
      "purpose": "Figma variable extraction — populates tokens/{colors,typography,spacing,surfaces}.md.",
      "preconditions": [
        { "type": "source", "key": "sources.figma", "required": false }
      ],
      "chain": [
        { "kind": "mcp",           "name": "figma-console",     "quality_label": "full",     "fidelity_note": "Full file walk; collections, modes, alias chains preserved" },
        { "kind": "user_artifact", "name": "dtcg-tokens-file",  "quality_label": "degraded", "fidelity_note": "DTCG export from a Figma plugin; modes captured if exporter included them, alias chains usually flattened" }
      ],
      "skip_behavior": {
        "writes_files": [],
        "files_left_as": "placeholder",
        "downstream_impact": "Figma-derived tokens absent; Stage 2 (web tokens) becomes sole token source if available"
      }
    },
    "2_web": {
      "purpose": "Web token extraction (computed CSS) — populates tokens/{colors,typography,spacing,surfaces}.md alongside Stage 1.",
      "preconditions": [
        { "type": "source", "key": "sources.website", "required": false }
      ],
      "chain": [
        { "kind": "mcp", "name": "playwright", "quality_label": "full", "fidelity_note": "Headless browser + computed CSS sampling" }
      ],
      "skip_behavior": {
        "writes_files": [],
        "files_left_as": "placeholder",
        "downstream_impact": "Web-derived tokens absent; if Stage 1 also skipped, token files stay as placeholders"
      }
    },
    "3_voice": {
      "purpose": "Voice extraction from live channels — populates voice.md observed-voice section.",
      "preconditions": [
        { "type": "source", "key": "sources.website", "required": true }
      ],
      "chain": [
        { "kind": "mcp",         "name": "playwright",  "quality_label": "full",     "fidelity_note": "Accessibility tree + DOM evaluation" },
        { "kind": "http",        "name": "jina-reader", "quality_label": "degraded", "fidelity_note": "JS-rendered markdown via r.jina.ai; loses accessibility tree" },
        { "kind": "native_tool", "name": "webfetch",    "quality_label": "degraded", "fidelity_note": "SSR sites only; SPAs return sparse content" }
      ],
      "skip_behavior": null
    },
    "4_overview": {
      "purpose": "Multimodal analysis — populates overview.md from PDFs and screenshots.",
      "preconditions": [],
      "chain": [
        { "kind": "native_tool", "name": "read", "quality_label": "full", "fidelity_note": "Native Read tool handles PDFs and images" }
      ],
      "skip_behavior": null
    },
    "5_conflicts": {
      "purpose": "Cross-source conflict detection — populates conflicts.md.",
      "preconditions": [],
      "chain": [
        { "kind": "native_tool", "name": "read", "quality_label": "full", "fidelity_note": "Native Read tool over .brand/ files" }
      ],
      "skip_behavior": null
    },
    "6_components": {
      "purpose": "Design-system repo scan (comprehensive tier only) — populates components/*.md.",
      "preconditions": [
        { "type": "tier",   "min": "comprehensive",                "required": true },
        { "type": "source", "key": "sources.design_system_repo",   "required": true }
      ],
      "chain": [
        { "kind": "native_tool", "name": "read", "quality_label": "full", "fidelity_note": "Native Read tool over the cloned/local repo" }
      ],
      "skip_behavior": null
    },
    "8_brand_md": {
      "purpose": "Regenerate brand.md and design.md at project root from .brand/.",
      "preconditions": [],
      "chain": [
        { "kind": "native_tool", "name": "read", "quality_label": "full", "fidelity_note": "Native Read + Write" }
      ],
      "skip_behavior": null
    }
  },
  "dependencies": {
    "figma-console": {
      "kind": "mcp",
      "homepage": null,
      "install_hint": "claude mcp add figma-console -s user -- npx -y @figma-console/mcp@latest",
      "install_caveat": "Originally distributed with the XD-toolkit. Outside that ecosystem, install separately. Note: the official Figma MCP (Dev Mode) is a different package — its read-only variable extraction is per-selection only, not file-wide; not a substitute.",
      "enables_stages": ["1_figma"]
    },
    "playwright": {
      "kind": "mcp",
      "homepage": "https://github.com/microsoft/playwright-mcp",
      "install_hint": "claude mcp add playwright -s user -- npx -y @playwright/mcp@latest",
      "install_caveat": null,
      "enables_stages": ["2_web", "3_voice"]
    },
    "jina-reader": {
      "kind": "http",
      "endpoint": "https://r.jina.ai/<URL>",
      "auth": "none",
      "rate_limit_hint": "20 RPM keyless; 10000 req/60s global IP cap",
      "homepage": "https://jina.ai/reader",
      "enables_stages": ["3_voice"]
    },
    "dtcg-tokens-file": {
      "kind": "user_artifact",
      "expected_path_glob": "assets/*.tokens.json",
      "format": "W3C Design Tokens Community Group (DTCG)",
      "user_action_hint": "Export tokens from Figma using any DTCG-compatible plugin (Token Press is one validated option: https://www.figma.com/community/plugin/1560757977662930693/token-press-dtcg-exporter) and save the JSON into ./assets/.",
      "enables_stages": ["1_figma"]
    },
    "webfetch": {
      "kind": "native_tool",
      "always_available": true,
      "enables_stages": ["3_voice"]
    },
    "read": {
      "kind": "native_tool",
      "always_available": true,
      "enables_stages": ["4_overview", "5_conflicts", "6_components", "8_brand_md"]
    }
  }
}
```

- [ ] **Step 2: Validate contract data against the schema**

```bash
node --input-type=module -e "
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { readFileSync } from 'node:fs';
const schema   = JSON.parse(readFileSync('schema/mcp-fallback-contract.schema.json', 'utf-8'));
const contract = JSON.parse(readFileSync('schema/mcp-fallback-contract.json',         'utf-8'));
const ajv = new Ajv({ allErrors: true, strict: true });
addFormats(ajv);
const validate = ajv.compile(schema);
const ok = validate(contract);
if (!ok) { console.error(ajv.errorsText(validate.errors)); process.exit(1); }
console.log('OK');
"
```

Expected: prints `OK`. Any validation error means a typo in the data — fix before committing.

- [ ] **Step 3: Run existing test suite**

```bash
npm test 2>&1 | tail -5
```

Expected: still 47/47 passing.

- [ ] **Step 4: Commit**

```bash
echo "feat(schema): add canonical mcp-fallback-contract.json

Per-stage chains for stages 1-6 + 8. Six dependencies covering all four
kinds (mcp, http, user_artifact, native_tool). Stage 3 introduces Jina
Reader as a Tier 2 fallback; Stage 1 introduces dtcg-tokens-file as a
Tier 2 fallback. Spec §2." > /tmp/commit-msg.txt
git add schema/mcp-fallback-contract.json
git commit -F /tmp/commit-msg.txt
```

---

## Task 4: `cli/src/utils/contract-loader.js` (TDD)

**Goal:** Single-import utility that loads + validates the contract on first import. Exports `loadContract()`, `getStageContract(key)`, `getDependency(name)`. Throws on validation failure with a clear ajv error.

**Files:**
- Create: `cli/src/utils/contract-loader.js`
- Test: `cli/test/unit/contract-loader.test.js`

- [ ] **Step 1: Write the failing test**

Create `cli/test/unit/contract-loader.test.js`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  loadContract,
  getStageContract,
  getDependency,
} from '../../src/utils/contract-loader.js';

test('loadContract returns parsed contract with stages and dependencies', () => {
  const c = loadContract();
  assert.equal(c.version, '1');
  assert.ok(c.stages);
  assert.ok(c.dependencies);
});

test('loadContract result is cached (same reference across calls)', () => {
  const a = loadContract();
  const b = loadContract();
  assert.equal(a, b);
});

test('getStageContract returns the stage entry for a known key', () => {
  const s = getStageContract('3_voice');
  assert.equal(s.purpose.length > 0, true);
  assert.ok(Array.isArray(s.chain));
  assert.ok(s.chain.length >= 1);
  assert.equal(s.chain[0].kind, 'mcp');
  assert.equal(s.chain[0].name, 'playwright');
});

test('getStageContract returns undefined for unknown stage', () => {
  const s = getStageContract('99_bogus');
  assert.equal(s, undefined);
});

test('getDependency returns the dependency entry for a known name', () => {
  const d = getDependency('jina-reader');
  assert.equal(d.kind, 'http');
  assert.equal(d.endpoint, 'https://r.jina.ai/<URL>');
  assert.equal(d.auth, 'none');
});

test('getDependency returns undefined for unknown dependency', () => {
  assert.equal(getDependency('not-a-real-dep'), undefined);
});

test('every chain entry references a known dependency name (cross-link integrity)', () => {
  const c = loadContract();
  for (const [stageKey, stage] of Object.entries(c.stages)) {
    for (const entry of stage.chain) {
      assert.ok(
        c.dependencies[entry.name],
        `Stage ${stageKey} chain entry '${entry.name}' has no matching dependencies entry`
      );
    }
  }
});

test('every dependency.enables_stages references a known stage key', () => {
  const c = loadContract();
  const stageKeys = new Set(Object.keys(c.stages));
  for (const [name, dep] of Object.entries(c.dependencies)) {
    for (const stageKey of dep.enables_stages) {
      assert.ok(
        stageKeys.has(stageKey),
        `Dependency '${name}' enables unknown stage '${stageKey}'`
      );
    }
  }
});
```

- [ ] **Step 2: Run test to confirm it fails (no module yet)**

```bash
node --test cli/test/unit/contract-loader.test.js 2>&1 | tail -10
```

Expected: `ERR_MODULE_NOT_FOUND` for `contract-loader.js`.

- [ ] **Step 3: Implement contract-loader.js**

Create `cli/src/utils/contract-loader.js`:

```javascript
/**
 * Loads and validates schema/mcp-fallback-contract.json on first import.
 * Throws on validation failure. Result is cached for the process lifetime.
 * Spec: docs/superpowers/specs/2026-06-13-mcp-fallback-contract-design.md §3.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const SCHEMA_PATH   = resolve(__dirname, '../../../schema/mcp-fallback-contract.schema.json');
const CONTRACT_PATH = resolve(__dirname, '../../../schema/mcp-fallback-contract.json');

let cached = null;

/**
 * Load + validate the contract. Subsequent calls return the cached object.
 * Throws Error with ajv errorsText on validation failure.
 */
export function loadContract() {
  if (cached) return cached;
  const schema   = JSON.parse(readFileSync(SCHEMA_PATH,   'utf-8'));
  const contract = JSON.parse(readFileSync(CONTRACT_PATH, 'utf-8'));
  const ajv = new Ajv({ allErrors: true, strict: true });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  if (!validate(contract)) {
    throw new Error(`mcp-fallback-contract.json failed schema validation: ${ajv.errorsText(validate.errors)}`);
  }
  cached = contract;
  return cached;
}

/** Return the stage entry for a stage key (e.g. '3_voice'), or undefined. */
export function getStageContract(stageKey) {
  return loadContract().stages[stageKey];
}

/** Return the dependency entry for a dependency name (e.g. 'jina-reader'), or undefined. */
export function getDependency(name) {
  return loadContract().dependencies[name];
}
```

- [ ] **Step 4: Run test to confirm it passes**

```bash
node --test cli/test/unit/contract-loader.test.js 2>&1 | tail -10
```

Expected: 8 tests pass.

- [ ] **Step 5: Run full suite**

```bash
npm test 2>&1 | tail -5
```

Expected: 55 pass (47 + 8), 0 fail.

- [ ] **Step 6: Commit**

```bash
echo "feat(cli): add contract-loader utility

loadContract() lazily parses + validates schema/mcp-fallback-contract.json
on first import; subsequent calls return the cached object. Lookup helpers
getStageContract(key) and getDependency(name) for SKILL + emit-manifest
consumers. Cross-link integrity tests guard against stage/dependency drift." > /tmp/commit-msg.txt
git add cli/src/utils/contract-loader.js cli/test/unit/contract-loader.test.js
git commit -F /tmp/commit-msg.txt
```

---

## Task 5: Bump `manifest.schema.json` to `version: "2"`

**Goal:** Update the manifest schema. `version: "1"` → `"2"`. `mcps` → `dependencies`. Each `dependencies[*]` gains `kind`. Each `stages[*]` gains `fallback_decision`, `chain_entry_used`, `required_dependencies`, `available_dependencies`. **Existing tests will break in this task** — they're fixed in Task 6 + Task 7. That's intentional: keep the schema change one commit, the test+fixture migration the next two.

**Files:**
- Modify: `schema/manifest.schema.json`

- [ ] **Step 1: Read the current schema**

(Already familiar from plan-writing — for reference: `schema/manifest.schema.json`. Top-level `required` lists `mcps`; `mcps` is a `patternProperties`-free object with per-entry `available` + `used`. `version` is `const: "1"`.)

- [ ] **Step 2: Replace the schema**

Overwrite `schema/manifest.schema.json` with:

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://github.com/adamforrester/brand-skills/schemas/manifest.schema.json",
  "title": "brand-skills manifest",
  "description": "Facts emitted by /brand-context:extract about the .brand/ package state. Spec: docs/superpowers/specs/2026-06-13-mcp-fallback-contract-design.md §4.",
  "type": "object",
  "required": ["version", "generated_at", "generator", "tier", "files", "stages", "dependencies"],
  "additionalProperties": false,
  "properties": {
    "_comment": { "type": "string" },
    "version": { "const": "2" },
    "generated_at": { "type": "string", "format": "date-time" },
    "generator": { "type": "string", "pattern": "^(brand-cli|brand-extract-skill)@\\S+$" },
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
          "required": ["ran", "fallback_decision"],
          "additionalProperties": false,
          "properties": {
            "ran": { "type": "boolean" },
            "wrote": { "type": "array", "items": { "type": "string" } },
            "reason": { "type": "string" },
            "confidence": { "$ref": "#/$defs/confidence" },
            "samples": { "type": "integer", "minimum": 0 },
            "active": { "type": "integer", "minimum": 0 },
            "sources": { "type": "array", "items": { "type": "string" } },
            "fallback_decision": { "$ref": "#/$defs/fallbackDecision" },
            "chain_entry_used": {
              "oneOf": [
                { "type": "null" },
                {
                  "type": "object",
                  "required": ["kind", "name", "quality_label"],
                  "additionalProperties": false,
                  "properties": {
                    "kind": { "$ref": "#/$defs/kind" },
                    "name": { "type": "string", "minLength": 1 },
                    "quality_label": { "enum": ["full", "degraded"] }
                  }
                }
              ]
            },
            "required_dependencies": { "type": "array", "items": { "type": "string" } },
            "available_dependencies": { "type": "array", "items": { "type": "string" } }
          }
        }
      }
    },
    "dependencies": {
      "type": "object",
      "additionalProperties": {
        "type": "object",
        "required": ["kind", "available", "used_by"],
        "additionalProperties": false,
        "properties": {
          "kind": { "$ref": "#/$defs/kind" },
          "available": { "type": "boolean" },
          "used_by": { "type": "array", "items": { "type": "string" } },
          "expected_path_glob": { "type": "string" }
        }
      }
    }
  },
  "$defs": {
    "status": { "enum": ["complete", "partial", "placeholder", "missing", "defaults"] },
    "confidence": {
      "description": "Per-stage confidence reported by the writing stage at emit time.",
      "enum": ["HIGH", "MEDIUM", "LOW"]
    },
    "kind": { "enum": ["mcp", "http", "user_artifact", "native_tool"] },
    "fallbackDecision": { "enum": ["none", "DOWNGRADE", "SKIP", "HALT"] }
  }
}
```

- [ ] **Step 3: Confirm tests now fail**

```bash
npm test 2>&1 | tail -10
```

Expected: failures referencing the missing `dependencies` field, or `mcps` no longer permitted, or `version: "1"` rejected. Several tests across `manifest-writer.test.js`, `emit-manifest.test.js`, `round-trip.test.js`, `score-emits-health.test.js`, `score-without-manifest.test.js` likely fail. **This is correct.** Tasks 6 + 7 fix them.

- [ ] **Step 4: Commit**

```bash
echo "feat(schema)!: bump manifest to version: \"2\" with dependencies + fallback fields

BREAKING. version const: \"1\" -> \"2\". Top-level mcps renamed to dependencies.
Each dependencies[*] gains kind. Each stages[*] gains fallback_decision (required),
chain_entry_used, required_dependencies, available_dependencies. Existing tests +
fixtures + goldens broken intentionally; fixed in the next two tasks. Spec §4." > /tmp/commit-msg.txt
git add schema/manifest.schema.json
git commit -F /tmp/commit-msg.txt
```

---

## Task 6: Update fixtures + emit-manifest to v2 shape

**Goal:** Migrate `cli/src/commands/emit-manifest.js` to consume `dependencies` (not `mcps`) and emit per-stage fallback fields. Update the three stage-data fixture files. Reject `version: "1"` payloads loudly. Tests + goldens still broken after this task — fixed in Task 7.

**Files:**
- Modify: `cli/src/commands/emit-manifest.js`
- Modify: `cli/test/fixtures/stage-data/full-pipeline.json`
- Modify: `cli/test/fixtures/stage-data/partial-pipeline.json`
- Modify: `cli/test/fixtures/stage-data/no-mcps.json`

- [ ] **Step 1: Update `cli/src/commands/emit-manifest.js`**

Replace the file with the following. Key differences from current: stdin payload is expected to carry `dependencies` (not `mcps`); stages are expected to include `fallback_decision` etc.; output is `version: "2"`. The CLI **does not derive** fallback decisions — it validates and writes through what the SKILL passes. Hard-rejects `version: "1"` if a producer accidentally sends one.

```javascript
import { existsSync, readdirSync, statSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import chalk from 'chalk';
import { parse as yamlParse } from 'yaml';
import { writeManifest, validateManifest } from '../utils/manifest-writer.js';
import { weightsForTier } from '../utils/tier-weights.js';
import { classifyFile } from '../utils/file-status.js';
import { loadContract, getDependency } from '../utils/contract-loader.js';

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

function generatorString() {
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

  const universe = weightsForTier('comprehensive');
  for (const path of Object.keys(universe)) {
    if (files[path]) continue;
    const abs = join(brandDir, path);
    if (!existsSync(abs)) continue;
    files[path] = { status: classifyFile(abs), bytes: statSync(abs).size };
  }

  if (tier === 'comprehensive') {
    for (const path of listExistingComponentFiles(brandDir)) {
      const abs = join(brandDir, path);
      files[path] = { status: classifyFile(abs), bytes: statSync(abs).size };
    }
  }

  for (const [path, override] of Object.entries(stageOverrides ?? {})) {
    if (!files[path]) {
      const abs = join(brandDir, path);
      files[path] = existsSync(abs)
        ? { status: classifyFile(abs), bytes: statSync(abs).size }
        : { status: 'missing' };
    }
    if (override.status) files[path].status = override.status;
    if (override.note) files[path].note = override.note;
  }

  return files;
}

const VALID_TIERS = ['minimum', 'standard', 'comprehensive'];

function rejectV1(input) {
  if (input.version === '1') {
    return 'manifest input uses version "1" shape — the contract is now version "2" '
      + '(see docs/superpowers/specs/2026-06-13-mcp-fallback-contract-design.md §4). '
      + 'Rename mcps -> dependencies and add per-stage fallback_decision before retrying.';
  }
  if (input.mcps !== undefined && input.dependencies === undefined) {
    return 'manifest input has top-level "mcps" but no "dependencies" — the contract is now '
      + 'version "2"; rename mcps -> dependencies and add a kind field to each entry.';
  }
  return null;
}

function validateDependencyNames(dependencies) {
  const contract = loadContract();
  for (const name of Object.keys(dependencies)) {
    if (!contract.dependencies[name]) {
      const valid = Object.keys(contract.dependencies).join(', ');
      return `unknown dependency '${name}'; valid: [${valid}]`;
    }
  }
  return null;
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

  const v1Reason = rejectV1(input);
  if (v1Reason) {
    console.error(chalk.red(v1Reason));
    process.exit(1);
  }

  const brandrc = readBrandrc(projectDir);
  const tier = input.tier ?? brandrc.tier ?? 'minimum';
  const client = input.client ?? brandrc.client ?? '';

  if (!VALID_TIERS.includes(tier)) {
    console.error(chalk.red(
      `Invalid tier "${tier}". Expected one of: ${VALID_TIERS.join(', ')}.`
    ));
    process.exit(1);
  }

  const dependencies = input.dependencies ?? {};
  const depErr = validateDependencyNames(dependencies);
  if (depErr) {
    console.error(chalk.red(depErr));
    process.exit(1);
  }

  // Decorate dependency entries with kind from the contract (so consumers
  // don't have to cross-reference). expected_path_glob also propagated for
  // user_artifact entries.
  const decoratedDependencies = {};
  for (const [name, entry] of Object.entries(dependencies)) {
    const contractDep = getDependency(name);
    decoratedDependencies[name] = {
      kind: contractDep.kind,
      available: entry.available ?? false,
      used_by: entry.used_by ?? [],
    };
    if (contractDep.kind === 'user_artifact' && contractDep.expected_path_glob) {
      decoratedDependencies[name].expected_path_glob = contractDep.expected_path_glob;
    }
  }

  const files = buildFilesMap({
    brandDir,
    tier,
    stageOverrides: input.file_overrides,
  });

  const payload = {
    _comment: 'Generated by brand-cli. Do not hand-edit — overwritten on every /brand-context:extract run.',
    version: '2',
    generated_at: input.generated_at ?? new Date().toISOString(),
    generator: generatorString(),
    tier,
    files,
    stages: input.stages ?? {},
    dependencies: decoratedDependencies,
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

- [ ] **Step 2: Update `cli/test/fixtures/stage-data/full-pipeline.json`**

Replace contents:

```json
{
  "tier": "standard",
  "client": "acme",
  "stages": {
    "1_figma":     { "ran": false, "reason": "skipped: sources.figma unset",
                     "fallback_decision": "SKIP", "chain_entry_used": null,
                     "required_dependencies": ["figma-console"],
                     "available_dependencies": [] },
    "2_web":       { "ran": true,  "wrote": ["tokens/colors.md","tokens/typography.md","tokens/spacing.md","tokens/surfaces.md"],
                     "confidence": "MEDIUM",
                     "fallback_decision": "none",
                     "chain_entry_used": { "kind": "mcp", "name": "playwright", "quality_label": "full" },
                     "required_dependencies": ["playwright"],
                     "available_dependencies": ["playwright"] },
    "3_voice":     { "ran": true,  "wrote": ["voice.md"], "samples": 14, "confidence": "MEDIUM",
                     "fallback_decision": "none",
                     "chain_entry_used": { "kind": "mcp", "name": "playwright", "quality_label": "full" },
                     "required_dependencies": ["playwright"],
                     "available_dependencies": ["playwright", "jina-reader", "webfetch"] },
    "4_overview":  { "ran": true,  "wrote": ["overview.md"], "sources": ["pdf:brand-guide.pdf"],
                     "fallback_decision": "none",
                     "chain_entry_used": { "kind": "native_tool", "name": "read", "quality_label": "full" },
                     "required_dependencies": [],
                     "available_dependencies": ["read"] },
    "5_conflicts": { "ran": true,  "wrote": ["conflicts.md"], "active": 0,
                     "fallback_decision": "none",
                     "chain_entry_used": { "kind": "native_tool", "name": "read", "quality_label": "full" },
                     "required_dependencies": [],
                     "available_dependencies": ["read"] },
    "6_components":{ "ran": false, "reason": "skipped: tier != comprehensive",
                     "fallback_decision": "SKIP", "chain_entry_used": null,
                     "required_dependencies": [],
                     "available_dependencies": ["read"] },
    "8_brand_md":  { "ran": true,  "wrote": ["../brand.md","../design.md"],
                     "fallback_decision": "none",
                     "chain_entry_used": { "kind": "native_tool", "name": "read", "quality_label": "full" },
                     "required_dependencies": [],
                     "available_dependencies": ["read"] }
  },
  "dependencies": {
    "figma-console":    { "available": false, "used_by": [] },
    "playwright":       { "available": true,  "used_by": ["2_web", "3_voice"] },
    "jina-reader":      { "available": true,  "used_by": [] },
    "dtcg-tokens-file": { "available": false, "used_by": [] },
    "webfetch":         { "available": true,  "used_by": [] },
    "read":             { "available": true,  "used_by": ["4_overview", "5_conflicts", "8_brand_md"] }
  }
}
```

- [ ] **Step 3: Update `cli/test/fixtures/stage-data/partial-pipeline.json`**

Replace contents:

```json
{
  "tier": "minimum",
  "client": "acme",
  "stages": {
    "2_web":      { "ran": true,  "wrote": ["tokens/colors.md"], "confidence": "LOW",
                    "fallback_decision": "none",
                    "chain_entry_used": { "kind": "mcp", "name": "playwright", "quality_label": "full" },
                    "required_dependencies": ["playwright"],
                    "available_dependencies": ["playwright"] },
    "3_voice":    { "ran": true,  "wrote": ["voice.md"], "samples": 6, "confidence": "LOW",
                    "fallback_decision": "none",
                    "chain_entry_used": { "kind": "mcp", "name": "playwright", "quality_label": "full" },
                    "required_dependencies": ["playwright"],
                    "available_dependencies": ["playwright", "webfetch"] },
    "4_overview": { "ran": false, "reason": "skipped: no PDF, no screenshots, no Stage 2 captures",
                    "fallback_decision": "SKIP", "chain_entry_used": null,
                    "required_dependencies": [],
                    "available_dependencies": ["read"] }
  },
  "dependencies": {
    "playwright": { "available": true, "used_by": ["2_web", "3_voice"] },
    "read":       { "available": true, "used_by": [] }
  },
  "file_overrides": {
    "voice.md":         { "status": "defaults", "note": "<10 samples; LOW confidence" },
    "tokens/colors.md": { "status": "defaults", "note": "single-page sample" }
  }
}
```

- [ ] **Step 4: Update `cli/test/fixtures/stage-data/no-mcps.json`**

Replace contents:

```json
{
  "tier": "minimum",
  "client": "acme",
  "stages": {
    "1_figma":   { "ran": false, "reason": "skipped: figma-console MCP unavailable, no DTCG file",
                   "fallback_decision": "SKIP", "chain_entry_used": null,
                   "required_dependencies": ["figma-console"],
                   "available_dependencies": [] },
    "2_web":     { "ran": false, "reason": "skipped: playwright MCP unavailable",
                   "fallback_decision": "SKIP", "chain_entry_used": null,
                   "required_dependencies": ["playwright"],
                   "available_dependencies": [] },
    "3_voice":   { "ran": true,  "wrote": ["voice.md"], "samples": 8, "confidence": "LOW",
                   "fallback_decision": "DOWNGRADE",
                   "chain_entry_used": { "kind": "native_tool", "name": "webfetch", "quality_label": "degraded" },
                   "required_dependencies": ["playwright"],
                   "available_dependencies": ["webfetch"] },
    "4_overview":{ "ran": true,  "wrote": ["overview.md"], "sources": ["pdf:brand-guide.pdf"],
                   "fallback_decision": "none",
                   "chain_entry_used": { "kind": "native_tool", "name": "read", "quality_label": "full" },
                   "required_dependencies": [],
                   "available_dependencies": ["read"] },
    "8_brand_md":{ "ran": true,  "wrote": ["../brand.md","../design.md"],
                   "fallback_decision": "none",
                   "chain_entry_used": { "kind": "native_tool", "name": "read", "quality_label": "full" },
                   "required_dependencies": [],
                   "available_dependencies": ["read"] }
  },
  "dependencies": {
    "playwright":       { "available": false, "used_by": [] },
    "figma-console":    { "available": false, "used_by": [] },
    "dtcg-tokens-file": { "available": false, "used_by": [] },
    "webfetch":         { "available": true,  "used_by": ["3_voice"] },
    "read":             { "available": true,  "used_by": ["4_overview", "8_brand_md"] }
  }
}
```

- [ ] **Step 5: Smoke-test emit-manifest end to end**

```bash
mkdir -p /tmp/brand-smoke-mcp && cd /tmp/brand-smoke-mcp
node "$OLDPWD/cli/bin/brand-cli.js" init --client acme --mode standard --force >/dev/null
cat "$OLDPWD/cli/test/fixtures/stage-data/full-pipeline.json" \
  | node "$OLDPWD/cli/bin/brand-cli.js" emit-manifest --dry-run \
  | head -5
cd "$OLDPWD"
rm -rf /tmp/brand-smoke-mcp
```

Expected first 5 lines include `"version": "2"`, `"dependencies"` (not `"mcps"`), and no errors on stderr.

- [ ] **Step 6: Confirm test suite is still in mid-migration state**

```bash
npm test 2>&1 | tail -10
```

Expected: failures persist (the old `validPayload()` in `manifest-writer.test.js` and goldens still reference v1). That's fine — fixed in Task 7.

- [ ] **Step 7: Commit**

```bash
echo "feat(cli): emit-manifest writes manifest version: \"2\"

Stdin payload now carries top-level dependencies (not mcps) and per-stage
fallback_decision/chain_entry_used/required_dependencies/available_dependencies.
v1 inputs hard-rejected with a migration message. Dependency names validated
against the contract. kind decorated onto each emitted dependency entry from
the contract (consumers don't cross-reference). Fixtures updated for the v2
shape; goldens + tests fixed in the next task." > /tmp/commit-msg.txt
git add cli/src/commands/emit-manifest.js cli/test/fixtures/stage-data/
git commit -F /tmp/commit-msg.txt
```

---

## Task 7: Update unit/integration tests + regenerate goldens for v2

**Goal:** Repair the breakage from Tasks 5 + 6. Update `validPayload()` in the manifest-writer unit test, regenerate both manifest goldens, and update the integration tests' shape assertions. Also update `score.js` to read `dependencies` (not `mcps`) and reject v1 manifests.

**Files:**
- Modify: `cli/src/commands/score.js`
- Modify: `cli/test/unit/manifest-writer.test.js`
- Modify: `cli/test/integration/emit-manifest.test.js`
- Modify: `cli/test/integration/round-trip.test.js`
- Modify: `cli/test/integration/score-emits-health.test.js`
- Modify: `cli/test/golden/manifest-from-populated.json` (regenerated)
- Modify: `cli/test/golden/manifest-from-skill.json` (regenerated)

- [ ] **Step 1: Update `cli/src/commands/score.js`**

`score.js` currently reads `manifest.files[*].status` only — that part doesn't change. But it should hard-reject a v1 manifest if a stale one is on disk, and accept v2 cleanly. Add a version check at the top of `readManifest`:

Find this block (lines ~19-27):

```javascript
function readManifest(brandDir) {
  const path = join(brandDir, 'manifest.json');
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch {
    return null;
  }
}
```

Replace with:

```javascript
function readManifest(brandDir) {
  const path = join(brandDir, 'manifest.json');
  if (!existsSync(path)) return null;
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(path, 'utf-8'));
  } catch {
    return null;
  }
  if (parsed.version === '1') {
    console.error(chalk.red(
      'Found .brand/manifest.json with version: "1"; the contract is now version "2". '
      + 'Re-run /brand-context:extract (or brand-cli emit-manifest with the v2 stdin shape) '
      + 'to regenerate. See docs/superpowers/specs/2026-06-13-mcp-fallback-contract-design.md §4.'
    ));
    process.exit(1);
  }
  return parsed;
}
```

- [ ] **Step 2: Update `cli/test/unit/manifest-writer.test.js`**

Replace the `validPayload()` helper at the top of the file:

```javascript
function validPayload() {
  return {
    version: '2',
    generated_at: '2026-06-10T14:23:11Z',
    generator: 'brand-cli@0.4.0',
    tier: 'minimum',
    client: 'acme',
    files: {
      'overview.md': { status: 'complete', bytes: 1000 },
    },
    stages: {
      '4_overview': {
        ran: true,
        wrote: ['overview.md'],
        fallback_decision: 'none',
        chain_entry_used: { kind: 'native_tool', name: 'read', quality_label: 'full' },
        required_dependencies: [],
        available_dependencies: ['read'],
      },
    },
    dependencies: {
      playwright: { kind: 'mcp', available: false, used_by: [] },
    },
  };
}
```

Update the assertion in `'writeManifest writes valid JSON to disk and pretty-prints'` from `parsed.version, '1'` to `parsed.version, '2'`. The other tests (`rejects missing required field`, `rejects invalid status enum`, `rejects unknown root key`, `accepts _comment at root`, `throws on invalid payload`) don't reference `version` directly — leave them.

- [ ] **Step 3: Regenerate `manifest-from-populated.json` golden**

Run the populated fixture through the CLI and capture the output:

```bash
mkdir -p /tmp/golden-pop && cp -r cli/test/fixtures/populated/. /tmp/golden-pop/
cd /tmp/golden-pop
cat "$OLDPWD/cli/test/fixtures/stage-data/full-pipeline.json" \
  | node "$OLDPWD/cli/bin/brand-cli.js" emit-manifest --dry-run \
  > "$OLDPWD/cli/test/golden/manifest-from-populated.json"
cd "$OLDPWD"
rm -rf /tmp/golden-pop
```

Now hand-pin the volatile fields so the golden is reproducible:

```bash
node --input-type=module -e "
import { readFileSync, writeFileSync } from 'node:fs';
const path = 'cli/test/golden/manifest-from-populated.json';
const m = JSON.parse(readFileSync(path, 'utf-8'));
m.generated_at = '2026-06-13T00:00:00.000Z';
m.generator    = 'brand-cli@0.4.0';
writeFileSync(path, JSON.stringify(m, null, 2) + '\n');
console.log('OK');
"
```

- [ ] **Step 4: Regenerate `manifest-from-skill.json` golden**

The SKILL fallback golden is the same shape as `manifest-from-populated.json` but with `generator: brand-extract-skill@<version>` and a different `_comment`. Copy then mutate:

```bash
node --input-type=module -e "
import { readFileSync, writeFileSync } from 'node:fs';
const src = 'cli/test/golden/manifest-from-populated.json';
const dst = 'cli/test/golden/manifest-from-skill.json';
const m = JSON.parse(readFileSync(src, 'utf-8'));
m._comment = 'Reference shape — what the SKILL fallback should produce. Sync with manifest-from-populated.json on edit.';
m.generator = 'brand-extract-skill@0.4.0';
writeFileSync(dst, JSON.stringify(m, null, 2) + '\n');
console.log('OK');
"
```

- [ ] **Step 5: Update `cli/test/integration/emit-manifest.test.js`**

Update the assertions in `emit-manifest writes a schema-valid manifest from populated fixture`. Find:

```javascript
    assert.equal(manifest.version, '1');
    assert.equal(manifest.tier, 'standard');
    assert.equal(manifest.client, 'acme');
    assert.equal(manifest.stages['2_web'].ran, true);
    assert.equal(manifest.mcps.playwright.available, true);
```

Replace with:

```javascript
    assert.equal(manifest.version, '2');
    assert.equal(manifest.tier, 'standard');
    assert.equal(manifest.client, 'acme');
    assert.equal(manifest.stages['2_web'].ran, true);
    assert.equal(manifest.stages['2_web'].fallback_decision, 'none');
    assert.equal(manifest.stages['2_web'].chain_entry_used.name, 'playwright');
    assert.equal(manifest.dependencies.playwright.available, true);
    assert.equal(manifest.dependencies.playwright.kind, 'mcp');
```

Also in the dry-run test, change `assert.equal(parsed.version, '1');` to `assert.equal(parsed.version, '2');`.

- [ ] **Step 6: Update `cli/test/integration/round-trip.test.js`**

The current tests don't assert `version` directly — just `manifest_seen`, `confidence`, `downgrades`. **No change needed** to round-trip.test.js, but verify after running the suite that nothing explodes from the renamed field.

- [ ] **Step 7: Update `cli/test/integration/score-emits-health.test.js`** (read it first, update where it references v1 or `mcps`)

```bash
grep -n "version\|mcps" cli/test/integration/score-emits-health.test.js
```

If anything matches `'1'` or `mcps`, update the same way as Step 5: change literal `'1'` to `'2'`, change `mcps` to `dependencies`. If nothing matches, no edits needed.

- [ ] **Step 8: Run the full suite**

```bash
npm test 2>&1 | tail -10
```

Expected: 55 pass, 0 fail (47 baseline + 8 from contract-loader tests in Task 4). If any tests still fail, read the failure carefully — most likely a stray v1 literal in a fixture or test.

- [ ] **Step 9: Commit**

```bash
echo "feat(cli): migrate tests + goldens to manifest version: \"2\"

manifest-writer.test.js validPayload() updated to v2 shape (dependencies
+ kind + per-stage fallback fields). emit-manifest.test.js asserts v2
fields. score.js hard-rejects v1 manifests on disk with a migration
message. Both goldens regenerated from current emit output, generated_at
and generator pinned for reproducibility." > /tmp/commit-msg.txt
git add cli/src/commands/score.js \
        cli/test/unit/manifest-writer.test.js \
        cli/test/integration/emit-manifest.test.js \
        cli/test/integration/score-emits-health.test.js \
        cli/test/golden/manifest-from-populated.json \
        cli/test/golden/manifest-from-skill.json
git commit -F /tmp/commit-msg.txt
```

---

## Task 8: `cli/src/utils/dtcg-import.js` (TDD)

**Goal:** Read `assets/*.tokens.json`, validate DTCG shape, return in-memory token state grouped by category. Pure function — no I/O beyond `readFileSync` of the path passed in.

The DTCG (W3C Design Tokens Community Group) format uses `$value` and `$type` per token, nested into groups. Sample for color:

```json
{
  "color": {
    "primary": { "$value": "#E2231A", "$type": "color" },
    "neutral-50": { "$value": "#F8F8F8", "$type": "color" }
  }
}
```

Recognized `$type` values for our categorization: `color`, `dimension` (→ spacing or typography size), `fontFamily`, `fontWeight`, `lineHeight`, `letterSpacing`, `cubicBezier` (→ motion), `duration` (→ motion), `shadow` (→ surfaces). Unknown `$type` is preserved verbatim under `tokens.unknown[]` for the SKILL to surface.

**Files:**
- Create: `cli/src/utils/dtcg-import.js`
- Create: `cli/test/unit/dtcg-import.test.js`
- Create: `cli/test/fixtures/dtcg-tokens/colors.tokens.json`
- Create: `cli/test/fixtures/dtcg-tokens/typography.tokens.json`
- Create: `cli/test/fixtures/dtcg-tokens/malformed.tokens.json`
- Create: `cli/test/fixtures/dtcg-tokens/unknown-type.tokens.json`

- [ ] **Step 1: Write fixture files**

`cli/test/fixtures/dtcg-tokens/colors.tokens.json`:

```json
{
  "color": {
    "primary":     { "$value": "#E2231A", "$type": "color" },
    "primary-dark":{ "$value": "#C1190F", "$type": "color" },
    "neutral-900": { "$value": "#1A1A1A", "$type": "color" },
    "neutral-50":  { "$value": "#F8F8F8", "$type": "color" }
  }
}
```

`cli/test/fixtures/dtcg-tokens/typography.tokens.json`:

```json
{
  "font": {
    "family-base":   { "$value": "Inter, sans-serif",  "$type": "fontFamily" },
    "family-display":{ "$value": "Source Serif Pro",   "$type": "fontFamily" }
  },
  "size": {
    "body":   { "$value": "16px", "$type": "dimension" },
    "h1":     { "$value": "48px", "$type": "dimension" },
    "h2":     { "$value": "32px", "$type": "dimension" }
  },
  "weight": {
    "regular":{ "$value": 400,    "$type": "fontWeight" },
    "bold":   { "$value": 700,    "$type": "fontWeight" }
  }
}
```

`cli/test/fixtures/dtcg-tokens/malformed.tokens.json`:

```json
{
  "color": {
    "primary": { "$value": "#E2231A" }
  }
}
```

(Missing `$type` — should error.)

- [ ] **Step 2: Write the failing test**

Create `cli/test/unit/dtcg-import.test.js`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { importDtcgFile, importDtcgFiles } from '../../src/utils/dtcg-import.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const FIXTURES = resolve(__dirname, '../fixtures/dtcg-tokens');

test('importDtcgFile parses a colors.tokens.json into the colors bucket', () => {
  const result = importDtcgFile(resolve(FIXTURES, 'colors.tokens.json'));
  assert.deepEqual(result.colors, {
    'primary':      '#E2231A',
    'primary-dark': '#C1190F',
    'neutral-900':  '#1A1A1A',
    'neutral-50':   '#F8F8F8',
  });
  assert.deepEqual(result.typography, {});
  assert.deepEqual(result.spacing, {});
  assert.deepEqual(result.surfaces, {});
  assert.deepEqual(result.motion, {});
  assert.deepEqual(result.unknown, []);
});

test('importDtcgFile parses a typography.tokens.json into typography fields', () => {
  const result = importDtcgFile(resolve(FIXTURES, 'typography.tokens.json'));
  assert.equal(result.typography['family-base'], 'Inter, sans-serif');
  assert.equal(result.typography['size-body'], '16px');
  assert.equal(result.typography['weight-regular'], 400);
});

test('importDtcgFile throws on missing $type', () => {
  assert.throws(
    () => importDtcgFile(resolve(FIXTURES, 'malformed.tokens.json')),
    /missing \$type/
  );
});

test('importDtcgFile throws on unreadable path', () => {
  assert.throws(
    () => importDtcgFile(resolve(FIXTURES, 'does-not-exist.tokens.json')),
    /no such file|ENOENT/
  );
});

test('importDtcgFiles merges multiple files; later files win on key conflict', () => {
  const result = importDtcgFiles([
    resolve(FIXTURES, 'colors.tokens.json'),
    resolve(FIXTURES, 'typography.tokens.json'),
  ]);
  assert.equal(result.colors.primary, '#E2231A');
  assert.equal(result.typography['family-base'], 'Inter, sans-serif');
});

test('importDtcgFile preserves unknown $type entries verbatim', () => {
  const result = importDtcgFile(resolve(FIXTURES, 'unknown-type.tokens.json'));
  assert.equal(result.unknown.length, 1);
  assert.equal(result.unknown[0].$type, 'gradient');
  assert.equal(result.unknown[0].path, 'gradient.hero');
});
```

Add a fifth fixture file `cli/test/fixtures/dtcg-tokens/unknown-type.tokens.json`:

```json
{
  "gradient": {
    "hero": { "$value": "linear-gradient(...)", "$type": "gradient" }
  }
}
```

- [ ] **Step 3: Run test to confirm it fails**

```bash
node --test cli/test/unit/dtcg-import.test.js 2>&1 | tail -10
```

Expected: `ERR_MODULE_NOT_FOUND` for `dtcg-import.js`.

- [ ] **Step 4: Implement `cli/src/utils/dtcg-import.js`**

```javascript
/**
 * DTCG (W3C Design Tokens Community Group) import. Reads assets/*.tokens.json,
 * validates the per-token { $value, $type } shape, and returns an in-memory
 * token state grouped by category (colors / typography / spacing / surfaces /
 * motion / unknown). Stage 1 fallback path when figma-console MCP is absent.
 * Spec: docs/superpowers/specs/2026-06-13-mcp-fallback-contract-design.md §3 dtcg-tokens-file.
 */

import { readFileSync } from 'node:fs';

const TYPE_TO_BUCKET = {
  color:          'colors',
  fontFamily:     'typography',
  fontWeight:     'typography',
  lineHeight:     'typography',
  letterSpacing:  'typography',
  duration:       'motion',
  cubicBezier:    'motion',
  shadow:         'surfaces',
};

function emptyState() {
  return { colors: {}, typography: {}, spacing: {}, surfaces: {}, motion: {}, unknown: [] };
}

function isToken(node) {
  return node && typeof node === 'object' && '$value' in node;
}

function walkGroup(node, pathParts, state) {
  if (isToken(node)) {
    if (!('$type' in node)) {
      throw new Error(`DTCG token at '${pathParts.join('.')}' missing $type`);
    }
    placeToken(node, pathParts, state);
    return;
  }
  if (node && typeof node === 'object') {
    for (const [key, child] of Object.entries(node)) {
      if (key.startsWith('$')) continue;
      walkGroup(child, [...pathParts, key], state);
    }
  }
}

function placeToken(node, pathParts, state) {
  const $type = node.$type;
  const $value = node.$value;
  const flatName = pathParts.slice(1).join('-') || pathParts[pathParts.length - 1];

  if ($type === 'color') {
    state.colors[flatName] = $value;
    return;
  }
  if ($type === 'dimension') {
    // Heuristic: top-level group 'spacing' / 'space' / 'size' goes to spacing
    // unless the group is 'font' / 'typography', in which case it's typography.
    const top = pathParts[0];
    if (top === 'font' || top === 'typography') {
      state.typography[flatName] = $value;
    } else if (top === 'size') {
      // The fixture uses size.{body,h1,h2}; treat as typography sizes — caller
      // can re-bucket if it wants. Tests assert size-body lands under typography.
      state.typography[flatName] = $value;
    } else {
      state.spacing[flatName] = $value;
    }
    return;
  }
  const bucket = TYPE_TO_BUCKET[$type];
  if (bucket) {
    state[bucket][flatName] = $value;
    return;
  }
  state.unknown.push({ $type, $value, path: pathParts.join('.') });
}

/**
 * Read one DTCG tokens file and return a normalized token state object.
 * Throws on missing $type or invalid JSON.
 */
export function importDtcgFile(absPath) {
  const raw = readFileSync(absPath, 'utf-8');
  const parsed = JSON.parse(raw);
  const state = emptyState();
  walkGroup(parsed, [], state);
  return state;
}

/**
 * Read multiple DTCG token files and merge. Later files win on key collision
 * within the same bucket. unknown[] entries accumulate.
 */
export function importDtcgFiles(absPaths) {
  const merged = emptyState();
  for (const path of absPaths) {
    const state = importDtcgFile(path);
    for (const bucket of ['colors', 'typography', 'spacing', 'surfaces', 'motion']) {
      Object.assign(merged[bucket], state[bucket]);
    }
    merged.unknown.push(...state.unknown);
  }
  return merged;
}
```

- [ ] **Step 5: Run test**

```bash
node --test cli/test/unit/dtcg-import.test.js 2>&1 | tail -10
```

Expected: 5 tests pass.

- [ ] **Step 6: Run full suite**

```bash
npm test 2>&1 | tail -5
```

Expected: 60 pass (55 + 5), 0 fail.

- [ ] **Step 7: Commit**

```bash
echo "feat(cli): dtcg-import utility for Stage 1 fallback

importDtcgFile + importDtcgFiles: read W3C Design Tokens Community Group
JSON, validate per-token { \$value, \$type }, return in-memory state
grouped by colors/typography/spacing/surfaces/motion/unknown. Unknown
\$type values preserved for SKILL surfacing rather than dropped.
Throws on missing \$type or invalid JSON.

Spec §3 dtcg-tokens-file. Stage 1 Tier 2 chain entry." > /tmp/commit-msg.txt
git add cli/src/utils/dtcg-import.js \
        cli/test/unit/dtcg-import.test.js \
        cli/test/fixtures/dtcg-tokens/
git commit -F /tmp/commit-msg.txt
```

---

## Task 9: `cli/src/utils/jina-fetch.js` (TDD)

**Goal:** A keyless `r.jina.ai` HTTP wrapper. Pure function over `globalThis.fetch` (Node ≥22 has it built in). Rate-limit-aware: 429 surfaces as a typed error so the caller can fall through. Test with mocked fetch — no real network.

**Contract:**
- `fetchViaJina(url, opts?)` → resolves `{ ok: true, markdown: string }` on 2xx, or rejects with `JinaFetchError` on non-2xx / network failure.
- `JinaFetchError.code` is one of `'rate_limit'`, `'http_error'`, `'network_error'`.
- The HTTP request is `GET https://r.jina.ai/<url>` with no auth; `<url>` is concatenated as-is (Jina expects unencoded).
- `opts.fetch` injects a fetch implementation (used only by tests).

**Files:**
- Create: `cli/src/utils/jina-fetch.js`
- Create: `cli/test/unit/jina-fetch.test.js`

- [ ] **Step 1: Write the failing test**

Create `cli/test/unit/jina-fetch.test.js`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchViaJina, JinaFetchError } from '../../src/utils/jina-fetch.js';

function fakeFetch(impl) {
  return async (url, init) => impl(url, init);
}

test('fetchViaJina builds the r.jina.ai URL and returns markdown on 200', async () => {
  let seenUrl = null;
  const fetch = fakeFetch(async (url) => {
    seenUrl = url;
    return {
      ok: true,
      status: 200,
      text: async () => '# Hello\n\nWorld\n',
    };
  });

  const result = await fetchViaJina('https://example.com/about', { fetch });
  assert.equal(result.ok, true);
  assert.equal(result.markdown, '# Hello\n\nWorld\n');
  assert.equal(seenUrl, 'https://r.jina.ai/https://example.com/about');
});

test('fetchViaJina throws JinaFetchError(rate_limit) on 429', async () => {
  const fetch = fakeFetch(async () => ({ ok: false, status: 429, text: async () => '' }));
  await assert.rejects(
    () => fetchViaJina('https://example.com', { fetch }),
    (err) => err instanceof JinaFetchError && err.code === 'rate_limit' && err.status === 429
  );
});

test('fetchViaJina throws JinaFetchError(http_error) on 5xx', async () => {
  const fetch = fakeFetch(async () => ({ ok: false, status: 503, text: async () => 'Service Unavailable' }));
  await assert.rejects(
    () => fetchViaJina('https://example.com', { fetch }),
    (err) => err instanceof JinaFetchError && err.code === 'http_error' && err.status === 503
  );
});

test('fetchViaJina throws JinaFetchError(network_error) on fetch reject', async () => {
  const fetch = fakeFetch(async () => { throw new Error('ECONNREFUSED'); });
  await assert.rejects(
    () => fetchViaJina('https://example.com', { fetch }),
    (err) => err instanceof JinaFetchError && err.code === 'network_error'
  );
});

test('fetchViaJina rejects empty url early without calling fetch', async () => {
  let called = false;
  const fetch = fakeFetch(async () => { called = true; return { ok: true, status: 200, text: async () => '' }; });
  await assert.rejects(() => fetchViaJina('', { fetch }), /url is required/);
  assert.equal(called, false);
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
node --test cli/test/unit/jina-fetch.test.js 2>&1 | tail -10
```

Expected: `ERR_MODULE_NOT_FOUND`.

- [ ] **Step 3: Implement `cli/src/utils/jina-fetch.js`**

```javascript
/**
 * Jina Reader (r.jina.ai) HTTP client. Keyless GET; rate-limit-aware. Used as
 * the Stage 3 voice-extraction Tier 2 fallback when Playwright MCP is absent.
 * Spec: docs/superpowers/specs/2026-06-13-mcp-fallback-contract-design.md §3 jina-reader.
 */

const JINA_PREFIX = 'https://r.jina.ai/';

export class JinaFetchError extends Error {
  constructor(message, { code, status } = {}) {
    super(message);
    this.name = 'JinaFetchError';
    this.code = code;
    this.status = status;
  }
}

/**
 * GET https://r.jina.ai/<url>. Returns { ok: true, markdown } on 2xx.
 * Throws JinaFetchError on non-2xx, rate-limit, or network failure.
 *
 * opts.fetch — inject a fetch implementation (tests only). Defaults to globalThis.fetch.
 */
export async function fetchViaJina(url, opts = {}) {
  if (!url) throw new Error('fetchViaJina: url is required');
  const fetchImpl = opts.fetch ?? globalThis.fetch;

  let response;
  try {
    response = await fetchImpl(JINA_PREFIX + url);
  } catch (err) {
    throw new JinaFetchError(`network error fetching ${url} via Jina: ${err.message}`, { code: 'network_error' });
  }

  if (response.status === 429) {
    throw new JinaFetchError(`Jina Reader rate-limited (429) for ${url}`, { code: 'rate_limit', status: 429 });
  }
  if (!response.ok) {
    throw new JinaFetchError(`Jina Reader returned ${response.status} for ${url}`, { code: 'http_error', status: response.status });
  }

  const markdown = await response.text();
  return { ok: true, markdown };
}
```

- [ ] **Step 4: Run test**

```bash
node --test cli/test/unit/jina-fetch.test.js 2>&1 | tail -10
```

Expected: 5 tests pass.

- [ ] **Step 5: Run full suite**

```bash
npm test 2>&1 | tail -5
```

Expected: 65 pass (60 + 5), 0 fail.

- [ ] **Step 6: Commit**

```bash
echo "feat(cli): jina-fetch utility for Stage 3 Tier 2 fallback

fetchViaJina(url) wraps a keyless GET to r.jina.ai; returns { ok, markdown }
on 2xx; throws typed JinaFetchError on rate_limit (429), http_error (other
non-2xx), or network_error. Tests use injected fetch — no real network.

Spec §3 jina-reader. Wires into the SKILL Stage 3 prose update next." > /tmp/commit-msg.txt
git add cli/src/utils/jina-fetch.js cli/test/unit/jina-fetch.test.js
git commit -F /tmp/commit-msg.txt
```

---

## Task 10: `cli/src/commands/import-tokens.js` + `brand-cli import-tokens` (TDD)

**Goal:** New CLI subcommand that ingests `assets/*.tokens.json` (DTCG) and prints the parsed token state as JSON. The SKILL's Stage 1 fallback path consumes this output (or invokes the same `importDtcgFiles` utility inline if `brand-cli` is absent). The command does **not** write to `.brand/tokens/*.md` directly — Stage 4 (token-file writing in the SKILL) does that. Keeping `import-tokens` a pure projection makes it easy for the SKILL to read structured data.

**Files:**
- Create: `cli/src/commands/import-tokens.js`
- Modify: `cli/bin/brand-cli.js` (register subcommand)
- Create: `cli/test/integration/import-tokens.test.js`

- [ ] **Step 1: Write the failing test**

Create `cli/test/integration/import-tokens.test.js`:

```javascript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, copyFileSync, rmSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runCli } from '../helpers/run-cli.js';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const FIXTURES = resolve(__dirname, '../fixtures/dtcg-tokens');

function tmpProjectWith(fileNames) {
  const dir = mkdtempSync(join(tmpdir(), 'brand-import-'));
  const assetsDir = join(dir, 'assets');
  mkdirSync(assetsDir, { recursive: true });
  for (const name of fileNames) {
    copyFileSync(resolve(FIXTURES, name), join(assetsDir, name));
  }
  return { dir, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

test('import-tokens emits merged token state as JSON for assets/*.tokens.json', async () => {
  const { dir, cleanup } = tmpProjectWith(['colors.tokens.json', 'typography.tokens.json']);
  try {
    const result = await runCli(['import-tokens'], { cwd: dir });
    assert.equal(result.exitCode, 0, `stderr: ${result.stderr}`);
    const out = JSON.parse(result.stdout);
    assert.equal(out.colors.primary, '#E2231A');
    assert.equal(out.typography['family-base'], 'Inter, sans-serif');
    assert.deepEqual(out.unknown, []);
  } finally {
    cleanup();
  }
});

test('import-tokens fails when no assets/*.tokens.json files are present', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'brand-import-'));
  try {
    const result = await runCli(['import-tokens'], { cwd: dir });
    assert.notEqual(result.exitCode, 0);
    assert.match(result.stderr, /No DTCG token files/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('import-tokens --file <path> reads exactly that file', async () => {
  const { dir, cleanup } = tmpProjectWith(['colors.tokens.json', 'typography.tokens.json']);
  try {
    const result = await runCli(
      ['import-tokens', '--file', 'assets/colors.tokens.json'],
      { cwd: dir }
    );
    assert.equal(result.exitCode, 0);
    const out = JSON.parse(result.stdout);
    assert.equal(out.colors.primary, '#E2231A');
    assert.deepEqual(out.typography, {});
  } finally {
    cleanup();
  }
});

test('import-tokens fails with parse error on malformed DTCG', async () => {
  const { dir, cleanup } = tmpProjectWith(['malformed.tokens.json']);
  try {
    const result = await runCli(['import-tokens'], { cwd: dir });
    assert.notEqual(result.exitCode, 0);
    assert.match(result.stderr, /missing \$type/);
  } finally {
    cleanup();
  }
});
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
node --test cli/test/integration/import-tokens.test.js 2>&1 | tail -10
```

Expected: failures referencing the missing subcommand (`unknown command 'import-tokens'`).

- [ ] **Step 3: Implement `cli/src/commands/import-tokens.js`**

```javascript
/**
 * brand-cli import-tokens — ingest assets/*.tokens.json (DTCG) and print
 * merged token state as JSON to stdout. Stage 1 fallback path when
 * figma-console MCP is absent. The SKILL writes the token files; this
 * command is a pure projection.
 *
 * Spec: docs/superpowers/specs/2026-06-13-mcp-fallback-contract-design.md
 *       §3 dtcg-tokens-file, §6 (CLI layer).
 */

import { existsSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, isAbsolute } from 'node:path';
import chalk from 'chalk';
import { importDtcgFiles } from '../utils/dtcg-import.js';

const ASSETS_DIR = 'assets';
const TOKEN_GLOB_SUFFIX = '.tokens.json';

function findTokenFiles(projectDir) {
  const dir = join(projectDir, ASSETS_DIR);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(TOKEN_GLOB_SUFFIX))
    .map((f) => join(dir, f));
}

export async function importTokensCommand(opts) {
  const projectDir = process.cwd();

  let files;
  if (opts.file) {
    const abs = isAbsolute(opts.file) ? opts.file : resolve(projectDir, opts.file);
    if (!existsSync(abs) || !statSync(abs).isFile()) {
      console.error(chalk.red(`File not found: ${opts.file}`));
      process.exit(1);
    }
    files = [abs];
  } else {
    files = findTokenFiles(projectDir);
    if (files.length === 0) {
      console.error(chalk.red(
        `No DTCG token files found at ${ASSETS_DIR}/*${TOKEN_GLOB_SUFFIX}. `
        + `Export tokens from a DTCG-compatible Figma plugin (e.g. Token Press) and drop the JSON into ./${ASSETS_DIR}/.`
      ));
      process.exit(1);
    }
  }

  let merged;
  try {
    merged = importDtcgFiles(files);
  } catch (err) {
    console.error(chalk.red(`DTCG parse error: ${err.message}`));
    process.exit(1);
  }

  process.stdout.write(JSON.stringify(merged, null, 2) + '\n');
}
```

- [ ] **Step 4: Register the subcommand in `cli/bin/brand-cli.js`**

Add the import at the top alongside the others:

```javascript
import { importTokensCommand } from '../src/commands/import-tokens.js';
```

Add the program block after the `emit-manifest` block:

```javascript
program
  .command('import-tokens')
  .description('Ingest DTCG token files (assets/*.tokens.json) and print merged token state as JSON. Stage 1 fallback when figma-console MCP is absent.')
  .option('--file <path>', 'Read exactly this file instead of scanning assets/')
  .action(importTokensCommand);
```

- [ ] **Step 5: Run the test**

```bash
node --test cli/test/integration/import-tokens.test.js 2>&1 | tail -10
```

Expected: 4 tests pass.

- [ ] **Step 6: Run full suite**

```bash
npm test 2>&1 | tail -5
```

Expected: 69 pass (65 + 4), 0 fail.

- [ ] **Step 7: Commit**

```bash
echo "feat(cli): brand-cli import-tokens subcommand

Ingest assets/*.tokens.json (DTCG) and print merged token state as JSON
to stdout. --file <path> reads exactly one file. Surfaces a clear error
when no token files are present (with install hint pointing at the
Figma plugin). The SKILL writes the .brand/tokens/*.md files; this
subcommand is a pure projection.

Spec §3 dtcg-tokens-file, §6 CLI layer." > /tmp/commit-msg.txt
git add cli/src/commands/import-tokens.js \
        cli/bin/brand-cli.js \
        cli/test/integration/import-tokens.test.js
git commit -F /tmp/commit-msg.txt
```

---

## Task 11: Pre-flight integration test (`preflight.test.js`)

**Goal:** Lock in the contract's behavior end-to-end via the manifest output. There's no separate "preflight" CLI command — pre-flight notices live in the SKILL prose. But we can verify the **decision math** (what `fallback_decision` lands per stage given a dependency-availability shape) by feeding three distinct scenarios through `emit-manifest` and asserting the resulting manifest captures the right `fallback_decision` + `chain_entry_used` per stage. This is the test that prevents stage/dependency drift.

**Files:**
- Create: `cli/test/integration/preflight.test.js`
- Create: `cli/test/fixtures/stage-data/all-mcps-available.json`
- Create: `cli/test/fixtures/stage-data/no-mcps-jina-available.json`
- Create: `cli/test/fixtures/stage-data/dtcg-only.json`

- [ ] **Step 1: Write the three new stage-data fixtures**

Each represents a different real-world dependency shape. The SKILL is responsible for *choosing* which chain entry fires; the fixture just records what the SKILL would emit. The test verifies the contract data + `emit-manifest` faithfully record those choices.

`cli/test/fixtures/stage-data/all-mcps-available.json`:

```json
{
  "tier": "minimum",
  "client": "acme",
  "stages": {
    "1_figma":   { "ran": true, "wrote": ["tokens/colors.md"],
                   "fallback_decision": "none",
                   "chain_entry_used": { "kind": "mcp", "name": "figma-console", "quality_label": "full" },
                   "required_dependencies": ["figma-console"],
                   "available_dependencies": ["figma-console", "playwright"] },
    "2_web":     { "ran": true, "wrote": ["tokens/typography.md"], "confidence": "HIGH",
                   "fallback_decision": "none",
                   "chain_entry_used": { "kind": "mcp", "name": "playwright", "quality_label": "full" },
                   "required_dependencies": ["playwright"],
                   "available_dependencies": ["playwright"] },
    "3_voice":   { "ran": true, "wrote": ["voice.md"], "samples": 30, "confidence": "HIGH",
                   "fallback_decision": "none",
                   "chain_entry_used": { "kind": "mcp", "name": "playwright", "quality_label": "full" },
                   "required_dependencies": ["playwright"],
                   "available_dependencies": ["playwright", "jina-reader", "webfetch"] },
    "8_brand_md":{ "ran": true, "wrote": ["../brand.md"],
                   "fallback_decision": "none",
                   "chain_entry_used": { "kind": "native_tool", "name": "read", "quality_label": "full" },
                   "required_dependencies": [],
                   "available_dependencies": ["read"] }
  },
  "dependencies": {
    "figma-console":    { "available": true,  "used_by": ["1_figma"] },
    "playwright":       { "available": true,  "used_by": ["2_web", "3_voice"] },
    "jina-reader":      { "available": true,  "used_by": [] },
    "webfetch":         { "available": true,  "used_by": [] },
    "read":             { "available": true,  "used_by": ["8_brand_md"] },
    "dtcg-tokens-file": { "available": false, "used_by": [] }
  }
}
```

`cli/test/fixtures/stage-data/no-mcps-jina-available.json`:

```json
{
  "tier": "minimum",
  "client": "acme",
  "stages": {
    "1_figma":   { "ran": false, "reason": "skipped: no figma-console MCP, no DTCG file",
                   "fallback_decision": "SKIP", "chain_entry_used": null,
                   "required_dependencies": ["figma-console"],
                   "available_dependencies": [] },
    "2_web":     { "ran": false, "reason": "skipped: no playwright MCP",
                   "fallback_decision": "SKIP", "chain_entry_used": null,
                   "required_dependencies": ["playwright"],
                   "available_dependencies": [] },
    "3_voice":   { "ran": true, "wrote": ["voice.md"], "samples": 12, "confidence": "MEDIUM",
                   "fallback_decision": "DOWNGRADE",
                   "chain_entry_used": { "kind": "http", "name": "jina-reader", "quality_label": "degraded" },
                   "required_dependencies": ["playwright"],
                   "available_dependencies": ["jina-reader", "webfetch"] },
    "8_brand_md":{ "ran": true, "wrote": ["../brand.md"],
                   "fallback_decision": "none",
                   "chain_entry_used": { "kind": "native_tool", "name": "read", "quality_label": "full" },
                   "required_dependencies": [],
                   "available_dependencies": ["read"] }
  },
  "dependencies": {
    "figma-console":    { "available": false, "used_by": [] },
    "playwright":       { "available": false, "used_by": [] },
    "jina-reader":      { "available": true,  "used_by": ["3_voice"] },
    "webfetch":         { "available": true,  "used_by": [] },
    "read":             { "available": true,  "used_by": ["8_brand_md"] },
    "dtcg-tokens-file": { "available": false, "used_by": [] }
  }
}
```

`cli/test/fixtures/stage-data/dtcg-only.json`:

```json
{
  "tier": "minimum",
  "client": "acme",
  "stages": {
    "1_figma":   { "ran": true, "wrote": ["tokens/colors.md", "tokens/typography.md"],
                   "fallback_decision": "DOWNGRADE",
                   "chain_entry_used": { "kind": "user_artifact", "name": "dtcg-tokens-file", "quality_label": "degraded" },
                   "required_dependencies": ["figma-console"],
                   "available_dependencies": ["dtcg-tokens-file"] },
    "8_brand_md":{ "ran": true, "wrote": ["../brand.md"],
                   "fallback_decision": "none",
                   "chain_entry_used": { "kind": "native_tool", "name": "read", "quality_label": "full" },
                   "required_dependencies": [],
                   "available_dependencies": ["read"] }
  },
  "dependencies": {
    "figma-console":    { "available": false, "used_by": [] },
    "dtcg-tokens-file": { "available": true,  "used_by": ["1_figma"] },
    "read":             { "available": true,  "used_by": ["8_brand_md"] }
  }
}
```

- [ ] **Step 2: Write the integration test**

Create `cli/test/integration/preflight.test.js`:

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

async function emitWith(stageDataName) {
  const { dir, brandDir, cleanup } = withFixture('populated');
  try {
    const stdin = readFileSync(join(FIXTURES, 'stage-data', stageDataName), 'utf-8');
    const result = await runCli(['emit-manifest'], { cwd: dir, stdin });
    assert.equal(result.exitCode, 0, `stderr: ${result.stderr}`);
    const manifest = JSON.parse(readFileSync(join(brandDir, 'manifest.json'), 'utf-8'));
    return manifest;
  } finally {
    cleanup();
  }
}

test('preflight: all MCPs available — every stage fallback_decision: none', async () => {
  const m = await emitWith('all-mcps-available.json');
  for (const [stageKey, stage] of Object.entries(m.stages)) {
    assert.equal(stage.fallback_decision, 'none', `${stageKey} should be 'none'`);
    assert.notEqual(stage.chain_entry_used, null);
    assert.equal(stage.chain_entry_used.quality_label, 'full');
  }
  assert.equal(m.dependencies['figma-console'].available, true);
  assert.equal(m.dependencies['figma-console'].kind, 'mcp');
});

test('preflight: no MCPs but Jina available — Stage 3 DOWNGRADE via jina-reader', async () => {
  const m = await emitWith('no-mcps-jina-available.json');
  assert.equal(m.stages['1_figma'].fallback_decision, 'SKIP');
  assert.equal(m.stages['1_figma'].chain_entry_used, null);
  assert.equal(m.stages['2_web'].fallback_decision, 'SKIP');
  assert.equal(m.stages['3_voice'].fallback_decision, 'DOWNGRADE');
  assert.equal(m.stages['3_voice'].chain_entry_used.kind, 'http');
  assert.equal(m.stages['3_voice'].chain_entry_used.name, 'jina-reader');
  assert.equal(m.stages['3_voice'].chain_entry_used.quality_label, 'degraded');
  assert.equal(m.dependencies['jina-reader'].kind, 'http');
  assert.equal(m.dependencies['jina-reader'].used_by[0], '3_voice');
});

test('preflight: dtcg-only — Stage 1 DOWNGRADE via user_artifact', async () => {
  const m = await emitWith('dtcg-only.json');
  assert.equal(m.stages['1_figma'].fallback_decision, 'DOWNGRADE');
  assert.equal(m.stages['1_figma'].chain_entry_used.kind, 'user_artifact');
  assert.equal(m.stages['1_figma'].chain_entry_used.name, 'dtcg-tokens-file');
  assert.equal(m.dependencies['dtcg-tokens-file'].kind, 'user_artifact');
  assert.equal(m.dependencies['dtcg-tokens-file'].expected_path_glob, 'assets/*.tokens.json');
});

test('preflight: emit-manifest hard-rejects unknown dependency name', async () => {
  const { dir, cleanup } = withFixture('populated');
  try {
    const stdin = JSON.stringify({
      tier: 'minimum',
      client: 'acme',
      stages: {},
      dependencies: { 'totally-not-real': { available: true, used_by: [] } },
    });
    const result = await runCli(['emit-manifest'], { cwd: dir, stdin });
    assert.notEqual(result.exitCode, 0);
    assert.match(result.stderr, /unknown dependency 'totally-not-real'/);
  } finally {
    cleanup();
  }
});

test('preflight: emit-manifest hard-rejects v1 mcps payload with migration message', async () => {
  const { dir, cleanup } = withFixture('populated');
  try {
    const stdin = JSON.stringify({
      version: '1',
      tier: 'minimum',
      client: 'acme',
      stages: {},
      mcps: { playwright: { available: true, used: [] } },
    });
    const result = await runCli(['emit-manifest'], { cwd: dir, stdin });
    assert.notEqual(result.exitCode, 0);
    assert.match(result.stderr, /version "2"/);
  } finally {
    cleanup();
  }
});
```

- [ ] **Step 3: Run the test**

```bash
node --test cli/test/integration/preflight.test.js 2>&1 | tail -15
```

Expected: 5 tests pass.

- [ ] **Step 4: Run full suite**

```bash
npm test 2>&1 | tail -5
```

Expected: 74 pass (69 + 5), 0 fail.

- [ ] **Step 5: Commit**

```bash
echo "test(integration): preflight contract decision-math fixtures + tests

Three end-to-end scenarios feed emit-manifest and assert the manifest
captures fallback_decision + chain_entry_used + dependency kind faithfully:
all MCPs available (every stage 'none'); no MCPs but Jina up (Stage 3
DOWNGRADE via jina-reader); dtcg-only (Stage 1 DOWNGRADE via user_artifact).
Plus negative cases: unknown dependency name rejected; v1 mcps payload
hard-rejected with migration message.

Locks in the cross-task contract: dependency names + kinds + stage keys
must stay in sync across contract data, schema, fixtures, and SKILL prose." > /tmp/commit-msg.txt
git add cli/test/integration/preflight.test.js cli/test/fixtures/stage-data/
git commit -F /tmp/commit-msg.txt
```

---

## Task 12: SKILL update — new `§0.5 Pre-flight dependency check`

**Goal:** Insert a new SKILL section between `§0` (source discovery) and `§1` (scope confirmation) that:
1. Detects which dependencies from the contract are available
2. Computes per-stage `fallback_decision` from the contract chains
3. Surfaces user-facing notices for stages where decision ∈ {SKIP, DOWNGRADE} **and** preconditions are met
4. Honors `interactive_preflight: false` in `.brandrc.yaml` (embedded mode)

The contract supplies structured fields; the SKILL prose owns the templating.

**Files:**
- Modify: `brand-context/skills/brand-extract/SKILL.md` (insert `§0.5`, modify `§0f` to point to the new section)

- [ ] **Step 1: Read the existing `§0f` to ground the insert**

Already familiar from plan-writing — `§0f` is at line 105 ("Detect available tools"). It does ad-hoc `claude mcp list` checks per stage. The new `§0.5` formalizes this into a contract-driven step.

- [ ] **Step 2: Replace `§0f` with a thin pointer + insert `§0.5`**

Find the existing `§0f` block (lines 105–114):

```markdown
### 0f. Detect available tools

Now check MCP availability — warn, don't block:

- Run `claude mcp list`. Note whether `playwright` and `figma-console` are listed and connected.
- **No MCPs detected at all.** Fine — Stages 4, 5, 6, 7, 8 run native. Stage 2 (web tokens) will be skipped, Stage 3 (voice) falls back to native `WebFetch`. Surface this in the scope-confirmation message.
- **Playwright missing.** Stage 2 skipped, Stage 3 degrades to WebFetch. Suggest `brand-cli setup` (one-command install, no signup) or `claude mcp add playwright -s user -- npx -y @playwright/mcp@latest`.
- **Figma Console missing AND `sources.figma` is set.** Stage 1 skipped. Surface a note. Continue with Stage 2.

Stop only when no useful input is available at all (no website, no PDFs, no screenshots, no Figma) — and even then, surface a clear "I have nothing to extract from. Drop assets into `./assets/` or paste a URL, then re-run" message rather than crashing.
```

Replace with:

```markdown
### 0f. Detect available tools

Tool detection is now driven by the MCP-fallback contract — see §0.5 below.
This subsection is preserved as a pointer so the §0a–§0e numbering still
follows on naturally; do not duplicate the detection logic here.

## 0.5 Pre-flight dependency check (contract-driven)

The contract at `schema/mcp-fallback-contract.json` declares per-stage fallback
chains. Pre-flight check answers two questions before the pipeline runs:

1. **Per dependency: is it available?** Passive checks only (no active prompting):
   - `kind: mcp` — run `claude mcp list`; treat as available if name appears AND status is `connected`.
   - `kind: http` — best-effort GET against the endpoint root (Jina: `GET https://r.jina.ai/`); treat 2xx/3xx as available, anything else (including network unreachable) as unavailable. Skip the probe if the user is offline; record `available: false` silently.
   - `kind: user_artifact` — check the `expected_path_glob` (e.g., `assets/*.tokens.json`) on disk. Available if at least one matching file exists.
   - `kind: native_tool` — always available.

2. **Per stage: what's the resolved `fallback_decision`?** Walk the stage's `chain` top-to-bottom; the first available entry fires. Apply this rule to set the manifest fields the stage will emit:
   - **Pre-conditions fail** (e.g., `sources.figma` empty AND `dtcg-tokens-file` not present): `fallback_decision: "SKIP"`, `chain_entry_used: null`, `reason: "<which precondition unmet>"`. The chain itself was never asked to fire.
   - **Top-of-chain entry fired**: `fallback_decision: "none"`, `chain_entry_used: { kind, name, quality_label: "full" }`.
   - **Lower entry fired**: `fallback_decision: "DOWNGRADE"`, `chain_entry_used: { kind, name, quality_label: "degraded" }`.
   - **Chain exhausted, no native floor** (only stages 1 + 2 today): `fallback_decision: "SKIP"`, `chain_entry_used: null`.
   - **Chain has a `native_tool` floor** (stages 3 / 4 / 5 / 6 / 8): always reaches at least the native floor; never SKIP at chain-floor.

Hold the resolved per-stage decisions in memory. They flow into the Section 10b manifest emission alongside `required_dependencies` (names from contract chain marked `quality_label: full`) and `available_dependencies` (names actually detected as available).

### 0.5a. Surface notices to the practitioner

For each stage where `fallback_decision ∈ {"SKIP", "DOWNGRADE"}` AND the stage's preconditions are met, surface a notice **before** asking "ready to proceed?" in §1 (scope confirmation). Templates use the contract's `install_hint`, `install_caveat`, `fidelity_note`, and `user_action_hint` fields.

**Stage 1 (figma-console missing AND no DTCG file, but `sources.figma` set):**

```
⚠ Stage 1 — Figma variable extraction will SKIP

Reason: Neither figma-console MCP nor a DTCG token export is available.
You provided sources.figma=<URL>, so without one of these, Figma extraction can't run.

Options before we proceed:
  a) Install figma-console MCP (originally distributed with XD-toolkit; install separately):
     claude mcp add figma-console -s user -- npx -y @figma-console/mcp@latest
     Note: the official Figma MCP (Dev Mode) is a different package — its variable
     extraction is per-selection, not file-wide; not a substitute.
  b) Export your Figma variables as DTCG JSON and drop the file into ./assets/.
     Any DTCG-compatible Figma plugin works; we've validated Token Press:
     https://www.figma.com/community/plugin/1560757977662930693/token-press-dtcg-exporter
  c) Proceed without Figma variables — token files will stay as placeholders;
     Stage 2 (web token extraction) will still run if Playwright is available.

Which? (a / b / c)
```

**Stage 1 (figma-console missing, DTCG file present):** No SKIP — fallback fires. Surface a one-line DOWNGRADE note inline in the §1 scope confirmation rather than a full notice block: "Stage 1 will use your DTCG export (`{filename}`) instead of figma-console; quality is comparable for primitive values, alias chains may flatten."

**Stage 2 (Playwright missing, but `sources.website` set):**

```
⚠ Stage 2 — Web token extraction will SKIP

Reason: Playwright MCP not available. There's no usable middle tier — token
extraction needs computed CSS, which keyless HTTP services don't expose.

Options before we proceed:
  a) Install Playwright MCP for full quality (recommended):
     claude mcp add playwright -s user -- npx -y @playwright/mcp@latest
     Or run `brand-cli setup` for the same one-line install.
  b) Proceed without web tokens — Stage 1 (Figma or DTCG) tokens will be
     primary; if Stage 1 also can't run, token files stay as placeholders.

Which? (a / b)
```

**Stage 3 (Playwright missing, but `sources.website` set):**

```
⚠ Stage 3 — Voice extraction will DOWNGRADE

Reason: Playwright MCP not available.
Falling back to Jina Reader (https://r.jina.ai/, keyless) — captures rendered text
on JS-heavy SPAs. Quality is comparable for voice samples; you lose the
accessibility tree (semantic role labels), so confidence will be MEDIUM, not HIGH.

Continue with Jina, or:
  a) Install Playwright MCP for full quality:
     claude mcp add playwright -s user -- npx -y @playwright/mcp@latest

Continue with Jina? (yes / a)
```

If Jina is also unreachable, the SKILL falls through to WebFetch automatically — adjust the notice to read "Falling back to native WebFetch (SSR sites only; SPAs return sparse content)" before proceeding. If WebFetch also fails at runtime (page returns 404), that's a runtime error not a fallback decision; let Stage 3 surface it normally.

**No notice when:**
- `fallback_decision: "none"` (top-tier dependency available)
- The stage's pre-condition was not met (e.g., `sources.figma` empty AND no DTCG file → no notice; that's a configuration choice, not a fallback)
- `interactive_preflight: false` is set in `.brandrc.yaml` — embedded mode; record the decisions silently for the manifest, do not prompt

### 0.5b. Embedded mode

If `.brandrc.yaml` has `interactive_preflight: false` (or the env var `BRAND_SKILLS_NONINTERACTIVE=1` is set), skip §0.5a entirely. Decisions still resolve and flow to the manifest, but the SKILL does not prompt. Hosts read `manifest.json` `stages[*].fallback_decision` + `chain_entry_used` and decide what to do.

Stop only when no useful input is available at all (no website, no PDFs, no screenshots, no Figma, no DTCG file) — and even then, surface a clear "I have nothing to extract from. Drop assets into `./assets/` or paste a URL, then re-run" message rather than crashing.
```

(Use `Edit` with the full old block as `old_string` and the full new block as `new_string`. The block boundaries are the section heading line `### 0f.` through the end of the original block including the "Stop only when…" paragraph.)

- [ ] **Step 3: Render-check the SKILL — count headings, length sanity**

```bash
grep -c "^## " brand-context/skills/brand-extract/SKILL.md
grep -c "^### " brand-context/skills/brand-extract/SKILL.md
wc -l brand-context/skills/brand-extract/SKILL.md
```

Top-level `##` count should increase by 1 (new `## 0.5`). Total lines should grow by ~80–100. Visually scan the diff: `git diff brand-context/skills/brand-extract/SKILL.md | head -180`.

- [ ] **Step 4: Run the suite (no test changes — sanity)**

```bash
npm test 2>&1 | tail -5
```

Expected: 74 pass, 0 fail (SKILL prose isn't covered by current tests yet — Task 16 adds a parity check).

- [ ] **Step 5: Commit**

```bash
echo "feat(skill): add §0.5 contract-driven pre-flight dependency check

Replaces ad-hoc tool detection with a contract-driven walk over
schema/mcp-fallback-contract.json. Per dependency: passive availability
check by kind (mcp/http/user_artifact/native_tool). Per stage: resolves
fallback_decision (none|DOWNGRADE|SKIP) by walking the chain. Surfaces
user-facing notices for SKIP/DOWNGRADE outcomes when preconditions are
met. Notices use install_hint, install_caveat, fidelity_note,
user_action_hint from the contract. Embedded mode (interactive_preflight:
false or BRAND_SKILLS_NONINTERACTIVE=1) skips notices, still records
decisions for the manifest.

Spec §5." > /tmp/commit-msg.txt
git add brand-context/skills/brand-extract/SKILL.md
git commit -F /tmp/commit-msg.txt
```

---

## Task 13: SKILL updates — Stages 1, 2, 3, 10b

**Goal:** Update the per-stage SKILL prose so it references the contract chains instead of inline rules. Stage 1 gains DTCG-fallback prose; Stage 3 gains the Jina-Reader middle tier; Stage 10b enumerates the new manifest fields.

**Files:**
- Modify: `brand-context/skills/brand-extract/SKILL.md` — Stages 1 (`§2`), 2 (`§3`), 3 (`§4`), 10b (`§10b`)

- [ ] **Step 1: Update Stage 1 (`§2 Stage 1 — Figma variable extraction`)**

Find the section starting at `## 2. Stage 1 — Figma variable extraction` (line 124). Replace the first paragraph (line 126) and prepend a DTCG fallback path.

Replace:

```markdown
Skip this stage if `sources.figma` is empty or `figma-console` MCP is unavailable. Log "Stage 1 skipped: no Figma source" and move to Stage 2.

For each Figma file ID in `sources.figma`:
```

With:

```markdown
Stage 1's fallback chain is declared in `schema/mcp-fallback-contract.json` `stages.1_figma`: `figma-console` MCP (full) → `dtcg-tokens-file` (degraded) → SKIP. Pre-flight (§0.5) resolves which entry fires.

**If `figma-console` MCP fired** (Tier 1, `quality_label: full`): proceed with the steps below.

**If `dtcg-tokens-file` fired** (Tier 2, `quality_label: degraded`): the SKILL has already detected `assets/*.tokens.json`. Use the CLI:

```bash
brand-cli import-tokens > /tmp/dtcg-tokens.json
```

Or, when `brand-cli` is absent, invoke the same logic inline by reading each `assets/*.tokens.json` and applying the DTCG normalization documented at `cli/src/utils/dtcg-import.js` (per-token `$value` + `$type` shape; `$type` ∈ `color | dimension | fontFamily | fontWeight | lineHeight | letterSpacing | duration | cubicBezier | shadow`; unknown types preserved verbatim under `unknown[]`).

In either case, hold the resulting token state in memory exactly as you would the `figma-console`-derived state — the bucket shape is the same. Skip the rest of this section's `figma-console` API steps.

**If `fallback_decision: SKIP` resolved** (no figma-console MCP AND no DTCG file): the pre-flight notice (§0.5a Stage 1) has already prompted the practitioner. Honor their choice. Move to Stage 2.

For each Figma file ID in `sources.figma` (figma-console path only):
```

(Use `Edit`. The exact `old_string` is the two-line block in the original; `new_string` is the larger block above.)

- [ ] **Step 2: Update Stage 2 (`§3 Stage 2 — Web token extraction`)**

Find the section starting at `## 3. Stage 2 — Web token extraction (when Playwright is available)` (line 142). Update the title and the leading skip paragraph.

Replace:

```markdown
## 3. Stage 2 — Web token extraction (when Playwright is available)

**Skip this stage entirely if Playwright MCP is not available.** Token extraction needs computed CSS, which WebFetch can't provide. Note the skip in the summary and rely on Stage 1 (Figma) tokens, or — if Stage 1 was also skipped — leave the token files as placeholders with a comment pointing the user at `brand-cli setup` to install Playwright.

When Playwright is available, this stage always runs alongside Stage 1. Treat as supplementary to Stage 1 (or primary if Stage 1 was skipped).
```

With:

```markdown
## 3. Stage 2 — Web token extraction

Stage 2's fallback chain is declared in `schema/mcp-fallback-contract.json` `stages.2_web`: `playwright` MCP (full) → SKIP. There is no usable middle tier — computed CSS sampling needs a real browser.

**If `playwright` fired**: proceed with the steps below alongside Stage 1.

**If `fallback_decision: SKIP` resolved**: the pre-flight notice (§0.5a Stage 2) has already prompted the practitioner. Honor their choice — leave token files reflecting Stage 1 only, or as placeholders if Stage 1 also skipped.

When Stage 2 runs, treat it as supplementary to Stage 1 (or primary if Stage 1 was skipped).
```

- [ ] **Step 3: Update Stage 3 (`§4 Stage 3 — Voice extraction`)**

The relevant block is at `### 4b. Scrape copy samples (target: 30–50 total)` (line 181). Insert a Jina path between the existing Playwright path and the WebFetch path.

Find:

```markdown
**Playwright path (preferred — full quality):**
1. `mcp__playwright__browser_navigate` to the URL
2. `mcp__playwright__browser_snapshot` to get the accessibility tree (preferred — gives semantic structure with role labels)
3. If snapshot is sparse, fall back to `mcp__playwright__browser_evaluate` with a script that walks `document.querySelectorAll('h1, h2, h3, [role="heading"], button, a, .cta, [aria-label], [class*="error"], nav a, footer a, .toast, .notice')` and returns `{tag, role, textContent, ariaLabel, className}` for each.

**WebFetch path (fallback when Playwright is missing — degraded quality):**
```

Replace with:

```markdown
**Playwright path (Tier 1 — full quality):**
1. `mcp__playwright__browser_navigate` to the URL
2. `mcp__playwright__browser_snapshot` to get the accessibility tree (preferred — gives semantic structure with role labels)
3. If snapshot is sparse, fall back to `mcp__playwright__browser_evaluate` with a script that walks `document.querySelectorAll('h1, h2, h3, [role="heading"], button, a, .cta, [aria-label], [class*="error"], nav a, footer a, .toast, .notice')` and returns `{tag, role, textContent, ariaLabel, className}` for each.

**Jina Reader path (Tier 2 — degraded; fires when Playwright MCP is absent and Jina is reachable):**
1. `GET https://r.jina.ai/<url>` (no auth, no API key). The SKILL fetches this directly from its own runtime (Bash `curl` or, if `Bash` isn't available, native `WebFetch` against the `r.jina.ai/<url>` URL). The CLI utility at `cli/src/utils/jina-fetch.js` is the canonical Node implementation — read it for the exact rate-limit handling, but the SKILL prose path doesn't import code; it just makes the request.
2. Jina returns rendered Markdown with hierarchical headings preserved. You don't get the accessibility tree, so role labels (`button`, `[aria-live]`, etc.) aren't available — sample classification falls back to heuristics (heading levels for `headline`; line shape + verb cues for `cta`; bullets/`-`/`>` patterns for `nav`).
3. Cap confidence at MEDIUM regardless of sample count — this is the contract's `quality_label: degraded` for jina-reader.
4. On `429` rate-limit or any other non-2xx (including network unreachable), fall through to WebFetch automatically. Update the manifest's `chain_entry_used` to whichever entry actually succeeded.

**WebFetch path (Tier 3 — degraded; fires when Playwright AND Jina are both unavailable):**
```

(Note: the WebFetch path heading and its bullets stay as in the existing prose — only the heading changes to "Tier 3 — degraded; fires when Playwright AND Jina are both unavailable".)

- [ ] **Step 4: Update Stage 10b (`§10b Emit .brand/manifest.json`)**

Find the section at `## 10b. Emit \`.brand/manifest.json\`` (line 718). Replace the block that describes the stdin payload + non-derivable fields.

Replace the existing CLI-path JSON example (lines 727–750) with:

````markdown
**CLI path:**

Build the stage payload from what just ran. Pass via stdin:

```bash
cat <<'JSON' | brand-cli emit-manifest
{
  "tier": "{tier}",
  "client": "{client}",
  "stages": {
    "1_figma":     { "ran": <bool>, "wrote": [<paths>], "reason": "<if skipped>",
                     "fallback_decision": "<none|DOWNGRADE|SKIP>",
                     "chain_entry_used": { "kind": "<kind>", "name": "<dep-name>", "quality_label": "<full|degraded>" },
                     "required_dependencies": [<names>], "available_dependencies": [<names>] },
    "2_web":       { ... same shape, plus "confidence": "<HIGH|MEDIUM|LOW>" when ran },
    "3_voice":     { ... plus "samples": <n>, "confidence": "..." },
    "4_overview":  { ... plus "sources": [<sources>] },
    "5_conflicts": { ... plus "active": <n> },
    "6_components":{ ... },
    "8_brand_md":  { ... }
  },
  "dependencies": {
    "figma-console":    { "available": <bool>, "used_by": [<stage_keys>] },
    "playwright":       { "available": <bool>, "used_by": [<stage_keys>] },
    "jina-reader":      { "available": <bool>, "used_by": [<stage_keys>] },
    "dtcg-tokens-file": { "available": <bool>, "used_by": [<stage_keys>] },
    "webfetch":         { "available": <bool>, "used_by": [<stage_keys>] },
    "read":             { "available": <bool>, "used_by": [<stage_keys>] }
  },
  "file_overrides": {
    "<path>": {"status": "defaults", "note": "<reason>"}
  }
}
JSON
```

The CLI decorates each emitted `dependencies[name]` entry with `kind` (and `expected_path_glob` for `user_artifact` entries) from the contract — the SKILL doesn't need to send those fields. Dependency names are validated against `schema/mcp-fallback-contract.json`; an unknown name (typo, or a dep not in the contract) hard-rejects with exit 1.
````

And replace the inline-fallback block (lines 753–764) with:

```markdown
**Inline fallback (CLI absent):**

Construct the manifest in memory and `Write` to `.brand/manifest.json`. The reference shape — including every required field with a concrete example value — is at `cli/test/golden/manifest-from-skill.json` in the brand-skills repo. Mirror that shape exactly.

The non-derivable fields the SKILL must set itself (manifest schema `version: "2"`):

- `version`: `"2"` (literal — schema enforces a const)
- `generated_at`: ISO-8601 datetime (e.g. `"2026-06-13T15:30:00Z"`)
- `generator`: `brand-extract-skill@<plugin-version>`
- `tier`, `client`: from `.brandrc.yaml`
- `stages`: per-stage object keyed by stage key (`1_figma` … `8_brand_md`, no `7_*`). Every entry has `ran` (bool) and `fallback_decision` (one of `"none" | "DOWNGRADE" | "SKIP" | "HALT"`). When `ran: true`, also include `chain_entry_used: { kind, name, quality_label }`. When `fallback_decision: "SKIP"`, set `chain_entry_used: null`. Always include `required_dependencies` (names from the contract chain marked `quality_label: "full"`) and `available_dependencies` (names you detected as available in §0.5). Stage-specific extras (`wrote`, `samples`, `confidence`, `sources`, `active`) are unchanged from `version: "1"`.
- `dependencies`: object keyed by dependency name (must match a name in `schema/mcp-fallback-contract.json` `dependencies` — typos hard-reject the manifest at validation). Each entry has `kind` (must equal the contract's `kind` for that name), `available` (bool), `used_by` (array of stage keys that consumed this dependency). For `user_artifact` entries, also include `expected_path_glob` mirroring the contract.
- `files`: object keyed by relative path under `.brand/`, with each entry `{ "status": "<enum>", "bytes": <integer> }` (and an optional `"note": "<reason>"` for `defaults`/`partial`). Apply the same content-scan logic the CLI uses — placeholder marker, frontmatter inspection, body length — to assign one of `complete | partial | placeholder | missing | defaults`. Include every file under `.brand/`, not just the ones listed in `file_overrides`.
```

- [ ] **Step 5: Verify the SKILL still parses cleanly**

```bash
grep -c "^## \|^### " brand-context/skills/brand-extract/SKILL.md
wc -l brand-context/skills/brand-extract/SKILL.md
git diff --stat brand-context/skills/brand-extract/SKILL.md
```

Expected: heading count higher than baseline; line count higher; diff stat shows ~150–200 line delta.

- [ ] **Step 6: Run full suite**

```bash
npm test 2>&1 | tail -5
```

Expected: 74 pass, 0 fail.

- [ ] **Step 7: Commit**

```bash
echo "feat(skill): wire Stages 1/2/3/10b to the MCP-fallback contract

Stage 1 references the contract chain (figma-console -> dtcg-tokens-file
-> SKIP) and adds DTCG-import as the Tier 2 path; both top and middle
tiers feed the same in-memory token state. Stage 2 prose collapses 'skip
when Playwright missing' to a contract pointer (chain has no middle tier).
Stage 3 inserts Jina Reader as Tier 2 between Playwright and WebFetch
with explicit fall-through behavior on 429/non-2xx. Stage 10b enumerates
the v2 manifest fields the SKILL must construct in inline-fallback mode
(version: \"2\", dependencies + kind, per-stage fallback_decision +
chain_entry_used + required_dependencies + available_dependencies).

Spec §6 SKILL layer." > /tmp/commit-msg.txt
git add brand-context/skills/brand-extract/SKILL.md
git commit -F /tmp/commit-msg.txt
```

---

## Task 14: Repo docs — `CLAUDE.md`, `README.md`, `schema/brand/README.md`, `docs/DESIGN.md`, `docs/tasks.md`

**Goal:** Propagate the schema + contract layer to the documentation surface. CLAUDE.md gains the new files in its architecture diagram + file-write policies + versioning section. README pipeline table notes the fallback chains. `schema/brand/README.md` cross-links the new contract schema. DESIGN.md expands the "no required MCP installs" bullet. `docs/tasks.md` marks #3 complete.

**Files:**
- Modify: `CLAUDE.md`
- Modify: `README.md`
- Modify: `schema/brand/README.md`
- Modify: `docs/DESIGN.md`
- Modify: `docs/tasks.md`

- [ ] **Step 1: Update `CLAUDE.md` architecture diagram**

Find the architecture block (line ~17–23 of CLAUDE.md):

```
schema/brand/*.schema.md      ← source of truth for .brand/ file shapes
schema/{manifest,health}.schema.json ← machine-validation contracts (NEW)
       ↓
brand-context/skills/*/SKILL.md   ← AI agent instructions (what to write)
       ↓
cli/src/                      ← deterministic regen (init scaffolding, refresh-design, refresh-context, score, emit-manifest)
```

Replace with:

```
schema/brand/*.schema.md                        ← source of truth for .brand/ file shapes
schema/{manifest,health}.schema.json            ← machine-validation contracts
schema/mcp-fallback-contract.{json,schema.json} ← per-stage fallback contract data + validator
       ↓
brand-context/skills/*/SKILL.md   ← AI agent instructions (what to write)
       ↓
cli/src/                      ← deterministic regen (init scaffolding, refresh-design, refresh-context, score, emit-manifest, import-tokens)
```

- [ ] **Step 2: Add `manifest.json` v2 migration note to file-write policies**

Find the "File-write policies" table row for `manifest.json` (line ~69):

```
| `manifest.json` | **Overwrite wholesale every run** | Generated artifact; source of truth is `.brand/*.md`. Same as `design.md`/`brand.md`. Emitted by `/brand-context:extract` end-of-pipeline. |
```

Replace with:

```
| `manifest.json` | **Overwrite wholesale every run** | Generated artifact; source of truth is `.brand/*.md`. Same as `design.md`/`brand.md`. Emitted by `/brand-context:extract` end-of-pipeline. **Schema is `version: "2"` as of branch `feat/mcp-fallback-contract`** — `version: "1"` payloads/manifests are hard-rejected by both `emit-manifest` and `score`. See `docs/superpowers/specs/2026-06-13-mcp-fallback-contract-design.md` §4. |
```

- [ ] **Step 3: Update CLAUDE.md "Versioning + release" version-coupled list**

Find the bullet that lists the test goldens. Append to the same bullet a contract-version pointer (the contract has its own independent `version: "1"`):

```
  - The MCP-fallback contract at `schema/mcp-fallback-contract.json` has its own `version: "1"` field, independent from the package version. Bump it (and the corresponding `version` const in `schema/mcp-fallback-contract.schema.json`) only on breaking shape changes. The manifest's `version: "2"` is similarly independent — bump on shape changes to `manifest.schema.json`.
```

- [ ] **Step 4: Update `CLAUDE.md` editing checklist item 1**

Replace item 1 with:

```
1. **Schema change?** → SKILL section that writes that file updated? `cli/src/commands/init.js` scaffold updated? Generators (`design-md-generator.js`, `brand-context-generator.js`) updated? If `manifest.schema.json`: both manifest goldens regenerated AND `cli/test/fixtures/stage-data/*.json` payloads updated AND `score.js` v1-rejection still in place? If `mcp-fallback-contract.json`: contract validator schema bumped if shape changed; SKILL §0.5 + Stages 1/2/3 still mirror the chain order?
```

- [ ] **Step 5: Update `README.md` pipeline table**

Replace the entire table (header + 8 rows) starting at the `| Stage | What it does | Needs |` line with:

```
| Stage | What it does | Fallback chain (top-to-bottom; first-available fires) |
|---|---|---|
| 1 | Figma variable extraction → tokens | `figma-console` MCP (full) → `assets/*.tokens.json` DTCG export (degraded) → SKIP. Pre-condition: `sources.figma` set or DTCG file present. |
| 2 | Web token extraction (computed CSS) → tokens | `playwright` MCP (full) → SKIP. No usable middle tier. |
| 3 | Voice extraction (samples → attributes, tone, vocabulary) | `playwright` MCP (full) → Jina Reader `r.jina.ai` (degraded, keyless HTTP) → native `WebFetch` (degraded, SSR sites only). |
| 4 | Multimodal analysis → `overview.md` | Native `Read` tool + brand-guide PDF or screenshots |
| 5 | Cross-source conflict detection → `conflicts.md` | Outputs from Stages 1–4 |
| 6 | Design-system repo scan → `components/*.md` | Local path or remote git URL (comprehensive tier only) |
| 8 | Regenerate `design.md` + `brand.md` | `brand-cli refresh-design` and `refresh-context` (or inline fallback) |
```

Note: row 7 is **removed** — Stage 7 doesn't exist in the canonical pipeline (collapsed into Stage 6 historically; the SKILL "Phase 8 scope reminder" already says so). The previous README table mistakenly listed it as "Regenerate design.md"; that's now folded into Stage 8 alongside `brand.md`.

Add this paragraph immediately after the "Always also emitted" bullet block:

```
The fallback chains themselves are declared as data in [`schema/mcp-fallback-contract.json`](schema/mcp-fallback-contract.json); both the SKILL prose and the CLI consume it. To audit chains or add a new fallback tier, edit the contract first.
```

- [ ] **Step 6: Update `schema/brand/README.md` cross-links**

After the existing manifest-schema cross-link line, add:

```
- [`../mcp-fallback-contract.json`](../mcp-fallback-contract.json) — canonical per-stage MCP fallback contract data
- [`../mcp-fallback-contract.schema.json`](../mcp-fallback-contract.schema.json) — JSON Schema validating the contract data
```

- [ ] **Step 7: Update `docs/DESIGN.md` "No required MCP installs" bullet**

```bash
grep -n "No required MCP installs\|minimal-dep" docs/DESIGN.md | head
test -s docs/DESIGN.md || echo "DESIGN.md is empty — skip this step and add a CLAUDE.md note"
```

If `docs/DESIGN.md` has content, expand the bullet to enumerate the three chains (Stage 1 / 2 / 3 chains as in Step 5 README pipeline table). If the file is empty, skip — flag as a follow-up in the progress doc rather than inventing the file.

- [ ] **Step 8: Update `docs/tasks.md` — move #3 to Completed**

Move the `#### #3` block from `### Unblocked` to a new `### #3 ... ✅` entry under `## Completed`, after `### #7 — Research peer tools ✅`. Output bullet should enumerate: contract files added, manifest schema bumped, `import-tokens` subcommand, `jina-fetch` utility, SKILL §0.5 + Stages 1/2/3/10b updated. Update the "Last updated" line.

- [ ] **Step 9: Run full suite (sanity)**

```bash
npm test 2>&1 | tail -5
```

Expected: 74 pass, 0 fail (doc-only changes).

- [ ] **Step 10: Commit**

```bash
echo "docs: propagate MCP-fallback-contract to repo-level docs

CLAUDE.md: contract schema in arch diagram; manifest v2 migration note
in file-write policies; versioning section + editing checklist updated.
README.md: pipeline table shows fallback chains per stage with quality
labels; manifest v2 + contract pointers in 'Always also emitted'.
schema/brand/README.md: cross-link contract schemas.
docs/DESIGN.md: enumerate three fallback chains (or skip if empty).
docs/tasks.md: move #3 to Completed; bump last-updated." > /tmp/commit-msg.txt
git add CLAUDE.md README.md schema/brand/README.md docs/tasks.md
test -s docs/DESIGN.md && git add docs/DESIGN.md || true
git commit -F /tmp/commit-msg.txt
```

---

## Task 15: SKILL ↔ contract parity test

**Goal:** Unit test that verifies SKILL prose mentions every dependency name + every stage key + all four `fallback_decision` verbs. Prevents silent drift.

**Files:**
- Create: `cli/test/unit/skill-contract-parity.test.js`

- [ ] **Step 1: Write the failing test**

Create `cli/test/unit/skill-contract-parity.test.js`:

```javascript
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
```

- [ ] **Step 2: Run the test**

```bash
node --test cli/test/unit/skill-contract-parity.test.js 2>&1 | tail -15
```

Expected: 5 tests pass. If any fail, fix the SKILL — the contract is the source of truth.

- [ ] **Step 3: Run full suite**

```bash
npm test 2>&1 | tail -5
```

Expected: 79 pass (74 + 5), 0 fail.

- [ ] **Step 4: Commit**

```bash
echo "test(unit): SKILL <-> contract parity

Five assertions guarding against silent drift between the contract data
and brand-extract SKILL prose: every dependency name appears, every
stage key appears, all four fallback_decision verbs appear, the DTCG
glob is verbatim, the v2 manifest version is referenced." > /tmp/commit-msg.txt
git add cli/test/unit/skill-contract-parity.test.js
git commit -F /tmp/commit-msg.txt
```

---

## Task 16: Final verification + cross-branch code review

**Goal:** Verification, not build. No implementer subagent. Confirm `npm test` passes, smoke-test end-to-end, dispatch a single final code-reviewer subagent across the branch diff, update progress doc, hand off via `superpowers:finishing-a-development-branch`.

- [ ] **Step 1: Run the full test suite**

```bash
npm test 2>&1 | tail -10
```

Expected: 79 pass, 0 fail.

- [ ] **Step 2: End-to-end smoke test**

Walk the full pipeline against a tempdir to verify the v2 contract holds end-to-end. Apostrophe rule applies to any inline JSON — write to `/tmp/smoke-stdin.json` first.

```bash
mkdir -p /tmp/brand-smoke-final && cd /tmp/brand-smoke-final
node "$OLDPWD/cli/bin/brand-cli.js" init --client acme --mode standard --force
mkdir -p assets
cp "$OLDPWD/cli/test/fixtures/dtcg-tokens/colors.tokens.json" assets/

# import-tokens reads the DTCG fixture
node "$OLDPWD/cli/bin/brand-cli.js" import-tokens > /tmp/smoke-tokens.json
node --input-type=module -e "
import { readFileSync } from 'node:fs';
const d = JSON.parse(readFileSync('/tmp/smoke-tokens.json', 'utf-8'));
if (d.colors.primary !== '#E2231A') throw new Error('import-tokens FAIL');
console.log('import-tokens OK');
"

# Emit a v2 manifest from a v2 stdin payload
cp "$OLDPWD/cli/test/fixtures/stage-data/no-mcps-jina-available.json" /tmp/smoke-stdin.json
node "$OLDPWD/cli/bin/brand-cli.js" emit-manifest < /tmp/smoke-stdin.json

# Verify the manifest is v2 and dependencies have kind
node --input-type=module -e "
import { readFileSync } from 'node:fs';
const m = JSON.parse(readFileSync('.brand/manifest.json', 'utf-8'));
if (m.version !== '2') throw new Error('version: ' + m.version);
if (!('dependencies' in m) || ('mcps' in m)) throw new Error('dependencies/mcps shape wrong');
if (m.dependencies['jina-reader'].kind !== 'http') throw new Error('jina kind wrong');
if (m.stages['3_voice'].fallback_decision !== 'DOWNGRADE') throw new Error('3_voice fallback wrong');
if (m.stages['3_voice'].chain_entry_used.name !== 'jina-reader') throw new Error('3_voice chain wrong');
console.log('manifest OK');
"

# Score against the v2 manifest
node "$OLDPWD/cli/bin/brand-cli.js" score
node --input-type=module -e "
import { readFileSync } from 'node:fs';
const h = JSON.parse(readFileSync('.brand/.health.json', 'utf-8'));
if (!h.manifest_seen) throw new Error('manifest_seen false');
if (!h.manifest_generated_at) throw new Error('manifest_generated_at missing');
console.log('health OK');
"

cd "$OLDPWD"
rm -rf /tmp/brand-smoke-final /tmp/smoke-stdin.json /tmp/smoke-tokens.json
```

- [ ] **Step 3: `git status` clean + commit count**

```bash
git status
git log --oneline main..HEAD | wc -l
```

Expected: clean working tree. Commit count: ~16–18 (1 spec + 1 plan-doc + 14 task commits, plus refinements).

- [ ] **Step 4: Spec coverage skim**

Open `docs/superpowers/specs/2026-06-13-mcp-fallback-contract-design.md` and confirm every requirement maps to a landed task:

| Spec section | Landed in task |
|---|---|
| §1 Status vocabulary + verbs | Task 5 (manifest schema enums) + Task 12 (SKILL §0.5) |
| §2 Fallback chains per stage | Task 3 (contract data) |
| §3 Contract JSON shape | Task 2 (schema) + Task 3 (data) + Task 4 (loader) |
| §4 Manifest schema changes (v2) | Task 5 (schema) + Tasks 6/7 (CLI + tests + goldens) |
| §5 Pre-flight messaging | Task 12 (SKILL §0.5) |
| §6 Three-layer propagation | Tasks 5/6/7 + Tasks 12/13 + Task 14 |
| §7 Error handling + edge cases | Tasks 6/7 (v1 reject; unknown dep) + Task 9 (Jina errors) + Task 8 (DTCG errors) |
| §8 Considered alternatives | (rejected per spec; nothing to land) |
| §9 Out of scope | C2/C8 candidate tasks already filed in tasks.md |

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
- Focus areas: (a) cross-task contract sync — `kind` enum, stage keys, DTCG glob, fallback decision verbs all consistent across schema, contract data, manifest schema, fixtures, goldens, SKILL prose; (b) v1→v2 migration completeness — no stray `version: "1"` literals or `mcps` references in the codebase; (c) does the CLI's emitted `dependencies` block include `kind` consistent with the contract for every entry?

If reviewer flags Critical or Important: dispatch a refinement subagent. Minor: accept per D7 from precedent.

- [ ] **Step 6: Update progress doc with final state**

In `docs/superpowers/plans/2026-06-13-mcp-fallback-contract-progress.md`:

- Add Task 16 to the "Completed tasks" table with the cross-branch reviewer verdict.
- Add a "Final-stage handoff" section listing what landed.
- Update the "Quick state check" block with the final commit + test counts.
- Confirm all D-letter decisions are recorded.

```bash
echo "docs: progress doc through Task 16 — feature ready for PR

All 16 tasks landed; cross-branch reviewer verdict recorded; D-letter
decisions captured. Ready to invoke superpowers:finishing-a-development-branch." > /tmp/commit-msg.txt
git add docs/superpowers/plans/2026-06-13-mcp-fallback-contract-progress.md
git commit -F /tmp/commit-msg.txt
```

- [ ] **Step 7: Open the PR via `superpowers:finishing-a-development-branch`**

Invoke that skill (separate, same as precedent branch's final move). Pass it: spec link, plan link, progress doc link, test delta (47 → 79; +32 tests), commit count, cross-branch reviewer verdict, manifest schema-version bump rationale.

After merge: update `docs/tasks.md` last-updated line with the merged-PR number. Hoist any new footguns surfaced during this branch into CLAUDE.md or a "lessons" appendix as a future contributor reference.

---

## Self-review checklist (controller-run during Task 16 spec-coverage skim)

After all 16 tasks land, all of these must be true:

- [ ] `schema/mcp-fallback-contract.json` exists, validates against its schema, contains every dependency named in the spec.
- [ ] `schema/manifest.schema.json` is `version: "2"`; top-level `dependencies` (not `mcps`); per-stage `fallback_decision` required.
- [ ] `cli/src/utils/{contract-loader,dtcg-import,jina-fetch}.js` exist; unit tests pass.
- [ ] `cli/bin/brand-cli.js` registers `import-tokens`.
- [ ] `cli/src/commands/{emit-manifest,score}.js` reject `version: "1"` payloads/manifests with migration messages.
- [ ] Both manifest goldens are v2 shape; `manifest-from-skill.json` differs from `manifest-from-populated.json` only in `_comment` + `generator`.
- [ ] All three pre-existing stage-data fixtures (`full-pipeline`, `partial-pipeline`, `no-mcps`) are v2 shape; three new ones added (`all-mcps-available`, `no-mcps-jina-available`, `dtcg-only`).
- [ ] SKILL has new `§0.5` section; Stages 1/2/3/10b updated; SKILL ↔ contract parity test passes.
- [ ] CLAUDE.md, README.md, schema/brand/README.md, docs/DESIGN.md (if non-empty), docs/tasks.md all reflect the new schema layer.
- [ ] `npm test` is 79 pass / 0 fail on Node ≥ 22.
- [ ] `git status` clean; branch is N commits ahead of main.
- [ ] Package version unchanged (`0.4.0`); `engines.node` unchanged (`>= 22.0.0`).



