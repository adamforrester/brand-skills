# Tasks

Canonical task state for the de-XD-coupling and multi-tenant work. Survives context clears.

The session task tool (TaskList) is ephemeral. This file is the durable record. When work moves between sessions, sync this file first.

**Last updated:** 2026-06-13 — #2 + #6 merged via PR #1 (merge commit `3041891`); #3 spec landed on branch `feat/mcp-fallback-contract` ([2026-06-13-mcp-fallback-contract-design.md](superpowers/specs/2026-06-13-mcp-fallback-contract-design.md)).

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

---

## Active backlog

### Unblocked (ready to start)

#### #3 — Explicit MCP-fallback contract per stage in `brand-extract`
Per stage, declare which dependencies (MCPs, HTTP APIs, user artifacts, native tools) are required vs available; on absence emit DOWNGRADE / SKIP / HALT. Decisions land in `manifest.json`. Adds DTCG-token-export as a Stage 1 fallback tier and Jina Reader as a Stage 3 middle tier. Source: feedback item #2.
**Status:** Spec approved on branch `feat/mcp-fallback-contract` — see [2026-06-13-mcp-fallback-contract-design.md](superpowers/specs/2026-06-13-mcp-fallback-contract-design.md). Implementation plan next. **Manifest schema bump to `version: "2"`.**

#### #8 — DTCG token export (`brand-cli refresh-design --dtcg`)
W3C Design Tokens Community Group format. Pure spec adoption — interoperates with Style Dictionary, Tokens Studio, Figma plugins, dembrandt itself. Composes with #2 (manifest can declare `dtcg_export: true|false|<path>`). Source: dembrandt research; CLAUDE.md "borrow without dependency" stance.

#### #4 — Support `.brand/.scope.json` as alternative to conversational scope-confirmation
Structured-input path for embedded use. Conversational flow stays the standalone default. Two paths produce equivalent `.brandrc.yaml` state. Source: feedback item #3.

### Blocked

#### #5 — Inject industry signal into voice + overview extraction
`industry:` field in `.brandrc.yaml` (and/or scope payload). Stages 3 + 4 read it; bias inference transparently. Cite the prior in voice.md / overview.md prose. Source: feedback item #4.
**Blocked by:** #4 (industry value may flow through `.scope.json`).

---

## Candidate tasks (not yet filed)

Held to avoid backlog bloat. Re-evaluate after the active backlog clears. From research notes (`docs/research-notes.md`).

| Tag | Idea | Why hold |
|---|---|---|
| C1 | Expose brand-skills as an MCP server | Biggest multi-tenant unlock. Model on dembrandt's job-queue + sync/async + 7-typed-tools design. File once #2 + #6 land — they define the JSON contract this exposes. |
| C2 | `brand-cli doctor` — tooling-readiness sibling to `brand-cli score` | Pairs with #3 + #6. File once #3 lands (the MCP-fallback contract is what `doctor` reports on). |
| C3 | Motion token extraction in Stage 2 | Populate `tokens/motion.md` (currently always placeholder). Borrows from dembrandt's approach. Independent — could file anytime. |
| C4 | Multi-page confidence boosting in Stage 2 | Tokens on N pages → HIGH confidence; on 1 page → MEDIUM/LOW. Independent — could file anytime. |
| C5 | `docs/install.md` agent-readable installer | Lets non-Claude-Code agents install via "Hey agent, follow this" pattern. Multi-tenant unlock. |
| C6 | WCAG state-simulating contrast walk in `/brand-context:audit` Dimension 5 | Borrowed from dembrandt. Improves audit quality. |
| C7 | Pluggable channel architecture for source extractors | Borrowed from Agent-Reach. Not urgent until we have a third source type asking for an alternative. |
| C8 | Standard Figma MCP (`plugin:figma:figma`) per-node walk as Stage 1 Tier 2 | Adds `get_variable_defs` per-selection walk as a degraded path between `figma-console` (full) and DTCG-import. Loses modes/aliases. Filed during #3 brainstorm; deferred for UX scoping (which nodes to walk?). File once #3 lands. |

---

## Priority notes

**Sequence (recommended):**
1. **#2 + #6 together** — sister tasks, share status vocabulary, design once. Reference dembrandt's MCP schemas during design.
2. **#8** — independent; could parallel with #2/#6, but easier after the manifest's `dtcg_export` flag shape is decided.
3. **#3** — slots into the manifest from #2.
4. **#4 + #5** — once #2 + #6 land. #5 follows #4 naturally.

**Cross-task contracts to preserve:**
- **#2 ↔ #6 status vocabulary:** must match exactly. `complete | partial | placeholder | missing | defaults`.
- **#2 ↔ #3:** manifest schema must accommodate per-stage MCP fallback decisions.
- **#4 ↔ #5:** industry value may flow through `.scope.json`. Decide once.

**Multi-tenant constraint** (applies to all tasks): brand-skills is used both standalone (Claude Code slash commands) and embedded (host-project orchestrator dispatching the SKILL or CLI). Every task here adds artifacts/contracts that work in both modes. Conversational flows stay; structured I/O is additive, not a replacement.

**XD-decoupling constraint:** when implementing tasks, default to general-purpose framing. Don't add new XD-specific defaults, vocabulary, or assumptions. Reference [`docs/xd-assumption-inventory.md`](xd-assumption-inventory.md) for the existing residue worth fixing opportunistically.
