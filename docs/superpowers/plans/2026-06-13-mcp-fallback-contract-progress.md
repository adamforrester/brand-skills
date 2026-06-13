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
$ git log --oneline main..HEAD | head -5
a8df1f3 fix(cli): tighten dtcg-import error handling + extensibility comments
48b612f feat(cli): dtcg-import utility for Stage 1 fallback
55a781a docs: progress doc through Task 7 + refinement
ee0aaa3 fix(cli): finish v1 to v2 migration in health-writer test fixture + add score v1-reject coverage
52d1f77 feat(cli): migrate tests + goldens to manifest version: "2"
…(13 commits ahead of main as of Task 8 refinement)

$ npm test 2>&1 | tail -5
# tests 64
# pass 64
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
| 3 | Add `schema/mcp-fallback-contract.json` (canonical data) | `c52b9b6` | 0 (loader test deferred to Task 4) | DONE first-pass. Spec reviewer ✅ all 8 verification steps passed (top-level shape, 7 stage keys, per-stage details inc. Stage 3 chain order + Stage 6 dual preconditions, 6 dependency keys with correct kinds, exact verbatim install_hints / endpoint / glob, cross-link integrity bidirectional, ajv `OK`, prose drift on XD-toolkit caveat + Token Press URL preserved). Code reviewer **Approve as-is**, one Minor: Stage 3 jina `fidelity_note` adds `via r.jina.ai` vs spec §3 example (matches plan body line 458; meaning unchanged; user-facing string surfaces in DOWNGRADE notice). Carry-forward [CF-1] for Task 14 docs propagation: align spec §3 Voice example wording with the contract value. |
| 4 | `cli/src/utils/contract-loader.js` (TDD) | `5c9b5d2` | +8 (47 → 55) | DONE first-pass. TDD: test failed with `ERR_MODULE_NOT_FOUND` as expected before implementation. Three exports (`loadContract`, `getStageContract`, `getDependency`); cached singleton at module scope; ajv `strict: true` + `ajv/dist/2020.js` matching manifest-writer/health-writer precedent; lookup helpers return `undefined` for unknown keys (no throws). Spec reviewer ✅ all 6 checks pass; cached identity verified (`assert.equal(a, b)`). Code reviewer **Approve**, six Minor accepted per D7: (a) `addFormats(ajv)` is unused by the contract schema (no `format` keywords) but kept for precedent/insurance; (b) `SCHEMA_PATH`/`CONTRACT_PATH` use column-aligned spaces (cosmetic); (c) cross-link tests intentionally placed with the loader (revisit only if integrity surface triples); (d) no explicit test for validation-failure-throws path (hard-coded paths; refactor would add unwanted configurability); (e) `chain[0]` indexing in test 3 is order-coupled but spec says order is meaningful; (f) reviewer noted this loader is *better* than precedent in one way — Ajv constructed inside `loadContract` rather than at import time, so import is zero-cost (deliberate, justified drift since this loader is rarely called). Reviewer flagged Task 15 will likely want a separate parity-test file; don't bundle it into `contract-loader.test.js`. |
| 5 | Bump `manifest.schema.json` to version `"2"` | `981be4a` | +0, but **breaks 8** intentionally (55 → 47 pass / 8 fail) | DONE first-pass. Wholesale schema replacement: `version` const `"1"` → `"2"`; `mcps` → `dependencies`; per-stage `fallback_decision` (required) + `chain_entry_used` (oneOf null|object) + `required_dependencies` + `available_dependencies` added; per-dependency `kind` required, `used` → `used_by`; new `$defs/kind` + `$defs/fallbackDecision` enums; `expected_path_glob` optional on dependency entries. **Schema compiles strict-mode-clean** (no Task-2-style if/then issue this time — the new conditionals use `oneOf` which doesn't trip `strictRequired`). Spec reviewer ✅ all 10 checks pass (top-level shape, per-stage required, chain_entry_used oneOf order, per-dependency required, no `used` leakage, `$defs` complete, patternProperties preserved, additionalProperties: false at top, npm test 47/8 split confirmed, v1→v2 negative-test ajv probe rejects v1 + accepts v2-minimal). **Tests fail as designed** in `manifest-writer.test.js` (3), `emit-manifest.test.js` (3), `round-trip.test.js` (2) — repaired in Tasks 6 + 7. Code-quality findings (Minor only, accepted per D7): (a) `$defs/kind` + `$defs/fallbackDecision` lack `description` strings while `confidence` has one; (b) per-stage property ordering puts `confidence` before `fallback_decision` while `required` lists them in opposite order — reading-order mismatch only. No separate `superpowers:code-reviewer` dispatch this task: schema-only commit, all findings already covered Minor by spec reviewer. |
| 6 | Update fixtures + emit-manifest to v2 | `4e17ef0` | +0, **3 of 8 broken tests pass** mid-migration (47 → 50 pass / 5 fail) | **Implementer subagent died on token expiration mid-flight (footgun [D3]).** All 4 file edits were on disk; controller verified each against the plan byte-for-byte, ran smoke test (printed `version: "2"` + `dependencies` + decorated `kind` per dep), confirmed test-count direction (8 → 5 fail), and committed. New: `loadContract` + `getDependency` imports; `rejectV1` (fires on `version:"1"` literal OR `mcps`-without-`dependencies`); `validateDependencyNames` (rejects unknown deps with valid-list); decoration loop adds `kind` (and `expected_path_glob` for `user_artifact`) from contract — SKILL doesn't send these. Stages passed through verbatim — CLI does NOT compute fallback_decision. Three fixtures (`full-pipeline`, `partial-pipeline`, `no-mcps`) wholesale-replaced with v2 shape. Spec reviewer ✅ all 8 checks pass (rejectV1 wired before tier processing; validateDependencyNames before decoration; decoration handles all four kinds; smoke output correct; v1 reject probe exits 1 with actionable message). Code reviewer **Approve, ready for Task 7**. Six Minor accepted per D7: (a) helpers' `string | null` pattern is fine but JSDoc would help readers; (b) `validateDependencyNames` triggers `loadContract` even on empty deps (cache makes this trivial); (c) extra dep fields silently dropped — defensible since manifest schema is closed; (d) one-sided spec link in second rejectV1 message; (e) hand-aligned fixture formatting now harder to scan after the v2 fields ballooned entries — defer reformat to a separate PR after migration completes; (f) decorator output field order will land as `kind, available, used_by, expected_path_glob` due to conditional assignment — reproducible, harmless. See [D3] for the implementer-died-mid-flight playbook. |
| 7 | Migrate tests + goldens to v2 (+ refinement [D4]) | `52d1f77`, `ee0aaa3` | +1 (55 → 56) | DONE first-pass (52d1f77) brought tests from 50/5 → 55/0: `score.js` `readManifest` now hard-rejects v1 manifests on disk; `manifest-writer.test.js` `validPayload()` updated to v2; `emit-manifest.test.js` assertions flipped (and extended with `fallback_decision`/`chain_entry_used.name`/`dependencies.playwright.{available,kind}`); both goldens regenerated with `generated_at`/`generator` hand-pinned. Spec reviewer ✅ all 8 checks. **Code reviewer flagged TWO Important findings the plan missed** — refinement (`ee0aaa3`) addressed both: (1) `cli/test/unit/health-writer.test.js` `makeManifest()` was still v1-shape inline (tests passed only because health-writer doesn't read `version`/`mcps`, but contradicted the new score.js v1-reject); (2) the new score.js v1-reject branch had zero coverage — added one integration test in `score-emits-health.test.js`. See [D4] for the lesson on cascading-migration-completeness audits. Two unrelated test files genuinely needed no changes: `round-trip.test.js` (no v1 literals) and `health.version === '1'` in `score-emits-health.test.js` (separate health schema, unchanged). Five Minor findings accepted per D7: (a) §4 in error message is unclear without parenthetical; (b) `process.exit(1)` inside the `readManifest` reader is a control-flow surprise but matches `rejectV1` precedent; (c) version-pinned goldens not yet on CLAUDE.md "three places" list (carry-forward to Task 14); (d) golden field ordering puts `client` last after `dependencies`; (e) `validPayload` over-specifies optional stage fields, but documents producer shape — useful as copy-paste starting point. |
| 8 | dtcg-import.js TDD (+ refinement [D5]) | `48b612f`, `a8df1f3` | +6 first-pass, +2 refinement (56 → 64) | **TDD first-pass (48b612f) caught a real bug in plan-pasted code:** Step 4's `flatName = pathParts.slice(1).join('-')` contradicted Step 2's tests (which asserted `size-body`/`weight-regular` — top-level group preserved as semantic prefix). Implementer DONE_WITH_CONCERNS, fixed by introducing `REDUNDANT_TOP_GROUPS = new Set(['color', 'font', 'typography'])` + `flattenName()` helper that drops only redundant top-level groups (so `color.primary`→`primary` AND `font.family-base`→`family-base`, but `size.body`→`size-body`, `weight.regular`→`weight-regular`, `gradient.hero`→`gradient.hero`). Spec reviewer ✅ deviation is principled, all 9 checks pass. Code reviewer **Approve with three Important findings before SKILL integration in Tasks 12-13** — refinement (a8df1f3) addressed all three: (1) `JSON.parse` now wrapped to re-throw with file path (fail-loud-with-context, matches manifest-writer precedent); (2) `REDUNDANT_TOP_GROUPS` + `$type: dimension` heuristic comments extended with extension hints for future contributors (don't add 'size'/'weight' — those are semantic prefixes); (3) added `nested.tokens.json` fixture + depth-3 test (`color.brand.primary` → `brand-primary` under colors bucket) locking in recursion behavior. Tests 56 → 62 (first-pass) → 64 (refinement). See [D5] for the lesson on plan-test-vs-plan-code contradictions. |

---

## Pending tasks

Tasks 9–16 pending. Picking up at Task 9.

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

### D5 — Plan's test code is authoritative when it contradicts plan's reference code (Task 8)

**Lesson:** Task 8 plan had two pasted code blocks: Step 2 (the failing test) and Step 4 (the reference implementation). The two contradicted each other on flat-name semantics:

- Step 2 test: asserted `result.typography['size-body'] === '16px'` and `result.typography['weight-regular'] === 400` — top-level groups preserved as semantic prefixes.
- Step 4 reference code: `const flatName = pathParts.slice(1).join('-')` — would drop `size.` and `weight.` unconditionally, producing `body` and `regular` (test would fail).

**The right resolution:** treat the test as the spec contract (TDD principle: red → green is meaningful only if the test is the source of truth) and patch the reference code. The implementer introduced `REDUNDANT_TOP_GROUPS = new Set(['color', 'font', 'typography'])` and a `flattenName()` helper that drops the top-level group ONLY when it's in that set. Result:

- `color.primary` → `primary` (color is bucket-redundant)
- `font.family-base` → `family-base` (font is bucket-redundant)
- `size.body` → `size-body` (size is a semantic prefix within typography)
- `weight.regular` → `weight-regular` (same)
- `gradient.hero` (unknown $type) → `path: 'gradient.hero'` preserved

**Why this is the right call:** the bucket name (`typography`) already conveys the semantic context, but `size`/`weight` are within-bucket distinctions. Dropping them would mean the SKILL can't write `size-body: 16px` without re-deriving the prefix. Keeping the prefix is information-preserving.

**Implication for future plan-writing:** when a plan has both pasted tests and pasted code, the tests are the contract. If they contradict, the implementer should patch the code, surface the deviation as DONE_WITH_CONCERNS, and let the reviewer confirm the resolution is principled. Don't silently align the test with the (wrong) code.

**Code reviewer follow-up (refinement a8df1f3):** added invalid-JSON wrapper for fail-loud-with-context; extended `REDUNDANT_TOP_GROUPS` and `$type: dimension` comments with extension hints (don't add `size`/`weight` — they're semantic); added depth-3 nested fixture + test (`color.brand.primary` → `brand-primary`) locking in recursion. Tests 62 → 64.

### D4 — Cascading-migration audits must scan the FULL test suite, not just plan-listed files (Task 7)

**Lesson:** The Task 7 plan listed five test files to update during the v1 → v2 manifest migration. The implementer followed the plan exactly and hit 55/0 tests passing. But the code reviewer caught that `cli/test/unit/health-writer.test.js` had a v1-shape inline fixture in its `makeManifest()` helper. Tests passed only because `health-writer.js` doesn't read `manifest.version` or `manifest.mcps` — they were dead literals.

**Why it matters:** the new `score.js` `readManifest` v1-reject (added in the same Task 7 commit) means the codebase is now claiming "v1 manifests are not supported." A v1 fixture inside the test suite contradicts that claim and would mislead any future contributor grepping for v1 references.

**Pattern for future migrations:** when a schema bumps, after the plan-listed files are migrated, do one extra grep across the full test suite for the legacy field names + version literals, even if tests are green. Specifically:

```bash
grep -rn "version, '1'\|version: '1'\|\bmcps\b" cli/test/ | grep -v node_modules
```

This is a 5-second sanity check that doesn't require new tests — green tests with stale fixtures are a documentation-debt smell that will bite the next contributor.

**Refinement applied (`ee0aaa3`):** bumped `health-writer.test.js` `makeManifest()` to v2 shape (`version: '2'`, `dependencies` with `kind` + `used_by`, per-stage `fallback_decision: 'none'`), AND added a missing integration test for the new `score.js` v1-reject branch (`score-emits-health.test.js`: writes a v1 manifest, runs score, asserts non-zero exit + migration message in stderr). Tests went 55 → 56.

### D3 — Implementer-died-mid-flight playbook (Task 6)

**Pattern:** Implementer subagent died on token expiration partway through Task 6 — its last reported message was an `API Error: Token is expired` after ~12 tool uses and 403s of duration. All four file edits (`emit-manifest.js` + 3 fixtures) had landed on disk before the death. The controller did NOT re-dispatch a new implementer (which would have started fresh and risked editing files already in their target state).

**Playbook applied (matches manifest+health-branch precedent for Task 8):**

1. `git status` to confirm files are modified-but-not-staged.
2. `git diff --stat` to see scope of damage / progress.
3. Read each modified file and compare against the plan text. (For Task 6 this was 4 files; the plan specified each verbatim.)
4. If files match the plan: run smoke tests (the plan's Step 5 emit-manifest dry-run probe).
5. Run `npm test` and verify the failure-count direction is correct (8 → 5 mid-migration is "moving toward green," not regression).
6. Commit using the plan's commit message via Write→/tmp/commit-msg.txt→`git commit -F`.
7. Dispatch spec compliance + code quality reviewers as normal.

**When NOT to apply:** if `git diff` shows partial files (e.g., emit-manifest.js with the new helpers but the old payload structure), re-dispatch — the surface is incoherent and the SKILL footgun rule "long-running implementer agents can die mid-flight" assumes file-level atomicity.

**Implication for downstream:** dispatch budget is real. Tasks that touch many files (4+ here) are higher death-risk. If the plan walks through them sequentially with explicit code blocks, controller verification of disk-state vs plan-text is a fast recovery path.

### D2 — `addFormats(ajv)` is unused by the contract schema but kept for precedent (Task 4)

**Observation:** `cli/src/utils/contract-loader.js:11` calls `addFormats(ajv)` but the contract schema has no JSON Schema `format` keyword usage. The only `"format"` token in the schema file is a *property name* on `dependencyEntry` (describing an HTTP response shape), not a `format` validator. So `addFormats` is dead weight on day one.

**Decision:** Keep it. Two reasons:
1. **Precedent parity** — `manifest-writer.js` and `health-writer.js` both call `addFormats`. Diverging here would force readers to figure out why this writer is different.
2. **Cheap insurance** — future contract schema revisions may add `date-time` or `uri` formats; keeping the call avoids a "why doesn't this validate?" diagnostic later.

The cost is one extra import + one function call at first-load only.

---

## Open questions surfaced for upcoming tasks

### CF-1 — Spec §3 vs contract `fidelity_note` for jina-reader (carry-forward to Task 14)

The contract (and the plan body line 458) reads `"JS-rendered markdown via r.jina.ai; loses accessibility tree"` for Stage 3's middle-tier `fidelity_note`. The spec §3 Voice example renders it as `"JS-rendered markdown; loses accessibility tree"` (no `via r.jina.ai`). Meaning is unchanged; the contract version is friendlier and self-locates. When Task 14 (docs propagation) lands, update spec §3 Voice example wording to match the contract value so the three sources (spec, plan, contract data) agree. Don't change the contract — it's the source of truth and ships in user-facing pre-flight DOWNGRADE notices.
