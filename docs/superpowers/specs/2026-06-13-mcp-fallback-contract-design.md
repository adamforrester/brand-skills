# Design — MCP Fallback Contract

**Status:** approved 2026-06-13 (brainstorm complete; ready for implementation plan)
**Tasks closed on land:** [#3](../../tasks.md)
**Tasks unblocked on land:** none directly (#5 still blocked by #4)
**Manifest schema impact:** `version: "1"` → `"2"` (breaking; `mcps` field renamed to `dependencies`; new per-stage fallback fields)

This spec formalizes the per-stage MCP-fallback contract for `/brand-context:extract`. Today the SKILL has implicit fallback behavior in prose ("Skip Stage 2 if Playwright is missing"). This spec makes the contract:

1. **Declared once** as data: `schema/mcp-fallback-contract.json`
2. **Schema-validated** on CLI startup
3. **Mirrored** in `brand-extract/SKILL.md` prose with the same chain decisions
4. **Recorded per-run** in `manifest.json` as machine-readable fallback decisions
5. **Surfaced to the user** via pre-flight notices before the pipeline runs

It also adds two new fallback tiers that already exist as user need but had no implementation:

- **DTCG token export** as a Stage 1 fallback (user drops `assets/*.tokens.json` instead of installing `figma-console` MCP)
- **Jina Reader** (`r.jina.ai`, keyless HTTP) as a Stage 3 middle tier between Playwright and WebFetch

Hosts (orchestrators, MCP servers, CI gates) consume the contract + manifest decisions to gate on extraction completeness without parsing prose. Practitioners running brand-extract conversationally see clear "this is what's missing and how to get it" messaging instead of silent skips.

---

## 1. Status vocabulary + verbs

Shared by contract, manifest, SKILL, CLI. Defined once.

### Verbs

| Verb | Meaning | When |
|---|---|---|
| `none` | Stage ran at top tier of its chain | Top-of-chain entry was available |
| `DOWNGRADE` | Stage ran with a non-top-tier chain entry | Any entry below position 1 fired |
| `SKIP` | Stage didn't run; pipeline continues | Bottom of chain reached AND no available entry |
| `HALT` | Pipeline aborts | Reserved. No stage uses it today; preserved for future stages with hard MCP needs |

### Source-conditional pre-conditions are distinct

A stage's `preconditions` (e.g., Stage 1 needs `sources.figma` set OR a DTCG file present) are checked **before** the chain is evaluated. If pre-conditions fail, the chain is not entered and `fallback_decision: SKIP` with `reason: "<precondition unmet>"`. The chain itself was never asked to fire.

### Chain-floor SKIP per stage

| Stage | Has chain-floor SKIP? | Native floor |
|---|---|---|
| 1 (Figma variables) | yes | none — can't extract Figma variables from nothing |
| 2 (Web tokens) | yes | none — can't get computed CSS without a browser |
| 3 (Voice) | no | `WebFetch` (always available; SSR sites only at this tier) |
| 4 (Overview) | no | `Read` (native) |
| 5 (Conflicts) | no | `Read` (native) |
| 6 (Components) | no | `Read` (native; comprehensive tier only) |
| 8 (Brand md) | no | `Read` (native) |

---

## 2. Fallback chains per stage

Final shape after research on Figma MCP capabilities, Jina Reader, Firecrawl, and crawl4ai:

| Stage | Chain (top-to-bottom) | Notes |
|---|---|---|
| 1 (Figma variables) | `figma-console` → `dtcg-tokens-file` → SKIP | Official `figma` MCP rejected as Tier 2 — per-selection only, loses modes/aliases. Filed as candidate task C8 for follow-up |
| 2 (Web tokens) | `playwright` → SKIP | No usable middle tier. Firecrawl rejected (subscription). Jina has no computed CSS. crawl4ai rejected (no keyless HTTP, overlaps Tier 1) |
| 3 (Voice) | `playwright` → `jina-reader` → `webfetch` | WebFetch is the floor; no chain SKIP. Pre-condition: `sources.website` set |
| 4 (Overview) | `read` (native) — full | No external dependencies |
| 5 (Conflicts) | `read` (native) — full | No external dependencies |
| 6 (Components) | `read` (native) — full | Comprehensive tier only |
| 8 (Brand md) | `read` (native) — full | No external dependencies |

### `kind` enum

Each chain entry has a `kind`:

| Kind | Availability check | Examples |
|---|---|---|
| `mcp` | Passive — `claude mcp list` | `figma-console`, `playwright` |
| `http` | Passive — network reachability | `jina-reader` |
| `user_artifact` | Passive — file matches glob | `dtcg-tokens-file` |
| `native_tool` | Always `true` | `webfetch`, `read` |

Active prompting (e.g., "drop a DTCG file into `./assets/`") is a SKILL-prose layer; the chain entry's availability is purely a passive filesystem check.

---

## 3. Contract JSON shape

**Path:** `schema/mcp-fallback-contract.json`
**Validated by:** `schema/mcp-fallback-contract.schema.json` (JSON Schema 2020-12) at CLI startup
**Owner:** Hand-edited canonical data. Bump `version` on breaking shape changes.

### Top-level

```json
{
  "_comment": "Source of truth for MCP-fallback contract. Read by SKILL prose (mirrored as a markdown table) and by brand-cli. See schema/mcp-fallback-contract.schema.json for validation.",
  "version": "1",
  "stages": { /* per-stage entries, see below */ },
  "dependencies": { /* per-dependency metadata, see below */ }
}
```

The top-level field is `dependencies`, not `mcps` — the contract holds entries of all four `kind` values, not only MCPs.

### Per-stage entry

```json
"3_voice": {
  "purpose": "Voice extraction from live channels — populates voice.md observed-voice section.",
  "preconditions": [
    { "type": "source", "key": "sources.website", "required": true }
  ],
  "chain": [
    { "kind": "mcp",         "name": "playwright",     "quality_label": "full",     "fidelity_note": "Accessibility tree + DOM evaluation" },
    { "kind": "http",        "name": "jina-reader",    "quality_label": "degraded", "fidelity_note": "JS-rendered markdown; loses accessibility tree" },
    { "kind": "native_tool", "name": "webfetch",       "quality_label": "degraded", "fidelity_note": "SSR sites only; SPAs return sparse content" }
  ],
  "skip_behavior": null
}
```

**Field rules:**

| Field | Type | Rules |
|---|---|---|
| `purpose` | string | One-line description of stage output |
| `preconditions` | array | Each: `{ type: "source", key: <dotted path>, required: bool }` or `{ type: "tier", min: <enum>, required: bool }` |
| `chain` | array | Ordered list. First-available entry fires |
| `chain[*].kind` | enum | `"mcp"` / `"http"` / `"user_artifact"` / `"native_tool"` |
| `chain[*].name` | string | References a key in top-level `dependencies` block |
| `chain[*].quality_label` | enum | `"full"` / `"degraded"` |
| `chain[*].fidelity_note` | string | One-line description for SKILL pre-flight messaging |
| `skip_behavior` | object \| null | `null` if stage has native floor (no chain SKIP). When non-null: `{ writes_files: string[], files_left_as: status, downstream_impact: string }` |

### Per-dependency metadata

```json
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
```

**Field rules per `kind`:**

| Field | mcp | http | user_artifact | native_tool |
|---|---|---|---|---|
| `kind` (required) | ✓ | ✓ | ✓ | ✓ |
| `homepage` | string \| null | string \| null | n/a | n/a |
| `install_hint` | required | n/a | n/a | n/a |
| `install_caveat` | string \| null | n/a | n/a | n/a |
| `endpoint` | n/a | required | n/a | n/a |
| `auth` | n/a | required (`"none"` or `"key"`) | n/a | n/a |
| `rate_limit_hint` | n/a | optional | n/a | n/a |
| `expected_path_glob` | n/a | n/a | required | n/a |
| `format` | n/a | n/a | optional | n/a |
| `user_action_hint` | n/a | n/a | required | n/a |
| `always_available` | n/a | n/a | n/a | const `true` |
| `enables_stages` | required | required | required | required |

---

## 4. Manifest schema changes (`version: "2"`)

### Migration overview

| Change | Impact |
|---|---|
| `manifest.schema.json` `version`: `const: "1"` → `"2"` | Hard-break |
| Top-level `mcps` field renamed to `dependencies` | Hard-break |
| Each `dependencies[*]` entry gains `kind` field | New required field |
| `mcps[*].used` renamed to `dependencies[*].used_by` | Hard-break |
| Each `stages[*]` entry gains `fallback_decision`, `chain_entry_used`, `required_dependencies`, `available_dependencies` | New fields, required when `ran` is set |

`brand-cli emit-manifest` hard-rejects `version: "1"` payloads with a migration message pointing to this spec. Soft-deprecation period not needed; package is not on npm yet, no external consumers.

`health.schema.json` is unchanged. Health is computed from manifest indirectly; the renamed field doesn't propagate to health output.

### New per-stage fields

```json
"3_voice": {
  "ran": true,
  "wrote": ["voice.md"],
  "samples": 14,
  "confidence": "MEDIUM",

  "fallback_decision": "DOWNGRADE",
  "chain_entry_used": { "kind": "http", "name": "jina-reader", "quality_label": "degraded" },
  "required_dependencies": ["playwright"],
  "available_dependencies": ["jina-reader", "webfetch"]
}
```

| Field | Type | Rules |
|---|---|---|
| `fallback_decision` | enum | `"none"` / `"DOWNGRADE"` / `"SKIP"` / `"HALT"`. Required |
| `chain_entry_used` | object \| null | The contract chain entry that fired: `{kind, name, quality_label}`. `null` when `fallback_decision: SKIP` or `HALT` |
| `required_dependencies` | string array | Names from contract chain marked `quality_label: full`. Empty if no top-tier entry exists |
| `available_dependencies` | string array | All dependencies the SKILL detected as available, regardless of which fired |

### Renamed top-level `dependencies` block

```json
"dependencies": {
  "figma-console":      { "kind": "mcp",           "available": false, "used_by": [] },
  "playwright":         { "kind": "mcp",           "available": true,  "used_by": ["2_web", "3_voice"] },
  "jina-reader":        { "kind": "http",          "available": true,  "used_by": [] },
  "dtcg-tokens-file":   { "kind": "user_artifact", "available": false, "used_by": [], "expected_path_glob": "assets/*.tokens.json" },
  "webfetch":           { "kind": "native_tool",   "available": true,  "used_by": [] },
  "read":               { "kind": "native_tool",   "available": true,  "used_by": ["4_overview", "5_conflicts", "8_brand_md"] }
}
```

`available` semantics per `kind`:

- `mcp` — `claude mcp list` shows it as connected
- `http` — network reachability + endpoint not 4xx/5xx (light health check; SKILL-detected, optional skip if offline)
- `user_artifact` — file matches `expected_path_glob` on disk
- `native_tool` — always `true`

The CLI does not probe. The SKILL passes the `dependencies` map in the `emit-manifest` stdin payload alongside today's `stages` data. CLI validates dependency names against the contract, then writes.

---

## 5. Pre-flight messaging (the de-XD-honesty layer)

### When the notice fires

For each stage where the resolved `fallback_decision` would be `SKIP` or `DOWNGRADE` AND the stage's pre-conditions are met (i.e., the user has expressed intent to extract from a source the chain can't fully serve), the SKILL surfaces a structured pre-flight notice **at the end of Stage 0 (scope confirmation), before asking "ready to proceed?"**.

No notice when:
- `fallback_decision: "none"` (top-tier dependency available)
- Stage's pre-condition was not met (e.g., `sources.figma` empty AND no DTCG file → no notice; that's a configuration choice, not a fallback)
- `interactive_preflight: false` is set in `.brandrc.yaml` (embedded mode; decisions are recorded silently in manifest)

