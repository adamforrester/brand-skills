# Manifest + Health — Implementation Progress

Companion to [`2026-06-10-manifest-and-health.md`](2026-06-10-manifest-and-health.md). Survives context clears. Update after every task completes (or after every refinement).

**Branch:** `feat/manifest-and-health` (off `main` at `e54066f`)
**Last updated:** 2026-06-10 — through Task 10 (+ refinement + doc commit)
**Test status:** 35/35 passing on the branch
**HEAD:** the latest progress-doc commit on `feat/manifest-and-health`. Don't bother chasing the exact SHA in this doc — `git rev-parse HEAD` is authoritative. As of writing, it should match the most-recent `docs:` commit at the top of `git log --oneline main..HEAD`.
**Next task:** **Task 11** — Test fixtures (populated/, fresh-init/, mixed/, stage-data/)

---

## How to resume in a fresh session

If this conversation got cleared and you're picking up the work:

1. Read `docs/superpowers/specs/2026-06-10-manifest-and-health-design.md` — the spec we're implementing.
2. Read `docs/superpowers/plans/2026-06-10-manifest-and-health.md` — the 18-task plan.
3. Read THIS file to see what's done, what's next, and which decisions were made along the way that aren't in the plan.
4. `git log --oneline main..HEAD` — verify your local branch matches the commit list below. HEAD should be `d3a7401`.
5. `npm test` — verify 35/35 passing.
6. Invoke `superpowers:subagent-driven-development` (the user expects full discipline: implementer + spec review + code quality review per task).
7. Resume at the next pending task using the dispatch protocol at the bottom of this file.

### Quick state check (as of 2026-06-10 through Task 10)

Verify before continuing:

```
$ git rev-parse --abbrev-ref HEAD
feat/manifest-and-health

$ git log --oneline main..HEAD | wc -l
23    # 16 task/code commits + 7 progress-doc commits

$ git log -1 --format=%H
<the most recent progress-doc commit on the branch — top of git log main..HEAD>

$ npm test 2>&1 | grep '^# tests\|^# pass\|^# fail'
# tests 35
# pass 35
# fail 0
```

If any of those don't match, **stop and tell the user** — something diverged between sessions.

### Things that bite repeatedly (from D1-D8 below; read those for full context)

