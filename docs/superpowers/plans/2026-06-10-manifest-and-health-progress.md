# Manifest + Health — Implementation Progress

Companion to [`2026-06-10-manifest-and-health.md`](2026-06-10-manifest-and-health.md). Survives context clears. Update after every task completes (or after every refinement).

**Branch:** `feat/manifest-and-health` (off `main` at `e54066f`)
**Last updated:** 2026-06-10
**Test status:** 20/20 passing on the branch

---

## How to resume in a fresh session

If this conversation got cleared and you're picking up the work:

1. Read `docs/superpowers/specs/2026-06-10-manifest-and-health-design.md` — the spec we're implementing.
2. Read `docs/superpowers/plans/2026-06-10-manifest-and-health.md` — the 18-task plan.
3. Read THIS file to see what's done, what's next, and which decisions were made along the way that aren't in the plan.
4. `git log --oneline main..HEAD` — verify your local branch matches the commit list below.
5. `npm test` — verify the test count below still matches.
6. Resume at the next pending task using the dispatch protocol described at the bottom of this file.

---

## Completed tasks

| # | Task | Commits | Tests added | Notes |
|---|---|---|---|---|
| 1 | Add ajv deps + node:test scripts | `f3bc9f3` | 0 (harness only) | `ajv@^8.20.0`, `ajv-formats@^3.0.1`. `package-lock.json` is gitignored in this repo, so it isn't committed. |
| 2 | tier-weights utility (TDD) | `f65d3e8`, `7949ec6` | +12 | Refinement (`7949ec6`) added JSDoc to match `exec.js` style + one `assert.throws` test for unknown tier. |
| 3 | file-status classifier (TDD) | `0bd9ef6`, `3dff0e3` | +8 | **Two real bugs caught.** See "Decisions" below. Refinement (`3dff0e3`) fixed both. |
| 4 | gap-actions lookup | `0e6c2e1` | 0 (covered later) | Per-prefix entries deliberately omit `partial` — see open question for Task 7. |
| 5 | JSON Schemas + cross-link | `8c044c2`, `4ba2d42` | 0 (no test layer change) | Refinement (`4ba2d42`) tightened `generator` regex (`@` → `@\S+$`) and added `description` to `tier_label` + `confidence`. Plan's Step 4 ajv compile snippet was wrong — needs `ajv/dist/2020`, not `ajv`, since draft 2020-12 metaschema is not in the default Ajv class. See D5. |
| 6 | manifest-writer (TDD) | `d76cc63` | +7 | Used `import Ajv from 'ajv/dist/2020.js'` per D5. Code review Minor only — flagged tempdir-helper duplication between this test file and `file-status.test.js`; fold both into Task 10's helper rather than letting `health-writer.test.js` add a third copy. |
| 7 | health-writer (TDD) | `c0de23a`, `6a66d91` | +8 | Refinement (`6a66d91`) extracted `weightedCounts()` in tier-weights.js so the complete-or-defaults reduce lives in one place; refactored `readiness()` to delegate. Documented `scanCompleteRatio` as deliberately unweighted (per spec §3 wording) — distinct from the weighted `readiness`. See D6. |

**Total tests:** 35 passing.

---

## Pending tasks

In plan order. Pull the full task text from `2026-06-10-manifest-and-health.md` when dispatching.

- [x] **Task 5** — JSON Schemas (`schema/manifest.schema.json`, `schema/health.schema.json`) + cross-link from `schema/brand/README.md`
- [x] **Task 6** — manifest-writer (TDD, +7 tests)
- [x] **Task 7** — health-writer (TDD, +8 tests)
- [ ] **Task 8** — emit-manifest CLI command
- [ ] **Task 9** — Refactor `score.js` to use shared utils + emit `.health.json`
- [ ] **Task 10** — Test helpers (`tmp-brand.js`, `run-cli.js`)
- [ ] **Task 11** — Test fixtures (populated/, fresh-init/, mixed/, stage-data/)
- [ ] **Task 12** — Integration test: emit-manifest end-to-end (+ golden)
- [ ] **Task 13** — Integration test: score emits health (+ golden)
- [ ] **Task 14** — Integration tests: round-trip + scan fallback
- [ ] **Task 15** — SKILL fallback golden + fresh-init test
- [ ] **Task 16** — SKILL updates (brand-extract Section 10b, brand-check Step 1)
- [ ] **Task 17** — Repo docs (CLAUDE.md, README, tasks.md)
- [ ] **Task 18** — Final verification + final code-reviewer subagent across the branch

