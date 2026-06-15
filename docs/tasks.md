# Tasks

Canonical task state for the de-XD-coupling and multi-tenant work. Survives context clears.

The session task tool (TaskList) is ephemeral. This file is the durable record. When work moves between sessions, sync this file first.

**Last updated:** 2026-06-15 — #4 merged to `main` via local merge commit `97db05d` (no PR — `--no-ff` merged from `feat/scope-json`; the feature branch is preserved on origin for history).

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

---

## Active backlog

### Unblocked (ready to start)

#### #8 — DTCG token export (`brand-cli refresh-design --dtcg`)
W3C Design Tokens Community Group format. Pure spec adoption — interoperates with Style Dictionary, Tokens Studio, Figma plugins, dembrandt itself. Composes with #2 (manifest can declare `dtcg_export: true|false|<path>`). Source: dembrandt research; CLAUDE.md "borrow without dependency" stance.

#### #5 — Inject industry signal into voice + overview extraction
`industry:` field in `.brandrc.yaml` (and/or scope payload). Stages 3 + 4 read it; bias inference transparently. Cite the prior in voice.md / overview.md prose. Source: feedback item #4. Now unblocked by the #4 merge — the scope schema's `additionalProperties: false` at the top level means adding `industry: <string>` to `scope.schema.json` will be a one-line append.

### Blocked

(none currently)

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
1. **#5 next** — small, well-scoped (one-line schema append + Stage 3/4 prose to read the field). Closes the #4↔#5 cross-task contract while it's fresh.
2. **#8 in parallel or after** — independent of #5. DTCG token export composes with the manifest's `dtcg_export` flag from #2.

(Sequence for #1-#3, #6, #7 has shipped — see Completed.)

**Cross-task contracts to preserve:**
- **#2 ↔ #6 status vocabulary:** must match exactly. `complete | partial | placeholder | missing | defaults`.
- **#2 ↔ #3:** manifest schema must accommodate per-stage MCP fallback decisions.
- **#4 ↔ #5:** scope schema (`schema/brand/scope.schema.json`) has `additionalProperties: false` at the top level. #5 adds `industry: <string>` as a one-line append.

**Multi-tenant constraint** (applies to all tasks): brand-skills is used both standalone (Claude Code slash commands) and embedded (host-project orchestrator dispatching the SKILL or CLI). Every task here adds artifacts/contracts that work in both modes. Conversational flows stay; structured I/O is additive, not a replacement.

**XD-decoupling constraint:** when implementing tasks, default to general-purpose framing. Don't add new XD-specific defaults, vocabulary, or assumptions. Reference [`docs/xd-assumption-inventory.md`](xd-assumption-inventory.md) for the existing residue worth fixing opportunistically.