### Notice templates

Templates live in **SKILL prose**, not the contract JSON. The contract provides structured fields (`install_hint`, `install_caveat`, `fidelity_note`, `user_action_hint`); SKILL prose templates them into user-facing markdown. Matches the existing pattern for SKILL-formatted prompts.

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

If Jina is also unreachable, the SKILL falls through to WebFetch automatically and the notice updates. If WebFetch also fails (page returns 404), that's a runtime error, not a fallback decision.

### Embedded use

When `interactive_preflight: false` (or env var `BRAND_SKILLS_NONINTERACTIVE=1`), notices are **manifest-only emissions**, not prompts. Pipeline proceeds with whatever chain entry is available. The host reads the manifest's `fallback_decision` + `chain_entry_used` fields and reacts.

### CLI parity

`brand-cli doctor` (deferred to candidate task C2): same logic; reads contract, runs `claude mcp list` + filesystem check + network reachability, prints per-stage table without invoking the pipeline. Useful for hosts wanting a pre-pipeline readiness probe.

---

## 6. Three-layer propagation (per CLAUDE.md editing checklist)

### Schema layer
- `schema/mcp-fallback-contract.json` (new) — canonical contract data
- `schema/mcp-fallback-contract.schema.json` (new) — JSON Schema 2020-12 validating the contract
- `schema/manifest.schema.json` (modified) — `version: "2"`, `mcps` → `dependencies`, new per-stage fields
- `schema/brand/README.md` (modified) — cross-link to new contract schema

