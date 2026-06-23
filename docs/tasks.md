# Tasks

Canonical task state for the de-XD-coupling and multi-tenant work. Survives context clears.

The session task tool (TaskList) is ephemeral. This file is the durable record. When work moves between sessions, sync this file first.

**Last updated:** 2026-06-23 — v0.5.0 release commit (one commit on `release/v0.5.0` branch, then merged to `main`). Bumps the package version across all ten literal places in actual code (4 runtime + 3 goldens + 3 test fixtures); updates `CLAUDE.md` "Versioning + release" with the audit-friendly ten-place inventory (was three) so the next release commit isn't blindsided. Covers the three Wendy's-tryout SKILL-prose fixes (R1 `2f7fab3`, R2 `2b8dde1`, R3 `84757bb`) plus the prior visual-style-guide release (`c29ba08`). Tests 159/159. Active backlog still empty. Next: 1.0 milestone (npm publish + first real-install validation walk + C2 doctor command).

---

## Completed

### #2 — Emit `.brand/manifest.json` from `/brand-context:extract` ✅
**Output:** `.brand/manifest.json` per `schema/manifest.schema.json`. Per-file statuses + per-stage outcomes + MCP availability. Emitted at end of Stage 8.

### #6 — Emit `.brand/.health.json` from `/brand-context:check` ✅
**Output:** `.brand/.health.json` per `schema/health.schema.json`. Tier-weighted readiness, gaps, downgrades. Emitted by every `brand-cli score` run.

### #1 — XD-assumption inventory (read-only audit) ✅
**Output:** [`docs/xd-assumption-inventory.md`](xd-assumption-inventory.md)

18 findings grouped by impact (Critical / Significant / Notable). Three cross-cutting patterns:
1. Workflow-tier-as-extraction-tier conflation (largest architectural issue)
2. Agency framing of the user (cumulative tone, mostly small fixes)
3. Closed integrations / closed enums (`--impeccable`, `tools.agent`, `extensions`)

No fixes proposed in the inventory itself — prioritization is downstream.

### #7 — Research peer tools ✅
**Output:** [`docs/research-notes.md`](research-notes.md)

Three repos compared: dembrandt (primary, 1.9K stars), design-oracle (3 stars), Agent-Reach (26K stars).

Strategic decision recorded: **borrow without dependency** (Option 3). Captured in [CLAUDE.md "Stance on dembrandt and other peer tools"](../CLAUDE.md). Adopt patterns and open specs (DTCG, design.md, MCP tool shape); don't add a runtime dependency on any peer.

### #3 — Explicit MCP-fallback contract per stage in `brand-extract` ✅
**Output:** branch `feat/mcp-fallback-contract` merged to `main` via `--no-ff` local merge commit `4383a94` (no PR — feature branch preserved on origin).

What landed:
- Contract schema + canonical data files: `schema/mcp-fallback-contract.json` + `schema/mcp-fallback-contract.schema.json`. Per-stage chains for Stages 1, 2, 3 with `tier` / `quality` / `fidelity_note` / `pre_conditions` declared as data.
- Manifest schema bumped to `version: "2"`: `mcps` field renamed to `dependencies`; new per-stage `fallback` fields. v1 payloads/manifests are hard-rejected by `emit-manifest` and `score`.
- New CLI utilities: `cli/src/utils/contract-loader.js`, `cli/src/utils/dtcg-import.js`, `cli/src/utils/jina-fetch.js`.
- New CLI subcommand: `brand-cli import-tokens` (DTCG → `.brand/tokens/*.md`, the Stage 1 degraded fallback).
- New SKILL section: `§0.5 Pre-flight dependency check` — runs once at the top of `/brand-context:extract`, materializes the contract decision tree per-stage.
- Stages 1 / 2 / 3 / 10b SKILL prose updated to reference the contract chains rather than inline branching.

Spec: [2026-06-13-mcp-fallback-contract-design.md](superpowers/specs/2026-06-13-mcp-fallback-contract-design.md).

