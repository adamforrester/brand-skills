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
808a331 feat(schema): add mcp-fallback-contract.schema.json (JSON Schema 2020-12)
9a958f2 docs: implementation plan + progress doc shell for #3
c312c97 docs: spec for #3 — MCP fallback contract

$ npm test 2>&1 | tail -5
# tests 47
# pass 47
# fail 0
```

---

## Things that bite repeatedly (carried forward from precedent)

See the "Things to know that aren't obvious from the codebase" section in the plan. Hoist new branch-specific patterns here as they surface.

---

## Completed tasks

| # | Task | Commits | Tests added | Notes |
|---|---|---|---|---|
| 1 | Test harness sync + plan/progress-doc commit | `c312c97` (spec), `9a958f2` (plan + progress doc shell) | 0 (baseline) | Executed by plan-writing controller pre-context-clear. Branch baseline 47/47. |
| 2 | Add `schema/mcp-fallback-contract.schema.json` | `808a331` | 0 (validation deferred to Task 4) | **Plan-pasted JSON failed `ajv strict: true` compile.** Implementer self-flagged DONE_WITH_CONCERNS and patched: added local `properties` declarations inside each of the four `then` clauses mirroring parent `dependencyEntry.properties` types. Spec reviewer ✅ confirmed fix is semantically equivalent (negative-test ajv probe rejects all malformed kind shapes). Code reviewer **Approve as-is** with three Minor observations accepted per D7: (a) missing `description` on `kind` + `qualityLabel` $defs vs. peer-schema precedent; (b) `preconditions[].key` regex is under-justified; (c) several optional string fields lack `minLength: 1`. See [D1] for the strict-mode fix details. |

---

## Pending tasks

Tasks 3–16 pending. Picking up at Task 3.

---

## Decisions made during implementation (D-letter pattern)

### D1 — Plan-pasted contract schema needed local `then.properties` for ajv `strict: true` (Task 2)

**Bug:** Plan's pasted JSON for `schema/mcp-fallback-contract.schema.json` failed `ajv.compile()` under `new Ajv({ allErrors: true, strict: true })` — the same config used by `cli/src/utils/manifest-writer.js` + `cli/src/utils/health-writer.js`. Strict mode rejects `required` keywords inside `if/then` subschemas when the listed properties aren't declared in the *same subschema's* `properties`:

```
strict mode: required property "install_hint" is not defined at "...#/allOf/0/then" (strictRequired)
```

**Fix (commit `808a331`):** Add local `properties` declarations inside each of the four `then` clauses, mirroring the parent `dependencyEntry.properties` types. Semantically equivalent — same fields, same types, same enforcement. Each `then` grew ~3 lines.

```json
{
  "if": { "properties": { "kind": { "const": "mcp" } }, "required": ["kind"] },
  "then": {
    "properties": { "install_hint": { "type": "string" } },
    "required": ["install_hint"]
  }
}
```

**Why not relax to `strict: false`:** Would diverge from the manifest+health schema precedent. The `properties` mirror is the canonical strict-mode-compatible workaround and adds ~12 lines total across four clauses.

**Implication for Task 4:** `contract-loader.js` should compile with the same `strict: true` config (consistent with peer writers).

---

## Open questions surfaced for upcoming tasks

(populated as questions surface)