---

## Decisions made during implementation (not in the original plan)

These deviated from or extended the plan; capture the reasoning so future-you doesn't relitigate.

### D1 — `file-status.js` H1-strip regex needed `.trimStart()` (Task 3)

**Bug:** Plan's pasted code in Task 3 used `body.replace(/^#\s+[^\n]+\n+/, '')` to strip a leading H1. After frontmatter is stripped, `body` begins with `\n\n# Title…`, so the anchored regex never fires. The H1 line then counts toward the 50-char body threshold, mis-classifying populated files with short bodies as `placeholder`.

**Fix:** Insert `.trimStart()` before the H1 strip in the chained `.replace().replace().trim()`.

**Implication:** Improves over current `score.js` `hasContent()` behavior — files like a populated `overview.md` with a short body now correctly classify as `complete`. Task 9 (score.js refactor) inherits this improvement.

### D2 — `file-status.js` flat YAML frontmatter detection (Task 3)

**Bug:** Plan's value-line filter `/^\s+/.test(l)` only matched lines starting with whitespace (nested keys). A flat frontmatter:
```yaml
---
title: Foo
client: Bar
---
```
produced zero "value lines," so the file was misclassified as `placeholder`.

**Fix:** Redefine value lines as "non-blank, contains `:`, not commented, AND has non-whitespace content after the colon." This handles flat AND nested AND mixed shapes uniformly. The trailing condition (non-empty after the colon) is critical — it preserves the existing test 3 behavior where `colors:` with all children commented should remain `placeholder` (a bare header line is not a value).

**Final predicate** (`cli/src/utils/file-status.js:57-62`):
```javascript
const uncommentedValueLines = fmLines.filter((l) => {
  if (/^\s*#/.test(l)) return false;
  const idx = l.indexOf(':');
  if (idx === -1) return false;
  return l.slice(idx + 1).trim().length > 0;
});
if (uncommentedValueLines.length > 0) return 'complete';
```

The two old branches (`allCommented && body.length < 50` and `hasUncommentedValue`) collapsed into one cleaner check.

### D3 — JSDoc convention established in Task 2

All new files under `cli/src/utils/` get:
- A 2–4 line file-header `/** … */` block with purpose + spec pointer
- A one-line JSDoc above each export

Style mirrors `cli/src/utils/exec.js`. No `@param`/`@returns` tags. Don't add JSDoc to module-private constants.

Task 4 (gap-actions) followed this. Future utility tasks should too.

### D6 — `scanCompleteRatio` is unweighted by design (Task 7)

**Decision:** `scanCompleteRatio` in `health-writer.buildHealth` uses an unweighted file-count ratio (`completeCount / totalCount`), NOT the weighted `weightedComplete / weightedTotal` ratio.

**Why:** Spec section 3 (`docs/superpowers/specs/2026-06-10-manifest-and-health-design.md` line 185) defines the no-manifest MEDIUM threshold as "≥80% files `complete` by content scan." That phrasing reads as a file-count ratio, not a weighted-readiness ratio. The two diverge in the 0.7–0.85 band: a project missing `voice.md` (weight 2) but having all five token files (weight 1 each) scores 5/7 ≈ 0.71 unweighted vs. 5/9 ≈ 0.56 weighted.

**Implication:** `readiness` and `scanCompleteRatio` are semantically different metrics — kept separate intentionally. An inline comment in `health-writer.js` documents the distinction.

### D5 — ajv draft 2020-12 metaschema requires `ajv/dist/2020` import (Task 5)

**Bug:** Plan's Step 4 ajv compile snippet uses `require('ajv').default`, the legacy Ajv class. Compiling a JSON Schema with `$schema: "https://json-schema.org/draft/2020-12/schema"` against that class throws `no schema with key or ref "https://json-schema.org/draft/2020-12/schema"`.

**Fix:** Use `require('ajv/dist/2020').default` (CJS) or `import Ajv from 'ajv/dist/2020.js'` (ESM). This is the documented entry point in ajv@8 for draft 2020-12.