### #4 — Support `.brand/.scope.json` as alternative to conversational scope-confirmation ✅
**Output:** branch `feat/scope-json` merged to `main` via `--no-ff` local merge commit `97db05d` (no PR — feature branch preserved on origin).

What landed:
- Scope schema: `schema/brand/scope.schema.json` (JSON Schema 2020-12, permissive at schema level — runtime requirements enforced in SKILL prose).
- Two CLI utilities: `cli/src/utils/scope-loader.js` (read + ajv validate) and `cli/src/utils/scope-merge.js` (pure-function merge with brandrc-wins-on-conflict + per-type "empty" rule).
- New CLI subcommand: `brand-cli scope --validate [--json]` for ahead-of-time host-side validation.
- New SKILL section `§0a.5` in `brand-context/skills/brand-extract/SKILL.md` — read-merge-delete flow, threads `filledFromScope` set into Stage 0c-0e to skip conversational questions for pre-filled fields, bails with structured stderr JSON when `interactive_preflight: false` and required fields are missing.
- SKILL ↔ scope parity test (`cli/test/unit/skill-scope-parity.test.js`) guards prose drift against the spec.
- Three test fixtures + integration tests + roundtrip test covering loader → validator → merge → CLI agreement.

Test count: 85 → 108 (+23). Conversational flow stays the standalone default. Two paths produce equivalent `.brandrc.yaml` state.

Spec: [2026-06-14-scope-json-design.md](superpowers/specs/2026-06-14-scope-json-design.md).

### #5 — Inject industry signal into voice + overview extraction ✅
**Output:** branch `feat/industry-signal` merged to `main` via `--no-ff` local merge commit `2aa31b4` (no PR — feature branch preserved on origin).

What landed:
- Schema: one-line `industry` field append to `schema/brand/scope.schema.json` at top level (sibling of `client`/`tier`/`mode`). Free-form string with `minLength: 1`. The cross-task contract from #4's `additionalProperties: false` made this a one-line change.
- SKILL prose: three additive blocks in `brand-context/skills/brand-extract/SKILL.md` — §0a notes the field, §4c adds a soft-tie-breaker bullet for Stage 3 voice inference (with worked example), §6b scopes the prior to Stage 4 Brand Personality / Audience / Competitive Context only (Visual Language and brand self-test stay evidence-only).
- Citation marker: `*(industry context: <value>)*` (italicized parenthetical, matches existing confidence-cite and source-cite patterns). Threshold-preservation rule explicit: prior may NOT lower §4d's ≥3-samples-per-attribute or §4e's <10-total-samples thresholds, NOR invent claims with no sample support.
- Tests: +1 in `cli/test/unit/scope-merge.test.js` (industry round-trip + brandrc-wins-on-conflict), +3 in `cli/test/unit/skill-scope-parity.test.js` (field-mention, citation-marker literal, tie-breaker rule + threshold-preservation regex).
- Docs: README YAML example + paragraph in "How the pipeline works" section. **No CLI code changes** — the existing generic recursive merge in `scope-merge.js` round-trips the new field automatically.

Test count: 108 → 112 (+4). Behavior identical to today when `industry` is unset.

Spec: [2026-06-15-industry-signal-design.md](superpowers/specs/2026-06-15-industry-signal-design.md).

### De-XD cleanup (Bucket A — pre-1.0 contract residue) ✅
**Output:** branch `feat/de-xd-cleanup` merged to `main` via `--no-ff` local merge commit `167c1f2` (no PR — feature branch preserved on origin).

Closes XD-inventory items #2, #3 (partial), #4, #6, #7, #10, #12, #14, #18 and unblocks 1.0 release.

