# Design — Visual Style Guide (HTML synthesis)

**Status:** draft — awaiting approval
**Closes on land:** new optional artifact alongside `design.md` and `brand.md`
**Manifest schema impact:** none (manifest stays v2; this is a new generated artifact at project root, not a `.brand/`-side file)
**Back-compat stance:** new feature; no migration required

This spec adds a third project-root artifact: `style-guide.html`, a single self-contained HTML file that visually represents the brand synthesis from `.brand/`. It complements `design.md` (the spec-compliant text artifact) and `brand.md` (the dense AI-agent context dump) — same source data, different audience: designers, PMs, and stakeholders who'd rather scan than read.

The premise: `.brand/tokens/*.md` already has YAML frontmatter with the brand's actual color, typography, spacing, and surface values. Rendering those values into a styled HTML page is mechanical and deterministic. The output is a polished page anyone can open in a browser without running any toolchain.

---

## 1. The artifact

### 1a. File shape

- **Path:** `./style-guide.html` at project root.
- **Sibling of:** `design.md`, `brand.md`, `.brandrc.yaml`.
- **Format:** single self-contained HTML5 document. All CSS inlined in `<style>`. No `<script>` tags. No external `<link>` resources. No fonts loaded over the network. Opens locally with `open style-guide.html`; copyable to any host as one file.
- **Size:** approximately 5–15 KB rendered output (depends on `.brand/` content density).
- **Encoding:** UTF-8 with `<meta charset="utf-8">`.

### 1b. File-write policy (additions to the CLAUDE.md table)

| File | Policy | Why |
|---|---|---|
| `style-guide.html` | **Overwrite wholesale** every regen | Generated artifact; source of truth is `.brand/`. Mirrors `design.md` / `brand.md`. |

The file is **never read** by the SKILL or CLI as a source of truth. Hand-edits do not survive a regen — same contract as `design.md` / `brand.md`.

### 1c. When it's generated

`brand-cli refresh-design` writes both `design.md` and `style-guide.html` in one pass. No new CLI subcommand. No new flags. Existing `--brand-path`, `--json` flags apply to both outputs.

