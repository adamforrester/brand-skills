# Design — `.brand/.scope.json` (Structured Scope Input for Embedded Use)

**Status:** approved 2026-06-14 (brainstorm complete; ready for implementation plan)
**Tasks closed on land:** [#4](../../tasks.md)
**Tasks unblocked on land:** [#5 industry signal](../../tasks.md) — industry value flows naturally through `.scope.json`
**Manifest schema impact:** none (no schema bump required)

This spec formalizes a structured-input path for `/brand-context:extract`'s Stage 0 (source discovery). Today, Stage 0 is conversational: the SKILL asks the practitioner about website URLs, Figma sources, social profiles, and so on, and writes their answers into `.brandrc.yaml`. This works for standalone use (a practitioner running the slash command in Claude Code), but it breaks for **embedded use** — a host orchestrator dispatching the SKILL non-interactively has no human at the keyboard to answer Stage 0's prompts.

The spec adds an optional `.brand/.scope.json` file. When present, the SKILL reads it once at the start of Stage 0, merges its contents into the in-memory brandrc state (brandrc wins on conflict), and skips the conversational discovery for any field that's now populated. When absent, the SKILL falls through to today's conversational flow exactly as-is.

This is the missing half of the multi-tenant story. The just-merged MCP-fallback-contract branch added `interactive_preflight: false` for embedded `§0.5` runs; `.scope.json` provides the structured Stage 0 input that completes the embedded-mode end-to-end path.

---

## 1. Relationship to `.brandrc.yaml`

`.brandrc.yaml` remains the **single source of truth** for all downstream stages. `.scope.json` is a transient pre-fill — read once, merged into brandrc, then deleted on successful Stage 0 completion. Re-running `/brand-context:extract` after a successful run uses brandrc only.

### Precedence rule

**brandrc wins on conflict.** The practitioner may have hand-tuned `.brandrc.yaml`; we don't overwrite their work. `.scope.json` only fills *empty* brandrc fields.

### "Empty" definition (per field type)

The brandrc shape is loose YAML, so "empty" needs a precise definition:

| Field type | "Empty" means |
|---|---|
| String (e.g. `client`, `tier`, `mode`, `sources.website`) | Missing key OR empty string `""` OR null |
| Array (e.g. `sources.figma`, `sources.website_pages`, `sources.screenshots`) | Missing key OR `[]` (empty array) OR null |
| Object (e.g. `sources.social`, `sources.app_store`) | Missing key OR `{}` (empty object) OR null. **For nested objects, descend leaf-by-leaf** — `sources.social.twitter` is empty independently of `sources.social.instagram` |
| Boolean (e.g. `interactive_preflight`) | Missing key only. `false` is a deliberate choice and counts as set |

### Three illustrative cases

**Case A — fresh project, full scope:**
- brandrc has just `client: "ACME"`, `tier: "standard"`, `mode: "standard"`, empty `sources: {}` (the `init` scaffold default)
- scope has the full sources tree
- Result: brandrc gets the full `sources:` block from scope; `client/tier/mode` already match scope (no-op)

**Case B — practitioner pre-tuned brandrc, partial scope:**
- brandrc has `sources.website: "https://acme.com"`, `sources.figma: ["abc123"]`
- scope has `sources.website: "https://stale.example.com"` AND `sources.brand_guide: "assets/guide.pdf"`
- Result: `sources.website` keeps brandrc's value (conflict; logged); `sources.brand_guide` gets pre-filled from scope; `sources.figma` keeps brandrc's value (scope didn't provide one)

**Case C — embedded host scope, no brandrc populated:**
- brandrc is the `init` scaffold default (everything empty)
- scope has full sources + `interactive_preflight: false`
- Result: every brandrc field gets pre-filled from scope

---

## 2. Schema

**Path:** `schema/brand/scope.schema.json`
**Validated by:** ajv draft 2020-12 (`ajv/dist/2020.js`) under `strict: true`, matching the established precedent.
**Owner:** Hand-authored by practitioners (interactive mode) or by host orchestrators (embedded mode).

### Top-level shape

```json
{
  "_comment": "Optional pre-fill for .brandrc.yaml. Stage 0a.5 reads this before conversational discovery; merges into brandrc; deletes the file on successful Stage 0 completion. See docs/superpowers/specs/2026-06-14-scope-json-design.md.",
  "client": "ACME Corp",
  "tier": "standard",
  "mode": "standard",
  "sources": {
    "website": "https://acme.example.com",
    "website_pages": ["/about", "/products", "/contact"],
    "figma": ["abc123def456"],
    "figma_variable_collections": ["Primitives", "Semantic"],
    "brand_guide": "assets/brand-guide.pdf",
    "screenshots": ["assets/hero.png", "assets/about.png"],
    "social": {
      "twitter": "https://x.com/acmecorp",
      "instagram": "https://instagram.com/acmecorp"
    },
    "app_store": {
      "ios": "https://apps.apple.com/...",
      "android": "https://play.google.com/..."
    },
    "design_system_repo": "./packages/ds"
  },
  "interactive_preflight": false
}
```

### Field rules

| Field | Required at schema level? | Notes |
|---|---|---|
| `_comment` | optional | Convention from peer schemas |
| `client` | optional | If absent, falls through to brandrc / Stage 0 conversation. **Required at runtime in embedded mode** (see §3) |
| `tier` | optional | Enum: `minimum | standard | comprehensive` |
| `mode` | optional | Enum: `pitch | standard | comprehensive` (matches `init.js TIER_FOR_MODE`) |
| `sources` | optional | All sub-fields optional; partial trees fine |
| `sources.website` | optional | URL string when present |
| `sources.website_pages` | optional | Array of paths (e.g., `/about`) |
| `sources.figma` | optional | Array of file IDs OR URLs (the SKILL extracts the file key from URLs, mirroring Stage 0d behavior). Schema is permissive: `{type: string, minLength: 1}` |
| `sources.figma_variable_collections` | optional | Array of collection names |
| `sources.brand_guide` | optional | Path string |
| `sources.screenshots` | optional | Array of paths |
| `sources.social` | optional | Object keyed by platform (`twitter`, `instagram`, `linkedin`, `facebook`, `tiktok`); each value a URL string |
| `sources.app_store` | optional | Object with optional `ios` + `android` URL strings |
| `sources.design_system_repo` | optional | Local path or git URL |
| `interactive_preflight` | optional | Boolean. Defaults to `true` if absent. When `false`, missing required fields cause structured-error bail (see §3) |

**`additionalProperties: false`** at every object level. Top-level requires nothing — partial scopes are valid.

### Schema-level vs. runtime requirement

- Schema validation is intentionally **permissive**: it accepts a `.scope.json` with only `interactive_preflight: false` and nothing else.
- Runtime requirement (`client` + `tier` + at least one usable `sources.*` entry) is enforced in the SKILL when `interactive_preflight: false`. Schema can't enforce "required when X" cleanly; SKILL prose owns this gate.

---

## 3. Merge algorithm

Runs in SKILL `§0a.5` (new section, inserted between `§0a` "Read existing config" and `§0b` "Scan the project for asset files"). Implemented in code at `cli/src/utils/scope-merge.js` so it's testable without driving the SKILL.

### Algorithm

```
For each scope field s (recursively, leaf-by-leaf):
  Let b = the corresponding brandrc field.

  If b is "empty":          brandrc[field] := scope[field]      (pre-fill)
  If b is "set":             brandrc[field] := brandrc[field]    (keep brandrc — log the conflict)

  Track which brandrc fields were filled-from-scope in an in-memory set. Stage 0c-0e
  reads this set to know which conversational questions to skip.
```

The merge utility returns `{ merged: <brandrc shape>, filledFromScope: Set<string>, conflicts: Array<{field, scope_value, brandrc_value}> }`. `filledFromScope` is a set of dot-paths (`"client"`, `"sources.website"`, `"sources.social.twitter"`) — the SKILL uses this to decide which Stage 0d questions to skip. Conflicts surface as chalk-yellow log lines in `§0e`.

### Embedded-mode runtime requirements

When `interactive_preflight: false` (or env var `BRAND_SKILLS_NONINTERACTIVE=1` is set):

| Field | Required for embedded mode? |
|---|---|
| `client` | required |
| `tier` | required |
| At least one of `sources.website`, `sources.figma`, `sources.brand_guide`, `sources.screenshots`, `sources.design_system_repo` | required (Stage 0 needs at least one pipeline-runnable source). `sources.social` and `sources.app_store` alone do not satisfy this — they're voice/copy supplements, not standalone pipeline inputs |
| `mode` | optional (defaults to `standard` if absent) |
| Other `sources.*` fields | optional |

If any required field is empty after the merge in embedded mode, the SKILL bails with a structured error (see §6).

### Stage 0c–0e behavior changes

After `§0a.5` runs:
- **`§0c` (asset findings)** — if `sources.brand_guide` and/or `sources.screenshots` came from scope AND `interactive_preflight: false`: skip the "sound good?" prompt entirely. Otherwise (interactive mode), still surface the discovery + ask. Pre-filling sources doesn't bypass the asset-rescan logic — that's filesystem state, separate from declared sources.
- **`§0d` (non-file source questions)** — for each of the 5 questions (website / figma / social / app_store / design_system_repo), check the in-memory "filled-from-scope" set. If the field's filled, skip that question. If `interactive_preflight: false` AND a required field's still empty, bail per §6. Otherwise (interactive), ask.
- **`§0e` (write brandrc)** — `Edit` brandrc with the merged in-memory state. Then, if `.scope.json` was read successfully and merged, `rm .brand/.scope.json` (delete-after-merge). Surface the final `sources:` block to the practitioner.

### File location

`.scope.json` lives at `.brand/.scope.json` — the same directory as the rest of the package. Consistent with `.brand/manifest.json` and `.brand/.health.json`.

**Implication for embedded hosts:** `.brand/` must exist before `.scope.json` can be written. Hosts run `brand-cli init --client "..." --mode standard --force` (which is non-interactive when `--client` is provided) before authoring `.scope.json`. Documented in §6 below.

---

## 4. CLI surface

### `brand-cli scope --validate`

A small lint command. Hosts authoring `.scope.json` programmatically run this before dispatching the SKILL to catch malformed payloads early.

```bash
$ brand-cli scope --validate
✓ .brand/.scope.json is valid

$ brand-cli scope --validate
✗ .brand/.scope.json failed schema validation:
  /sources/website must be string
exit 1
```

`--json` flag emits structured output for embedded hosts:

```bash
$ brand-cli scope --validate --json
{"ok": true, "path": ".brand/.scope.json"}

$ brand-cli scope --validate --json
{"ok": false, "errors": [{"path": "/sources/website", "message": "must be string"}]}
exit 1
```

The command is **not** required for the SKILL to work — the SKILL validates `.scope.json` itself on read at `§0a.5`. The CLI command is purely for ahead-of-time host-side validation.

### What the CLI does NOT do

- It does not implement the merge. The merge utility (`cli/src/utils/scope-merge.js`) is a library; only the SKILL `§0a.5` invokes it (or, if `brand-cli` were ever extended with an `--apply` action, that command — but that's out of scope for this branch).
- It does not delete `.scope.json` after validation. Validation is read-only.
- It does not write to `.brandrc.yaml`. Brandrc updates only happen in SKILL `§0a.5` after the merge is in memory.

---

## 5. Three-layer propagation (per CLAUDE.md editing checklist)

### Schema layer
- `schema/brand/scope.schema.json` (new) — JSON Schema 2020-12 validating scope payloads
- `schema/brand/README.md` (modified) — cross-link to the new scope schema

### CLI layer
- `cli/src/utils/scope-loader.js` (new) — `loadScope(brandDir)` returns parsed scope or null; `validateScope(payload)` runs ajv against the schema and returns `{valid, errorText}`
- `cli/src/utils/scope-merge.js` (new) — `mergeScopeIntoBrandrc(scope, brandrc)` returns `{merged, filledFromScope, conflicts}`
- `cli/src/commands/scope.js` (new) — `brand-cli scope --validate [--json]`
- `cli/bin/brand-cli.js` (modified) — register the new subcommand

### SKILL layer
- `brand-context/skills/brand-extract/SKILL.md` `§0a.5` (new section) — reads `.scope.json` if present; calls the merge utility; updates the in-memory brandrc state; tracks filled-from-scope keys; bails on embedded-mode missing-required
- `brand-context/skills/brand-extract/SKILL.md` `§0c` (modified) — honors `filledFromScope` set + `interactive_preflight` flag to skip the asset-confirmation prompt when appropriate
- `brand-context/skills/brand-extract/SKILL.md` `§0d` (modified) — same treatment for the 5 non-file source questions
- `brand-context/skills/brand-extract/SKILL.md` `§0e` (modified) — deletes `.scope.json` after successful brandrc write; logs conflicts inline

### Test layer
- `cli/test/unit/scope-loader.test.js` (new) — 6 tests: present/absent, malformed/valid, schema-rejection, additionalProperties enforcement
- `cli/test/unit/scope-merge.test.js` (new) — 5 tests: empty-fill, conflict-keeps-brandrc, partial pre-fill, leaf-by-leaf nesting, returned `filledFromScope` set
- `cli/test/integration/scope-cli.test.js` (new) — 3 tests: valid/invalid/absent for `brand-cli scope --validate`
- `cli/test/integration/scope-fixtures-roundtrip.test.js` (new) — 2 tests: full + invalid scope fixtures through the CLI
- `cli/test/unit/skill-scope-parity.test.js` (new) — 3 tests: SKILL prose mentions scope file path, merge precedence rule, embedded-mode bail behavior
- `cli/test/fixtures/scope/full.scope.json` (new) — every field populated
- `cli/test/fixtures/scope/partial.scope.json` (new) — `client`, `tier`, `sources.website` only
- `cli/test/fixtures/scope/invalid.scope.json` (new) — has an unknown top-level field

### Docs layer
- `CLAUDE.md` "File-write policies" table — add `scope.json` row (write policy: read-once + delete-after-merge)
- `CLAUDE.md` "Architecture" diagram — note `schema/brand/scope.schema.json`
- `README.md` "How the pipeline works" — note that `.brand/.scope.json` is an optional pre-fill for embedded use; conversational flow is the standalone default
- `docs/DESIGN.md` "Multi-tenant" — expand to explicitly call out the embedded-mode end-to-end path: `init` → optional `.scope.json` → `extract` with `interactive_preflight: false`
- `docs/tasks.md` — mark #4 complete on land; #5 unblocked

---

## 6. Error handling + edge cases

| Failure | Behavior |
|---|---|
| `.brand/.scope.json` absent | No-op; SKILL `§0a.5` returns immediately; falls through to conversational discovery as today |
| `.brand/.scope.json` is malformed JSON | Bail; chalk-red error mentioning the file path + parse error message; exit 1; **don't delete the file** |
| `.scope.json` fails schema validation (e.g., `tier: "wrong"`) | Bail; chalk-red error with ajv `errorsText`; exit 1; don't delete |
| `.scope.json` valid but `client` missing AND `interactive_preflight: false` | Bail with structured error to stderr (see error-message conventions below); exit 1; don't delete |
| `.scope.json` valid; `interactive_preflight: false`; required runtime fields present; merge succeeds | Quiet pre-fill; Stage 0c-0d skip questions for filled fields; `§0e` writes brandrc + `rm .scope.json` |
| `.scope.json` valid; `interactive_preflight: true` (or unset); partial; merge succeeds | Pre-fill what's there; Stage 0c-0d ask about everything else conversationally |
| `.scope.json` valid; non-empty conflict with `.brandrc.yaml` | brandrc wins; chalk-yellow log line surfaced inline; merge continues |
| `.brandrc.yaml` write fails (filesystem error) mid-merge | Bail; chalk-red error; **don't delete** `.scope.json` (state is inconsistent) |
| Brandrc write succeeds, scope delete fails | Chalk-yellow warning; continue. Brandrc is canonical now; leftover scope re-merges as no-op next run |
| `.scope.json` provides `sources.figma` as a Figma URL (not raw file ID) | SKILL extracts the file key (mirrors Stage 0d URL-parsing). Bad URLs surface as Stage 1 failures with clear errors — not blocked at intake |
| `.scope.json` references a nonexistent path (`brand_guide: assets/missing.pdf`) | Pre-fill proceeds (intake doesn't check filesystem). Missing file surfaces as a Stage 4 failure or `§0c` asset-rescan miss |
| `.scope.json` has `interactive_preflight: true` AND `BRAND_SKILLS_NONINTERACTIVE=1` env var | Env var wins; treated as embedded (matches §0.5b precedent: env var is a host-level override) |
| `.scope.json` has `_comment` field | Validated as string; ignored in merge logic |
| Two `.scope.json` files in the project (root + `.brand/`) | Only `.brand/.scope.json` is read. Root `.scope.json` is silently ignored |

### Error message conventions

All structured errors follow the pattern from `emit-manifest.js rejectV1` (just-merged precedent):

```
chalk.red(
  '<one-line problem statement>. '
  + '<one-sentence remediation>. '
  + 'See <spec-or-doc-pointer>.'
)
```

For the embedded-mode `missing_required_fields` case, the prose error is **also** emitted as JSON to stderr (so hosts can parse it):

```javascript
chalk.red('.scope.json is missing required fields for embedded mode: client, tier. '
  + 'Add the missing fields and re-author .scope.json before dispatching the SKILL. '
  + 'See docs/superpowers/specs/2026-06-14-scope-json-design.md §3.');
console.error(JSON.stringify({error: 'missing_required_fields', missing: ['client', 'tier'], hint: '...'}));
```

### Embedded-host setup pattern (documented for §5 docs propagation)

Because `.scope.json` lives inside `.brand/`, hosts must run `init` before authoring scope:

```bash
brand-cli init --client "ACME Corp" --mode standard --force
cat > .brand/.scope.json <<JSON
{
  "client": "ACME Corp",
  "tier": "standard",
  "sources": { "website": "https://acme.example.com" },
  "interactive_preflight": false
}
JSON
# now the SKILL can be dispatched non-interactively via /brand-context:extract
```

---

## 7. Considered alternatives (rejected)

Recorded so future readers don't re-litigate.

### Project-root `.scope.json` (instead of `.brand/.scope.json`)
**Rejected.** Pro: hosts could pre-stage scope before init. Con: another root-level dotfile; violates the pattern of "everything brand-skills lives under `.brand/`." The init-then-scope sequence is acceptable host-side friction.

### Both locations (root + `.brand/`)
**Rejected.** Pro: maximum flexibility. Con: two places to look on every run; documentation needs to explain both; potential confusion if both exist. YAGNI.

### `.scope.json` overrides `.brandrc.yaml` (scope wins on conflict)
**Rejected.** Hand-tuned brandrc fields are a real pattern (practitioners customize after `init` writes the scaffold). Overwriting them violates the principle that the practitioner's edits are authoritative.

### Replacement model — `.scope.json` IS the input when present, brandrc ignored
**Rejected.** Two parallel inputs that never reconcile permanently invites drift. Embedded runs would fork from standalone runs in ways that are hard to debug. The pre-fill model keeps brandrc as the single source of truth.

### Keep `.scope.json` after merge (don't delete)
**Rejected.** Re-running the SKILL would re-merge stale scope content into brandrc. The "consumed_at timestamp" variant adds a check-on-mtime mechanism that's more complex than needed. Delete-after-merge is the simplest correct behavior; embedded hosts re-author scope before each invocation as part of their normal workflow.

### Strict-only schema (require complete scope)
**Rejected.** Practitioners may want to hand-write a partial scope to skip the parts they're sure about. The complexity of "complete = no questions, partial = some questions" is small; the flexibility win is large.

### Schema-level "required when interactive_preflight: false"
**Rejected.** JSON Schema 2020-12's `if/then/else` could express this, but readability suffers and ajv error messages get harder to interpret. Runtime enforcement in SKILL prose is clearer.

### Embedded mode with partial scope: degrade gracefully (run with what's there)
**Rejected.** Silent degradation in embedded mode hides configuration mistakes from hosts. Hard-fail with a structured error is what hosts actually want — they fix the scope and re-dispatch.

### Manifest schema bump to record scope conflicts as a `0_scope` stage
**Rejected for now.** Adds a manifest schema bump (version 3) just for a logging field. Conflicts will be rare; chalk-yellow stderr log is enough. If hosts later ask for structured conflict reporting, file as a follow-up — likely a small additive manifest schema bump.

### Merge logic in SKILL prose only (strict Approach A)
**Adjusted.** The strict reading of "Approach A" had merge logic only in SKILL prose. We deviate by extracting the merge into `cli/src/utils/scope-merge.js` (~30 lines, pure function, no I/O). The deviation earns its keep by making the merge testable as code instead of un-testable prose. SKILL `§0a.5` documents the algorithm in prose for the inline-fallback path, but the canonical implementation is the utility.

### `brand-cli scope --apply` (CLI command that does the merge)
**Rejected.** Would mean two implementations of the merge (CLI + SKILL inline-fallback). The merge is simple enough that having two parallel implementations is overkill. The SKILL invokes `scope-merge.js` directly via the inline path; no shell-out needed.

---

## 8. Out of scope

- **`brand-cli doctor`** — candidate task C2; the runtime sibling to `brand-cli score` for tooling readiness. Parked in `docs/tasks.md` until embedded hosts demand it.
- **Manifest-level conflict reporting** — see "Considered alternatives" above. Defer until hosts ask.
- **Industry signal injection (`industry:` field)** — task #5; spec'd separately. The shape is intentionally compatible with `.scope.json` so adding `industry: <string>` to the scope schema later is a one-line addition.
- **`.scope.json` as a CI-friendly diff artifact** — speculative. If hosts want to track scope drift over time, that's a separate task.
- **Concurrent SKILL invocations** — out of scope; SKILL invocations aren't expected to be concurrent in any current usage pattern.
- **Cross-platform path normalization beyond `node:path`** — out of scope; same reasoning as the just-merged contract branch.
