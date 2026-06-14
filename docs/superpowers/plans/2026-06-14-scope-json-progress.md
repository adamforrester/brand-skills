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

---

## Pending tasks

All 11 tasks pending. See plan.

---

## Decisions made during implementation (D-letter pattern)

(populated as decisions land)

---

## Open questions surfaced for upcoming tasks

(populated as questions surface)