What landed:
- New `cli/src/utils/brandrc-loader.js` + `deprecations.js`. `loadBrandrc(projectDir)` is the single normalization site; four reading callers (`refresh-context`, `refresh-design`, `score`, `emit-manifest`) consume the normalized `{brand, ...}` shape. `init.js` scaffolds, doesn't read.
- `client` → `brand` rename across brandrc field, init prompt, `--brand` flag, schema doc, README. `--client` retained as deprecated alias. Manifest schema stays `version: "2"`; brandrc `brand` translates to `manifest.client` at write time ([D0]).
- `mode: pitch` → `mode: public-sources-only` across SKILL §4f/§5c/§6e/§8f banners and init prompt list. Loader normalizes legacy `mode: pitch` with warn-once.
- Stage 6 gate decoupled from `tier == comprehensive`; now fires whenever `sources.design_system_repo` is set, regardless of tier. Init-time workflow scaffolding under `tier: comprehensive` unchanged (Bucket C scope).
- `--impeccable` → `--also-write <path>` (repeatable) + brandrc `outputs: [path]` field; dedup-merged via `Set` seeded with `brand.md`. `--impeccable` retained as deprecated alias. `overview.schema.md` reframes Impeccable as one of many AI-agent context-gathering protocols.
- Schema-doc cleanup batch: `tools.agent` enum→string with cline/aider/other; `tools.storybook` row dropped; `extensions` row+section dropped; `sources.asset_dir` row added with init `--asset-dir <path>` persistence; SKILL §0b honors override before legacy fallbacks.
- Soft-deprecation infrastructure: `deprecations.js` warns once per key per process. Seven warn keys: `brandrc.client`, `brandrc.client+brand`, `brandrc.mode.pitch`, `brandrc.extensions`, `init.flag.client`, `init.flag.mode.pitch`, `cli.refresh-context.impeccable`. `tools.storybook` dropped silently.

Test delta: 112 → 132 (+20). +1 deprecations + 9 brandrc-loader + 4 refresh-context-outputs (incl. dedup-coalesce regression) + 6 skill-scope-parity assertions for renamed banners, Stage 6 gating phrase, and asset_dir override.

Spec: [2026-06-16-de-xd-cleanup-design.md](superpowers/specs/2026-06-16-de-xd-cleanup-design.md).
Plan: [2026-06-16-de-xd-cleanup.md](superpowers/plans/2026-06-16-de-xd-cleanup.md).
Progress: [2026-06-16-de-xd-cleanup-progress.md](superpowers/plans/2026-06-16-de-xd-cleanup-progress.md).

---

### R3 — SKILL §0d consolidated multi-line paste prompts + URL auto-classification ✅
**Output:** branch `feat/skill-source-collection-ux` merged to `main` via `--no-ff` local merge commit `84757bb` (no PR — feature branch preserved on origin).

What landed:
- Rewrite `§0d` as five consolidated multi-line paste prompts, one per source category:
  1. **Web URLs** — first → `sources.website` (primary), rest → `sources.website_pages` array.
  2. **Figma URLs** — multi-line paste, all → `sources.figma` array, with file-key extraction noted.
  3. **Social URLs** — auto-classified by hostname into `sources.social.*` subobject (twitter.com / x.com / instagram.com / linkedin.com / facebook.com / fb.com / tiktok.com).
  4. **App store URLs** — auto-classified: apps.apple.com → `app_store.ios`; play.google.com → `app_store.android`.
  5. **Design-system repo** — single-value, unchanged.
- Hostname normalization spelled out: strip leading `www.` AND `m.` subdomains; path / trailing slash / query string irrelevant. LinkedIn `/company/...` and `/in/...` both classify to `social.linkedin`.
- Pre-fill skip rule reframed as "primary key + additive keys" so a scope.json that fills only `sources.website` doesn't trigger a redundant web-URL prompt for the missing `website_pages`.
- Preflight bail precedence made explicit: `§0a.5` owns the `interactive_preflight: false` bail; `§0d` is unreachable in that mode and only runs interactively.
- Conversational fallback retained but pinned to a `https?://[^\s]+` regex for URL extraction; bare-domain mentions without a scheme are NOT auto-extracted (avoids false matches on brand-name mentions).
- Non-URL line handling: silently drop blanks / comments / prose interjections from a paste; surface a one-line summary if any were dropped so the practitioner can re-paste if needed.

