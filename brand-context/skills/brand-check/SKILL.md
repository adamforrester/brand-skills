---
name: brand-check
description: Check brand package completeness and health. Reports which .brand/ files are populated, which are placeholders or empty, and what gaps exist relative to the project's tier (minimum / standard / comprehensive). Use when someone asks "is the brand package complete", "what's missing from the brand package", "/brand-check", "score the brand", or after running /brand-extract to see what's left.
---

# /brand-context:check

Run `brand-cli score` (when available) and present results conversationally. The goal is to surface gaps an agent or practitioner can act on, not to dump a raw report.

## Step 1 — Get the score

Try the deterministic CLI first:

```bash
brand-cli score --json
```

`brand-cli score` always also writes `.brand/.health.json` — a machine-readable verdict (readiness, tier_label, gaps, downgrades) for hosts that gate on the package programmatically. Humans read the console output; hosts read the JSON.

The CLI's `.health.json` and the SKILL's inline-fallback `.health.json` must share the same shape — see `schema/health.schema.json` and the field set the inline-fallback step 5 below produces.

If `brand-cli` is not installed, score manually:

1. Read `.brandrc.yaml` for `tier` and `mode`.
2. List required files for the tier (see `schema/brand/` or the table below).
3. For each file, classify:
   - **Missing** — file doesn't exist
   - **Placeholder** — file exists but only contains the `<!-- Fill this file following the schema… -->` marker
   - **Partial** — file has content but obvious gaps (frontmatter empty, multiple TODO markers, or sections missing)
   - **Complete** — schema sections populated with real content
4. Compute overall completeness as % of files that are at least Partial, weighted by required-vs-optional.
5. **Also write `.brand/.health.json`** with the per-file statuses, readiness score, and gaps. The schema is at `schema/health.schema.json` in the brand-skills repo. If `manifest.json` is also present, read it for `defaults`/`partial` statuses (a content scan can't detect those); otherwise the inline fallback only emits `complete` / `placeholder` / `missing`.

### Tier file map

| Tier | Required files |
|---|---|
| minimum | overview.md, voice.md, tokens/{colors,typography,spacing,motion,surfaces}.md |
| standard | (above) + composition/{page-types,patterns,anti-patterns}.md, CHANGELOG.md, conflicts.md |
| comprehensive | (above) + workflows/{figma-to-code,code-standards,deploy,qa-checklist,build-sequence}.md, components/, specs/ |

## Step 2 — Present conversationally

> Your **{client}** brand package is **{X}% complete** at the **{tier}** tier.
>
> **What's solid:**
> - {list of files that are Complete, with one-line notes on what's in them}
>
> **What needs attention:**
> - {list of Missing/Placeholder/Partial files with specific gaps}
>
> Want me to work on filling any of these gaps?

If a brand self-test exists in `overview.md`, score it too:

> **Brand self-test:** {X}/{Y} questions have clear answers based on the current brand package.

If the self-test is missing, offer to generate one: "Your brand package doesn't have a self-test yet. Want me to generate one from the brand personality and visual direction in `overview.md`?"

## Step 3 — Offer specific next actions

For each gap, suggest the action that resolves it:

| Gap | Suggested action |
|---|---|
| Missing `voice.md` | "I can run `/brand-context:extract` Stage 3 to scrape voice samples from the website and social — or paste in your brand voice document." |
| Empty token files | "Do you have a Figma file? I can pull variables via `/brand-context:extract` Stage 1. Or `/brand-context:extract` Stage 2 can sample computed CSS from the live site." |
| Empty `overview.md` | "Drop the brand-guide PDF or screenshots into the project and run `/brand-context:extract` — Stage 4 reads them via multimodal vision." |
| Missing self-test | "I can generate one from `overview.md` personality + anti-patterns — say the word." |
| Missing aesthetic anti-patterns | "I can infer what this brand is NOT from the personality traits and visual direction." |
| Empty `conflicts.md` | "Either there are no conflicts, or `/brand-context:extract` Stage 5 hasn't run yet. Want me to run it?" |
| Empty `components/` | "If you have a design-system codebase, add `sources.design_system_repo` to `.brandrc.yaml` and run `/brand-context:extract` — Stage 6 inventories it (comprehensive tier only)." |

Be concise. The whole report is a short message, not a wall of text.