**Implication for Tasks 6 + 7:** the manifest-writer and health-writer modules will compile these same schemas with ajv at module load. The plan's pasted code uses `import Ajv from 'ajv'` — update to `import Ajv from 'ajv/dist/2020.js'` in BOTH writer modules. Without this, the modules throw at import time and every test that imports them fails.

### D4 — `package-lock.json` is gitignored

Plan said `git add package.json package-lock.json` in Task 1. The repo's `.gitignore` excludes `package-lock.json`, so the lock file can't be committed. Deps re-resolve on each `npm install`. Not changed in this task — flagged for follow-up if reproducible installs become important.

---

## Open questions surfaced for upcoming tasks

### For Task 7 (health-writer) — RESOLVED

**Q:** Should `gap-actions.js` per-prefix entries (`tokens/`, `composition/`, `workflows/`) include `partial` keys?

**Resolution:** No. Task 7's plan-test for `gaps` only asserts `suggested_action` matches `/\S/` (non-empty). No per-status text assertions for `partial` in those prefixes. The generic `Populate <path> per schema/brand/<dashed>.schema.md` fallthrough is acceptable.

A follow-up (separate, optional) could add a one-line `// partial intentionally omitted — falls through to generic` comment in `gap-actions.js`. Not blocking Task 7.

### For Task 10 (test helpers)

**Q:** Fold the tempdir setup pattern from `manifest-writer.test.js` and the `withTmpFile` helper from `file-status.test.js` into `tmp-brand.js`?

**Context:** Task 6 reviewer flagged that `manifest-writer.test.js` re-implements `mkdtempSync` / `try` / `rmSync` inline, and `file-status.test.js` already has a near-identical `withTmpFile`. Without consolidation, `health-writer.test.js` (Task 7) will become the third copy.

**Resolution path:** When Task 10 lands the helpers, also retroactively migrate `manifest-writer.test.js` and `file-status.test.js` to use the consolidated helper if the API fits cleanly. If migration risks regressions (the tests are tight; touching them is risky), document the duplication and move on.

### For Task 18 (final verification)

**Q:** Does `npm test` run cleanly on the lowest supported Node version (`engines.node: >=18.0.0`)?

**Context:** Task 1's code reviewer noted that `node --test` glob support solidified in Node 21+. On Node 18/20 the quoted-glob argument may behave differently.

**Resolution path:** Run the full suite on Node 18 (or whatever the floor we want to claim) during final verification. If it fails, bump `engines.node` to `>=20.0.0`.

---

## Per-task dispatch protocol

For each remaining task:

1. **Open the plan** (`docs/superpowers/plans/2026-06-10-manifest-and-health.md`), find the task by number, copy the FULL task text.
2. **Dispatch implementer** (general-purpose subagent) with:
   - Full task text inline (don't make subagent read the plan file)
   - Context: the branch, the prior tasks landed (point at this progress doc), any relevant decisions from D1–D4 above, and known open questions
   - Project gotchas: apostrophes break heredoc commit messages (use tempfile + `git commit -F`); branch is `feat/manifest-and-health`; ajv/ajv-formats already installed
3. **Spec compliance review** (general-purpose subagent) — verify by reading code, don't trust report.
4. **Code quality review** (`superpowers:code-reviewer` subagent) — pass BASE_SHA (commit before this task) and HEAD_SHA.
5. **If reviewer flags issues:** if `Critical` or `Important`, dispatch a refinement subagent; if `Minor` only, accept and proceed.
6. **Update this file:** add the task to "Completed tasks" with the commit SHA(s) and test delta. Record any new decisions or open questions.
7. **Mark task done** in the session task list.
8. **Move to next task.**

The implementer prompt template, spec-reviewer template, and code-reviewer template all live in the `superpowers:subagent-driven-development` skill. Read them once at the start of a fresh session if not already loaded.

---

## Final-stage handoff

After Task 18 completes:
1. Run `npm test` one more time.
2. Update `docs/tasks.md` (the repo's main backlog) to move tasks #2 + #6 to Completed and unblock #3.
3. Open a PR from `feat/manifest-and-health` → `main` with the spec link in the body.
4. Use the `superpowers:finishing-a-development-branch` skill if it applies.
