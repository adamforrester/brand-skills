# Design — Prism3 engine alignment (type-role vocabulary, colour-role contract, `x-prism3` block)

**Status:** draft — awaiting approval
**Closes on land:** `design.md` output speaks one vocabulary with the Prism3 generation engine — type roles renamed to the engine's semantic set, the colour-role naming contract documented (incl. the `error`→`danger` bridge), and an optional namespaced `x-prism3:` frontmatter block for engine-only levers.
**Manifest schema impact:** none (no new `.brand/` file; no manifest/health/tier changes).
**Back-compat stance:** additive + non-breaking. `design.md` stays spec-conformant (base `google-labs-code/design.md` unchanged); the `x-prism3` block is optional and ignored by non-Prism3 consumers per the spec's unknown-key rule. Existing `.brand/` packages with custom token names keep working (custom names remain allowed).

---

## 1. Why

`brand-skills` **describes** a brand (observed tokens + rich prose); the Prism3 engine **generates** a complete, contrast-verified, moded token system from a few anchors. They connect through **one shared interchange format — `google-labs-code/design.md`** (Prism3 docs/07 §11). For the bridge to be deterministic, both tools must speak the same vocabulary. This spec is derived from the **Wendy's spike** (Prism3 `engine/wendys-fidelity-report.md`), which ran a real `brand-skills` `design.md` through the engine and confirmed exactly where the vocabularies diverge.

`brand-skills` stays **standalone-complete** — a user who never touches the engine still gets a usable `design.md`. This is a *naming + optional-extension* alignment, not a rearchitecture, and it does not strip any descriptive output.

## 2. Spike findings that drive this (evidence)

From `engine/wendys-fidelity-report.md` §6:

- **Type roles:** the engine's semantic set is `display / title / body / label / caption / eyebrow / code`. Observed brand names (`mega-*`, `button-*`) and this repo's current *recommended* set (`headline-display` / `headline-lg` / `headline-md` / `body-*` / `label-*`) both diverge. `body-*` and `label-*` already align; `headline-*` splits into `display-*` (hero/marketing) + `title-*` (UI headings), and `caption`/`eyebrow`/`code` are missing.
- **Colour roles:** this repo's colour naming (`primary` / `secondary` / `tertiary` / `neutral-<step>` / `success` / `warning` / `error` / `info`) **already matches** the engine's classifier convention. The only bridge is that the engine's internal status role is `danger`; it reads `error` and renames it. So colour needs **documentation, not a rename** — `error` stays (it is the DTCG/design.md semantic name).
- **Engine-only levers** (`radiusScale`, `typeScale`, motion tempo, `density`, `actionPalette`, surface overrides, `iconContrast`, gradients) have no home in the base spec. The engine wants them optional, additive, and namespaced (Prism3 §11.4).

## 3. Changes

### 3a. Type-role vocabulary — align, not map (decision: replace)

Move the **recommended** typography token names to the engine's semantic set:

| Role | Meaning | Sizes (t-shirt suffix) |
|---|---|---|
| `display-*` | Hero / marketing headlines | `-xl … -sm` |
| `title-*` | UI headings (H1–H5), component titles | `-lg … -xs` |
| `body-*` | Reading / UI prose | `-lg / -md / -sm` |
| `label-*` | Buttons, form labels, dense UI text | `-lg / -md / -sm` |
| `caption-*` | Metadata, helper text, fine print | `-lg / -sm` |
| `eyebrow` | Over-line kicker above a title | (single) |
| `code` | Monospace / tabular | (single) |

- `headline-*` is retired from the recommended set (`headline-display`→`display-*`, `headline-lg`/`headline-md`→`title-*`/`display-*`).
- **Custom names remain allowed.** The SKILL's normalize step gains mapping guidance for common observed names: `mega-*`→`display-*` (top rungs), `button-*`→`label-*`, `headline-*`→`display-*`/`title-*`.
- The Typography object shape is **unchanged** (`fontFamily` / `fontSize` / `fontWeight` / `lineHeight` / `letterSpacing` / …).