### CLI layer
- `cli/src/utils/contract-loader.js` (new) — loads + validates contract on import; exports `getStageContract(stageKey)` and `getDependency(name)` lookup helpers
- `cli/src/utils/dtcg-import.js` (new) — reads `assets/*.tokens.json`, validates DTCG shape, maps to in-memory token state for Stage 4 token-file writing
- `cli/src/utils/jina-fetch.js` (new) — keyless `r.jina.ai` GET wrapper; rate-limit-aware; handles error responses
- `cli/src/commands/emit-manifest.js` (modified) — accept `dependencies` payload; validate against contract; populate new per-stage fields; reject `version: "1"`
- `cli/src/commands/score.js` (modified) — read `dependencies` field; reject `version: "1"` manifests with migration error
- `cli/bin/brand-cli.js` (modified) — register new `import-tokens` subcommand for DTCG ingestion
- `cli/src/utils/manifest-writer.js` (modified) — emit new field shape

### Test layer
- `cli/test/unit/contract-loader.test.js` (new) — schema validation, lookup helpers, error paths
- `cli/test/unit/dtcg-import.test.js` (new) — happy path, malformed-DTCG, multi-file, unknown DTCG type
- `cli/test/unit/jina-fetch.test.js` (new) — mocked HTTP responses (happy / 429 / 5xx); no real network
- `cli/test/integration/preflight.test.js` (new) — fixtures with various dependency-availability shapes
- `cli/test/integration/emit-manifest.test.js` (modified) — update for `dependencies` rename + new per-stage fields
- `cli/test/integration/round-trip.test.js` (modified) — same
- `cli/test/integration/score-emits-health.test.js` (modified) — minor — verify `version: "2"` manifest passes through health-writer
- `cli/test/golden/manifest-from-populated.json` (regenerated) — `version: "2"` shape
- `cli/test/golden/manifest-from-skill.json` (regenerated) — same
- `cli/test/golden/health-from-populated.json` — unchanged (health schema unaffected)
- `cli/test/fixtures/dtcg-tokens/` (new) — sample DTCG export for Stage 1 fallback tests

