# CLAUDE.md

Guidance for Claude (and other AI agents) working on **this repo**. Distinct from `brand.md`, which is generated context *about a client's brand*. This file is about how to edit `brand-skills` itself.

For what the project does and how end users install it, read `README.md`. This file is the parts a contributor needs that the README doesn't cover.

---

## Naming — three different names, don't conflate them

| Surface | Name | Where it appears |
|---|---|---|
| GitHub repo | `adamforrester/brand-skills` | `package.json` `repository.url`, plugin marketplace install |
| npm package | `brand-skills` | `package.json` `name`, ships the CLI |
| CLI binary | `brand-cli` | `package.json` `bin`, what users actually run |
| Claude Code plugin | `brand-context` | `.claude-plugin/marketplace.json` `plugins[0].name`, command namespace |
| Slash commands | `/brand-context:extract`, `:check`, `:audit` | `brand-context/commands/*.md` |

The plugin was renamed from `brand-skills` to `brand-context` in v0.2.0; the repo and npm package kept the old name. **Don't unify them without explicit approval** — external installs reference both names independently.

---

## Architecture — three layers, edit them together

```
schema/brand/*.schema.md                        ← source of truth for .brand/ file shapes
schema/{manifest,health}.schema.json            ← machine-validation contracts
schema/mcp-fallback-contract.{json,schema.json} ← per-stage fallback contract data + validator
schema/brand/scope.schema.json                  ← validator for optional .brand/.scope.json pre-fill
       ↓
brand-context/skills/*/SKILL.md   ← AI agent instructions (what to write)
       ↓
cli/src/                      ← deterministic regen (init scaffolding, refresh-design, refresh-context, score, emit-manifest, import-tokens)
```

Editing one layer almost always means touching the others:

- **Schema change** → update the SKILL.md section that writes that file → update `cli/src/commands/init.js` `BRAND_FILES` / `TOKEN_FRONTMATTER` / scaffold output → update `cli/src/utils/{design-md-generator,brand-context-generator}.js` if the file feeds either generated artifact
- **New stage in `brand-extract` SKILL.md** → check the "Phase 8 scope reminder" block at the bottom of `brand-context/skills/brand-extract/SKILL.md` → check the README "How the pipeline works" table → check the "Stage status" line in the SKILL's final-summary section
- **New audit dimension** → update `brand-context/skills/brand-audit/SKILL.md` Dimension list AND the `score = …` formula AND `schema/brand/audits.schema.md`

If you're tempted to skip one of these propagations, don't. The three layers are read independently by users at runtime — drift between them produces silent wrongness.

---

## SKILL → CLI fallback contract

Every CLI command has a SKILL.md inline fallback. The contract:

- If `brand-cli` is installed → SKILL shells out via `Bash`
- If not → SKILL regenerates the same file inline using `Read` / `Write` / `Edit`

**Both paths must produce the same output shape.** When you change `cli/src/utils/design-md-generator.js`, you must also update the inline-fallback instructions in `brand-extract/SKILL.md` Section 8 (design.md regen). Same for `brand-context-generator.js` ↔ Section 10 (brand.md regen).

The CLI is the canonical implementation; the SKILL fallback is the spec in prose. If they disagree, fix the SKILL — users without the CLI shouldn't get a different artifact.

The same contract applies to `cli/src/utils/style-guide-generator.js` ↔ `brand-extract/SKILL.md` Section 8a (the visual style guide). Both paths must produce byte-identical HTML for any given `.brand/` state — the spec at `docs/superpowers/specs/2026-06-18-visual-style-guide-design.md` §7a is load-bearing on this.

---

## File-write policies — additive vs. overwrite

This is the easiest thing to get wrong. Each `.brand/` file has a specific policy that the SKILL must honor:

| File | Policy | Why |
|---|---|---|
| `tokens/{colors,typography,spacing,surfaces}.md` | **Overwrite** unprompted if placeholder marker present; otherwise prompt overwrite/merge/skip | Tokens are values; replacing is fine when the file is scaffolding |
| `voice.md` | **Additive** — `## Observed Voice (live channels)` section is the *only* section Stage 3 writes; all prescriptive sections are preserved | Practitioners add voice principles from brand guides; Stage 3 must not erase them. Use `Edit`, never `Write`. See `brand-extract/SKILL.md` Section 4f for the three cases. |
| `overview.md` | **Overwrite** when placeholder; prompt overwrite/merge/skip when populated. Merge regenerates only the brand-self-test block. | Single coherent document, no descriptive/prescriptive split |
| `conflicts.md` | **Additive** — Active Conflicts can be rebuilt; Intentional Adaptations and Resolved Conflicts Archive are *never* deleted | Practitioner-resolved entries are the audit trail |
| `components/*.md` | **Overwrite per-file** if provenance marker present; prompt if hand-edited | Auto-generated from repo scan; hand edits go to a sibling file |
| `audits/*.md` | **Additive** — never overwrite, every run is a new dated file | The directory IS the audit trail |
| `.scope.json` | **Read-once + delete-after-merge** — the SKILL `§0a.5` reads `.brand/.scope.json` if present, merges into the in-memory brandrc state, deletes the file only after `§0e` successfully writes `.brandrc.yaml`. Failure modes (parse, validation, embedded-mode bail, brandrc-write fail) do **not** delete. | Transient pre-fill for `.brandrc.yaml`; brandrc remains the single source of truth. Embedded hosts re-author it before each invocation. |
| `manifest.json` | **Overwrite wholesale every run** | Generated artifact; source of truth is `.brand/*.md`. Same as `design.md`/`brand.md`. Emitted by `/brand-context:extract` end-of-pipeline. **Schema is `version: "2"` as of branch `feat/mcp-fallback-contract`** — `version: "1"` payloads/manifests are hard-rejected by both `emit-manifest` and `score`. See `docs/superpowers/specs/2026-06-13-mcp-fallback-contract-design.md` §4. |
| `.health.json` | **Overwrite wholesale every run** | Verdict cache emitted by `/brand-context:check` (and `brand-cli score`). Reproducible from manifest + tier weights. |
| `design.md`, `brand.md`, `style-guide.html` | **Overwrite wholesale** every regen | Generated artifacts; source of truth is `.brand/`. `style-guide.html` is a self-contained HTML synthesis written by `brand-cli refresh-design` alongside `design.md`. Spec: `docs/superpowers/specs/2026-06-18-visual-style-guide-design.md`. |

If you add a new `.brand/` file, decide its policy explicitly and document it in the SKILL.

---

## Current direction: de-coupling from XD-toolkit

This repo was extracted from `xd-toolkit` (a separate internal repo at `~/Documents/xd-toolkit`). `xd-toolkit` consumes this repo externally as of its v2.0.0 — there's no source duplication.

The active goal is making `brand-skills` viable for users **outside the XD practice**. That means questioning XD-specific assumptions baked into the skills, slash-command UX, and CLI prose.

**Full XD-assumption inventory:** [`docs/xd-assumption-inventory.md`](docs/xd-assumption-inventory.md) — 18 findings, three impact tiers, three cross-cutting patterns. Read this before making changes that touch user-facing vocabulary, defaults, or schema shape.

**Quick highlights from the inventory:**
- The `comprehensive` tier conflates extraction completeness with workflow elaboration — it pulls in prototype-deploy / QA-checklist / Figma-to-code workflow files most users won't want.
- `client` is required in `.brandrc.yaml`; agency framing.
- `mode: pitch` is agency-pitch vocabulary.
- `--impeccable` is the only first-class non-default integration; Impeccable is XD-internal.
- `cli/src/utils/design-md-generator.js:23` — comment refers to "XD Toolkit-only `elevation` block".

