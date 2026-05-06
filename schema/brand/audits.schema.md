# Schema: .brand/audits/

**Purpose:** Historical record of brand audits. Each audit produces a dated report scoring a build target against the project's `.brand/` package across six dimensions.

**Tier:** Standard (and above)
**Loaded:** When the practitioner reviews audit history, compares against a prior run, or runs `/brand-context:check`. Not loaded by default in visual-implementation tasks.
**Owned by:** `/brand-context:audit` skill.

---

## Directory structure

```
.brand/audits/
├── 2026-05-06-pages-plan.md
├── 2026-05-08-pages-plan.md      # re-audit, additive
├── 2026-05-08-hero-component.md
├── 2026-05-09-localhost-3000-quote.md
└── ...
```

**Filename convention:** `YYYY-MM-DD-<target-slug>.md`
- Date is the audit run date.
- Target slug derived from the path/URL, with `/` and special characters replaced by `-`.
  - File path `./pages/plan.tsx` → `pages-plan`
  - URL `http://localhost:3000/quote` → `localhost-3000-quote`
  - Image path `./tmp/preview.png` → `tmp-preview`

**Re-runs** produce new files, never overwrite. The directory is the audit trail.

---

## Required sections in each report

### Header

| Field | Required | Description |
|-------|----------|-------------|
| Title | required | `# Brand Audit — {target}` |
| Date | required | YYYY-MM-DD |
| Adherence score | required | `{0-100}/100 ({tier label})` — see scoring below |
| Audit confidence | required | `HIGH` / `MEDIUM` / `LOW` — LOW when `.brand/` is mostly placeholders, MEDIUM when one or more dimensions skipped, HIGH when full package + all dimensions ran |

### Summary

A one-paragraph narrative: what the target is, what was checked, and the top 3 issues to address first. Practitioners read this in the inline output; the rest of the report is for follow-up.

### Findings

Three subsections by severity. Each finding cites a specific brand rule.

| Field | Required | Description |
|-------|----------|-------------|
| `Critical` | required (may be 0) | Block-merge issues — wrong logo, hardcoded brand colors, substituted custom fonts, broken mandatory anti-patterns |
| `Major` | required (may be 0) | Should-fix-before-shipping issues — token violations, off-brand voice, composition issues |
| `Minor` | required (may be 0) | Nice-to-clean-up issues — slight naming drift, tone nudges |

Each finding row should include: dimension, location (file:line or URL fragment), rule violated (with citation to a `.brand/` file), recommended fix.

### Brand self-test (optional)

Only included when Dimension 5 (visual atmosphere) ran. Lists each question from `.brand/overview.md`'s brand-self-test, with PASS/FAIL/N/A and a one-line rationale.

### Fix-it queue (required)

Top 3-5 actions, ordered by severity then impact. Concrete and immediately actionable.

### Tools used

A brief list of how the audit was performed:
- Source-code grep on N files
- Playwright snapshot of {URL} (or WebFetch fallback)
- Multimodal analysis of {screenshot path}
- Brand package: `.brand/` (tier, files populated)

### Provenance

HTML comment at the end stating: skill version, date, inputs, dimensions run, additive note.

---

## Scoring formula

```
score = 100 - (10 × critical_count) - (3 × major_count) - (1 × minor_count)
floor at 0
```

| Score | Tier label | Meaning |
|-------|-----------|---------|
| 90-100 | Strong brand adherence | Ready to ship |
| 70-89 | Solid base, fixable issues | Resolve criticals + majors before shipping |
| 50-69 | Significant drift | Multiple critical or major fixes needed |
| <50 | Off-brand | Do not ship without rework |

---

## Re-run behavior

When auditing a target that has prior reports:

- **Don't overwrite** — write a new file with today's date.
- **Compare** — surface the score delta vs. the most recent prior audit ("↑ 7 points since 2026-05-04").
- **Resolved findings** — items present in a prior audit but absent from the current run are reported as "resolved since last audit" in the inline summary, not in the findings tables.
- **Persistent findings** — items present in both are flagged in the new report's findings tables as "previously raised on YYYY-MM-DD".

---

## Example

```markdown
# Brand Audit — pages/plan.tsx

**Date:** 2026-05-06
**Adherence score:** 72/100 (solid base, fixable issues)
**Audit confidence:** HIGH

## Summary

Audited `./pages/plan.tsx` against the TruGreen brand package (standard tier, 14 files populated). The component shows strong brand alignment in token usage and composition, but ships off-brand voice on every primary CTA and has 2 hardcoded color literals that should reference `var(--color-primary)`. Top fixes are voice (sentence-case CTAs) and color tokens.

## Findings

### Critical (1)
| # | Dimension | Location | Rule violated | Recommended fix |
|---|-----------|----------|---------------|-----------------|
| 1 | Token compliance | `Hero.tsx:42` | hardcoded `#E2231A` (.brand/tokens/colors.md defines `color-primary` for this) | Replace with `var(--color-primary)` |

### Major (3)
| # | Dimension | Location | Rule violated | Recommended fix |
|---|-----------|----------|---------------|-----------------|
| 1 | Voice | `Hero.tsx:67` ("Get Started") | .brand/voice.md — CTAs are sentence case | Change to "Get started" |
| 2 | Voice | `PlanCard.tsx:34` ("Talk To a Pro") | .brand/voice.md — CTAs are sentence case | Change to "Talk to a pro" |
| 3 | Composition | `Hero.tsx:18-94` | .brand/composition/anti-patterns.md — max 1 primary CTA per viewport (renders 3) | Demote 2 CTAs to secondary or move to a separate section |

### Minor (3)
{...}

## Brand self-test

| # | Question | Answer | Rationale |
|---|----------|--------|-----------|
| 1 | Could this screen belong to a competitor? (should be NO) | NO ✓ | TruGreen wordmark and signature green present |
| 2 | Is the lawn imagery photography front and center? | NO ✗ | Hero uses an illustration; brand visual language requires photography |
| ... |

## Fix-it queue
1. Replace hardcoded `#E2231A` with `var(--color-primary)` in Hero.tsx
2. Sentence-case all primary-CTA labels (3 instances)
3. Reduce primary CTAs in hero from 3 → 1; move others to secondary or a separate section
4. Swap hero illustration for product imagery (per brand visual language)

## Tools used
- Source-code grep on 4 files
- Brand package: `.brand/` (standard, 14 files populated)

<!--
Generated by /brand-context:audit on 2026-05-06.
Inputs: ./pages/plan.tsx, .brand/ (standard tier).
Dimensions run: 1 (token), 3 (composition), 4 (voice), 6 (conflict consistency). Skipped: 2 (no .brand/components/), 5 (no screenshot provided).
This audit is additive — earlier audits in `.brand/audits/` are not modified.
-->
```