- **`ajv/dist/2020.js`, not `ajv`.** The plan's pasted writer code uses plain `import Ajv from 'ajv'` which crashes at module load against draft 2020-12 schemas. Both `manifest-writer.js` and `health-writer.js` use the dist/2020 entry point. Any new module that compiles these schemas must do the same. (D5)
- **Apostrophes break heredoc commit messages.** Always write the commit message to `/tmp/commit-msg.txt` and use `git commit -F`. Subagents need to be told this every time.
- **`package-lock.json` is gitignored.** Don't try to `git add` it. (D4)
- **Don't bump the package version. Don't touch `~/Documents/xd-toolkit`.** Durable rules from CLAUDE.md.
- **Two-stage review per task** (spec compliance, then code quality). Don't shortcut. **6 of 10 tasks (60%)** have needed a refinement subagent for reviewer-flagged Critical/Important findings. Plan-pasted code has had four real bugs (D1, D2, D8, D9) and one wrong import (D5). (D7)
- **Long-running implementer/refinement agents can die mid-flight on token expiration.** When the file edits are already on disk but the agent didn't commit, just run smoke-tests + commit yourself rather than re-dispatching from scratch. The Task 8 refinement died this way after editing but before committing — the diff was correct, mechanical to verify and commit. (Bare-fact, no decision letter assigned.)

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
| 8 | emit-manifest CLI command | `ed3ede0`, `d858b42` | 0 (integration test in Task 12) | Refinement (`d858b42`) fixed three reviewer-flagged Important issues: (1) out-of-tier files on disk are now surfaced (spec §2 deviation in plan's pasted code); (2) invalid `tier` exits cleanly instead of throwing; (3) `file_overrides` for unknown paths surface rather than silently drop. See D8. Six Minor findings (JSDoc, `pkg` hoist, dead `projectDir` param, field ordering, `inventory.md` comment, brandrc-helper extraction) deferred per D7. |
| 9 | score.js refactor + .health.json emit | `5025e25` | 0 (integration test in Task 13) | Code review Minor only — accepted per D7. D1 H1-strip improvement now flows through `score`. Yellow-circle line shows real status names (`placeholder`/`partial`/`defaults`) instead of the old "(exists but empty/placeholder)". `--json` flag and exit-code semantics preserved. Six Minor findings deferred (unused `weightsForTier` import, repeated `manifest?.files?.[p]?.status ?? classifyFile(...)` pattern across 4 sites, empty-string `client` footgun, brandrc-vs-manifest tier-mismatch is silently resolved by manifest, no per-task regression test until Task 13, malformed manifest is silently treated as missing). |
| 10 | Test helpers (`tmp-brand.js`, `run-cli.js`) | `844e6b4`, `9f6cdc0` | 0 (consumed by Tasks 11–15) | Refinement (`9f6cdc0`) made `emptyBrandDir`'s `mode` independent of `tier` — plan's `mode: ${tier}` produced combos that never appear from real init (`TIER_FOR_MODE` maps pitch→minimum, standard→standard, comprehensive→comprehensive). See D9. Open question on retroactive migration of `manifest-writer.test.js` + `file-status.test.js` resolved as DON'T MIGRATE — `withTmpFile(content, fn)` and the inline mkdtempSync don't map to `withFixture(name)` / `emptyBrandDir({tier, mode, client})`. Code reviewer agreed. |

**Total tests:** 35 passing.

---

## Pending tasks

In plan order. Pull the full task text from `2026-06-10-manifest-and-health.md` when dispatching.

- [ ] **Task 11** — Test fixtures (populated/, fresh-init/, mixed/, stage-data/). Plan lines ~1711-1900.
- [ ] **Task 12** — Integration test: emit-manifest end-to-end (+ golden). Plan lines ~1902-2036.
- [ ] **Task 13** — Integration test: score emits health (+ golden). Plan lines ~2038-2140.
- [ ] **Task 14** — Integration tests: round-trip + scan fallback. Plan lines ~2142-2272.
- [ ] **Task 15** — SKILL fallback golden + fresh-init test. Plan lines ~2274-2360.
- [ ] **Task 16** — SKILL updates (brand-extract Section 10b, brand-check Step 1). Plan lines ~2362-2480.
- [ ] **Task 17** — Repo docs (CLAUDE.md, README, tasks.md). Plan lines ~2482-2570.
- [ ] **Task 18** — Final verification + final code-reviewer subagent across the branch. Plan lines ~2572+.

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

### D7 — Reviewers consistently catch real issues; budget for refinement subagents (meta)

**Pattern:** Across Tasks 2, 3, 5, 7, 8 the code reviewer surfaced Important findings worth a refinement subagent. The plan's pasted code has had three real bugs (D1, D2, D8), one wrong import (D5), and an unhandled error path (D8). Spec/code reviewers earn their keep here — don't shortcut review for "simple" tasks. **Updated rate:** ~5 of 8 tasks (≈60%) have needed a refinement.

### D8 — emit-manifest spec deviation in plan's pasted code (Task 8)

**Bug:** Plan's `buildFilesMap` pasted code surfaced out-of-tier files only when listed in `file_overrides`. Spec §2 explicitly requires: *"Out-of-tier files that do exist also appear (so a hand-written `composition/patterns.md` at `tier: minimum` is surfaced rather than hidden)."* A practitioner-written file that no producer mentioned was silently dropped from the manifest.

**Two adjacent issues caught at the same review:**
- Invalid `tier` value threw `Error: Unknown tier: <x>` from `weightsForTier()` and exited with a Node stack trace, instead of using the file's existing `console.error(chalk.red(...)) + process.exit(1)` pattern.
- `file_overrides` referencing a path not in the active tier (e.g., a typo, or a producer mentioning an out-of-tier path) was silently dropped rather than surfaced. Producers (the brand-extract SKILL) had no signal.

**Fix (commit `d858b42`):**
- `buildFilesMap` now walks `weightsForTier('comprehensive')` as the universe of known schema paths and surfaces any not-in-active-tier file that exists on disk. Components branch (dynamic enumeration) stays separate.
- New `VALID_TIERS = ['minimum','standard','comprehensive']` check after the brandrc/stdin merge; invalid value exits cleanly.
- Override application now creates an entry for unknown paths (status from disk-classification if file exists, else `'missing'`) before applying the override's status/note.
- Removes the old "overrides-on-disk" intermediate block — its semantics are subsumed by the broader walk + override fallback.

**Implication for Task 12 (integration tests):** the goldens must reflect this corrected behavior. Hand-written out-of-tier files appear with their classified status; `file_overrides` for unknown paths surface; invalid `tier` exits 1 with a chalk-red message.

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

### D9 — `emptyBrandDir` `mode` is independent of `tier` (Task 10)

**Bug:** Plan's pasted code in Task 10 wrote `mode: ${tier}` to `.brandrc.yaml`. But production `cli/src/commands/init.js:41-45` defines:
```js
const TIER_FOR_MODE = {
  pitch: 'minimum',
  standard: 'standard',
  comprehensive: 'comprehensive',
};
```
So `mode ∈ {pitch, standard, comprehensive}` and `tier ∈ {minimum, standard, comprehensive}` — the helper's default produced `mode: minimum`, an unreachable shape from real `init`. No CLI command currently reads `mode` from `.brandrc.yaml` (only `client` and `tier` are read), but the helper would have silently encoded the misleading shape into every integration test that consumes it.

**Fix (commit `9f6cdc0`):** `emptyBrandDir({ tier = 'minimum', mode = 'standard', client = 'acme' } = {})` — `mode` is an independent third parameter defaulting to `'standard'` (production-valid for any tier). JSDoc points readers at `TIER_FOR_MODE` for the production mapping.

**Implication for Tasks 11–15:** if any downstream test cares about the `mode` field's value, override it explicitly. Otherwise the `'standard'` default works.

---

## Open questions surfaced for upcoming tasks

### For Task 7 (health-writer) — RESOLVED

**Q:** Should `gap-actions.js` per-prefix entries (`tokens/`, `composition/`, `workflows/`) include `partial` keys?

**Resolution:** No. Task 7's plan-test for `gaps` only asserts `suggested_action` matches `/\S/` (non-empty). No per-status text assertions for `partial` in those prefixes. The generic `Populate <path> per schema/brand/<dashed>.schema.md` fallthrough is acceptable.

A follow-up (separate, optional) could add a one-line `// partial intentionally omitted — falls through to generic` comment in `gap-actions.js`. Not blocking Task 7.

### For Task 10 (test helpers) — RESOLVED

**Q:** Fold the tempdir setup pattern from `manifest-writer.test.js` and the `withTmpFile` helper from `file-status.test.js` into `tmp-brand.js`?

**Resolution:** Don't migrate. The new helpers are integration-test-focused (`withFixture(name)` copies a committed fixture; `emptyBrandDir({tier, mode, client})` scaffolds a `.brand/` + `.brandrc.yaml`). Neither maps to `withTmpFile(content, fn)` (generic-tmpdir-with-arbitrary-string-content) or to `manifest-writer.test.js`'s inlined `mkdtempSync`-then-write-JSON pattern. Forcing a migration would require committing string-content fixtures the existing tests inline cleanly. Code reviewer agreed during Task 10 review.

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
   - Context: the branch, the prior tasks landed (point at this progress doc), any relevant decisions from D1–D7 above, and known open questions
   - Project gotchas: apostrophes break heredoc commit messages (use tempfile + `git commit -F`); branch is `feat/manifest-and-health`; ajv/ajv-formats already installed; ajv import must be `ajv/dist/2020.js` not plain `ajv` (D5)
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