**When editing this repo, default to general-purpose framing.** Don't add new XD-specific defaults, vocabulary, or assumptions. If a change here would require a corresponding edit in `xd-toolkit`, flag it — don't reach into that repo.

**Constraint:** do not touch `~/Documents/xd-toolkit` from this repo's working tree.

---

## Stance on dembrandt and other peer tools

[`dembrandt`](https://github.com/dembrandt/dembrandt) is the closest peer to brand-skills — a polished, MIT-licensed design-token extractor with a mature MCP server. We've decided **borrow without dependency**, with an optional graceful-degradation hook for users who already have dembrandt installed (Option 3 in `docs/research-notes.md`).

**What this means in practice:**

1. **Don't add dembrandt as a runtime dependency.** Our minimal-dependency invariant (no required CLI / MCP / framework, see `docs/DESIGN.md`) is load-bearing. Adding a hard dependency on any peer tool reverses it.
2. **Borrow patterns and open specs freely.** DTCG token format, MCP tool-shape conventions, motion-token extraction approaches, multi-page confidence boosting — all reimplement-and-own. dembrandt is MIT; specs (DTCG, design.md) are open.
3. **Optional delegation, not required.** A future Stage 2 enhancement may detect dembrandt and delegate visual-token extraction to it (same pattern as our Playwright-or-WebFetch fallback). This is additive, not a hard switch.
4. **Stay differentiating.** Voice extraction, multi-source reconciliation (Figma + PDF + web + social), conflicts.md, and `/brand-context:audit` are unique to us. Don't cede any of them in pursuit of "compose with dembrandt."
5. **Avoid their anti-patterns.** dembrandt's drift / CI / ingest features are sponsor-gated; ours stay in the free CLI. Their `--stealth` and anti-detection flags are off-limits.

If a future feature here looks like "wrap dembrandt's CLI / MCP," push back unless it's strictly an opt-in fallback path. The default must keep working when dembrandt is absent.

Same posture applies to design-oracle, Agent-Reach, or any peer that emerges later. See `docs/research-notes.md` for the full comparison.

---

## Versioning + release

- **One version, ten places.** Authoritative inventory (audit-friendly: `grep -rn "<current-version>"` in code excluding `docs/superpowers/` should yield exactly these matches):
  1. `package.json` `version`
  2. `.claude-plugin/marketplace.json` `metadata.version`
  3. `.claude-plugin/marketplace.json` `plugins[0].version`
  4. `cli/bin/brand-cli.js` `program.version()`
  5. `cli/test/golden/manifest-from-populated.json` `generator: "brand-cli@<version>"`
  6. `cli/test/golden/manifest-from-skill.json` `generator: "brand-extract-skill@<version>"`
  7. `cli/test/golden/health-from-populated.json` `generator: "brand-cli@<version>"`
  8. `cli/test/unit/health-writer.test.js` `generator: 'brand-cli@<version>'` (fixture in `makeManifest()`)
  9. `cli/test/unit/manifest-writer.test.js` `generator: 'brand-cli@<version>'` (fixture in `validPayload()`)
  10. `cli/test/integration/score-emits-health.test.js` `generator: 'brand-cli@<version>'` (v1 fixture for rejection test)
  Places 1–4 are the runtime version. Places 5–10 pin the version as a string inside test data; tests strip `generator` before `deepEqual` so staleness doesn't break CI, but readers using the goldens or test fixtures as documentation see the wrong version. Bump them with the others. Plan/spec docs under `docs/superpowers/` reference the version that was current at authoring — those are historical artifacts, leave alone.
  - The MCP-fallback contract at `schema/mcp-fallback-contract.json` has its own `version: "1"` field, independent from the package version. Bump it (and the corresponding `version` const in `schema/mcp-fallback-contract.schema.json`) only on breaking shape changes. The manifest's `version: "2"` is similarly independent — bump on shape changes to `manifest.schema.json`.
- **Tests cover the CLI, not the SKILLs.** `npm test` runs the suite (`node --test 'cli/test/**/*.test.js'` — 159 tests as of v0.5.0, all green). Run `npm install` first; with no `node_modules` the suite fails wholesale on missing deps (ajv/js-yaml/commander), which looks like a red suite but isn't. The SKILL fallback prose is **not** under test directly — SKILL ↔ CLI parity assertions in `cli/test/unit/skill-scope-parity.test.js` guard load-bearing prose contracts via regex, but a full SKILL change still needs a manual stage-end-to-end walk.
- **Not yet on npm.** Install path today is GitHub-direct via `claude plugin marketplace add adamforrester/brand-skills`. The CLI is intended to publish to npm but hasn't yet (roadmap item in README).
- **Don't bump the version proactively.** Wait for explicit instruction — release cadence is being decided.

---

## Things to know that aren't obvious from reading the code

- **The Wendy's brand is the canonical extraction example** in SKILL prose (red, food-photography references) and across `schema/brand/*.schema.md`. When updating examples, swap to a different brand to avoid the impression that the tool is Wendy's-specific. (See `docs/xd-assumption-inventory.md` finding #9.)
- **MCP dependencies are recommended but not required.** Playwright MCP, Figma Console MCP, and Firecrawl MCP all degrade gracefully. When adding a new SKILL feature that uses an MCP, write the no-MCP fallback at the same time.
- **Stage numbering in `brand-extract` is non-contiguous.** Stages are 1, 2, 3, 4, 5, 6, 8 — there is no Stage 7 (collapsed historically). Don't "fix" this without reading the "Phase 8 scope reminder" block at the bottom of the SKILL; the numbers are referenced from outside this repo.

---

## Editing checklist (use when changing skills or schemas)

When you change anything in this repo, walk this list before declaring done:

1. **Schema change?** → SKILL section that writes that file updated? `cli/src/commands/init.js` scaffold updated? Generators (`design-md-generator.js`, `brand-context-generator.js`) updated? If `manifest.schema.json`: both manifest goldens regenerated AND `cli/test/fixtures/stage-data/*.json` payloads updated AND `score.js` v1-rejection still in place? If `mcp-fallback-contract.json`: contract validator schema bumped if shape changed; SKILL §0.5 + Stages 1/2/3 still mirror the chain order?
2. **SKILL change?** → README "How the pipeline works" table or "Three slash commands" list still accurate?
3. **CLI change?** → Inline-fallback instructions in the corresponding SKILL section still match the CLI's behavior?
4. **New file in `.brand/`?** → Overwrite policy declared in the SKILL? Init scaffolding writes a placeholder?
5. **Version bumped?** → All ten places per the "Versioning + release" inventory above? Easiest verification: `grep -rn "<old-version>" --include="*.json" --include="*.js" .` should return zero hits outside `docs/superpowers/`.
6. **XD residue introduced?** → Re-read your diff for XD-specific framing or vocabulary; rewrite to general-purpose.

---

## Where to find what

| Need | File |
|---|---|
| What the project does, install, end-user usage | `README.md` |
| Why the project is shaped this way (architectural rationale) | `docs/DESIGN.md` |
| XD-assumption inventory and de-coupling targets | `docs/xd-assumption-inventory.md` |
| Peer tool research (dembrandt, design-oracle, Agent-Reach) | `docs/research-notes.md` |
| Active and candidate task list, sequencing, cross-task contracts | `docs/tasks.md` |
| Per-`.brand/`-file schemas | `schema/brand/*.schema.md` |
| Slash-command behavior and pipeline stages | `brand-context/skills/*/SKILL.md` |

---

## What this file is not

- Not the README. Don't restate what `README.md` says.
- Not `brand.md`. That's per-project brand context loaded by AI agents at runtime; this file guides editing the tool itself.
- Not a roadmap. The README has the user-facing roadmap; `docs/tasks.md` has the active engineering backlog.
