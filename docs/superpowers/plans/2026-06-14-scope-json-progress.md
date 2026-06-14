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
b8b9710 test(unit): SKILL <-> scope parity
67fefd0 docs: progress doc through Task 8
5cd032a feat(skill): add §0a.5 read-merge-delete for .brand/.scope.json
5b4bd55 docs: progress doc through Task 7
e798702 test(integration): scope fixtures roundtrip through loader + validator + CLI + merge
e70ed6f docs: progress doc through Task 6
1518a18 test(integration): scope-cli covers valid / invalid / absent / --json
007a69a docs: progress doc through Task 5 + log [D3]
4f3f940 feat(cli): brand-cli scope --validate subcommand + fixtures
2353cc4 docs: progress doc through Task 4
918e57f feat(cli): scope-merge utility (TDD)
d6467f8 docs: record Task 3 spec + code review verdicts
f36cc9a docs: progress doc through Task 3 + session-pause resume notes
0ede969 feat(cli): add scope-loader utility (TDD)
8616ac0 docs: progress doc through Task 2
50cdb79 feat(schema): add scope.schema.json (JSON Schema 2020-12)
812e51f docs: progress doc shell for #4
90aed33 docs: implementation plan for #4
8993533 docs: spec for #4 — .brand/.scope.json structured scope input