### SKILL layer
- `brand-context/skills/brand-extract/SKILL.md` §0.5 (new section) — pre-flight dependency check + notice templates that consume contract metadata
- `brand-context/skills/brand-extract/SKILL.md` §1 + §2 (modified) — Stage 1 + Stage 2 prose updated to reference contract chains; remove inline rules ("skip this stage if X")
- `brand-context/skills/brand-extract/SKILL.md` §3 (modified) — Stage 3 prose adds Jina Reader as Tier 2 fallback before WebFetch
- `brand-context/skills/brand-extract/SKILL.md` §10b (modified) — manifest emission stage references `dependencies` not `mcps`; new fields enumerated for SKILL inline-fallback path
- `brand-context/skills/brand-check/SKILL.md` — no change required (health schema unchanged)

### Docs layer
- `CLAUDE.md` "File-write policies" table — add `manifest.json` `version: 2` migration note (no policy change)
- `CLAUDE.md` "Architecture" diagram — add `schema/mcp-fallback-contract.json` to schema layer
- `CLAUDE.md` versioning section — add contract file + new test fixtures to "Versioning + release" version-coupled list
- `README.md` "How the pipeline works" table — Stage 1/2/3 rows updated to show fallback chains
- `docs/tasks.md` — mark #3 complete on land; #5 still blocked by #4; new candidate task C8 ("standard Figma MCP per-node walk as Tier 2 of Stage 1") filed
- `docs/DESIGN.md` "Decoupling principles" — strengthen "no required MCP installs" bullet by listing fallback chains explicitly

---

## 7. Error handling + edge cases