One parity-test assertion guards against drift:
- `§0d` section-scoped (mirrors R1/R2 pattern). Asserts: ≥3 "one per line" multi-line affordances, all 8 canonical hostnames named, conversational fallback retained, both `sources.website` AND `sources.website_pages` referenced, and the "primary key + additive" framing present.

Test delta: 158 → 159 (+1). No schema changes, no new CLI surface, no new generator code. Pure SKILL-prose fix.

Closes the third and final SKILL-prose bug surfaced by the Wendy's tryout. Active backlog from the tryout is now empty.

### R2 — SKILL §8d conflict-resolution walkthrough is a hard pipeline gate ✅
**Output:** branch `feat/skill-conflict-walkthrough` merged to `main` via `--no-ff` local merge commit `2b8dde1` (no PR — feature branch preserved on origin).

What landed:
- Rewrite `§8d` as a "hard pipeline gate" with explicit blocking language ("must not advance to §8e/§10b/§10c/§11 until the walkthrough has run") and an inline note about the Wendy's bug so the failure mode is preserved as institutional memory.
- Pre-walkthrough framing message that surfaces the N/M/K counts and the four-option set before the first prompt.
- Three explicit passes, each with a fixed option set and clear status-enum mappings:
  - **Pass 1 — Conflicts:** `Resolve / Override / Mark intentional / Skip for now`. Resolve and Override produce `resolved-with-rationale` entries that stay in Active Conflicts (per `schema/brand/conflicts.schema.md` §"Behavior on re-run"); Mark intentional moves the entry to Intentional Adaptations.
  - **Pass 2 — Intentional adaptation candidates:** `Confirm intentional / It's actually a conflict / Skip`.
  - **Pass 3 — Auto-resolutions:** `Confirm auto-resolved / Re-add as active / Skip`. Only Pass 3 confirmations move to the Resolved Conflicts Archive.
- Post-walkthrough one-line confirmation (`Walkthrough complete: X resolved, Y intentional, Z skipped, W auto-resolved.`) so the practitioner sees the gate cleared. Disambiguates that `X resolved` folds Resolve+Override.
- Mid-walkthrough abort handling (treat remaining items as Skip for now, post partial counts, proceed) so the pipeline doesn't deadlock.
- `§8e` "Apply the additive policy" updated to mirror §8d's three passes — Active Conflicts populates from §8d's in-memory state including the Mark-intentional re-classification path; Intentional Adaptations appends from Pass 2 + Pass 1 re-classifications; Resolved Archive appends only from Pass 3 confirmations.
- `§8e` step 3 also pins the schema's empty-state literal `_No active conflicts as of {today}._` so the chat-message string from §8d isn't accidentally written to disk.

Two parity-test assertions guard against drift:
- `§8d` gate language ("hard pipeline gate" / "must not advance"), all ten canonical labels across the three passes (4+3+3), one-item-at-a-time discipline, and abort handling.
- `§8e` mirrors §8d's "Mark intentional" re-classification path.

Test delta: 156 → 158 (+2). No schema changes, no new CLI surface, no new generator code. Pure SKILL-prose fix.

Closes the second of three SKILL-prose bugs surfaced by the Wendy's tryout.

### R1 — SKILL §10c triggers `brand-cli refresh-design` at end of pipeline ✅
**Output:** branch `feat/skill-refresh-design-final` merged to `main` via `--no-ff` local merge commit `2f7fab3` (no PR — feature branch preserved on origin).

What landed:
- New SKILL section `§10c Final design-surface refresh (required — do not skip)` between `§10b` (manifest emission) and `§11` (Final summary). Calls `brand-cli refresh-design` once more after Stage 5 conflict resolution + Stage 8 `brand.md` refresh so `style-guide.html`'s active-conflicts banner reflects post-walkthrough state.
- Forward-pointer note in `§8` previewing the second pass so a future reader can't collapse the two regen passes into one and reintroduce the bug.
- Two opportunistic prose cleanups in the same diff: `§10` closing line ("Stages 7 and 8" — there is no Stage 7) rewrote to point at `§10b → §10c`; `§11` Files-written bullet's `(comprehensive tier)` parenthetical (residue from pre-de-XD) replaced with `(when sources.design_system_repo is set)` and `style-guide.html` added to the list.
- Two parity-test assertions in `cli/test/unit/skill-scope-parity.test.js`: `§10c` header + refresh-design/style-guide.html proximity + "required, do not skip" wording, AND a `§8`-section-scoped check for the forward-pointer (tightened post-review so removing the note actually fails the assertion).