$ npm test 2>&1 | tail -5
# tests 108
# pass 108
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
| 3 | `cli/src/utils/scope-loader.js` (TDD) | `0ede969` | +6 (85 → 91) | TDD: test failed with `ERR_MODULE_NOT_FOUND` as expected before implementation. Two exports (`loadScope`, `validateScope`); cached validator at module scope; ajv `strict: true` + `ajv/dist/2020.js` matching contract-loader precedent. Reviews ran in fresh session (the original session paused at the clean stopping point and resumed for the proper review pair): **Spec compliance ✅ all 12 verifiable checks PASS** (item 13, the pre-implementation `ERR_MODULE_NOT_FOUND` snapshot, is structurally plausible but unverifiable post-commit). **Code review: Approve, Minors only.** Two Minor findings, both accepted per [D7]: M1 — `errorsTextFn` closure on the validator diverges from the sibling `manifest-writer`/`contract-loader` pattern of holding `ajv` in module scope and calling `ajv.errorsText()` directly; functionally equivalent. M2 — malformed-JSON error message has a small redundancy (`.brand/.scope.json at <abs path ending in .scope.json>`); test-regex is forgiving and Task 5's chalk wrapper rewrites the user-facing string anyway. Verdict logged at `d6467f8`. |
| 4 | `cli/src/utils/scope-merge.js` (TDD) | `918e57f` | +5 (91 → 96) | TDD: test failed with `ERR_MODULE_NOT_FOUND` as expected. Pure function `mergeScopeIntoBrandrc(scope, brandrc)` returning `{ merged, filledFromScope, conflicts }`. Implements per-type "empty" rule from spec §1: string (missing/`""`/null), array (missing/`[]`/null), object (missing/`{}`/null + recurse leaf-by-leaf), boolean (missing only — `false` counts as set, including the `false`-beats-scope-`true` direction). Conflict comparison uses `JSON.stringify` deep-equal on leaves only (recursion exhausts plain-object cases first). `_comment` skipped during recursion at every level. **Spec compliance ✅ all 15 checks PASS.** **Code review: Approve, Minors only** — accept per [D7]. M1: no defensive `null`/`undefined` guard at top-level entry (SKILL contract guarantees non-null). M2: arrays from scope flow through by reference (no downstream mutation in practice). M3: JSDoc could mention `_comment` skip explicitly. |
| 5 | `brand-cli scope --validate` subcommand + fixtures | `4f3f940` | 0 (96 → 96) | Read-only lint command + three fixtures (`full`/`partial`/`invalid`). All three exit-code paths smoke-tested: full → 0; invalid → 1 with `additionalProperties` rejection; missing → 1. **Spec compliance ✅ all 10 checks PASS** with one informational note: see [D3] below for the plan-vs-spec divergence on `--json` invalid output shape. **Code review: Approve, Minors only** — accept per [D7]. M1: `--json` malformed-error leaks absolute path in `message` field (host-side hosts can ignore it; structured `path` field already carries the canonical relative path). M2: error string for missing-`--validate` could carry a spec-pointer tag-on (lint command, not stage failure — strict adherence not required). M3: `.scope.json` filename is implicit-duplicated between scope-loader's `join(brandDir, '.scope.json')` and the CLI's `SCOPE_REL_PATH` constant — defer extraction until rename happens. Cross-task contracts intact: command does not call `mergeScopeIntoBrandrc`, doesn't write any file, doesn't delete `.scope.json`, doesn't touch `.brandrc.yaml`. |
| 6 | `scope-cli` integration tests | `1518a18` | +5 (96 → 101) | 5 integration tests against the three fixtures + an absent-file path. Tempdir-per-test isolation; `try/finally { cleanup() }`; `runCli` helper with `NO_COLOR: '1'` so chalk markers come through plain. **Spec compliance ✅ all 12 checks PASS.** **Code review: Approve, Minors only** — accept per [D7]. M1: `__dirname` shadowing — standard ESM pattern. M2: `tmpProjectWithScope` helper duplicates shape-of-thing logic from sibling `tmp-brand.js`; promote later if a second integration test needs the same shape. M3: regex test 4's `path: '.brand/.scope.json'` assertion is POSIX-specific (Windows would emit `.brand\.scope.json`); rest of the suite makes the same assumption. |
| 7 | Roundtrip integration test | `e798702` | +2 (101 → 103) | 2 cross-utility integration tests verifying loader → validator → merge → CLI subprocess all agree on valid/invalid for the same fixture. Test 1 (full): all four code paths return success-shaped output, merge produces expected values with `conflicts.length === 0`. Test 2 (invalid): both `validateScope` and `runCli` reject. Helper variant returns `{dir, brandDir, cleanup}` (vs Task 6's `{dir, cleanup}`) so tests can call `loadScope(brandDir)` directly. **Spec compliance ✅ all 10 checks PASS.** **Code review: Approve, Minor only** — accept per [D7]. M1: dead `readFileSync` import (plan-prescribed in the import list but never consumed in test bodies); kept verbatim to match plan; logged for plan-author follow-up. |
| 8 | SKILL §0a.5 read-merge-delete prose | `5cd032a` | 0 (103 → 103) | New `### 0a.5.` section between `### 0a.` and `### 0b.` (44 lines added), plus leading paragraphs added to `### 0c.`, `### 0d.`, and two appended paragraphs in `### 0e.`. Total file growth: 950 → 994 lines (+44). All 6 cross-task contract grep checks pass: `.brand/.scope.json`, "brandrc wins on conflict / kept brandrc's value", `interactive_preflight`, `missing_required_fields`, `filledFromScope`, delete-after-merge phrase. Heading depth integrity preserved (`### ` count up by exactly 1; section-zero sequence is `0a, 0a.5, 0b, 0c, 0d, 0e, 0f, 0.5a, 0.5b`). All four `Edit` operations matched on first attempt. **Spec compliance ✅ all 11 checks PASS.** **Code review: Approve, two Minors** — accept per [D7]. M1: forward-looking pointer to `brand-cli scope --validate` (verified — Task 5 added this command). M2: §0a.5 phrase about "invoke `scope-merge.js` indirectly via the scope-loader" is slightly redundant; reads fine to a contributor. |
| 9 | SKILL ↔ scope parity test | `b8b9710` | +5 (103 → 108) | 5 module-scope assertion tests reading `brand-context/skills/brand-extract/SKILL.md` once and asserting the cross-task contract phrases are present (file path, brandrc-wins-on-conflict, `interactive_preflight` + `missing_required_fields`, `filledFromScope`, delete-after-merge regex). Mirrors the contract-branch `skill-contract-parity.test.js` precedent. All 5 tests passed on first run with no SKILL prose changes needed (Task 8 wrote all phrases correctly). **Spec compliance ✅ all 10 checks PASS.** **Code review: Approve, Minors only** — accept per [D7]. M1: path-resolution `../../../` depth is correct but fragile if test moves. M2: regex could be tighter (e.g. anchoring `.brand/.scope.json`) but loose form aligns with "forgiving as prose evolves" stance. |

---

## Pending tasks

Tasks 10-11 pending. Tasks 1-9 complete; reviews signed off; proceeding to Task 10.

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
- **[D3]** Task 5: spec §4 prose example for `--json` invalid output shows `{ok: false, errors: [{path, message}]}` (an array). The plan's authoritative implementation block (Task 5 Step 4) specifies `{ok: false, error: "schema_validation_failed", path, errorText: <string>}` (a single string field, mirroring `validateScope`'s return shape). The committed code matches the plan, which is the implementer's source of truth. Picking the plan over the spec prose because (a) `errorText` is the existing canonical field name returned by `validateScope` so consumers already deal with that shape; (b) the plan-pasted code is what the implementer was instructed to write byte-for-byte; (c) the spec example was illustrative shape-of-thing rather than authoritative wire format. **Action:** none for this branch. If hosts later request structured per-field error breakdown, file as a follow-up — that would be an additive `errors: [{path, message}]` field alongside `errorText`, not a replacement.

---

## Open questions surfaced for upcoming tasks

(populated as questions surface)