`brand-cli init` does **not** scaffold an empty `style-guide.html`. The file lands the first time `refresh-design` runs after init. (`init` already runs `refresh-design` implicitly when scaffolding `brand.md` and `design.md`, so the file appears at end of `brand-cli init` for any new project. See [§5b](#5b-init-flow-implication).)

[D1 locked.]

---

## 2. Page structure

Long-scroll, top-to-bottom, single-column layout. Sections render in this order; each is conditional on its source data being present (see [§4](#4-empty-state-handling)).

### 2a. Active-conflicts banner (top, conditional)

Renders only when `.brand/conflicts.md` has at least one entry under the "Active Conflicts" heading. Small yellow alert bar:

```
⚠ N active conflicts — see conflicts.md
```

Where `N` is the count of Active Conflicts entries. Banner is suppressed when the count is zero or when `conflicts.md` is absent / placeholder.

### 2b. Brand identity header

Always renders. Sources:

- **Brand name** (large `<h1>`): from `.brandrc.yaml` `brand` field via the brandrc-loader (`client` accepted as deprecated alias per de-XD branch).
- **Tagline / positioning paragraph** (subtitle below the `<h1>`): first paragraph from `.brand/overview.md` Identity section. When the section is empty or the file is a placeholder, the subtitle reads `"<no brand identity captured yet — run /brand-context:extract>"` in muted text. (Empty-state pattern per [§4](#4-empty-state-handling).)

### 2c. Colors

Grouped swatch grid. Each swatch renders as:
- A colored block (square; ~80px on desktop, ~60px on mobile)
- Token name below (monospace, e.g. `primary-500`)
- Color value (hex / rgb / hsl as declared in frontmatter)

Grouping inferred from frontmatter key prefixes: tokens whose names share a prefix (e.g. `primary-100`, `primary-300`, `primary-500`) group under that prefix as a section header. Tokens without a recognizable prefix group under "Other".

Reads `.brand/tokens/colors.md` frontmatter `colors:` block. Empty-state callout when no real values exist (the placeholder frontmatter from init has all entries commented out; the empty-state detection [§4](#4-empty-state-handling) treats this as no-data).

### 2d. Typography

Type ramp. Each typography token renders as:
- A line of sample text at the token's declared `fontSize`, `fontWeight`, `fontFamily`, `lineHeight`
- Sample text default: `"The quick brown fox jumps over the lazy dog."`
- Token name + numeric values displayed alongside (smaller, muted)

Reads `.brand/tokens/typography.md` frontmatter `typography:` block. The font family declared in the token is used as-is — no font-loading. If the user's system doesn't have it, the browser falls back to its own default. (Document this in the page footer — see [§2h](#2h-footer).)

### 2e. Spacing (when present)

Spacing scale rendered as colored bars. Each bar:
- Width matches the token value (with a max of ~400px for readability)
- Token name and value rendered below the bar

Reads `.brand/tokens/spacing.md` frontmatter `spacing:` block. Section is skipped silently when no real values exist (per [D4]).

### 2f. Surfaces (when present)

Two small visual sub-grids:
- **Rounded:** small boxes demonstrating each `rounded` token's `border-radius` value.
- **Elevation:** small boxes demonstrating each `elevation` token's `box-shadow` value.

Reads `.brand/tokens/surfaces.md` frontmatter `rounded:` and `elevation:` blocks. Section is skipped silently when both blocks are empty (per [D4]).

### 2g. Voice (when present)

Two to three pull-quotes from `.brand/voice.md` "Observed Voice (live channels)" section. Each quote renders as a styled `<blockquote>` with a left border accent and slightly larger italic text.

Selection rule: parse the Observed Voice section, extract any markdown blockquote (`> "..."`), pick the first three by document order. If fewer than three quotes are present, render whatever exists. If the Observed Voice section is empty or absent, omit the section entirely.

### 2h. Footer

Always renders at bottom:

- Generation timestamp (ISO-8601 datetime).
- Generator string (e.g. `brand-cli@0.4.0`).
- Source-file pointers: short text noting "Source: `.brand/` directory; regenerate with `brand-cli refresh-design`."
- Font-loading caveat: "Typography samples use the brand's declared `fontFamily`. If your system doesn't have the font, your browser falls back to its default."

---

## 3. Visual styling (page chrome)

[D8 locked: neutral chrome.] The page wrapper is **brand-agnostic**. Brand values appear in the content samples (swatches, type ramp, voice quotes), not in the chrome.

### 3a. Chrome rules

- **Wrapper font:** `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`. Independent of the brand's typography tokens.
- **Background:** `#fafafa` (neutral light grey).
- **Page max-width:** `960px`, centered, padded `48px` on desktop / `24px` on mobile.
- **Borders:** `1px solid #e5e5e5` for any panel divisions.
- **Accent color (links, focus rings, etc.):** fixed neutral `#0066cc`. Does NOT pull from `tokens/colors.md`.
- **No JS.** No interactivity. The page is a static document.

### 3b. Why neutral chrome

A brand-tinted chrome would compete visually with the data being shown — the swatches, type ramp, and voice quotes carry the brand expression. Chrome sets the frame; samples carry the content. This also makes the guide visually consistent across every brand the tool generates, which helps users compare brands or audit multiple projects without the chrome distorting their perception.

A low-contrast brand or a brand missing tokens would also break a brand-tinted chrome. Neutral chrome is robust to incomplete `.brand/` state.

---

## 4. Empty-state handling

[D9 locked: render with "not yet extracted" callouts.] The file is always written when `refresh-design` runs. Sections with no real source data render a callout instead of being silently skipped — *except* spacing and surfaces, which are silently skipped per [D4].

### 4a. Empty-state detection

Per-section rules:

| Section | "Empty" definition |
|---|---|
| Brand identity (header) | Brand name from `.brandrc.yaml` is empty after loader normalization (loader defaults to `basename(projectDir)`, so this is rare); OR `overview.md` Identity section is missing / placeholder. |
| Colors | All entries in `tokens/colors.md` `colors:` frontmatter are commented out, missing, or have empty/null values. |
| Typography | All entries in `tokens/typography.md` `typography:` frontmatter are commented out, missing, or have empty/null values. |
| Spacing | Same — but section is silently skipped, not callout-rendered. |
| Surfaces | Same — silently skipped. |
| Voice | `voice.md` "Observed Voice (live channels)" section is missing or contains zero blockquotes. Section is silently skipped, not callout-rendered. |
| Conflicts banner | `conflicts.md` is missing OR Active Conflicts subsection is empty. Banner is silently suppressed. |

### 4b. Empty-state callout shape

For sections that DO callout (brand identity subtitle, colors, typography), the callout is a small grey box with a single line of muted italic text:

```
No <section name> extracted yet. Run /brand-context:extract.
```

Examples:
- `No brand identity captured yet. Run /brand-context:extract.`
- `No colors extracted yet. Run /brand-context:extract.`
- `No typography extracted yet. Run /brand-context:extract.`

### 4c. Why partial visibility

A first-time user opening the file immediately after `brand-cli init` will see a valid HTML page with their brand name and explicit "run extract" prompts under each empty section. This teaches the contract — the file is always live; running the extract pipeline populates it. The alternative (skipping the file or writing a single-line "run extract" placeholder) was rejected because it breaks the "sibling of design.md" mental model — design.md *also* renders skeletally for fresh projects.

---

## 5. Implementation

### 5a. New files

| Path | Purpose |
|---|---|
| `cli/src/utils/style-guide-generator.js` | `generateStyleGuide(brandDir, brand)` returns a self-contained HTML string. Pure function. No fs writes inside. No AI calls. |
| `cli/test/unit/style-guide-generator.test.js` | Unit tests for the generator (see [§6](#6-test-coverage)). |
| `cli/test/fixtures/style-guide/` | Test fixture `.brand/` directories: empty / colors-only / type-only / voice-only / full. |

### 5b. Modified files

| Path | Change |
|---|---|
| `cli/src/commands/refresh-design.js` | After writing `design.md`, call `generateStyleGuide(brandDir, brand)` and write `style-guide.html` to project root. Updates the `--json` output to include the new path. Updates the success log line. |
| `brand-context/skills/brand-extract/SKILL.md` | Stage 8 (design.md regen section) gets a parallel block describing the inline-fallback HTML construction. The block teaches Claude how to build the same HTML when `brand-cli` is absent — same pattern as the existing design.md / brand.md fallback prose. |
| `cli/test/unit/skill-scope-parity.test.js` | +1 parity test: SKILL Stage 8 mentions `style-guide.html` inline-fallback. |
| `CLAUDE.md` | Add `style-guide.html` to the file-write-policies table (per [§1b](#1b-file-write-policy-additions-to-the-claudemd-table)). Note in the architecture-3-layers section that the new generator follows the established generator pattern. |
| `README.md` | Quick-start adds a one-line note: "After `brand-cli refresh-design`, open `style-guide.html` in a browser to see the brand visualized." Pipeline-output list adds the new file. |
| `docs/tasks.md` | Move the visual-style-guide entry from candidates → completed on land. |
| `docs/DESIGN.md` | Brief mention of the new artifact in the architectural overview. |

### 5c. Generator contract

```js
// cli/src/utils/style-guide-generator.js
export function generateStyleGuide(brandDir, brand) {
  // Returns: a single self-contained HTML5 string (UTF-8).
  // Pure function. No fs side-effects.
  //
  // brandDir: absolute path to the .brand/ directory.
  // brand: the brand name (already normalized via brandrc-loader at call site).
}
```

The function reads source files synchronously via `fs.readFileSync`. Failure modes (missing files, malformed YAML frontmatter, malformed markdown sections) degrade silently to empty-state per [§4a](#4a-empty-state-detection) — the function never throws on bad source data.

### 5d. Refresh-design call-site change

After Task 2 of de-XD, `cli/src/commands/refresh-design.js` ends with:

```js
const content = generateDesignMd(brandDir, brand);
const outPath = join(projectDir, 'design.md');
writeFileSync(outPath, content, 'utf-8');
console.log(chalk.green(`✓ design.md regenerated from ${brandDir}`));
```

This becomes:

```js
const designContent = generateDesignMd(brandDir, brand);
const designPath = join(projectDir, 'design.md');
writeFileSync(designPath, designContent, 'utf-8');
console.log(chalk.green(`✓ design.md regenerated from ${brandDir}`));

const styleGuideContent = generateStyleGuide(brandDir, brand);
const styleGuidePath = join(projectDir, 'style-guide.html');
writeFileSync(styleGuidePath, styleGuideContent, 'utf-8');
console.log(chalk.green(`✓ style-guide.html regenerated from ${brandDir}`));
```

`--json` output gains a `style_guide` field alongside the existing `output` field:

```json
{ "ok": true, "brand_dir": "...", "output": "...design.md", "style_guide": "...style-guide.html", "brand": "..." }
```

### 5e. SKILL inline-fallback prose

`brand-extract/SKILL.md` Stage 8 currently has prose describing how to regenerate `design.md` and `brand.md` inline when `brand-cli` is absent. A new sub-section is added covering `style-guide.html`. The prose teaches the structure (page chrome, section order, swatch shape, type ramp shape, etc.) and points at the generator file (`cli/src/utils/style-guide-generator.js`) as the canonical reference.

The fallback contract is byte-identical output for any given `.brand/` state. This is enforced by the unit tests (the generator's reference implementation defines what byte-identical means; the SKILL prose has to mirror it).

[D6 locked: full SKILL↔CLI parity.]

---

## 6. Test coverage

New tests in `cli/test/unit/style-guide-generator.test.js`:

1. **Header renders brand name from brandrc** — fixture with `brand: "ACME"` produces an HTML file containing `<h1>ACME</h1>` (or equivalent).
2. **Brand identity subtitle pulls from overview.md** — fixture with a populated Identity section renders the first paragraph in the subtitle.
3. **Brand identity subtitle empty-state callout** — fixture with empty `overview.md` renders the "No brand identity captured yet" callout.
4. **Colors section renders swatches when frontmatter is populated** — fixture with `colors: { primary-500: "#ff0000" }` produces HTML containing `#ff0000` and the token name.
5. **Colors section renders empty-state callout when frontmatter is placeholder** — fixture with all-commented `colors:` frontmatter renders the "No colors extracted yet" callout.
6. **Typography section renders type ramp when populated** — fixture with `typography: { body-md: { fontSize: "16px", ... } }` produces HTML containing the font-size value applied as inline CSS.
7. **Spacing section silently skipped when empty** — fixture with empty `spacing.md` produces HTML that does NOT contain a "Spacing" `<h2>` heading.
8. **Voice section renders pull-quotes** — fixture with three Observed Voice blockquotes renders all three as `<blockquote>` elements; fixture with zero blockquotes silently skips the section.
9. **Conflicts banner appears when Active Conflicts present** — fixture with two Active Conflicts entries renders the banner with `2 active conflicts`; fixture with zero Active Conflicts has no banner.
10. **Output is a single self-contained HTML document** — output starts with `<!DOCTYPE html>` (or `<html>`), contains exactly one `<style>` block, contains zero `<script>` tags, contains zero `<link rel="stylesheet">` or external `<script src=...>` references.
11. **Generator never throws on malformed YAML** — fixture with invalid YAML frontmatter still produces valid HTML (the section that reads from that file falls back to the empty-state callout).

Plus 1 SKILL parity test in `cli/test/unit/skill-scope-parity.test.js`:

12. **SKILL Stage 8 documents the style-guide.html inline-fallback** — assert `skill.includes('style-guide.html')` AND `skill` mentions some Stage-8 fallback context (matches the existing pattern for design.md / brand.md fallback prose).

Test count target: 132 → ~144 (+12).

---

## 7. Cross-cutting concerns

### 7a. The generator stays deterministic

No AI calls. No timestamps inside the rendered content (the timestamp lives in the footer and is set at write-time by `refresh-design.js`, not by the generator — this keeps the generator output deterministic for the same input, which makes byte-identical SKILL/CLI parity testable).

For unit tests, `refresh-design.js` writes the timestamp; the generator does not. Pass `now: Date` (or a fixed ISO string) into the call site rather than reading `Date.now()` inside the generator.

### 7b. No new dependencies

The generator uses Node built-ins (`fs`, `path`) and the existing `yaml` package. No HTML templating library. Hand-crafted template literals or a small `escapeHtml` helper. Same minimal-dependency posture as the rest of `cli/src/utils/`.

### 7c. The new artifact does NOT propagate via the `outputs:` field

[Out of scope.] The `outputs:` brandrc field added in the de-XD branch is for `brand.md` mirroring only. `style-guide.html` is conceptually different — it's a visual artifact, not an AI-agent context surface. Mixing them in one field would conflate two contracts.

If users want the HTML mirrored elsewhere (e.g. into a `docs/` site), they can copy it manually or wire it up in their own CI. A future feature could generalize, but YAGNI for v1.

### 7d. Manifest schema unchanged

The manifest at `.brand/manifest.json` records what `/brand-context:extract` did. `style-guide.html` is generated by `brand-cli refresh-design`, which is a separate command from `extract`. The manifest does not currently track the design.md or brand.md regen state either. Adding style-guide.html tracking would require a manifest schema change — out of scope for v1.

The SKILL Stage 8 fallback prose already runs `refresh-design` (or its inline equivalent) at the end of the pipeline; the new style-guide.html write happens implicitly there.

---

## 8. Out of scope (explicit non-goals)

- **Live component previews.** Rendering Figma exports or codebase components in the HTML is large-scope and ill-defined for a static file. v1 has no Components section; a future version could add a simple inventory table.
- **Per-brand chrome theming.** Locked to neutral chrome per [D8].
- **A separate `brand-cli build-style-guide` subcommand.** Auto-generated by `refresh-design` per [D1].
- **Mobile-first responsive design.** v1 is single-column at any width and is readable on mobile, but the design target is laptop / desktop scanning.
- **Print stylesheet.** The HTML prints reasonably, but no `@media print` rules are added. (Color swatches printing as solid blocks is a known limitation.)
- **Dark mode.** Single light theme for v1.
- **Internationalization.** Page chrome strings are English-only.
- **Accessibility audit.** v1 emits semantic HTML (`<h1>`, `<h2>`, `<blockquote>`, `<dl>` where appropriate) and includes alt-text equivalents for visual swatches (token name + value visible alongside the swatch). A formal a11y audit is a follow-up.

---

## 9. Decisions made during brainstorm (D-letter pattern)

[D1] **Auto-generated by `refresh-design`.** Not opt-in. Sibling of `design.md` / `brand.md`. Same overwrite policy.

[D2] **Path: `./style-guide.html` at project root.** Sibling of the existing root-level generated artifacts.

[D3] **Single self-contained HTML file.** All CSS inlined. No JS. No external assets.

[D4] **Core sections (always render when data present):** brand identity header, colors, typography, spacing, surfaces. Colors and typography render empty-state callouts when source data is empty; spacing and surfaces silently skip.

[D5] **Optional sections in v1:** voice samples + conflicts callout banner. Component inventory deferred.

[D6] **Full SKILL↔CLI parity.** New `cli/src/utils/style-guide-generator.js` is the canonical implementation; SKILL Stage 8 prose mirrors it for the no-CLI fallback path.

[D7] **Layout: long-scroll narrative.** Single column, top-to-bottom sections. Reads like a brand brief.

[D8] **Neutral page chrome.** Brand values appear only in content samples (swatches, type ramp, voice quotes), not in the page wrapper.

[D9] **Empty-state behavior:** render the file with "not yet extracted" callouts on Day 1 (immediately after `brand-cli init`). The file is always valid HTML; it just teaches the user what's missing.

---

## 10. Acceptance criteria

- `brand-cli refresh-design` on the brand-skills repo writes a valid `style-guide.html` at root that renders without errors in any modern browser (Chrome, Safari, Firefox).
- Opening the file with `open style-guide.html` displays:
  - The brand name in the header.
  - A populated identity subtitle (or the empty-state callout if `overview.md` is empty).
  - Color swatches matching `.brand/tokens/colors.md` (or the empty-state callout).
  - Type ramp matching `.brand/tokens/typography.md` (or the empty-state callout).
  - Spacing and surface sections when their source files are populated; silent skip otherwise.
  - Voice pull-quotes when `voice.md` Observed Voice section has blockquotes; silent skip otherwise.
  - The conflicts banner when `conflicts.md` has Active Conflicts; silent skip otherwise.
- A fresh `brand-cli init` followed by `brand-cli refresh-design` produces a valid HTML file showing the brand name in the header and "not yet extracted" callouts under empty sections.
- Both the CLI path (`brand-cli refresh-design`) and the SKILL inline-fallback path produce byte-identical HTML for the same `.brand/` state.
- `npm test` adds approximately 12 new tests; total goes from 132 → ~144.
- The output HTML file is a single document: `<!DOCTYPE html>`, exactly one `<style>` block, zero `<script>`, zero external resources.
- The generator function `generateStyleGuide(brandDir, brand)` is pure (no fs writes, no `Date.now()` reads, no AI calls); the timestamp in the page footer is supplied by the `refresh-design.js` call site.

---

## 11. Open questions for plan-writing

None. All decisions [D1]–[D9] are locked. Plan-writing can proceed.