**Edit sites:** `schema/brand/tokens-typography.schema.md` (recommended-names line + the two frontmatter examples); `brand-context/skills/brand-extract/SKILL.md` §Stage-1 categorize/normalize; `cli/src/commands/init.js` `TOKEN_FRONTMATTER['tokens/typography.md']`.

### 3b. Colour-role contract — document the convention + `error`→`danger` bridge

No rename. Add to `schema/brand/tokens-colors.schema.md` an explicit **interchange contract** note: the naming convention a Prism3-aware consumer reads (`primary` / `secondary` / `tertiary` / `neutral-<step>` / `success` / `warning` / `error` / `info`), that scale/state variants (`primary-dark`, `primary-50`) are descriptive ramp points the engine regenerates, and that the engine maps `error` → its internal `danger` role (so keep emitting `error`).

**Edit sites:** `schema/brand/tokens-colors.schema.md` (recommended-set note); a one-line pointer in the SKILL colour categorize step.

### 3c. Optional `x-prism3:` engine-levers block (decision: passthrough via `surfaces.md`)

Add an **optional, hand-authored** `x-prism3` frontmatter block, hosted in `.brand/tokens/surfaces.md` (already the "rendering/shape" token file feeding `rounded` + `elevation`). `refresh-design` reads it and emits it as a **top-level `x-prism3`** key in `design.md`. Non-Prism3 consumers ignore it (spec unknown-key rule); the engine consumes it for full control.

Recognised levers (all optional; a plain file with no block compiles on engine defaults):

```yaml
x-prism3:
  radiusScale: 2          # 0 sharp … 1 default … 2 soft
  typeScale: expressive   # compact | default | expressive
  density: comfortable    # comfortable | compact
  motionTempo: standard   # snappy | standard | relaxed
  actionPalette: primary  # which palette drives interactive colour
  iconContrast: text      # text | "3:1"
  surfaces: { light: { base: 50 } }   # non-white page → moves the contrast floor
  gradients: false        # opt-in; true or an explicit list
```

- **Scoring-neutral:** no new `.brand/` file, so no manifest/health/tier/scaffold ripple. It rides in `surfaces.md`, which is already scored.
- **Write policy:** practitioner-owned/additive — `refresh-design` only *reads* it; it is never auto-generated or overwritten.
- **Passthrough only:** `brand-skills` does not validate lever values (the engine's `theme-schema.json` is the authority); it copies the block verbatim so a plain-spec file stays plain.

**Edit sites:** `cli/src/utils/design-md-generator.js` (read `x-prism3` from `surfaces.md`, emit top-level); `schema/brand/tokens-surfaces.schema.md` (document the block); `brand-context/skills/brand-extract/SKILL.md` §8 merge list + a surfaces-stage note; `cli/src/commands/init.js` surfaces scaffold (commented example); new `cli/test/unit/design-md-generator.test.js` (passthrough coverage).

## 4. Non-goals

- No version bump (release cadence is being decided — CLAUDE.md).
- No new `.brand/` file, no manifest/health schema change.
- No change to the base `design.md` frontmatter keys (`version` / `name` / `colors` / `typography` / `rounded` / `spacing` / `elevation`) — `x-prism3` is additive.
- `brand-skills` does not adopt the engine's OKLCH generation, contrast contracts, or ramp regeneration — it stays descriptive; the engine owns generation.

## 5. Test plan

- `npm test` stays green (159 → +N). Existing `style-guide-generator.test.js` fixtures (`body-md`, `display-lg`, `primary-500`, `neutral-900`) already use engine-aligned names — no breakage.
- New `design-md-generator.test.js`: (a) frontmatter passes token blocks through; (b) an `x-prism3` block in `surfaces.md` frontmatter surfaces as a top-level `x-prism3` key in `design.md`; (c) absence of the block yields no `x-prism3` key (plain-spec files stay plain).
- SKILL↔CLI parity: §8 fallback prose gains `x-prism3` in the merge list so the inline path matches the CLI.

## 6. Rollout

Single PR on the integration branch. The Prism3 side already consumes this (the spike's `standard-design-md.ts` + `classify-colors.ts`); once this lands, a `brand-skills`-produced `design.md` — with or without `x-prism3` — feeds the engine with no converter.
