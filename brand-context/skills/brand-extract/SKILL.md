---
name: brand-extract
description: Extract a complete brand package from a client's Figma file, live website, social profiles, brand-guide PDF, reference screenshots, and (for comprehensive tier) design-system codebase — populating .brand/tokens/*.md, .brand/voice.md, .brand/overview.md, .brand/components/*.md, .brand/conflicts.md, and regenerating design.md and brand.md at the project root. Use when the user says "extract the brand", "/brand-extract", "build a brand package from these assets", "pull tokens from Figma", "analyze the voice", "summarize the brand from this PDF", "find brand conflicts", "scan the design system repo", or when starting a new project. Full pipeline: tokens, voice, overview, components (comprehensive tier), conflict detection, and project-root artifacts (design.md, brand.md) regenerated. Playwright MCP is recommended; without it the skill falls back to native WebFetch with degraded quality.
---

# /brand-context:extract — full pipeline

You are running the brand-extract skill end to end. The full pipeline writes/refreshes:

- `.brand/tokens/{colors,typography,spacing,surfaces}.md`
- `.brand/voice.md` (additive Stage 3)
- `.brand/overview.md`
- `.brand/components/*.md` + `.brand/components/inventory.md` (when `sources.design_system_repo` is set, any tier)
- `.brand/conflicts.md` (additive Stage 5)
- `design.md` (project root, [design.md spec](https://github.com/google-labs-code/design.md))
- `brand.md` (project root, dense brand context loaded by AI agents)

**Pipeline scope:** all stages — 1 through 6, plus Stage 8 (`.brand/` regeneration of project-root files). Stage 7 doesn't exist in this numbering (reserved historically; collapsed into Stage 6).

The full design reference lives at `https://github.com/adamforrester/brand-skills/blob/main/brand-context/skills/brand-extract/SKILL.md` (this file). Architectural overview in `docs/DESIGN.md`.

---

## 0. Pre-flight + source discovery

Discover sources by reading `.brandrc.yaml`, scanning the project for asset files dropped into a folder, and asking the practitioner conversationally for the rest. **Practitioners should never have to hand-edit `.brandrc.yaml`** — the skill walks them through everything and writes the file at the end.

### 0a. Read existing config

1. Confirm `.brandrc.yaml` exists at the project root. If not, run `brand-cli init` via `Bash` to scaffold it (it'll prompt for brand name and tier). If `brand-cli` is not available, write a minimal `.brandrc.yaml` inline using the YAML library or just `Write` with the right shape: `brand`, `tier: standard`, `mode: standard`, empty `sources:`.
2. Read the file. Note `brand` (with `client` accepted as a deprecated alias), `tier`, `mode`, and any `sources.*` already populated. Existing values are kept unless the practitioner explicitly says otherwise. Also note `industry` if present (free-form string, e.g. "fast-food QSR", "B2B SaaS analytics"). When set, Stages 3 and 4 use it as a soft tie-breaker prior on inference. When absent, behavior is identical to today.

### 0a.5. Read `.brand/.scope.json` (if present) and pre-fill brandrc

If `.brand/.scope.json` exists, the practitioner (or an embedded host) has pre-answered some or all of Stage 0d's discovery questions. Read the file once at the start of Stage 0, merge into the in-memory brandrc state, and delete the scope file after `§0e` writes the brandrc successfully.

**Read.** `Read` `.brand/.scope.json`. If absent: skip this entire subsection and continue to `§0b`. If present and malformed JSON: bail with a chalk-red error mentioning the file path; exit. If present and parses but fails schema validation: bail with the ajv error text; exit. (Practitioners can run `brand-cli scope --validate` to lint scope files before invoking the SKILL — see spec §4.)

**Merge.** Apply the merge rule from `cli/src/utils/scope-merge.js` (the canonical implementation). Per spec §1: brandrc wins on conflict; "empty" brandrc fields get pre-filled from scope; non-empty conflicts are recorded for `§0e` to surface as chalk-yellow log lines. The merge produces:
- An updated in-memory brandrc state (merged values).
- A `filledFromScope` set of dot-paths (e.g. `"client"`, `"sources.website"`, `"sources.social.twitter"`) — every brandrc key that scope filled. Stage 0c-0e read this set to skip conversational questions for already-populated fields.
- A `conflicts` array of `{field, scope_value, brandrc_value}` records for `§0e` to log.

When `brand-cli` is installed, prefer to invoke `cli/src/utils/scope-merge.js` indirectly via the scope-loader. When `brand-cli` is absent, read `.brand/.scope.json` directly and apply the same merge algorithm inline (the scope-merge utility's algorithm is documented in spec §3 — implement it in-prose by walking scope leaf-by-leaf, comparing each leaf against the corresponding brandrc value via the per-type "empty" rule from spec §1).

**Embedded-mode bail.** If the merged scope sets `interactive_preflight: false` (or the env var `BRAND_SKILLS_NONINTERACTIVE=1` is set — env wins on disagreement), check that all of these are present after the merge:
- `client` (non-empty string)
- `tier` (non-empty enum value)
- At least one of: `sources.website`, `sources.figma` (non-empty array), `sources.brand_guide`, `sources.screenshots` (non-empty array), `sources.design_system_repo`. `sources.social` and `sources.app_store` alone do **not** satisfy this — they're voice/copy supplements, not standalone pipeline inputs.

If any required field is empty, bail. Print a chalk-red one-line problem statement, then emit a JSON object to stderr for embedded host parsing:

```
.scope.json is missing required fields for embedded mode: <comma-separated field names>.
Add the missing fields and re-author .scope.json before dispatching the SKILL.
See docs/superpowers/specs/2026-06-14-scope-json-design.md §3.

{"error":"missing_required_fields","missing":["client","tier"],"hint":"<one-line hint>"}
```

Exit 1. **Do not delete the scope file** — the host needs it to fix and retry.

**Hold.** Pass `filledFromScope` and the merged brandrc state forward in memory. Don't write `.brandrc.yaml` yet — `§0e` does that after the rest of Stage 0 completes.

### 0b. Scan the project for asset files

Look for assets the practitioner may have dropped into the project. The scan order:

1. **`sources.asset_dir`** from `.brandrc.yaml` if set (e.g. `./brand-inputs/`).
2. **`./assets/`** — the default scaffold path.
3. **Legacy fallbacks** — checked only when neither (1) nor (2) yields any assets:
   - `./brand-assets/`
   - `./.brand-assets/`
   - `./inputs/`
   - `./sources/`
   - Project root (loose files only — be selective; ignore obvious code/config/dotfiles)

When `sources.asset_dir` is set, prefer it for the "drop your assets here" prompt and any rescan loops. The legacy fallback list is preserved for projects that never ran `brand-cli init` and have assets sitting in older conventional locations.

For each file found, classify by extension:
- **`.pdf`** → brand guide candidate. Read the **first page** with the `Read` tool (`pages: "1"`) to confirm. Brand-guide covers usually have the brand name + "Brand Guidelines" / "Brand Identity" / "Style Guide". A pitch deck or other PDF will look obviously different — categorize accordingly. Multiple PDFs are fine; pick the one that reads as a brand guide; treat the rest as supporting context (campaign decks, voice docs).
- **`.png`, `.jpg`, `.jpeg`, `.webp`, `.gif`** → reference screenshot. Cap at 10 — if more are present, pick the most descriptive filenames (e.g., `hero-desktop.png` > `IMG_2438.JPG`) or ask the practitioner which to prioritize.
- **`.svg`** → reference asset (often a logo or hero asset). Treat the same as a screenshot for Stage 4 input.
- **`.docx`, `.doc`, `.pptx`, `.ppt`, `.key`, `.numbers`** → noted but **not directly readable**. Surface to the practitioner: "Found `{filename}`. Word/PowerPoint/Keynote/Numbers files aren't natively readable. Either export to PDF and re-run, or paste the key sections into the chat." Do not block on these — proceed with everything else.
- **`.fig`** → unusual on disk; likely a Figma export. Ignore unless the practitioner mentions it.
- **`.txt`, `.md`** in an asset folder → may be a hand-written voice doc or notes. Read it; surface contents to the practitioner.

### 0c. Surface findings and confirm

**If `filledFromScope` (from `§0a.5`) contains `sources.brand_guide` or `sources.screenshots` AND `interactive_preflight: false`:** treat the corresponding asset entries as pre-confirmed. Skip the "sound good?" prompt for those entries; proceed silently. Asset rescan logic (Cases 2 + 3) still applies as today — pre-filled scope doesn't manifest files that don't exist on disk.

Three cases — handle each explicitly. **Don't silently skip the asset step** even when nothing is found; the drop-folder pattern is the primary intake mechanism, so it has to be visible to a practitioner who hasn't read the docs.

**Case 1: assets found.** Show what was discovered:

> Looking through your project, I found:
> - `assets/{filename}.pdf` — brand guide (cover reads "{brand} Brand Guidelines, 2024")
> - `assets/{filename}.pdf` — campaign deck, will use as supporting context
> - 3 reference screenshots in `assets/`: `homepage.png`, `hero.png`, `landing-mobile.png`
> - `assets/voice-rules.docx` — Word doc, not directly readable. Export to PDF if you want me to use it.
>
> I'll use these for Stage 4 (overview synthesis). Sound good, or should I skip any?

**Case 2: `./assets/` exists but is empty (or only contains the scaffold README).** Prompt explicitly:

> Your `./assets/` directory is empty. If you have **any** of these for {brand}, drop them in now — I'll wait:
> - Brand guide PDF
> - Style guide / voice doc PDF
> - Reference screenshots (homepage, key pages, hero shots)
> - Logo files (SVG or PNG)
>
> Word/PowerPoint/Keynote files aren't readable directly — export to PDF first.
>
> When you're done, say "ready" or "rescan" and I'll pick them up. Or say "skip assets" if you only have URLs to work from.

After "ready"/"rescan", re-run the scan from 0b. If still empty after the rescan, accept "skip assets" or a re-prompt. **Don't loop indefinitely** — after two rescans with nothing new, move on with whatever's available.

**Case 3: `./assets/` directory doesn't exist.** Offer to create it:

> I don't see an `./assets/` directory. I can create one for you to drop brand files into (PDFs, screenshots, logos) — or we can work from URLs only.
>
> Create the assets folder? (yes / skip)

If yes, `mkdir ./assets/` via Bash and write the same scaffold README that `brand-cli init` would. Then go to Case 2's prompt.

### 0d. Ask for non-file sources

**Pre-filled-from-scope fields:** for each question below, check whether the corresponding `sources.*` key is in `filledFromScope` (from `§0a.5`). If yes, skip the question silently — the value is already in the merged brandrc state. If `interactive_preflight: false` AND a required field (per `§0a.5` runtime requirements) is still empty, bail with the structured error from `§0a.5` rather than asking. Otherwise, ask conversationally.

These can't be discovered on disk. Ask conversationally — one question at a time, accept "skip" or empty as valid answers:

1. **Live website URL** — required for Stages 2 and 3 (token sampling, voice extraction). Skip is OK if the brand has no public web presence; the skill will run on PDF/screenshot inputs only.
2. **Figma file URL** — optional. Paste a URL like `https://figma.com/design/<fileKey>/...` and the skill extracts the file key. Skip if no Figma access.
3. **Social profiles** — optional. Twitter/X, Instagram, LinkedIn, Facebook, TikTok. Accept any combination. Skip if none.
4. **App store listings** — optional. iOS App Store and/or Google Play URLs. Skip if no app.
5. **Design-system repo** — local path or remote git URL. When set, Stage 6 produces `.brand/components/*.md` regardless of tier.

For each one, validate the answer minimally (URL looks like a URL; local path exists if given). Don't over-validate — bad URLs will surface as Stage failures with clear errors.

### 0e. Write the populated config

Update `.brandrc.yaml` with everything gathered. Use `Edit` (not `Write`) so any fields the practitioner had set manually are preserved — only add or update what we discovered.

After writing, show the final `sources:` block to the practitioner so they can confirm. If anything looks wrong, accept corrections inline and re-write the file.

**Conflicts from `§0a.5`:** for each entry in the `conflicts` array, surface a chalk-yellow log line:

> Note: scope provided `<field>: <scope_value>` but brandrc already had `<brandrc_value>`. Kept brandrc's value.

This is informational only — the merge already honored brandrc. No action needed.

**Delete `.brand/.scope.json` on success.** After the `Edit` to `.brandrc.yaml` completes successfully (Stage 0e writes through), delete `.brand/.scope.json` via `Bash rm` or the equivalent. The scope file is a one-shot input; subsequent runs use brandrc only. **Do NOT delete on failure** — if the brandrc write itself failed, the state is inconsistent and the host needs the scope file to retry. Failures earlier in `§0a.5` (parse, validation, embedded-mode bail) also do not delete.

### 0f. Detect available tools

Tool detection is now driven by the MCP-fallback contract — see §0.5 below.
This subsection is preserved as a pointer so the §0a–§0e numbering still
follows on naturally; do not duplicate the detection logic here.

## 0.5 Pre-flight dependency check (contract-driven)

The contract at `schema/mcp-fallback-contract.json` declares per-stage fallback
chains. Pre-flight check answers two questions before the pipeline runs:

1. **Per dependency: is it available?** Passive checks only (no active prompting):
   - `kind: mcp` — run `claude mcp list`; treat as available if name appears AND status is `connected`.
   - `kind: http` — best-effort GET against the endpoint root (Jina: `GET https://r.jina.ai/`); treat 2xx/3xx as available, anything else (including network unreachable) as unavailable. Skip the probe if the user is offline; record `available: false` silently.
   - `kind: user_artifact` — check the `expected_path_glob` (e.g., `assets/*.tokens.json`) on disk. Available if at least one matching file exists.
   - `kind: native_tool` — always available.

2. **Per stage: what's the resolved `fallback_decision`?** Walk the stage's `chain` top-to-bottom; the first available entry fires. Apply this rule to set the manifest fields the stage will emit:
   - **Pre-conditions fail** (e.g., `sources.figma` empty AND `dtcg-tokens-file` not present): `fallback_decision: "SKIP"`, `chain_entry_used: null`, `reason: "<which precondition unmet>"`. The chain itself was never asked to fire.
   - **Top-of-chain entry fired**: `fallback_decision: "none"`, `chain_entry_used: { kind, name, quality_label: "full" }`.
   - **Lower entry fired**: `fallback_decision: "DOWNGRADE"`, `chain_entry_used: { kind, name, quality_label: "degraded" }`.
   - **Chain exhausted, no native floor** (only stages 1 + 2 today): `fallback_decision: "SKIP"`, `chain_entry_used: null`.
   - **Chain has a `native_tool` floor** (stages 3 / 4 / 5 / 6 / 8): always reaches at least the native floor; never SKIP at chain-floor. Reserved verb `HALT` is not used by any stage today; it remains in the contract vocabulary for future stages that cannot proceed at all without a specific dependency.

Hold the resolved per-stage decisions in memory. They flow into the Section 10b manifest emission alongside `required_dependencies` (names from contract chain marked `quality_label: full`) and `available_dependencies` (names actually detected as available).

### 0.5a. Surface notices to the practitioner

For each stage where `fallback_decision ∈ {"SKIP", "DOWNGRADE"}` AND the stage's preconditions are met, surface a notice **before** asking "ready to proceed?" in §1 (scope confirmation). Templates use the contract's `install_hint`, `install_caveat`, `fidelity_note`, and `user_action_hint` fields.

**Stage 1 (figma-console missing AND no DTCG file, but `sources.figma` set):**

```
⚠ Stage 1 — Figma variable extraction will SKIP

Reason: Neither figma-console MCP nor a DTCG token export is available.
You provided sources.figma=<URL>, so without one of these, Figma extraction can't run.

Options before we proceed:
  a) Install figma-console MCP (originally distributed with XD-toolkit; install separately):
     claude mcp add figma-console -s user -- npx -y @figma-console/mcp@latest
     Note: the official Figma MCP (Dev Mode) is a different package — its variable
     extraction is per-selection, not file-wide; not a substitute.
  b) Export your Figma variables as DTCG JSON and drop the file into ./assets/.
     Any DTCG-compatible Figma plugin works; we've validated Token Press:
     https://www.figma.com/community/plugin/1560757977662930693/token-press-dtcg-exporter
  c) Proceed without Figma variables — token files will stay as placeholders;
     Stage 2 (web token extraction) will still run if Playwright is available.

Which? (a / b / c)
```

**Stage 1 (figma-console missing, DTCG file present):** No SKIP — fallback fires. Surface a one-line DOWNGRADE note inline in the §1 scope confirmation rather than a full notice block: "Stage 1 will use your DTCG export (`{filename}`) instead of figma-console; quality is comparable for primitive values, alias chains may flatten."

**Stage 2 (Playwright missing, but `sources.website` set):**

```
⚠ Stage 2 — Web token extraction will SKIP

Reason: Playwright MCP not available. There's no usable middle tier — token
extraction needs computed CSS, which keyless HTTP services don't expose.

Options before we proceed:
  a) Install Playwright MCP for full quality (recommended):
     claude mcp add playwright -s user -- npx -y @playwright/mcp@latest
     Or run `brand-cli setup` for the same one-line install.
  b) Proceed without web tokens — Stage 1 (Figma or DTCG) tokens will be
     primary; if Stage 1 also can't run, token files stay as placeholders.

Which? (a / b)
```

**Stage 3 (Playwright missing, but `sources.website` set):**

```
⚠ Stage 3 — Voice extraction will DOWNGRADE

Reason: Playwright MCP not available.
Falling back to Jina Reader (https://r.jina.ai/, keyless) — captures rendered text
on JS-heavy SPAs. Quality is comparable for voice samples; you lose the
accessibility tree (semantic role labels), so confidence will be MEDIUM, not HIGH.

Continue with Jina, or:
  a) Install Playwright MCP for full quality:
     claude mcp add playwright -s user -- npx -y @playwright/mcp@latest

Continue with Jina? (yes / a)
```

If Jina is also unreachable, the SKILL falls through to WebFetch automatically — adjust the notice to read "Falling back to native WebFetch (SSR sites only; SPAs return sparse content)" before proceeding. If WebFetch also fails at runtime (page returns 404), that's a runtime error not a fallback decision; let Stage 3 surface it normally.

**No notice when:**
- `fallback_decision: "none"` (top-tier dependency available)
- The stage's pre-condition was not met (e.g., `sources.figma` empty AND no DTCG file → no notice; that's a configuration choice, not a fallback)
- `interactive_preflight: false` is set in `.brandrc.yaml` — embedded mode; record the decisions silently for the manifest, do not prompt

### 0.5b. Embedded mode

If `.brandrc.yaml` has `interactive_preflight: false` (or the env var `BRAND_SKILLS_NONINTERACTIVE=1` is set), skip §0.5a entirely. Decisions still resolve and flow to the manifest, but the SKILL does not prompt. Hosts read `manifest.json` `stages[*].fallback_decision` + `chain_entry_used` and decide what to do.

Stop only when no useful input is available at all (no website, no PDFs, no screenshots, no Figma, no DTCG file) — and even then, surface a clear "I have nothing to extract from. Drop assets into `./assets/` or paste a URL, then re-run" message rather than crashing.

## 1. Confirm scope with the practitioner

Tell the user what you're about to do, in one short paragraph:

> I'll extract design tokens for {brand}. Sources: {website}, {figmaCount} Figma file(s){, plus N pages: ...}. This will populate `.brand/tokens/colors.md`, `.brand/tokens/typography.md`, `.brand/tokens/spacing.md`, and `.brand/tokens/surfaces.md`. Estimated time: 2–4 minutes. Continue?

If they decline, stop. Don't proceed without explicit confirmation.

## 2. Stage 1 — Figma variable extraction

Stage 1's fallback chain is declared in `schema/mcp-fallback-contract.json` `stages.1_figma`: `figma-console` MCP (full) → `dtcg-tokens-file` (degraded) → SKIP. Pre-flight (§0.5) resolves which entry fires.

**If `figma-console` MCP fired** (Tier 1, `quality_label: full`): proceed with the steps below.

**If `dtcg-tokens-file` fired** (Tier 2, `quality_label: degraded`): the SKILL has already detected `assets/*.tokens.json`. Use the CLI:

```bash
brand-cli import-tokens > /tmp/dtcg-tokens.json
```

Or, when `brand-cli` is absent, invoke the same logic inline by reading each `assets/*.tokens.json` and applying the DTCG normalization documented at `cli/src/utils/dtcg-import.js` (per-token `$value` + `$type` shape; `$type` ∈ `color | dimension | fontFamily | fontWeight | lineHeight | letterSpacing | duration | cubicBezier | shadow`; unknown types preserved verbatim under `unknown[]`).

In either case, hold the resulting token state in memory exactly as you would the `figma-console`-derived state — the bucket shape is the same. Skip the rest of this section's `figma-console` API steps.

**If `fallback_decision: SKIP` resolved** (no figma-console MCP AND no DTCG file): the pre-flight notice (§0.5a Stage 1) has already prompted the practitioner. Honor their choice. Move to Stage 2.

For each Figma file ID in `sources.figma` (figma-console path only):

1. Call `mcp__figma-console__figma_browse_tokens` (or `figma_get_variables` if the file is opened — try `figma_list_open_files` first to see what's accessible).
2. Filter to the collections in `sources.figma_variable_collections` if specified; otherwise extract all collections.
3. For each variable, resolve aliases to primitive values (use `figma_get_token_values` for resolved values).
4. Categorize variables into the four target groups:
   - **Colors** — type COLOR. Output as `<name>: "#RRGGBB"` (sRGB hex, lowercase or uppercase consistent within the file).
   - **Typography** — text styles or grouped variables (font family + size + weight + lineHeight + letterSpacing). Each typography token is a Typography object per the design.md spec.
   - **Spacing** — type FLOAT or NUMBER variables in spacing/sizing collections. Output as `<name>: <px-value>px` (or unitless number for ratios/columns).
   - **Surfaces** — separate radius variables (`<name>: <px>` under `rounded`) from effect styles (shadows → CSS box-shadow strings under `elevation`).
5. Normalize variable names to design.md-recommended conventions where reasonable (`primary-60` over `Primary/60`), but preserve the practitioner's naming if it's already sensible. Don't aggressively rename.

**Hold these results in memory** for Stage 4 (token file writing). Do not write yet.

## 3. Stage 2 — Web token extraction

Stage 2's fallback chain is declared in `schema/mcp-fallback-contract.json` `stages.2_web`: `playwright` MCP (full) → SKIP. There is no usable middle tier — computed CSS sampling needs a real browser.

**If `playwright` fired**: proceed with the steps below alongside Stage 1.

**If `fallback_decision: SKIP` resolved**: the pre-flight notice (§0.5a Stage 2) has already prompted the practitioner. Honor their choice — leave token files reflecting Stage 1 only, or as placeholders if Stage 1 also skipped.

When Stage 2 runs, treat it as supplementary to Stage 1 (or primary if Stage 1 was skipped).

1. Use Playwright MCP to navigate to `sources.website`. Take screenshots at desktop (1280px) and mobile (390px) widths.
2. Inject `getComputedStyle` queries via `mcp__playwright__browser_evaluate`. Sample these elements:
   - `body`, `h1`, `h2`, `h3`, `p`, `a`, `button` (preferably `button.primary` or `button[type="submit"]` if present)
   - First `header` and first `footer`
3. Capture the following per element:
   - `color`, `background-color` → color tokens
   - `font-family`, `font-size`, `font-weight`, `line-height`, `letter-spacing` → typography tokens
   - `padding`, `margin`, `gap` (for flex/grid containers) → spacing tokens
   - `border-radius` → rounded tokens
   - `box-shadow` → elevation tokens
4. Sample dominant colors from the desktop screenshot — the top 6–8 most-used colors (excluding pure white, pure black, and transparency). Use `mcp__playwright__browser_evaluate` with a canvas-based pixel sampler if needed.
5. Normalize:
   - Convert any `rgb()`, `rgba()`, or `hsl()` color values to hex.
   - Convert font-size, padding, margin to px integers (drop `em`/`rem` for the frontmatter; preserve in prose if useful).
   - Group similar values to derive a scale (e.g., padding values cluster around 4, 8, 16, 32 → these become spacing scale steps).

**Reconcile with Stage 1 results:**
- If Stage 1 produced a token with the same role (e.g., "primary"), prefer the Figma value unless the web value materially differs (then it's a conflict — note for Stage 5 in a future phase, but don't write to `conflicts.md` yet; just include a note in the prose).
- If Stage 1 had no equivalent, add the web-derived token with a name inferred from its role (e.g., `surface-page`, `text-primary`).

## 4. Stage 3 — Voice extraction (always run when sources.website is set)

This stage scrapes user-facing copy from the live site, social profiles, and app store listings to produce `.brand/voice.md`. Run after Stages 1+2.

### 4a. Source list

Build the URL list from `.brandrc.yaml`:
- `sources.website` (homepage) and every entry in `sources.website_pages` (e.g., `/about`, `/products`, `/contact`, `/help`)
- Each platform under `sources.social.*` (twitter / x, instagram, linkedin, facebook, tiktok)
- Each entry under `sources.app_store.*` (ios, android)

If `sources.website` is missing, you should already have prompted for it in Stage 0. If still absent, skip Stage 3 with a note in the summary.

### 4b. Scrape copy samples (target: 30–50 total)

Use the best available tool — Playwright when present, native `WebFetch` as the fallback. Quality differs; surface the difference in the summary.

**Playwright path (Tier 1 — full quality):**
1. `mcp__playwright__browser_navigate` to the URL
2. `mcp__playwright__browser_snapshot` to get the accessibility tree (preferred — gives semantic structure with role labels)
3. If snapshot is sparse, fall back to `mcp__playwright__browser_evaluate` with a script that walks `document.querySelectorAll('h1, h2, h3, [role="heading"], button, a, .cta, [aria-label], [class*="error"], nav a, footer a, .toast, .notice')` and returns `{tag, role, textContent, ariaLabel, className}` for each.

**Jina Reader path (Tier 2 — degraded; fires when Playwright MCP is absent and Jina is reachable):**
1. `GET https://r.jina.ai/<url>` (no auth, no API key). The SKILL fetches this directly from its own runtime (Bash `curl` or, if `Bash` isn't available, native `WebFetch` against the `r.jina.ai/<url>` URL). The CLI utility at `cli/src/utils/jina-fetch.js` is the canonical Node implementation — read it for the exact rate-limit handling, but the SKILL prose path doesn't import code; it just makes the request.
2. Jina returns rendered Markdown with hierarchical headings preserved. You don't get the accessibility tree, so role labels (`button`, `[aria-live]`, etc.) aren't available — sample classification falls back to heuristics (heading levels for `headline`; line shape + verb cues for `cta`; bullets/`-`/`>` patterns for `nav`).
3. Cap confidence at MEDIUM regardless of sample count — this is the contract's `quality_label: degraded` for jina-reader.
4. On `429` rate-limit or any other non-2xx (including network unreachable), fall through to WebFetch automatically. Update the manifest's `chain_entry_used` to whichever entry actually succeeded.

**WebFetch path (Tier 3 — degraded; fires when Playwright AND Jina are both unavailable):**
1. Call the native `WebFetch` tool with the URL and a prompt asking for "all visible text content grouped by document position."
2. Parse the returned text into samples — without the accessibility tree, you'll need to make heuristic calls about classification (headline vs body vs CTA). Mark each sample's confidence accordingly.
3. App-store and social-platform fallbacks: WebFetch handles plain marketing pages well. JS-heavy SPAs may return sparse content; note that as a limitation in the summary.
4. Skip Stages that need screenshots (Stage 2 already skipped; for Stage 4 you'll rely on uploaded screenshots only).

**Either path** — for app store listings: navigate, capture the description block, "What's New" section, and short subtitle.

For each captured string, classify and store:
- **Type** — exactly one of: `headline`, `cta`, `body`, `error`, `nav`, `microcopy`, `transactional`. Inference rules:
  - `headline` — H1/H2/H3 elements with role="heading", or hero text >= 24px font (you saw the type scale in Stage 2 — use it)
  - `cta` — `<button>`, `<a>` styled as button (class contains "btn"/"button"), `[role="button"]`, or anchor with imperative verb
  - `body` — paragraph elements, list items >= 5 words
  - `error` — anything in elements with class/data attribute containing "error", "alert", "warn", or aria-invalid
  - `nav` — anchors inside `<nav>`, header, or footer
  - `microcopy` — tooltips (`[role="tooltip"]`), placeholders, helper text under inputs, badges, captions
  - `transactional` — toast/notice/confirmation patterns, anything in `[role="status"]` or `[aria-live]`
- **Channel** — `website`, `social`, `app-store`, `email` (if email examples are uploaded — Phase 4 will handle uploads; for Phase 3 only website/social/app-store)
- **Source URL** — keep for citation in `voice.md` provenance comments

Stop scraping when you have ≥30 samples *or* you've exhausted the source list. Don't crawl indefinitely.

### 4c. Inference

From the corpus, derive:

- **Voice attributes** (3–5 adjectives) — what consistently shows up across types and channels (e.g., "direct", "warm", "wry"). Each attribute must be supported by at least 3 specific samples.
- **Voice anti-attributes** — what the brand explicitly avoids. Inferred from absences (no exclamation points anywhere → "Never overly enthusiastic") or contrasts with competitor patterns (don't speculate — anchor in evidence).
- **Tone by context** — sample at least 3 contexts from the type buckets (typically `error`, `transactional`, `cta` or `headline`). For each, give one or two real examples and a short tone descriptor.
- **Vocabulary** — preferred terms (words that recur with intent) and avoided terms (you can rarely prove a word is *avoided*, so use the absence cautiously — only flag avoided terms that the brand explicitly contrasts in marketing copy or that are obvious anti-patterns for the inferred voice).
- **Microcopy patterns** — patterns visible in the samples for buttons, errors, empty states. Cite real examples.
- **Channel deltas** — note material differences (e.g., "Twitter copy is shorter and more irreverent than the website").
- **Industry prior (optional, soft tie-breaker).** If `.brandrc.yaml` has `industry` set, treat it as a tie-breaker on inference choices when the evidence is roughly balanced — for example, choosing between "clinical-but-warm" and "clinical-but-cold" when sample counts and tone signals are even. The prior may NOT lower the ≥3-supporting-samples-per-attribute threshold from §4d, NOR the <10-total-samples threshold from §4e, NOR invent claims that have no sample support. When the prior actually influenced a claim, cite it inline with `*(industry context: <value>)*` after the claim's other citations. When `industry` is unset, this bullet is a no-op.

  Example. Samples are split 4-and-4 between "playful" and "wry" as candidate voice attributes; both clear the threshold. With `industry: "fast-food QSR"`, the prior breaks the tie toward "playful". The voice.md entry reads: `**playful** *(MEDIUM — 8 samples)* — short irreverent CTAs and emoji in social posts *(industry context: fast-food QSR)*`. Without the prior, the SKILL would pick whichever the corpus narrowly favored or surface both as candidates.

### 4d. Confidence levels

Tag each major claim in `voice.md` with confidence based on supporting sample count:
- **HIGH** — ≥10 samples back the claim
- **MEDIUM** — 5–9 samples
- **LOW** — <5 samples

Express confidence inline in the prose where useful (e.g., "Voice is consistently warm and direct *(HIGH — 18 supporting samples across website + Twitter)*"), or in a small confidence-summary block at the top of `voice.md`.

### 4e. Sample threshold

If the total scraped samples is **<10**, do not generate inferred prose. Behavior depends on whether voice.md already has prescriptive content (see 4f):

- **Placeholder voice.md (case 1):** write a stub for the observed-voice section listing the captured samples verbatim and asking for more sources. Do not invent attributes from <10 samples.
- **Populated voice.md (cases 2/3):** append a sparse observed-voice section that includes only the Sources, Sample corpus, and a `> ⚠️ Insufficient samples (<10) — observed-voice claims withheld` note plus the raw sample list. Do not touch prescriptive sections.

In both cases, ask the practitioner to provide more sources before re-running:
- Additional `sources.website_pages` (deeper crawl of the live site)
- Brand voice document or style guide PDF (Stage 4 territory once it ships)
- Recent campaign decks, email examples, support templates

### 4f. Write to voice.md — additive only

**Stage 3 is descriptive, not prescriptive. It owns exactly one section: `## Observed Voice (live channels)`. It never modifies any other section of voice.md.**

This is different from token files. Tokens are values — replacing them is fine. Voice.md may already contain prescriptive guidance (voice principles, tone spectrum rules, vocabulary, microcopy patterns, writing rules) sourced from a brand guide, campaign toolkit, or earlier multimodal analysis. That content is authoritative and Stage 3 must preserve it.

**Three cases to handle:**

1. **voice.md is a placeholder** (contains `<!-- Fill this file following the schema at schema/brand/voice.schema.md -->` marker, or is empty/zero-bytes):
   Write the full file with prescriptive sections left as `<!-- TODO: populate from brand guide via Stage 4 (not yet implemented) -->` and the observed-voice section filled in from this stage.

2. **voice.md has prescriptive content but no observed-voice section** (most common case after earlier `/new-project` runs that synthesized prescriptive content from uploaded assets):
   Use `Edit` to **append** an `## Observed Voice (live channels)` section to the end of the file. Do not touch any existing section. Do not "merge" — keep prescriptive prose exactly as-is.

3. **voice.md already has an observed-voice section** (Stage 3 was run before):
   Use `Edit` to replace only the contents of the `## Observed Voice (live channels)` section. Use the `Edit` tool with the section's H2 line as part of `old_string` to scope the replacement. Do not touch other sections.

**Never use `Write` to overwrite voice.md when prescriptive content exists.** If you're unsure whether prescriptive content is present, read the file first and look for any of: `## Voice Principles`, `## Tone Spectrum`, `## Vocabulary`, `## Microcopy Patterns`, `## Writing Rules`. If any are present, you're in case 2 or 3 — use `Edit`, not `Write`.

**Section content per `schema/brand/voice.schema.md`:**

```markdown
## Observed Voice (live channels)

> Descriptive observations from live channels — complements (does not replace) the prescriptive guidance above. Captured by `/brand-context:extract` Stage 3 on YYYY-MM-DD.

**Sources:** {website pages}, {social platforms}, {app store listings}
**Sample corpus:** {N} samples — {breakdown by type} | {breakdown by channel}
**Confidence summary:** HIGH ({n}) · MEDIUM ({n}) · LOW ({n})

### Observed attributes
- **{attribute}** *(HIGH — {n} samples)* — {one-line characterisation with example}
- ...

### Observed tone by context
| Context | Observed tone | Example | Source |
|---|---|---|---|
| Error | ... | "..." | URL |
| CTA | ... | "..." | URL |
| ... |

### Channel deltas
- {Channel A vs. Channel B}: {observation}

### Divergences from prescriptive
> ⚠️ **Diverges from prescriptive:** Brand guide specifies sentence case for CTAs; observed live: title case ("Talk To a Pro") and mixed/all-caps H3s ("Lawn CARE PLANS"). Flag for Stage 5 conflict resolution.
```

Include the divergences subsection only when there are real divergences to surface. Otherwise omit it.

**Public-sources-only mode** (when `mode: public-sources-only`, or its deprecated alias `mode: pitch`): inside the section, append a confidence-cap note: `> Public-sources-only mode — confidence capped at MEDIUM.` Do not touch the file's top-level public-sources-only disclaimer (if any) — that's owned by other stages.

**Provenance block** (only when writing the section for the first time, case 1 or 2): immediately after the `## Observed Voice (live channels)` content, before any subsequent section, place:

```markdown
<!--
Observed Voice section generated by /brand-context:extract Stage 3 on YYYY-MM-DD.
Sources: {websites}, {social platforms}, {app store listings}.
Total samples: N (HIGH ≥10 · MEDIUM 5-9 · LOW <5).
This section is regenerated on each Stage 3 run; the rest of voice.md is preserved.
-->
```

## 5. Write token files

**Scope:** This section applies only to the four token files: `.brand/tokens/colors.md`, `tokens/typography.md`, `tokens/spacing.md`, `tokens/surfaces.md`. **It does not apply to `voice.md`** — that's owned by Section 4f's additive-only policy. Do not prompt the practitioner with overwrite/merge/skip options for voice.md.

### 5a. Apply the overwrite policy

Read the existing file. If it contains the placeholder marker `<!-- Fill this file following the schema at schema/brand/...schema.md -->`, the file is untouched scaffolding — overwrite without asking.

If the marker is **absent** and the file has content beyond just frontmatter, ask the user:
> `tokens/colors.md` has been edited. **Overwrite** (replace entirely), **merge** (refresh the YAML frontmatter, keep your prose), or **skip** (leave alone)?

Default to **skip** if the user is ambiguous. Only proceed when explicit.

### 5b. Generate the file content

Build the file as: YAML frontmatter (between `---` delimiters) + a markdown body.

**Frontmatter:** the relevant token map for that file:
- `colors.md` → `colors:` map (hex strings only)
- `typography.md` → `typography:` map (Typography objects)
- `spacing.md` → `spacing:` map (Dimensions or unitless numbers)
- `surfaces.md` → `rounded:` and `elevation:` maps

Example frontmatter for `tokens/colors.md`:

```yaml
---
colors:
  primary: "#E2231A"
  primary-dark: "#C1190F"
  neutral-900: "#1A1A1A"
  neutral-50: "#F8F8F8"
  white: "#FFFFFF"
  error: "#D32F2F"
---
```

**Body:** start with a one-line provenance comment, then the schema-prescribed sections with content derived from extraction:

```markdown
<!-- Generated by /brand-context:extract on {YYYY-MM-DD}. Sources: Figma file abc123, https://example.com -->

# Color System

## Philosophy
{2–3 sentences inferred from the brand. If you can't infer, write a placeholder: "TODO: describe how color functions in this brand."}

## Primary Palette
| Token | Hex | Source |
|-------|-----|--------|
| `primary` | #E2231A | Figma `Color/Primary/Default` + verified on web (#E2231A) |
| ... |

## Application Context
{If you observed real usage on the website, describe it: "On wendys.com, primary red appears as: CTA buttons, badges, and navigation accents — not as full-section backgrounds."}

<!-- Sections like "Dark Mode" omitted — no source data. /brand-audit will flag missing sections. -->
```

Apply the same shape to `typography.md`, `spacing.md`, `surfaces.md` per their schemas in `schema/brand/`.

### 5c. Public-sources-only mode

If `mode: public-sources-only` in `.brandrc.yaml`, prepend the disclaimer:

```
> ⚠️ **PUBLIC-SOURCES-ONLY MODE** — derived from public sources only. Not validated against internal brand standards.
```

(The legacy `mode: pitch` value is normalized by the brandrc loader to `public-sources-only` before this stage runs; treat them identically.)

### 5d. Write the file

Use the `Write` tool to write the full content. Do not use `Edit` — token files are regenerated wholesale.

## 6. Stage 4 — Multimodal analysis (overview.md)

This stage reads brand-guide PDFs, reference screenshots, and the website screenshots already captured by Stage 2 to populate `.brand/overview.md` — brand identity, personality, audience, visual language, competitive context, aesthetic anti-patterns, and the brand self-test.

Run this stage when **any** of these inputs are present:
- `sources.brand_guide` (path to a PDF, relative to project root)
- `sources.screenshots` (paths to reference images)
- Stage 2 captured at least one website screenshot (always true if Stage 2 ran)

If none of those are present, skip Stage 4 with a clear note and leave `overview.md` as the placeholder.

### 6a. Read the inputs

Use the `Read` tool — it handles PDFs and images natively.

- **Brand guide PDF.** If `sources.brand_guide` is set, read up to 20 pages. Prioritize: cover, executive summary, mission/positioning, brand voice, visual identity, color, typography, photography, anti-patterns, do/don't pages. Use the `pages` parameter to read in batches if the PDF is long; do not read all 20 pages at once if you can target the key ones.
- **Reference screenshots.** Read each path under `sources.screenshots` (cap at 10 — if more are listed, ask the practitioner which ones matter most).
- **Web screenshots.** Read the top 3 captured by Stage 2 (homepage desktop + mobile, plus the most content-rich landing page from `sources.website_pages`).

If the PDF is encrypted, corrupt, or fails to read, log "Stage 4: brand-guide PDF unreadable — falling back to screenshots only" and continue with whatever screenshots are available.

### 6b. Extract per overview.md schema

Synthesize content for each required section of `schema/brand/overview.schema.md`. Anchor every claim in specific source material — cite page numbers for the PDF, filenames for screenshots, URLs for web captures.

**Industry prior (optional, soft tie-breaker).** When `.brandrc.yaml` has `industry` set, the same soft-prior rule from §4c applies to the **Brand Personality**, **Audience**, and **Competitive Context** subsections — and only those. Visual Language and the brand self-test are evidence-only (screenshots and the guide's stated rules). When the prior influenced a claim, append `*(industry context: <value>)*` after the claim's other citations. The prior never overrides an explicit guide statement; it only disambiguates close calls grounded in evidence.

**Brand Identity:**
- Brand name, tagline, one-sentence positioning. The brand guide is authoritative; cross-check against the website hero copy.

**Brand Personality:**
- 3–5 trait adjectives. Each trait must appear in the brand guide either explicitly named or inferable from a personality description / tone-of-voice section.
- Archetype if the guide names one (Jungian or otherwise). Do not invent.
- 2–3 sentence description expanding on the traits.

**Audience:**
- Primary audience (demographics, psychographics, or behavioral description) — usually in a "who we serve" / "target audience" / "user" section of the guide.
- Optional secondary audiences.
- Audience context (insight that influences design).
- Key use cases (the jobs users are getting done).

**Visual Language:**
- Direction (2–3 sentences on the visual approach). Read the visual identity section of the guide and cross-check against website screenshots.
- 3–5 design principles, taken verbatim from the guide where possible.
- Signature elements (distinctive visual hooks unique to this brand — see the guide's "key elements" section, plus what's actually visible on the website).

**Competitive Context:**
- Differentiation: how the brand positions vs. competitors.
- Avoid-resemblance-to: specific brands or styles to not look like (the guide often calls these out explicitly).
- **Aesthetic anti-patterns:** what the brand explicitly rejects. Mix the guide's stated rejections with inference from personality (e.g., a "confident, direct" brand is NOT "tentative, hedging"). Frame as `NOT corporate minimalist (too sterile)`, `NOT retro nostalgic (too backward-looking)`, etc.

**Brand self-test (5–10 yes/no questions):**
- Generate from the personality traits, visual direction, signature elements, and anti-patterns.
- The first question is always: `Could this screen belong to a competitor? (should be NO)`.
- The last question should be an overall feel check tied to visual atmosphere.
- Each question must be falsifiable — a "no" answer means something specific needs to change.

### 6c. Citation style

Inline citations make the prose auditable and trustworthy. Use lightweight footnote-style references:

```markdown
**Personality traits:** Bold, playful, irreverent, confident, witty *(per p. 4 of brand-guide.pdf and the consistent voice across @Wendys Twitter samples)*.
```

For the source list at the bottom of `overview.md`, cite explicitly:

```markdown
<!--
Generated by /brand-context:extract Stage 4 on YYYY-MM-DD.
Sources:
- brand-guide.pdf (pages 1, 4, 7, 12-14, 22)
- assets/screenshot-hero-desktop.png
- web capture: https://wendys.com (desktop + mobile)
-->
```

### 6d. Apply overwrite policy

`overview.md` is a single coherent document, not split prescriptive vs. descriptive like voice.md. Use the same overwrite policy as token files (Section 5a):

- **Placeholder marker present** (`<!-- Fill this file following the schema at schema/brand/overview.schema.md -->`) — overwrite without prompting.
- **Empty file** — overwrite without prompting.
- **Populated, no marker** — prompt: **overwrite** / **merge** / **skip**. For merge, regenerate only the brand self-test block (it has the clear `## Brand self-test` heading delimiter); preserve all other prose.

When in doubt, default to **skip** and leave the file alone.

### 6e. Public-sources-only mode

In public-sources-only mode (`mode: public-sources-only`, or its deprecated alias `mode: pitch`), prepend the disclaimer block to `overview.md`:

```markdown
> ⚠️ **PUBLIC-SOURCES-ONLY MODE** — derived from public sources only. Not validated against internal brand standards.
```

Cap inferred confidence: if a personality trait or audience claim relies on inference (rather than a direct guide quote), note it inline as `*(inferred from public materials)*`.

### 6f. Write the file

Use the `Write` tool when overwriting (or scaffolding from placeholder). Use `Edit` when merging. Build the file per `schema/brand/overview.schema.md` — the schema documents the target shape and the expected citation density.

After writing, verify the file is no longer the placeholder by checking that the brand identity, personality, and visual language sections are populated.

## 7. Stage 6 — Design-system repo scan (any tier)

This stage runs when:
- `.brandrc.yaml` `sources.design_system_repo` is set (local path or remote git URL)

Tier no longer gates Stage 6. Any project that points at a design-system repo gets the inventory — `comprehensive` tier no longer carries an implicit DS-scan opt-in. If `sources.design_system_repo` is unset, skip Stage 6 with a one-line log and move to Section 8 (design.md regen).

The job: inventory what components actually exist in the client's design system codebase and write per-component descriptions into `.brand/components/<name>.md`. This describes what's there for agents working on visual implementation — it does **not** audit quality, completeness, or DS conformance. That's a DS Pack concern.

### 7a. Resolve and prepare the source

For a **local path** (e.g., `./packages/design-system`):
- Resolve relative to project root.
- Verify it exists and is a directory; if not, log "Stage 6: path not found, skipping" and return.

For a **remote git URL** (e.g., `https://github.com/client/design-system`):
- Use `git clone --depth 1 {url} {tmpDir}` via the `Bash` tool, where `{tmpDir}` is `~/.brand-skills-tmp/ds-repo-{timestamp}`.
- If the clone fails (auth, 404, network), log the error and skip Stage 6 — don't error out the whole pipeline.
- Plan to clean up the temp directory in Section 7d.

### 7b. Scan and inventory

Read these patterns:

- **Tokens.** Look for `tokens/`, `tokens.json`, `*.tokens.json`, `*.tokens.yaml`, `theme.json`, or a `style-dictionary.config.*`. Cross-check token values against the ones extracted by Stages 1+2 — flag any disagreement as a conflict candidate for Stage 5 (Section 9). Don't write a tokens file from this — the canonical token files live in `.brand/tokens/`.
- **Component source files.** Try these paths in order until one matches: `src/components/*/`, `packages/*/src/`, `lib/components/*/`, `app/components/*/`, `components/*/`. For each component directory, expect a primary `index.{ts,tsx,js,jsx}` plus optional `*.stories.{ts,tsx}`, `*.test.*`, and a `README.md`.
- **Prop APIs.** From the primary file, extract the component's props. For TypeScript: parse the exported interface or type. For JavaScript with PropTypes: read the `Component.propTypes` declaration. For JSDoc/TSDoc: pull the `@param` and `@property` lines.
- **`package.json`.** Note any third-party component dependencies that the design system wraps (`@radix-ui/*`, `react-aria`, internal `@client/ds`). Practitioners use this to know what underlying primitives are in play.
- **`figma.config.*` or `.figma/` directory.** Read Code Connect mappings — they link Figma component IDs to source file paths. Capture the mapping for use in Section 7c.
- **`.storybook/main.{ts,js}`.** If present, note that Storybook is configured. Storybook MCP (when running) can introspect components further.

Cap at the first 50 components scanned to avoid runaway work on huge libraries. If more exist, list them as references at the end of `.brand/components/inventory.md` rather than per-component docs.

### 7c. Write per-component files

For each scanned component, write `.brand/components/<kebab-case-name>.md` with this shape:

```markdown
---
name: {ComponentName}
source: packages/design-system/src/Button/index.tsx
storybook_path: components-button--default        # optional
figma_node_id: 123:456                            # optional, from Code Connect
---

# {ComponentName}

## Purpose
{One-paragraph description inferred from the component name, prop signature, and any JSDoc / TSDoc / README content found.}

## Props
| Name | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `variant` | `"primary" | "secondary"` | yes | — | Visual variant |
| ... |

## Underlying primitives
- {Third-party dependency name} (from package.json) — what this component composes from

## Where to find it
- Source: `{relative path from project root or repo root}`
- Storybook: `{URL pattern if Storybook configured}`
- Figma: `{Code Connect node ID, if present}`

<!-- Inventoried by /brand-context:extract Stage 6 on YYYY-MM-DD from {repo URL or local path} -->
```

Also write `.brand/components/inventory.md` — a single-page index of every component found, grouped by category (form / layout / feedback / data display / etc., inferred from naming conventions). Include any components beyond the 50-cap as bare entries.

### 7d. Cleanup

If you cloned to a temp directory in Section 7a, remove it:

```bash
rm -rf {tmpDir}
```

Use the `Bash` tool. Do not leave clones behind in the user's home directory.

### 7e. Apply overwrite policy

`.brand/components/*.md` files are overwritten on every Stage 6 run — they describe what currently exists in the codebase. If a practitioner has hand-edited a component file (e.g., added usage notes), they should keep those notes in `.brand/composition/patterns.md` or `.brand/components/<name>-usage.md` (separate file), not in the auto-generated `<name>.md`.

If the practitioner has hand-edited a `<name>.md` file (detect: file lacks the `<!-- Inventoried by /brand-context:extract Stage 6 -->` provenance marker, or contains content beyond the auto-generated shape), prompt before overwriting: **overwrite** (use new scan), **skip** (keep their edits, don't refresh the inventory for this one).

`inventory.md` is always overwritten.

### 7f. Feed conflicts forward

Any token disagreements detected between the repo's `tokens.json` and `.brand/tokens/` are not resolved here — they're written to memory and surfaced in Section 9 (Stage 5 conflict detection) as `severity: token-level` conflicts with a `Source: design-system repo` citation.

## 8. Regenerate design.md (required — do not skip)

After all four token files are written, regenerate `design.md` at the project root. **This is a required step, not optional.** `design.md` is a self-contained, spec-compliant artifact (per https://github.com/google-labs-code/design.md/blob/main/docs/spec.md) — it inlines the actual token values in the YAML frontmatter so external tools can read them. Without this step, `design.md` stays the empty skeleton from `init` and the extraction work is invisible to spec consumers.

Use the dedicated CLI command — it's deterministic and avoids hand-building the file:

```bash
brand-cli refresh-design
```

Run it via the `Bash` tool. The command reads `.brand/` and overwrites `design.md`. It exits 0 on success and prints the brand directory it used.

If `brand-cli` is not installed, fall back to building `design.md` inline: read each `.brand/` file, merge the `colors` / `typography` / `spacing` / `rounded` / `elevation` frontmatter blocks into a single design.md frontmatter, then assemble the body sections (Overview, Colors, Typography, Layout, Elevation, Shapes, Components, Do's and Don'ts) per the spec at https://github.com/google-labs-code/design.md/blob/main/docs/spec.md.

After regeneration, verify the file is no longer the placeholder by checking that the frontmatter contains at least one populated token map.

> **Note — this regen runs twice in the pipeline.** The first pass here picks up the token files just written in Stages 1–4. A second, mandatory pass runs at the end of the pipeline (`§10c`, after Stage 5 conflict resolution and Stage 8 `brand.md` refresh) so `style-guide.html`'s active-conflicts banner reflects post-walkthrough state. Skip the §10c pass and the practitioner sees a stale `style-guide.html` — the bug the trigger exists to prevent.

### Also write `style-guide.html` (visual style guide)

`brand-cli refresh-design` writes a second project-root artifact alongside `design.md`: `style-guide.html`, a single self-contained HTML synthesis of `.brand/` aimed at designers / PMs / stakeholders who want to scan the brand visually rather than read through the markdown. The CLI command produces both files in one run; no separate command, no flag.

If `brand-cli` is installed (the recommended path), the second write happens automatically — no additional Bash invocation needed. Confirm both files exist after `refresh-design`:

```bash
ls design.md style-guide.html
```

If `brand-cli` is **not** installed, build `style-guide.html` inline using the `Write` tool. The canonical implementation lives at `cli/src/utils/style-guide-generator.js` in the brand-skills repo; mirror its output exactly for byte-identical parity.

**Section order (top to bottom):**

1. Active-conflicts banner — only when `.brand/conflicts.md` has at least one entry under `## Active Conflicts` (count `### ` H3 headings or top-level `- ` bullets). Banner literal: `<p class="banner">⚠ N active conflicts — see <code>conflicts.md</code></p>`. Suppress when count is zero.
2. Brand identity header — `<h1>${brand}</h1>` followed by `<p class="subtitle">${first paragraph from .brand/overview.md}</p>`. When `overview.md` is missing or only has the placeholder HTML comment, render the subtitle as `<p class="subtitle callout">No brand identity captured yet. Run /brand-context:extract.</p>`.
3. Colors — `<h2>Colors</h2>` plus a swatch grid grouped by token name prefix (e.g. `primary-100`, `primary-300`, `primary-500` group under `primary`; tokens with no hyphen group under `other`). Each swatch: `<div class="swatch"><div class="swatch-block" style="background: ${value}"></div><span class="swatch-name">${name}</span><span class="swatch-value">${value}</span></div>`. When `tokens/colors.md` frontmatter is empty or all-commented, render `<p class="callout">No colors extracted yet. Run /brand-context:extract.</p>`.
4. Typography — `<h2>Typography</h2>` plus one row per typography token: `<div class="type-row"><span style="font-family: ${fontFamily}; font-size: ${fontSize}; font-weight: ${fontWeight}; line-height: ${lineHeight}">The quick brown fox jumps over the lazy dog.</span><span class="type-row-meta">${name} · ${fontSize} / ${fontWeight} · ${fontFamily}</span></div>`. When `tokens/typography.md` frontmatter is empty or all-commented, render `<p class="callout">No typography extracted yet. Run /brand-context:extract.</p>`.
5. Spacing — `<h2>Spacing</h2>` plus one row per spacing token: `<div class="spacing-row"><div class="spacing-bar" style="width: ${minOf(parsedPx, 400)}px"></div><span class="spacing-meta">${name} · ${value}</span></div>`. **Silent skip** the entire section when the frontmatter has no real values (no heading, no callout).
6. Surfaces — `<h2>Surfaces</h2>` with two grids when populated: a `Rounded` group applying `border-radius: ${value}` to each sample, and an `Elevation` group applying `box-shadow: ${value}` to each sample. **Silent skip** when both `rounded:` and `elevation:` are empty.
7. Voice — `<h2>Voice</h2>` plus up to three `<blockquote>` elements pulled from the markdown blockquotes inside `.brand/voice.md`'s `## Observed Voice (live channels)` section, in document order. **Silent skip** when the section is a stub or contains zero blockquotes.
8. Footer — always renders. Three short paragraphs: generation timestamp (use `new Date().toISOString()` at write time), `Source: .brand/ directory; regenerate with brand-cli refresh-design.`, and the font-loading caveat from spec §2h.

**Page chrome.** Wrap the body in `<main class="page">…</main>` and ship a single `<style>` block in `<head>` with the chrome CSS. The chrome is **brand-agnostic**: `system-ui` font stack, `#fafafa` background, `#0066cc` accent, `1px solid #e5e5e5` borders, `960px` max-width. **Do not** pull values from `.brand/tokens/colors.md` or `tokens/typography.md` for the wrapper — brand values appear only in the content samples.

**Self-contained constraint.** The output must be a single HTML5 document: starts with `<!DOCTYPE html>`, has exactly one `<style>` block in `<head>`, has zero `<script>` tags, has zero `<link rel="stylesheet">` and zero external `<script src=...>`. No fonts loaded over the network; declared `fontFamily` values are used as-is and degrade to system fonts when absent.

**Escape user-supplied content.** Brand name, token names, token values, voice quotes, and overview prose all flow through `escapeHtml` before being embedded in the output. Replace `&` → `&amp;`, `<` → `&lt;`, `>` → `&gt;`, `"` → `&quot;`, `'` → `&#39;`. For values that land in inline `style="…"` attributes (color swatch backgrounds, typography font-* properties, surface border-radius / box-shadow), additionally strip CSS-significant characters (`;`, `:`, `{`, `}`, `<`, `>`, `\n`, `\r`) before HTML-escaping — `escapeHtml` does not prevent CSS injection via semicolons.

**Empty-state contract.** The file is always written, even on a fresh `brand-cli init` project. Sections without source data fall back to either an empty-state callout (identity, colors, typography) or a silent skip (spacing, surfaces, voice). The active-conflicts banner is always silent-suppressed when no Active Conflicts exist.

After regeneration, verify the HTML is valid (it begins with `<!DOCTYPE html>` and ends with `</html>`) and contains the brand name in the `<h1>`.

## 9. Stage 5 — Conflict detection (`conflicts.md`)

Reconcile what Stages 1–4 surfaced. Three things land in `.brand/conflicts.md`:

1. **Genuine conflicts** — sources disagree about the same thing and a choice is needed. Examples: brand guide says `#007749`, Figma says `#008542`, web computed style is `#00794a`. Or: brand guide rules sentence case, live site uses title case CTAs.
2. **Intentional adaptations** — divergences that are *not* conflicts because the practitioner has a legitimate reason (licensed display font swapped for a free body font on web; simplified palette for email; relaxed tone on social).
3. **Auto-resolutions** — previously-flagged conflicts that no longer reproduce because the source was fixed.

Run this stage after design.md regenerates (Section 7) so design.md is the consolidated artifact and conflicts.md describes what was reconciled to produce it.

### 8a. Inputs to compare

Read these files into memory:
- `.brand/tokens/colors.md`, `tokens/typography.md`, `tokens/spacing.md`, `tokens/surfaces.md` — frontmatter + prose
- `.brand/voice.md` — both prescriptive sections AND the `## Observed Voice (live channels)` divergences subsection (Stage 3 already flagged candidates there)
- `.brand/overview.md` — brand identity, personality, anti-patterns, visual direction
- Stage 1 raw Figma values (still in memory if Stage 1 ran)
- Stage 2 raw web computed styles (still in memory if Stage 2 ran)
- Stage 4 brand-guide PDF citations (page references for prescriptive claims)

If a file is missing or stub, note it as "no input from {file}" and continue.

### 8b. Detect

Apply these detection rules. Each is independent — run all of them and aggregate.

**Token disagreements:**
- For each named token (e.g., `colors.primary`), compare the value across Figma (Stage 1), web (Stage 2), and any value mentioned in the brand-guide PDF prose (Stage 4). If two or more sources disagree by more than a trivial threshold (>3% delta on color hex; non-trivial size delta on type), flag a `token-level` conflict.
- A trivial delta (e.g., `#E2231A` vs. `#E22319`) is not worth flagging; note silently.

**Voice rule disagreements:**
- For each prescriptive rule in `voice.md` (capitalization, punctuation, vocabulary, microcopy patterns), check whether Stage 3's observed-voice divergences subsection contradicts it. The Stage 3 divergence callouts (`> ⚠️ Diverges from prescriptive: ...`) are pre-flagged candidates — promote them into formal conflicts here.
- Also compare brand-guide prose (Stage 4) against the `## Voice Principles` and `## Writing Rules` sections for internal contradictions.

**Structural disagreements:**
- Brand guide positioning vs. live website hero copy (does the website speak the same brand vs. a sub-brand?).
- Visual direction principles in `overview.md` vs. observed live atmosphere from Stage 4 screenshots.
- Audience description vs. who the live site clearly addresses.

**Intentional adaptation candidates:**
- Font substitutions (display family in guide → body family on web) — usually intentional.
- Palette simplifications between print and digital — usually intentional.
- Tone shifts between channels (formal on website, casual on social) — usually intentional.

When a divergence has the shape of an intentional adaptation, **do not file it as a conflict**. File it under "Intentional Adaptations" and ask the practitioner during the walkthrough whether to confirm.

### 8c. Apply the source authority hierarchy

For each conflict, propose a resolution grounded in the hierarchy from `schema/brand/conflicts.schema.md`:

1. Practitioner-provided live brand guide (PDF, recent)
2. Figma variables (if maintained by brand team)
3. Live website CSS (current behavior)
4. Social profiles

If the project has a hierarchy override at the top of `conflicts.md`, use that instead.

The recommended resolution should be one paragraph: which source wins, why, and what the consequence is for the prototype/build.

### 8d. Walk the practitioner through (required interaction)

Before writing `conflicts.md`, present each detected item to the practitioner and get explicit input:

- For each **conflict**: show the title, sources in tension, recommended resolution. Ask: confirm the resolution, override it (and capture rationale), or mark it as `intentional-adaptation` if the practitioner says it's not actually a conflict.
- For each **intentional adaptation candidate**: confirm it's intentional + capture the rationale.
- For each conflict that previously existed and no longer reproduces: confirm the auto-resolution and move to the archive.

This is the "structured conflict resolution" practitioners care about — keep the prompts crisp and one item at a time. Do not batch-prompt.

If there are zero detected items, skip the walkthrough and write `_No active conflicts as of {date}._`.

### 8e. Apply the additive policy

`conflicts.md` is **additive** — Stage 5 must preserve practitioner-resolved entries on every re-run.

Read the existing `conflicts.md` first. Build the new file as:

1. **Header** — regenerate (date stamp, skill provenance)
2. **Source Authority Hierarchy** — preserve any practitioner overrides; otherwise regenerate the standard table
3. **Active Conflicts** — start fresh; populate with currently-detected `unresolved` items + any practitioner-overridden resolutions captured during the walkthrough
4. **Intentional Adaptations** — preserve all existing entries; append newly-confirmed ones
5. **Resolved Conflicts Archive** — preserve all existing entries; append any auto-resolutions detected this run

**Never delete entries from Intentional Adaptations or Resolved Conflicts Archive.** Use the `Edit` tool to surgically update sections, or `Write` to rebuild the file from in-memory state — but verify the diff in either case.

### 8f. Public-sources-only mode

In public-sources-only mode (`mode: public-sources-only`, or its deprecated alias `mode: pitch`), do not run the practitioner walkthrough — there's no internal access to resolve conflicts authoritatively. Instead:
- Detect conflicts as usual
- Write all detected items as `unresolved` with `Recommended resolution: pending — public-sources-only mode (public sources only)`
- Surface the count in the Final summary so the practitioner can resolve later when internal access is available

### 8g. Provenance

End the file with:

```markdown
<!--
Generated by /brand-context:extract Stage 5 on YYYY-MM-DD.
Inputs: .brand/tokens/*.md, .brand/voice.md, .brand/overview.md, Stage 1 Figma values, Stage 2 web computed styles, Stage 4 PDF citations.
Detected: N conflicts, M intentional adaptations, K auto-resolutions.
This section preserves practitioner-resolved entries on every re-run.
-->
```

## 10. Stage 8 — Refresh `brand.md`

After Stages 1–5 complete, regenerate `brand.md` at the project root so any agent that loads root-level brand context (Claude Code, Cursor, Copilot, Impeccable) picks up the new brand state immediately. Required, not optional — without it, agents continue running against stale brand context.

Use the dedicated CLI command via the `Bash` tool:

```bash
brand-cli refresh-context
```

The command reads `.brand/overview.md` and `.brand/voice.md`, builds a dense single-file summary (identity, personality, visual language, voice principles, anti-patterns, brand self-test, plus pointers to deeper files), and overwrites `brand.md` at the project root.

**Impeccable users** (or anyone whose agent loads `.impeccable.md` specifically) can pass `--impeccable`:

```bash
brand-cli refresh-context --impeccable
```

That writes the same content to both `brand.md` and `.impeccable.md`. Detect Impeccable's presence by checking for `~/.claude/skills/impeccable/` or by `.impeccable.md` already existing in the project; pass `--impeccable` accordingly.

**If `brand-cli` is not installed,** fall back to building the file inline: read `.brand/overview.md` and condense it to ~200–400 tokens of dense brand context, with pointers (`See \`.brand/voice.md\` for full voice rules`) to deeper files. Density matters — agents load this file on every interaction.

After Stage 8 (`brand.md`) runs, control flows to `§10b` (manifest emission) and then `§10c` (final `refresh-design` pass that regenerates `design.md` AND `style-guide.html` together). Only after `§10c` is the project's interop surface fully consistent with the post-conflict-resolution `.brand/` state.

## 10b. Emit `.brand/manifest.json`

After Stages 1–8 complete and before the final summary, emit a machine-readable manifest of what just ran. Hosts gate on it; humans don't read it.

**CLI path:**

Build the stage payload from what just ran. Pass via stdin:

```bash
cat <<'JSON' | brand-cli emit-manifest
{
  "tier": "{tier}",
  "client": "{brand}",
  "stages": {
    "1_figma":     { "ran": <bool>, "wrote": [<paths>], "reason": "<if skipped>",
                     "fallback_decision": "<none|DOWNGRADE|SKIP>",
                     "chain_entry_used": { "kind": "<kind>", "name": "<dep-name>", "quality_label": "<full|degraded>" },
                     "required_dependencies": [<names>], "available_dependencies": [<names>] },
    "2_web":       { ... same shape, plus "confidence": "<HIGH|MEDIUM|LOW>" when ran },
    "3_voice":     { ... plus "samples": <n>, "confidence": "..." },
    "4_overview":  { ... plus "sources": [<sources>] },
    "5_conflicts": { ... plus "active": <n> },
    "6_components":{ ... },
    "8_brand_md":  { ... }
  },
  "dependencies": {
    "figma-console":    { "available": <bool>, "used_by": [<stage_keys>] },
    "playwright":       { "available": <bool>, "used_by": [<stage_keys>] },
    "jina-reader":      { "available": <bool>, "used_by": [<stage_keys>] },
    "dtcg-tokens-file": { "available": <bool>, "used_by": [<stage_keys>] },
    "webfetch":         { "available": <bool>, "used_by": [<stage_keys>] },
    "read":             { "available": <bool>, "used_by": [<stage_keys>] }
  },
  "file_overrides": {
    "<path>": {"status": "defaults", "note": "<reason>"}
  }
}
JSON
```

The CLI decorates each emitted `dependencies[name]` entry with `kind` (and `expected_path_glob` for `user_artifact` entries) from the contract — the SKILL doesn't need to send those fields. Dependency names are validated against `schema/mcp-fallback-contract.json`; an unknown name (typo, or a dep not in the contract) hard-rejects with exit 1.

**Inline fallback (CLI absent):**

Construct the manifest in memory and `Write` to `.brand/manifest.json`. The reference shape — including every required field with a concrete example value — is at `cli/test/golden/manifest-from-skill.json` in the brand-skills repo. Mirror that shape exactly.

The non-derivable fields the SKILL must set itself (manifest schema `version: "2"`):

- `version`: `"2"` (literal — schema enforces a const)
- `generated_at`: ISO-8601 datetime (e.g. `"2026-06-13T15:30:00Z"`)
- `generator`: `brand-extract-skill@<plugin-version>`
- `tier`: from `.brandrc.yaml`'s `tier`. `client` (the manifest field name): from `.brandrc.yaml`'s `brand` (or its deprecated alias `client`). The manifest field name stays `client` for v2 back-compat; only the brandrc UX surface was renamed.
- `stages`: per-stage object keyed by stage key (`1_figma` … `8_brand_md`, no `7_*`). Every entry has `ran` (bool) and `fallback_decision` (one of `"none" | "DOWNGRADE" | "SKIP" | "HALT"`). When `ran: true`, also include `chain_entry_used: { kind, name, quality_label }`. When `fallback_decision: "SKIP"`, set `chain_entry_used: null`. Always include `required_dependencies` (names from the contract chain marked `quality_label: "full"`) and `available_dependencies` (names you detected as available in §0.5). Stage-specific extras (`wrote`, `samples`, `confidence`, `sources`, `active`) are unchanged from `version: "1"`.
- `dependencies`: object keyed by dependency name (must match a name in `schema/mcp-fallback-contract.json` `dependencies` — typos hard-reject the manifest at validation). Each entry has `kind` (must equal the contract's `kind` for that name), `available` (bool), `used_by` (array of stage keys that consumed this dependency). For `user_artifact` entries, also include `expected_path_glob` mirroring the contract.
- `files`: object keyed by relative path under `.brand/`, with each entry `{ "status": "<enum>", "bytes": <integer> }` (and an optional `"note": "<reason>"` for `defaults`/`partial`). Apply the same content-scan logic the CLI uses — placeholder marker, frontmatter inspection, body length — to assign one of `complete | partial | placeholder | missing | defaults`. Include every file under `.brand/`, not just the ones listed in `file_overrides`.

## 10c. Final design-surface refresh (required — do not skip)

After Stage 5 (`conflicts.md` walkthrough) and Stage 8 (`brand.md` refresh) complete, run `brand-cli refresh-design` once more to regenerate **both** `design.md` AND `style-guide.html` from the now-final `.brand/` state. This second pass is required, not optional — without it the practitioner sees a stale `style-guide.html` (the empty-state file from `brand-cli init` if they never edited it, or the §8 first-pass output that pre-dates the conflict walkthrough).

CLI path:

```bash
brand-cli refresh-design
```

Run via the `Bash` tool. The command reads `.brand/` and overwrites `design.md` AND `style-guide.html` in one pass — both files always regenerate together; there is no flag to suppress one. After it runs, confirm both artifacts are current:

```bash
ls design.md style-guide.html
```

**If `brand-cli` is not installed,** repeat both inline fallbacks: §8 (regenerate `design.md` from frontmatter) AND §8 "Also write `style-guide.html`" (regenerate the visual style guide via the canonical generator at `cli/src/utils/style-guide-generator.js`, byte-identical to the CLI). Both must run; skipping `style-guide.html` is the regression this stage exists to prevent.

After this pass, the project root has three current artifacts: `design.md`, `style-guide.html`, and `brand.md`. The Final summary's "Files written" list reflects all three.

## 11. Final summary

Post a message to the user with:

- **Token counts:** how many color tokens, typography tokens, spacing tokens, surface tokens were extracted
- **Voice corpus:** total samples, breakdown by type and channel, plus HIGH / MEDIUM / LOW claim counts
- **Overview sources:** brand-guide PDF (yes/no, page count read), reference screenshots (count), web screenshots (count)
- **Conflicts surfaced:** count of new `unresolved` conflicts, intentional adaptations confirmed, auto-resolutions
- **Sources used (overall):** Figma, web pages, social, app stores, PDFs, screenshots
- **Files written:** four token files + `voice.md` + `overview.md` + `components/*.md` (when `sources.design_system_repo` is set) + `conflicts.md` + `design.md` + `style-guide.html` + `brand.md`
- **Files skipped:** if any (with reason)
- **Stage status:** Stage 1 / 2 / 3 / 4 / 5 / 6 / 8 — ran / skipped / partial / stub
- **What's next:** "Phase 8 is the complete pipeline. Run `/brand-context:check` to see brand-package completeness and any remaining gaps."

Be concise. The summary is one short message, not a wall of text.

## Failure handling

| Failure | What to do |
|---|---|
| `claude mcp list` errors | Tell the user setup may be incomplete. Stop. |
| Figma file private (Stage 1) | Skip Stage 1, note in summary, continue with Stage 2 |
| Playwright blocked by CAPTCHA / login wall (Stage 2) | Stop Stage 2, ask user for screenshots. Stage 4 can use those. |
| Stage 3: a social URL is private/login-walled | Skip that one source, continue with the rest. Note in summary. |
| Stage 3: total samples <10 | Write the stub `voice.md` per Section 4e. Don't infer. Ask for additional sources. |
| Stage 3: snapshot returns sparse content (SPA with delayed render) | Wait 2 seconds via `mcp__playwright__browser_wait_for`, retry once. If still sparse, fall back to `browser_evaluate` selector script. |
| Stage 4: brand-guide PDF unreadable (encrypted, corrupt) | Note it in summary. Continue with screenshots only. Lower confidence. |
| Stage 4: PDF >20 pages | Read the prioritized pages (cover, mission, voice, visual identity, anti-patterns). Ask the practitioner if specific pages matter that you didn't read. |
| Stage 4: no PDF, no screenshots, no Stage 2 captures | Skip Stage 4. Leave overview.md as placeholder. Ask the practitioner to provide a brand guide or screenshots. |
| Stage 4: practitioner has hand-curated `overview.md` already | Default to skip. Only merge if explicitly requested — and merge replaces only the brand self-test block. |
| Stage 5: practitioner declines a recommended resolution | Capture their override + rationale, write the conflict with `status: resolved-with-rationale` and the practitioner's text. |
| Stage 5: practitioner can't resolve right now | Leave the conflict as `unresolved`. They can re-run later. |
| Stage 5: a previously-resolved conflict re-surfaces | Treat as a new active conflict. Note in the new entry that it had been resolved on a prior date. |
| Stage 5: only one source is present (e.g., no Figma, no PDF) | Cannot detect cross-source conflicts. Stage 5 writes "_No active conflicts as of {date}._" and notes the limited input in the provenance block. |
| Stage 6: `sources.design_system_repo` not set | Skip silently. Note in summary. |
| Stage 6: local path not found | Log "Stage 6: path not found", skip. Don't error the pipeline. |
| Stage 6: remote git clone fails (auth, 404, network) | Log the error, skip Stage 6, continue. |
| Stage 6: no recognizable component patterns in repo | Write `.brand/components/inventory.md` with "_No components detected by pattern scan as of {date}._" and skip per-component files. |
| Stage 6: practitioner has hand-edited a component file | Detect via missing provenance marker. Prompt overwrite/skip per file. |
| Stage 6: temp clone directory cleanup fails | Log a warning. Don't fail the pipeline. |
| All stages fail | Don't write any files. Tell the user what failed and what to fix. |
| Practitioner says "skip" on overwrite for a file | Honor it — leave that file alone, write the others |
| Conflict between Figma and web token values | Stage 5 captures it formally. In token file prose, note the divergence; in conflicts.md, file with `severity: token-level`. |
| Overview claim contradicts a token value | Stage 5 captures it as `severity: structural`. |

## Phase 8 scope reminder

Implemented (complete pipeline):
- Stage 1: Figma → tokens
- Stage 2: Web → tokens (always when sources.website is set)
- Stage 3: Voice extraction → voice.md `## Observed Voice` section (additive)
- Stage 4: Multimodal analysis → overview.md
- Stage 5: Conflict detection → conflicts.md (additive, with practitioner walkthrough)
- Stage 6: Design-system repo scan → components/*.md + components/inventory.md (when `sources.design_system_repo` is set, any tier)
- Stage 8: `brand.md` regeneration (always runs)
- design.md regeneration
- Manifest emission (Section 10b) — every extract run now writes `.brand/manifest.json`

There is no further Stage 7 — the numbering preserves the historical pipeline plan. Stage 6 covers what an earlier draft called Stage 7.

If the user asks for any of these (i.e., a stage that's marked not-yet-implemented), say: "That stage isn't yet active in this version. The other files in `.brand/` need to be filled manually or wait for an upgrade." (At v0.2.0 the entire pipeline is active, so this clause is dormant — kept for forward-compat when new stages are introduced behind a flag.)
