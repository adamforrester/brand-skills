# Design — `industry` signal injection (transparent soft prior for Stages 3 + 4)

**Status:** approved 2026-06-15 (brainstorm complete; ready for implementation plan)
**Tasks closed on land:** [#5](../../tasks.md)
**Tasks unblocked on land:** none
**Manifest schema impact:** none (no schema bump required)

This spec adds an optional `industry` field to `.brandrc.yaml` and `.brand/.scope.json`. When set, it acts as a soft tie-breaker prior on inference inside Stages 3 (voice extraction) and 4 (overview synthesis), with every prior-influenced claim cited inline. When absent, behavior is identical to today.

The cross-task contract from #4 set this up: `scope.schema.json` already has `additionalProperties: false` at the top level, so adding `industry` is a one-line schema append. The merge utility (`cli/src/utils/scope-merge.js`) is already generic and recursive, so the new field round-trips without code changes.

---

## 1. Field shape and location

### `.brandrc.yaml`

`industry` is a **top-level sibling** of `client`, `tier`, `mode` — descriptive metadata about the brand, not a source URL. Free-form string. Optional. Example:

```yaml
client: ACME Corp
tier: standard
mode: standard
industry: B2B SaaS analytics
sources:
  website: https://acme.example.com
  ...
```

Why top-level (not under `sources:` or a new `context:` block):
- It's not a source like website/figma — it's a hint about the brand.
- A new `context:` block to hold one field is YAGNI.
- Top-level matches the scope schema's existing shape; the cross-task contract from #4 anticipated exactly this placement.

### `.brand/.scope.json`

Same shape. Hosts pre-fill it via the same scope-merge path that handles every other field. Existing brandrc-wins-on-conflict rule applies unchanged.

```json
{
  "client": "ACME Corp",
  "tier": "standard",
  "industry": "B2B SaaS analytics",
  "sources": { "website": "https://acme.example.com" },
  "interactive_preflight": false
}
```

### "Empty" semantics (already implemented in `scope-merge.js`)

| Brandrc state | Treated as |
|---|---|
| Key missing | empty (scope fills) |
| `industry: ''` (empty string) | empty (scope fills) |
| `industry: null` | empty (scope fills) |
| `industry: "any non-empty string"` | set (brandrc wins; scope value logged as a §0e conflict if different) |

The existing `isEmpty()` rule in `cli/src/utils/scope-merge.js` already handles strings this way. No code change.

---

## 2. Schema layer

### `schema/brand/scope.schema.json` — one-line append

Inside the top-level `properties` object, alongside `client` / `tier` / `mode`:

```json
"industry": {
  "description": "Free-form descriptive prior (e.g. 'fast-food QSR', 'B2B SaaS analytics', 'luxury fashion ecommerce'). Stages 3 + 4 use it as a soft tie-breaker on inference and cite it inline. Mirrored field in .brandrc.yaml; same shape.",
  "type": "string",
  "minLength": 1
}
```

**`additionalProperties: false`** at top level (already in place) accepts this exact key. No nested objects introduced. No `industry` field is added under `sources`.

### Other schemas — unchanged

- `schema/manifest.schema.json` — `industry` is configuration, not stage-execution data. Nothing belongs in the manifest.
- `schema/health.schema.json` — same.
- `schema/brand/voice.schema.md`, `schema/brand/overview.schema.md` — these schemas describe shapes, not provenance markers. The `industry context:` citation is inline prose, not a structured field. The parity test (Section 4) is the guard that the citation marker is documented.

### `schema/brand/README.md`

If it enumerates scope-payload fields, add a one-line entry. If it doesn't, no change.

---

## 3. SKILL prose (`brand-context/skills/brand-extract/SKILL.md`)

Three additive blocks. No section is moved or restructured.

### Edit 1 — §0a (Read existing config)

After the existing sentence "Note `client`, `tier`, `mode`, and any `sources.*` already populated…", add:

> Also note `industry` if present (free-form string, e.g. "fast-food QSR", "B2B SaaS analytics"). When set, Stages 3 and 4 use it as a soft tie-breaker prior on inference. When absent, behavior is identical to today.

### Edit 2 — §4c (Stage 3 Inference)

Append at the end of the existing inference list (after the "Channel deltas" bullet):

> - **Industry prior (optional, soft tie-breaker).** If `.brandrc.yaml` has `industry` set, treat it as a tie-breaker on inference choices when the evidence is roughly balanced — for example, choosing between "clinical-but-warm" and "clinical-but-cold" when sample counts and tone signals are even. The prior may NOT lower the ≥3-supporting-samples-per-attribute threshold from §4d, NOR the <10-total-samples threshold from §4e, NOR invent claims that have no sample support. When the prior actually influenced a claim, cite it inline with `*(industry context: <value>)*` after the claim's other citations. When `industry` is unset, this bullet is a no-op.
>
> Example. Samples are split 4-and-4 between "playful" and "wry" as candidate voice attributes; both clear the threshold. With `industry: "fast-food QSR"`, the prior breaks the tie toward "playful". The voice.md entry reads: `**playful** *(MEDIUM — 8 samples)* — short irreverent CTAs and emoji in social posts *(industry context: fast-food QSR)*`. Without the prior, the SKILL would pick whichever the corpus narrowly favored or surface both as candidates.

### Edit 3 — §6b (Stage 4 Extract per overview.md schema)

After the existing "Anchor every claim in specific source material…" sentence, add:

> **Industry prior (optional, soft tie-breaker).** When `.brandrc.yaml` has `industry` set, the same soft-prior rule from §4c applies to the **Brand Personality**, **Audience**, and **Competitive Context** subsections — and only those. Visual Language and the brand self-test are evidence-only (screenshots and the guide's stated rules). When the prior influenced a claim, append `*(industry context: <value>)*` after the claim's other citations. The prior never overrides an explicit guide statement; it only disambiguates close calls grounded in evidence.

### No changes to

- §0a.5 (scope merge) — generic merge handles the new field automatically.
- §0c–§0e — `industry` doesn't gate any prompt or rescan.
- §0.5 (pre-flight dependency check) — orthogonal.
- §0a.5 embedded-mode bail — `industry` is not a required field. Embedded mode does not require it.
- Stages 1, 2, 5, 6, 8 — the prior is scoped to inference-bearing prose stages only.

### Why scoped to Personality / Audience / Competitive Context (Stage 4)

- **Brand Personality** — adjective selection often involves close calls between adjacent traits ("witty" vs. "wry", "warm" vs. "approachable"). Industry context legitimately disambiguates.
- **Audience** — "who do we serve" descriptions benefit from category framing ("enterprise IT buyers" vs. "individual developers") when guide language is loose.
- **Competitive Context** — "avoid resemblance to" calls out specific peers; industry context narrows the relevant peer set.
- **Visual Language** — must stay evidence-only. Screenshots and the guide's stated visual rules are concrete; a prior here would substitute taste for evidence.
- **Brand self-test** — generated from the other sections; inherits their priors transitively but emits no new prior-influenced claims of its own.

---

## 4. Test layer

### Extend `cli/test/unit/skill-scope-parity.test.js` (+3 assertions; 5 → 8 tests)

1. SKILL prose mentions the `industry` field by name. `assert.ok(skill.includes('industry'))`.
2. SKILL prose contains the `industry context:` citation marker literal. Greppable string is `industry context:`.
3. SKILL prose explains the soft-prior tie-breaker rule, not a hard heuristic. Match `tie-breaker` or `tie breaker` (case-insensitive); the assertion is "the SKILL doesn't allow inference without evidence."

### Extend `cli/test/unit/scope-merge.test.js` (+1 assertion; 5 → 6 tests)

4. `industry` round-trips through merge as a top-level string. Calls `mergeScopeIntoBrandrc({ industry: 'fast-food QSR' }, {})` and asserts:
   - `merged.industry === 'fast-food QSR'`
   - `filledFromScope.has('industry')`
   - No conflicts.

### Not added

- New scope fixtures. The existing three (`full.scope.json`, `partial.scope.json`, `invalid.scope.json`) stay as-is. Adding `industry` to `full.scope.json` would force regenerating the integration roundtrip golden; the unit test in `scope-merge.test.js` covers what the parity test doesn't.
- New CLI integration test. `brand-cli scope --validate` already exercises ajv schema validation; the schema's strict-mode compile is the guard.
- Runtime SKILL behavior tests. Inference behavior can't be driven from `node:test`; the parity assertions are the prose-drift guard.

### Test count target

108 → 112 (+4). Same delta size as the lighter-weight parts of #4.

---

## 5. CLI layer — no code changes

- `cli/src/utils/scope-merge.js` — already generic and recursive. `industry` round-trips with no diff.
- `cli/src/utils/scope-loader.js` — schema validates the new key automatically once the schema is updated.
- `cli/src/commands/scope.js` — same.
- `cli/src/commands/init.js` — `industry` is **omitted** from the brandrc scaffold. Practitioners add it by hand if they want it; embedded hosts add it via `.scope.json`. The omit-rather-than-empty-string choice matches how `init` already treats `sources.*` (writes `sources: {}` rather than enumerated empty keys).
- `cli/bin/brand-cli.js` — no new subcommand; no registration change.
- `cli/src/utils/brand-context-generator.js`, `cli/src/utils/design-md-generator.js` — unchanged. Surfacing `industry` in `brand.md` is a candidate follow-up, not part of this spec.

---

## 6. Docs layer

- `CLAUDE.md` "File-write policies" table — no change (`.brandrc.yaml` and `.scope.json` policies don't shift).
- `CLAUDE.md` editing checklist — no change.
- `README.md` — if the "How the pipeline works" section is structured by stage, add a one-line note alongside Stage 3 that `industry` is an optional descriptive field used as a soft prior. Otherwise, add it to whichever pipeline overview lists `.brandrc.yaml` fields.
- `docs/DESIGN.md` — no change. The architectural shape doesn't move.
- `docs/tasks.md` — mark #5 complete on land. No active backlog re-shuffle needed; #8 (DTCG token export) remains the next available item.

---

## 7. Error handling + edge cases

| Case | Behavior |
|---|---|
| `industry` absent (no key, `""`, `null`) | Identical to today. Stage 3/4 don't emit any `industry context:` citation. The new prose bullets are no-ops. |
| `industry` present in `.scope.json` with wrong type (number, array) | Schema rejects with ajv error text at §0a.5; SKILL bails red, exits 1. Doesn't delete `.scope.json` (precedent: `§0a.5` invariants). |
| `industry` present in `.brandrc.yaml` with wrong type | Brandrc is loose YAML; type is not validated today. SKILL passes whatever it read into the citation literal — practitioner-visible garbage, no crash. Acceptable. |
| `industry` very long (e.g. 500 chars) | No length cap. Citation renders long but doesn't break anything. Schema's `minLength: 1` only — no `maxLength`. |
| `industry` set in `.scope.json` AND in `.brandrc.yaml` (different values) | Existing brandrc-wins rule fires. Conflict logged in §0e as today. No new code. |
| Stage 3 has <10 samples (sparse-corpus path per §4e) | Prior must NOT activate. SKILL prose makes this explicit ("may NOT lower the <10-total-samples threshold"). |
| Stage 3 has fewer than 3 samples for any candidate attribute | Prior must NOT activate for that attribute. Threshold is preserved. |
| Stage 4 has only screenshots, no PDF | Prior may activate on Personality / Audience / Competitive Context as long as evidence supports the close call. Visual Language stays evidence-only regardless. |
| `industry` value is implausible/nonsense (e.g. "asdf") | SKILL treats it as a useless prior — no tie meaningfully breaks. No claims get an `industry context:` citation because none were influenced. Practitioner-visible: the brandrc field was filled with nonsense, no harm done. |
| `industry` is empty-string `""` after merge | Treated as unset by `isEmpty()`. New bullets are no-ops. |
| Pitch mode (`mode: pitch`) + `industry` set | No special interaction. The pitch-mode confidence cap from §4d still applies; the prior still activates as a tie-breaker within MEDIUM/LOW claims. Citation rendered as usual. |
| Practitioner removes `industry` between runs | Stage 3/4 stop citing it. Already-written voice.md / overview.md retain prior runs' citations until the next regeneration overwrites them. (Stage 3 owns only its observed-voice section per §4f; prescriptive sections preserved.) |

---

## 8. Considered alternatives (rejected)

Recorded so future readers don't relitigate.

### Closed enum of industries
**Rejected.** Closed taxonomies are always wrong for some brand. Maintaining the list adds schema bumps for every new sector. Contradicts the de-XD posture of avoiding closed enums where free-form fits.

### `industry` + separate `archetype: <enum>`
**Rejected.** Two fields, two layers to test. The free-form string already accommodates archetype-style shorthand ("Modern SaaS", "QSR fast-food") for practitioners who want it. YAGNI.

### Hard heuristic switches per industry
**Rejected.** "qsr" → activates a food-photography check; "saas" → activates a jargon-density rule. Requires a closed taxonomy under the hood; contradicts the free-form-string choice. Wrong fit.

### Annotation-only (no inference effect)
**Rejected.** The schema-change cost is non-zero; if the field doesn't influence anything, consumers may as well read brandrc directly. The whole point of the field is to make inference better in the close-call cases.

### `brand-cli init` prompts for `industry` interactively
**Rejected.** Adds friction for every new project. The field is optional; lots of brands genuinely don't need it. Practitioners who want it can add it post-init.

### Surface `industry` in `brand.md` (Approach B from brainstorm)
**Punted to candidate follow-up.** A 2-line addition to `cli/src/utils/brand-context-generator.js` if practitioners ask for the field to flow into the dense agent-context artifact. Not load-bearing for #5; expanding scope here delays landing.

### Industry reference doc cataloging examples (Approach C)
**Rejected.** Re-introduces the closed-taxonomy maintenance the free-form choice was meant to avoid. The SKILL's worked example in §4c is sufficient.

### Manifest schema bump to record industry
**Rejected.** `industry` is configuration, not stage-execution data. Nothing belongs in `manifest.json`. A future bump can add it if hosts ask, but no host has.

### Length cap (`maxLength: 200`) on `industry`
**Rejected.** No concrete failure mode. Ajv's `minLength: 1` is enough.

### `industry` flowing into Stage 4 Visual Language
**Rejected.** Visual Language must stay anchored in screenshots and the guide's stated visual rules. A prior here would substitute taste for evidence — exactly the failure mode the soft-prior contract is designed to prevent.

### Hard requirement: `industry` must be set when `interactive_preflight: false`
**Rejected.** The signal is a hint, not a pipeline input. Embedded hosts that don't have an industry classifier shouldn't be blocked. The §0a.5 bail rule stays as-is.

---

## 9. Out of scope

- Surfacing `industry` in `brand.md` or `design.md`.
- Manifest schema bump (no per-stage state changes).
- Industry-specific reference docs / heuristic prose.
- Closed-enum constraint on the value.
- Localized industry taxonomies.
- Tests that drive runtime SKILL inference behavior.
- A `brand-cli industry --set <value>` CLI subcommand. Practitioners edit `.brandrc.yaml` directly.

---

## 10. Three-layer propagation summary (per CLAUDE.md editing checklist)

| Layer | Files | Change |
|---|---|---|
| Schema | `schema/brand/scope.schema.json` | One-line `industry` property append |
| Schema | `schema/brand/README.md` | One-line entry if it enumerates scope fields; else no change |
| SKILL | `brand-context/skills/brand-extract/SKILL.md` | §0a, §4c, §6b — three additive blocks |
| CLI | (none) | No code changes |
| Test | `cli/test/unit/skill-scope-parity.test.js` | +3 assertions |
| Test | `cli/test/unit/scope-merge.test.js` | +1 assertion |
| Docs | `README.md` | One-line pipeline note |
| Docs | `docs/tasks.md` | Mark #5 complete on land |
| Docs | This spec + the implementation plan | New files |

Total: 1 schema diff, 1 SKILL diff (three sub-edits), 2 test-file diffs, ~2 docs diffs. No new files except the spec/plan/progress docs themselves.