Test delta: 154 → 156 (+2). No schema changes, no new CLI surface, no new generator code. Pure SKILL-prose fix.

Closes the first of three SKILL-prose bugs surfaced by the Wendy's tryout.

### Visual style guide (`style-guide.html` synthesis artifact) ✅
**Output:** branch `feat/visual-style-guide` merged to `main` via `--no-ff` local merge commit `c29ba08` (no PR — feature branch preserved on origin).

New project-root artifact alongside `design.md` and `brand.md`. Single self-contained HTML file rendering the brand synthesis from `.brand/`: identity header, color swatches, type ramp, spacing/surface samples, voice pull-quotes, and an active-conflicts banner. Auto-generated by `brand-cli refresh-design` (no new subcommand, no opt-in flag). Neutral page chrome — brand values appear only in content samples. Long-scroll narrative layout. Empty-state on a fresh init renders the brand name + per-section "not yet extracted" callouts.

What landed:
- New `cli/src/utils/style-guide-generator.js`. Pure function `generateStyleGuide(brandDir, brand, now)` returning a self-contained HTML5 string. No fs writes, no `Date.now()`, no AI calls — timestamp supplied by the call site so the SKILL inline fallback can produce byte-identical output.
- Wired into both `brand-cli refresh-design` and `brand-cli init`. `--json` output gains a `style_guide` field alongside the existing `output` field.
- Page chrome brand-agnostic ([D8]): system-ui font, `#fafafa` background, `#0066cc` accent, `1px solid #e5e5e5` borders, `960px` max-width. Brand values appear only in content samples.
- CSS-injection hardening: `escapeCss()` strips `; : { } < > \n \r` from token values before they land in inline `style="..."` attributes. Applied at five sites (typography 4 sub-fields, colors swatch background, surfaces rounded, surfaces elevation).
- Active Conflicts H2 regex tightened (`\s*$` instead of `\b`) so a `## Active Conflicts (archived)` heading does NOT contribute to the count.
- Full SKILL↔CLI fallback parity: new SKILL block under §8 ("Also write style-guide.html") + parity test asserting `style-guide.html`, `cli/src/utils/style-guide-generator.js`, and `byte-identical` are all in the SKILL prose.
- Repo docs: CLAUDE.md file-write-policies row + SKILL→CLI fallback cross-reference; README pipeline-output + quick-start; DESIGN.md architectural mention.

Test delta: 132 → 154 (+22 — 21 generator unit tests + 1 SKILL parity). Manifest schema unchanged. No new dependencies. No version bump (v0.5.0 release commit deferred).

Spec: [2026-06-18-visual-style-guide-design.md](superpowers/specs/2026-06-18-visual-style-guide-design.md).
Plan: [2026-06-18-visual-style-guide.md](superpowers/plans/2026-06-18-visual-style-guide.md).

---

## Active backlog

### Pending

(none currently — the three Wendy's-tryout SKILL-prose bugs all closed; see Completed below)

### Blocked

(none currently)

---

## Won't do

### #8 — DTCG token export (`brand-cli refresh-design --dtcg`) ✗
**Closed:** 2026-06-16. DTCG export is out of scope for brand-skills. The canonical DTCG producer in this practitioner's workflow is **Token Press** (a separate Figma plugin); brand-skills already consumes its output via `brand-cli import-tokens` (shipped in #3 as Stage 1's degraded fallback). An export command would round-trip through brand-skills for no consumer the tool owns, and pull framing toward "token tooling" — outside the extraction-and-context mandate. If a future use case appears that needs `.brand/tokens/*.md` → DTCG (e.g. emitting tokens that originated from non-Figma sources), file as a fresh task with that specific use case named.

