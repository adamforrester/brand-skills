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
0ede969 feat(cli): add scope-loader utility (TDD)
8616ac0 docs: progress doc through Task 2
50cdb79 feat(schema): add scope.schema.json (JSON Schema 2020-12)
812e51f docs: progress doc shell for #4
90aed33 docs: implementation plan for #4
8993533 docs: spec for #4 — .brand/.scope.json structured scope input

$ npm test 2>&1 | tail -5
# tests 91
# pass 91
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
| 3 | `cli/src/utils/scope-loader.js` (TDD) | `0ede969` | +6 (85 → 91) | TDD: test failed with `ERR_MODULE_NOT_FOUND` as expected before implementation. Two exports (`loadScope`, `validateScope`); cached validator at module scope; ajv `strict: true` + `ajv/dist/2020.js` matching contract-loader precedent. Reviews ran in fresh session (the original session paused at the clean stopping point and resumed for the proper review pair): **Spec compliance ✅ all 12 verifiable checks PASS** (item 13, the pre-implementation `ERR_MODULE_NOT_FOUND` snapshot, is structurally plausible but unverifiable post-commit). **Code review: Approve, Minors only.** Two Minor findings, both accepted per [D7]: M1 — `errorsTextFn` closure on the validator diverges from the sibling `manifest-writer`/`contract-loader` pattern of holding `ajv` in module scope and calling `ajv.errorsText()` directly; functionally equivalent. M2 — malformed-JSON error message has a small redundancy (`.brand/.scope.json at <abs path ending in .scope.json>`); test-regex is forgiving and Task 5's chalk wrapper rewrites the user-facing string anyway. |

---

## Pending tasks

Tasks 4-11 pending. Task 3 review pair signed off in this session — proceeding to Task 4.

---

## Resuming in a fresh session

Branch state at pause: `feat/scope-json` at `0ede969` (or whatever HEAD is post-progress-doc commit), 6 commits ahead of `main`, 91/91 tests passing, working tree clean, branch pushed to origin.

To resume:

1. Read this progress doc end-to-end. The "Things that bite repeatedly" section + the per-task notes below tell the resuming controller everything they need.
2. Read `docs/superpowers/specs/2026-06-14-scope-json-design.md` (the spec) end-to-end.
3. Read `docs/superpowers/plans/2026-06-14-scope-json.md` (the plan) end-to-end. 11 tasks; Tasks 1-3 are committed.
4. Verify branch state matches: `git log --oneline main..HEAD` should show ~6 commits including `0ede969 feat(cli): add scope-loader utility (TDD)` near the top. `npm test` should be 91/91.
5. **First action:** dispatch the spec compliance reviewer + `superpowers:code-reviewer` for Task 3 (commit `0ede969`). The implementer's self-review was clean (TDD failure was missing-module; 6 tests pass; full suite 91/91), but the proper review pair was deferred to the fresh session for context budget. Task 3 prompt template + reviewer prompts are documented in the plan's "Per-task dispatch protocol" section.
6. Once Task 3 is signed off, invoke `superpowers:subagent-driven-development` against the plan and pick up at Task 4.

Test count growth path remaining (use this to spot regressions in subagent reports):
- After Task 3 review: 91 (already there)
- Task 4: 91 + 5 = 96 (scope-merge unit tests)
- Task 5: 96 (no new tests — CLI command + fixtures)
- Task 6: 96 + 5 = 101 (scope-cli integration tests)
- Task 7: 101 + 2 = 103 (roundtrip)
- Task 8: 103 (SKILL prose)
- Task 9: 103 + 5 = 108 (SKILL ↔ scope parity)
- Task 10: 108 (docs)
- Task 11: 108 (verification only)

---

## Decisions made during implementation (D-letter pattern)

- **[D1]** Task 2: enum-only properties (`tier`, `mode`, `interactive_preflight`) added inline `description` strings during the Task 2 spec/code review pair (3-line cheap improvement; resolved a precedent inconsistency the contract reviewer also flagged). Logged in Task 2 row above.
- **[D2]** Task 3: `errorsTextFn` closure stashed on the compiled validator instead of keeping `ajv` in module scope. Functionally equivalent to the sibling `manifest-writer`/`contract-loader` pattern; flagged Minor in code review and accepted as-is per [D7]. If a future branch refactors all validators for consistency, this is a candidate site.

---

## Open questions surfaced for upcoming tasks

(populated as questions surface)
