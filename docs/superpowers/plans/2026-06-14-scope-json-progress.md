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
50cdb79 feat(schema): add scope.schema.json (JSON Schema 2020-12)
812e51f docs: progress doc shell for #4
90aed33 docs: implementation plan for #4
8993533 docs: spec for #4 — .brand/.scope.json structured scope input

$ npm test 2>&1 | tail -5
# tests 85
# pass 85
# fail 0
```

---

## Things that bite repeatedly (carried forward from precedent)

See the "Things to know" section in the plan. Hoist new branch-specific patterns here as they surface.

---

## Completed tasks

| # | Task | Commits | Tests added | Notes |
|---|---|---|---|---|
| 1 | Test harness sync + progress doc shell | `812e51f` | 0 (baseline) | Inline (no implementer subagent — same shape as Task 1 of the contract branch). 85/85 baseline confirmed. |
| 2 | Add `schema/brand/scope.schema.json` | `50cdb79` | 0 (loader test deferred to Task 3) | Schema compiled strict-mode-clean first try (no Task-2 strict-mode trap as on the contract branch — no `if/then` conditionals). Spec reviewer ✅ all 13 checks. Code reviewer **Approve**, M1 (enum descriptions on `tier` / `mode` / `interactive_preflight`) picked up inline because it's a 3-line cheap improvement and resolves a precedent inconsistency the contract reviewer also flagged. Commit amended with M1 fix; tests stayed 85/85. M2-M5 deferred per [D7]: M3 docs `live_urls` exclusion (XD-specific Layout CLI field, deliberately omitted per de-XD posture; could be footnoted in spec §7); M5 industry-signal future-extensibility — `additionalProperties: false` at top means the future #5 task addition is a deliberate one-line append. |

---

## Pending tasks

Tasks 3-11 pending. Picking up at Task 3.

---

## Decisions made during implementation (D-letter pattern)

(populated as decisions land)

---

## Open questions surfaced for upcoming tasks

(populated as questions surface)
