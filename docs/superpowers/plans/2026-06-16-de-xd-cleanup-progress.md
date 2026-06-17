# De-XD Cleanup — Implementation Progress

Companion to [`2026-06-16-de-xd-cleanup.md`](2026-06-16-de-xd-cleanup.md) (the implementation plan — **not yet written**, see "Resume from here" below).

**Status:** brainstorm complete; spec committed; **plan-writing was interrupted by API errors mid-session and needs to be resumed in a fresh session.**
**Branch:** `feat/de-xd-cleanup`
**Branch base:** `main` at commit `6b87652` (post-C9-merge tip).
**Branch tip at handoff:** `25e3300` (spec commit).
**Spec:** [`../specs/2026-06-16-de-xd-cleanup-design.md`](../specs/2026-06-16-de-xd-cleanup-design.md)
**Precedent (D-letter pattern reference):** [`2026-06-15-industry-signal-progress.md`](2026-06-15-industry-signal-progress.md)

---

## Quick state check

```
$ git log --oneline main..HEAD
e916917 docs: implementation plan for de-XD cleanup
039b695 docs: progress doc shell for de-XD cleanup + tasks.md state
25e3300 docs: spec for de-XD cleanup (Bucket A — pre-1.0 contract residue)

$ npm test 2>&1 | tail -5
# pass 112
# fail 0
```

Baseline locked: 112 tests at HEAD `e916917`. New tests by task tracked below.

---

## Resume from here (read first when picking back up)

The session that produced the spec hit recurring API errors during plan-writing — only in this project's chat, not user's other sessions. To get unblocked the user is restarting; this doc captures all decisions made so the next session doesn't re-litigate any of them.

**What's already locked (do NOT re-brainstorm):**

1. **Soft deprecation** is the back-compat stance for renames. Old names (`client`, `mode: pitch`, `--impeccable`, `extensions`, `tools.storybook`) keep working and emit a one-line warning per process, exactly once. Plan to remove in 2.0.
2. **Loader scope: surgical.** Create `cli/src/utils/brandrc-loader.js` with `loadBrandrc(projectDir)`. Route only the call sites that read `client` / `mode` / `extensions` / `tools.storybook` through it. Specifically: `refresh-context.js`, `refresh-design.js`, `score.js`, `emit-manifest.js`. Do **not** restructure other reads.
3. **`outputs:` shape: flat array.** `outputs: [.impeccable.md, ./other.md]`. No named buckets, no per-output metadata. YAGNI.
4. **Default `brand` value: `basename(projectDir)`.** When `.brandrc.yaml` has neither `brand:` nor `client:`, fall back to the directory name. `brand-cli init` pre-fills the prompt with this default.
5. **Manifest schema stays v2 untouched.** The manifest's top-level `client` field (in `schema/manifest.schema.json:15`) is a generated-artifact field name, decoupled from the brandrc UX surface. Brandrc's `cfg.brand` translates to `manifest.client` at write time. A short comment in the brandrc-loader and emit-manifest call site should explain this asymmetry. **This is load-bearing — do NOT bump manifest to v3.**

**What's done on disk (committed on `feat/de-xd-cleanup`):**
- `25e3300` — spec at `docs/superpowers/specs/2026-06-16-de-xd-cleanup-design.md` (255 lines).

**What's done in-session but NOT committed (in this progress doc itself):**
- This file. Captures the brainstorm-resolution decisions so they survive the restart.

**What's NOT done:**
- The implementation plan (`docs/superpowers/plans/2026-06-16-de-xd-cleanup.md`) — the next session writes this.
- All code changes for the 7 tasks below.
- All tests for the 7 tasks below.
- Repo docs propagation (CLAUDE.md, README.md, schema/brand/README.md, docs/DESIGN.md, tasks.md inventory close-outs).

---

## What needs to happen in the resumed session