| Failure | Behavior |
|---|---|
| `mcp-fallback-contract.json` malformed at CLI startup | Throw with ajv error; CLI exits 1 with red chalk; no manifest written |
| Manifest stdin payload references unknown dependency name | Reject; surface "unknown dependency '<name>'; valid: [list from contract]"; exit 1 |
| Manifest stdin payload uses `version: "1"` shape (`mcps` field) | Hard-reject; print migration message pointing to this spec; exit 1 |
| DTCG file at `assets/*.tokens.json` malformed | SKILL surfaces parse error; offers (a) fix file, (b) drop file & proceed without DTCG; CLI `import-tokens` exits 1 with reason |
| Multiple DTCG files in `assets/` | SKILL prompts user to pick; CLI `import-tokens` requires `--file <path>` flag |
| Jina Reader returns 4xx/5xx | Fall through to next chain entry (WebFetch); manifest captures `chain_entry_used` as the one that succeeded |
| Jina Reader rate-limited (429) | Same as 5xx — fall through to WebFetch |
| Network unreachable during Jina probe | `available: false` for `jina-reader` in dependency map; SKILL silent-falls-through; no error surfaced |
| Contract chain has zero available entries (Stage 1 or 2 only) | `fallback_decision: SKIP`; reason field captures "no available chain entries"; pipeline continues |
| User has both top-tier MCP available AND a `user_artifact` for the same stage | SKILL prompts which to prefer (default: top-tier); records choice in manifest |
| Empty `dependencies` payload | All stages get `available_dependencies: []`; falls through to native-tool floor where it exists |
| Stage runs but `chain_entry_used.quality_label: "degraded"` | `fallback_decision: DOWNGRADE`; stage's `confidence` caps at MEDIUM (consistent with health-writer's existing logic) |

---

## 8. Considered alternatives (rejected)

Recorded so future readers don't re-litigate.

### Firecrawl as Stage 2/3 middle tier
**Rejected.** Subscription gate after free trial violates the minimal-dep invariant. The user has Firecrawl MCP installed locally but won't recommend it as a default. (Discussed during brainstorm 2026-06-12.)

### crawl4ai as Stage 3 middle tier
**Rejected.** No keyless HTTP endpoint (cloud is closed beta); only paths are `pip install` (heavy) or `docker run` (heavier). No accessibility-tree advantage over Jina. Differentiating features (`JsonCssExtractionStrategy`, deep-crawl, content filters) overlap with Tier 1 (Playwright MCP), not Tier 2. Default content filters strip nav/footer where CTA microcopy lives. Researched 2026-06-13.

### Standard Figma MCP (`plugin:figma:figma`) as Stage 1 Tier 2
**Deferred.** `get_variable_defs` returns only variables referenced by a *selected node*; loses collection names, mode-by-mode values, alias chains. Could be a degraded "walk top-level frames one selection at a time" path, but adds significant per-node-walk UX (which nodes? top-level frames? user-selected? all pages?). Filed as candidate task C8 for follow-up after this branch lands. DTCG-import covers the most common case.

### Soft-deprecation period for `version: "1"` → `"2"`
**Rejected.** Package is not on npm yet; no external consumers; hard-rejecting `version: "1"` payloads is cleaner.

### Notice templates in contract JSON (Mustache-style)
**Rejected.** Contract stays as data; SKILL prose owns the templating layer. Matches existing pattern for SKILL-formatted prompts. Host-rendering of notices is theoretical (no host has asked).

### Stage 2 via Jina `pageshot` + vision-based color sampling
**Speculative; out of scope.** Could give a degraded Stage 2 path on top of Jina screenshots, but requires a vision-based color-sampling subroutine that doesn't exist yet. Stage 2 stays at SKIP at chain floor.

### Per-run override of contract decisions (Approach C from brainstorm)
**Rejected.** No embedded host has asked for it. YAGNI.

### Source-conditional contract entries (Approach B from brainstorm)
**Rejected.** All source-conditionality is resolvable at SKILL runtime via simple `if sources.figma is set AND figma-console MCP missing` checks. Manifest captures the decision; predicate language in the contract isn't needed.

---

## 9. Out of scope

- **`brand-cli doctor` command** — candidate task C2; reads contract + probes runtime; reports same per-stage table without invoking pipeline. File once #3 lands.
- **Standard Figma MCP per-node walk** — candidate task C8 (see "Considered alternatives" above).
- **Computed CSS via Jina + vision** — speculative middle tier for Stage 2.
- **`.brandrc.yaml` industry signal** — task #5; orthogonal to this contract.
- **`.scope.json` as alternate input** — task #4; the SKILL's `dependencies` payload is part of the conversational scope-confirmation flow today.
- **CI workflow** — `.github/workflows/test.yml` left for follow-up; tests run locally via `npm test`.
- **MCP-server-fronting brand-skills** — candidate task C1; the manifest schema's `dependencies` block is a reference data shape this would expose.
