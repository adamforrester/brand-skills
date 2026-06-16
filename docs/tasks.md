# Tasks

Canonical task state for the de-XD-coupling and multi-tenant work. Survives context clears.

The session task tool (TaskList) is ephemeral. This file is the durable record. When work moves between sessions, sync this file first.

**Last updated:** 2026-06-16 — #8 closed as won't-do (DTCG export is upstream-owned by Token Press; the import direction shipped in #3 is sufficient). Active backlog now empty; next work picks from candidate tasks. #5 merged earlier on this date via `2aa31b4`; #4 via `97db05d`.

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

---

## Active backlog

(empty — pick next work from "Candidate tasks" below)

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
| C9 | Unify ajv-validator construction pattern across loaders | Sibling utilities (`manifest-writer`, `health-writer`, `contract-loader`) keep `ajv` in module scope and call `ajv.errorsText()` directly; `scope-loader.js` instead stashes an `errorsTextFn` closure on the compiled validator. Functionally equivalent ([D2] in the scope-json branch progress doc). A future small refactor could align all four. Independent; surface only if other validator drift accumulates. |

---

## Priority notes

**Sequence (recommended) — remaining active backlog only:**

(Active backlog is empty. #1-#7 shipped; #8 closed as won't-do — see "Won't do" above. Next work picks from candidate tasks below; C2 / C8 / C9 are most fileable.)

**Cross-task contracts to preserve:**
- **#2 ↔ #6 status vocabulary:** must match exactly. `complete | partial | placeholder | missing | defaults`.
- **#2 ↔ #3:** manifest schema must accommodate per-stage MCP fallback decisions.
- **#4 ↔ #5:** scope schema (`schema/brand/scope.schema.json`) `additionalProperties: false` at top level let #5 land as a one-line append. (Both shipped.)

**Multi-tenant constraint** (applies to all tasks): brand-skills is used both standalone (Claude Code slash commands) and embedded (host-project orchestrator dispatching the SKILL or CLI). Every task here adds artifacts/contracts that work in both modes. Conversational flows stay; structured I/O is additive, not a replacement.

**XD-decoupling constraint:** when implementing tasks, default to general-purpose framing. Don't add new XD-specific defaults, vocabulary, or assumptions. Reference [`docs/xd-assumption-inventory.md`](xd-assumption-inventory.md) for the existing residue worth fixing opportunistically.