**Step 1.** Read these in order:
1. `docs/superpowers/specs/2026-06-16-de-xd-cleanup-design.md` (the spec)
2. This progress doc (the locked decisions above)
3. `docs/xd-assumption-inventory.md` (cross-reference for inventory items #2/#3/#4/#6/#7/#10/#12/#14/#18 — what each closure must achieve)
4. `cli/src/commands/{init,refresh-context,refresh-design,score,emit-manifest}.js` — the 5 call sites that read `client`/`mode`
5. `schema/brand/brandrc.schema.md` — the schema-doc the renames touch
6. `docs/superpowers/plans/2026-06-15-industry-signal.md` — the most recent precedent for the plan format (subagent-driven-development with verbatim code blocks per task)

**Step 2.** Invoke the `superpowers:writing-plans` skill and produce `docs/superpowers/plans/2026-06-16-de-xd-cleanup.md`. The plan should pre-bake all implementer code/edit blocks (per-task verbatim) so an implementer subagent can't hallucinate or improvise.

**Step 3.** The plan should walk these 7 tasks in order:

| # | Task | Spec section | Key files |
|---|------|--------------|-----------|
| 1 | Test harness sync + branch baseline | — | `npm test` confirms 112/112; no code change |
| 2 | brandrc-loader extraction + `client` → `brand` rename + warn-once helper | §1 Change 1 + §2 Cross-cutting "Soft-deprecation infrastructure" | NEW `cli/src/utils/{brandrc-loader,deprecations}.js`; modify `refresh-context.js`, `refresh-design.js`, `score.js`, `emit-manifest.js`, `init.js`, `schema/brand/brandrc.schema.md` |
| 3 | `mode: pitch` → `public-sources-only` rename | §1 Change 2 | `init.js`, `brandrc-loader.js` (alias mapping in same loader from Task 2), `schema/brand/brandrc.schema.md`, SKILL prose §4f/5c/6e/8f, plus skill-prose-parity test |
| 4 | Stage 6 gate: `tier == comprehensive` → `sources.design_system_repo` set | §1 Change 3 | `brand-context/skills/brand-extract/SKILL.md` §6 only; skill-prose-parity test asserting new gating phrase |
| 5 | `--impeccable` → `--also-write <path>` + `outputs:` brandrc field (flat array) | §1 Change 4 | `refresh-context.js` (option + outputs read); `schema/brand/brandrc.schema.md` (add `outputs` row); `schema/brand/overview.schema.md` (reframe Impeccable refs to neutral) |
| 6 | Schema-doc cleanup batch: `tools.agent` → string + drop `extensions` + drop `tools.storybook` + add `sources.asset_dir` | §1 Changes 5/6/7/8 | `schema/brand/brandrc.schema.md` (4 row changes); `init.js` (asset_dir respect); `brand-context/skills/brand-extract/SKILL.md` §1 (asset-dir override prose); silent/warn-once for dropped fields in `brandrc-loader.js` |
| 7 | Repo docs propagation + final verification + cross-branch code review | §4 Acceptance criteria | `docs/xd-assumption-inventory.md` close-outs for items #2/#3/#4/#6/#7/#10/#12/#14/#18; CLAUDE.md (file-write policies for new fields if any); README.md (any user-facing renames); `docs/tasks.md` "Last updated" + completion entry; final verification run |

**Step 4.** After the plan is committed (`docs: implementation plan + progress doc shell for de-XD cleanup`), execution follows the **subagent-driven-development** pattern (precedent: #3, #4, #5).

---

## Test count target

Baseline: 112/112 (at `feat/de-xd-cleanup` HEAD = `25e3300`).
Target after Task 7 lands: **120-128** (estimated).

New tests by task (estimated):
- Task 2: +3-4 (`brandrc-loader` aliases legacy `client`, defaults to `basename(projectDir)`, warns exactly once; deprecation helper warn-once semantics)
- Task 3: +1-2 (`mode: pitch` aliases to `public-sources-only` + warns; new mode loads silently); SKILL parity tests for renamed mode strings
- Task 4: +2 (skill-prose-parity for new gating phrase; existing gating phrase removed)
- Task 5: +2-3 (`--also-write` writes mirror file; `outputs: [path]` from brandrc produces same result; `--impeccable` still works as alias + warns)
- Task 6: +1-2 (legacy `extensions: [ds-pack]` ignored + warns; `sources.asset_dir` override read by SKILL parity)
- Task 7: 0 (verification only)

---

## Cross-branch contracts to preserve (from the spec)

- **Manifest v2 untouched** — the brandrc `brand` field translates to `manifest.client` at emit-manifest time. Don't bump.
- **Scope schema untouched** — `.brand/.scope.json` still uses `client` (per #4's design). The brandrc-loader's alias logic accepts `client` from scope.json the same way it accepts it from `.brandrc.yaml`. Document this in the spec/plan.
- **MCP fallback contract untouched** — Stage 6 gating change is a SKILL-prose change only; the contract data file isn't involved.
- **Goldens** — `cli/test/golden/manifest-from-{populated,skill}.json` `generator` field already pinned to `brand-cli@0.4.0` / `brand-extract-skill@0.4.0`; the de-XD branch does NOT bump version (release commit does that, post-merge). If goldens use `client:` field, that stays — it's manifest-side, not brandrc-side.

---

## Things that bite repeatedly (carried forward from precedent)

1. **Branch-suffixed tempfile names for commit messages.** `/tmp/commit-msg-task<N>-de-xd.txt` — never the bare `/tmp/commit-msg.txt`. Stale tempfiles in /tmp survive across sessions; `git commit -F` consumes silently. ([D1] from #5; CF-2 from #3.)
2. **Implementer-died-mid-flight.** If a subagent dies on terminal API token expiration with file edits unstaged on disk, the controller picks up partial edits and finishes inline — does NOT re-dispatch. ([D4] from #4; [D3] from #3.)
3. **SKILL prose isn't covered by `npm test`.** Use parity tests (`skill-scope-parity.test.js` precedent) to lock cross-task contract phrases. New tests likely needed for Task 4 (Stage 6 gating phrase) and Task 5 (Impeccable → also-write reframing).
4. **Node 22 required for the test glob.** A bare `npm test` in a shell that hasn't `nvm use 22`'d will print "Could not find 'cli/test/**/*.test.js'" — Node 20 doesn't expand the glob. Source `~/.nvm/nvm.sh && nvm use 22` first.
5. **API-error session interruption.** If errors recur, snapshot state to disk via this progress doc and restart. (This document itself is the precedent — recorded 2026-06-16.)

---

## Decisions made during brainstorm (D-letter pattern, pre-implementation)

### [D0] Manifest schema stays v2; brandrc `brand` translates to manifest `client`

**Discovered during spec-writing.** `schema/manifest.schema.json:15` declares a top-level `client` field on the manifest. The brandrc rename `client` → `brand` would normally cascade — but the manifest is a generated artifact with its own contract (separate from the brandrc UX surface). Bumping manifest to v3 over a vocabulary rename would force every downstream tool (host orchestrators, CI gates, the embedded path) to migrate for no functional gain.

**Resolution:** the brandrc-loader's `loadBrandrc()` returns `{ brand, ...rest }`. At emit-manifest time, the manifest payload uses `manifest.client = cfg.brand` (with a one-line comment in `emit-manifest.js` noting the historical asymmetry). The manifest schema's `client` field is now framed as "the brand name as recorded in the manifest" rather than "the client this engagement is for" — this is a docs-only change to `schema/manifest.schema.json`'s description, not a structural change.

**Implication for plan:** Task 2 includes (a) the brandrc-loader returns `brand` in its result shape, (b) `emit-manifest.js`'s `client` derivation reads `cfg.brand ?? cfg.client ?? ''` and writes `manifest.client = ...`, (c) the manifest schema description is reworded but `version: "2"` and the field name are preserved.

### [D1] Soft-deprecation aliases live in the brandrc-loader, not in callers

The loader normalizes incoming brandrc state once: it maps `client → brand`, `mode: pitch → mode: public-sources-only`, drops/warns on `extensions` and `tools.storybook`, and emits warnings via the shared `deprecations.js` helper. Callers receive a fully-normalized object — no caller has alias logic. This keeps drift impossible: every consumer sees the same shape regardless of which file they read.

### [D2] `outputs:` is parsed at refresh-context call time, not at brandrc-loader time

The brandrc-loader only normalizes legacy aliases. The `outputs: [path1, path2]` field is read by `refresh-context.js` directly when it builds its mirror list. Reason: the loader stays focused on alias normalization; the `outputs` field is consumed by exactly one call site, so parsing it inside the loader would expand the loader's responsibility for no consumer.

### [D3] `init.js` prompt for `brand` shows the dirname default but still allows empty

When neither `--client` nor `--brand` flag is set, `init.js` prompts `Brand name:` with the default pre-filled from `basename(projectDir)`. User can hit Enter to accept the default, or type an override. The validator accepts the default-or-override but rejects the empty string after trimming (preserves current input-validation semantics). The `--client` flag stays as a deprecated alias of `--brand`.

---

## Open questions surfaced during brainstorm (resolved before plan-write)

All three questions from spec §6 are resolved (see "What's already locked" above):
1. Loader scope → surgical
2. `outputs:` shape → flat array
3. Default `brand` → `basename(projectDir)`

No open questions remain. Plan-write can proceed without further user input.

---

## Final-stage handoff (after plan execution lands — placeholder until then)

Will be populated when all 7 tasks merge. Mirror format used by the #5 progress doc.