---

## Candidate tasks (not yet filed)

Held to avoid backlog bloat. Re-evaluate after the active backlog clears. From research notes (`docs/research-notes.md`).

| Tag | Idea | Why hold |
|---|---|---|
| C1 | Expose brand-skills as an MCP server | Biggest multi-tenant unlock. Model on dembrandt's job-queue + sync/async + 7-typed-tools design. File once #2 + #6 land — they define the JSON contract this exposes. |
| C2 | `brand-cli doctor` — tooling-readiness sibling to `brand-cli score` | Pairs with #3 + #6. **#3 has landed** — C2 is now filable when an embedded host asks for it. |
| C3 | Motion token extraction in Stage 2 | Populate `tokens/motion.md` (currently always placeholder). Borrows from dembrandt's approach. Independent — could file anytime. |
| C4 | Multi-page confidence boosting in Stage 2 | Tokens on N pages → HIGH confidence; on 1 page → MEDIUM/LOW. Independent — could file anytime. |
| C5 | `docs/install.md` agent-readable installer | Lets non-Claude-Code agents install via "Hey agent, follow this" pattern. Multi-tenant unlock. |
| C6 | WCAG state-simulating contrast walk in `/brand-context:audit` Dimension 5 | Borrowed from dembrandt. Improves audit quality. |
| C7 | Pluggable channel architecture for source extractors | Borrowed from Agent-Reach. Not urgent until we have a third source type asking for an alternative. |
| C8 | Standard Figma MCP (`plugin:figma:figma`) per-node walk as Stage 1 Tier 2 | Adds `get_variable_defs` per-selection walk as a degraded path between `figma-console` (full) and DTCG-import. Loses modes/aliases. Filed during #3 brainstorm; deferred for UX scoping (which nodes to walk?). **#3 has landed** — fileable; needs UX scoping first. |
| ~~C9~~ | ~~Unify ajv-validator construction pattern across loaders~~ | **Resolved 2026-06-16** on `feat/ajv-pattern-unification`. `scope-loader.js` now caches `ajv` at module scope and calls `ajv.errorsText()` directly (matching the contract-loader pattern); `errorsTextFn` closure removed. Writers stay eager; loaders stay lazy — both legitimate by design. |

---

## Priority notes

**Sequence (recommended) — remaining active backlog only:**

All three Wendy's-tryout SKILL-prose bugs closed. R1 at `2f7fab3`, R2 at `2b8dde1`, R3 at `84757bb`. Next post-merge step: v0.5.0 release commit covering the three R-task SKILL changes (one commit, five places: package.json, marketplace.json × 2 fields, cli/bin/brand-cli.js; plus 2 test goldens' generator field). Then 1.0 milestone (npm publish + first real-install validation walk + C2 doctor command). C2 and C8 remain the most fileable candidates.

**Cross-task contracts to preserve:**
- **#2 ↔ #6 status vocabulary:** must match exactly. `complete | partial | placeholder | missing | defaults`.
- **#2 ↔ #3:** manifest schema must accommodate per-stage MCP fallback decisions.
- **#4 ↔ #5:** scope schema (`schema/brand/scope.schema.json`) `additionalProperties: false` at top level let #5 land as a one-line append. (Both shipped.)

**Multi-tenant constraint** (applies to all tasks): brand-skills is used both standalone (Claude Code slash commands) and embedded (host-project orchestrator dispatching the SKILL or CLI). Every task here adds artifacts/contracts that work in both modes. Conversational flows stay; structured I/O is additive, not a replacement.

**XD-decoupling constraint:** when implementing tasks, default to general-purpose framing. Don't add new XD-specific defaults, vocabulary, or assumptions. Reference [`docs/xd-assumption-inventory.md`](xd-assumption-inventory.md) for the existing residue worth fixing opportunistically.
