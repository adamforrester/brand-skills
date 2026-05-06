---
name: brand-audit
description: Audit a target (file, directory, URL, or screenshot) against the project's `.brand/` package and report adherence. Use when the user says "audit this against the brand", "/brand-audit", "/brand-context:audit", "is this on-brand?", "check brand adherence", "score this build against the brand", or after building something they want to verify before shipping. Produces a severity-ranked findings list, a brand-adherence score, and (when the target supports it) auto-runs the brand self-test from overview.md. Reports are written to `.brand/audits/YYYY-MM-DD-<target>.md` for historical record. Report-only — does not modify the audit target.
---

# /brand-context:audit

Run a structured audit of a build target against the project's `.brand/` package. The goal is to surface every place the target deviates from the brand, ranked by severity, with citations back to the specific brand rule that was violated.

This skill is **report-only**. It reads the target and the brand package, finds violations, recommends fixes, and writes a report. It does not modify the target.

---

## 0. Pre-flight

### 0a. Resolve the audit target

Determine what's being audited from the practitioner's input:

- **File path** (e.g., `./src/components/Hero.tsx`, `./pages/plan.tsx`) — read with `Read`. Source code audit.
- **Directory** (e.g., `./src/components/`, `./pages/`) — list files with `Glob`, audit each individually, aggregate findings.
- **URL** (`http://localhost:3000/...` or any web URL) — use Playwright MCP if available (full quality: HTML + computed styles + screenshot); fall back to `WebFetch` (HTML + text only, no screenshot).
- **Image path** (`.png`, `.jpg`, `.webp`) — read with the `Read` tool for multimodal analysis. Visual atmosphere checks only — no code-level checks.
- **Combination** (e.g., "audit `./pages/plan.tsx` and the running localhost:3000/plan") — run both, merge findings.

If the practitioner gives no target, prompt:

> What should I audit? Pick one:
> - File path or directory: `./src/components/...`
> - Running URL: `http://localhost:3000/...`
> - Screenshot: `./tmp/preview.png`
> - All recent work: I'll figure out what's been touched since the last audit (uses `git diff` against the last audit commit, when available)

### 0b. Locate `.brand/`

Resolve the brand directory from `.brandrc.yaml` (`brand_path` field) or default to `./.brand/`. If the directory doesn't exist or is mostly placeholders, surface that and ask: "The brand package is empty. Run `/brand-context:extract` first, or audit anyway against whatever's populated?"

If the practitioner says proceed, run with what's available. Mark the audit's confidence as **LOW** in the report.

### 0c. Check available tools

- **Playwright MCP** present? → URL audits use full quality (computed styles + screenshot).
- **Playwright missing** + URL given? → Fall back to `WebFetch` for text content. Skip the visual-atmosphere dimension. Note in the report.
- **No tools**, file/code only target? → Fine, native `Read` + `Grep` does everything needed.

Don't block on missing tools — degrade gracefully.

---

## 1. Run the six audit dimensions

Each dimension is independently runnable. Skip a dimension if the target type doesn't support it (e.g., visual atmosphere on a code file with no rendered preview).

### Dimension 1 — Token compliance

**Source of truth:** `.brand/tokens/{colors,typography,spacing,surfaces}.md` frontmatter.

**Detection:**
- **Hardcoded color literals.** Grep for `#[0-9a-fA-F]{3,8}\b`, `rgb(`, `rgba(`, `hsl(`, and CSS named colors (`red`, `blue`, etc.) in the target's source. Cross-reference against the project's color tokens — flag any color that isn't a token reference.
- **Raw spacing values.** Grep for arbitrary px/rem/em values in margin/padding/gap declarations: `padding:\s*\d+px`, `margin:\s*\d+px`, etc. Compare against the spacing scale in `.brand/tokens/spacing.md`. Flag values not on the scale.
- **Font family literals.** Grep for `font-family:` rules. Cross-reference against typography tokens — flag any family not declared in `.brand/tokens/typography.md`.
- **Border-radius literals.** Grep for `border-radius:\s*\d+px`. Cross-reference against `rounded` tokens in `.brand/tokens/surfaces.md`.
- **Off-tier token references.** When tokens are referenced via CSS variables (`var(--color-X)` or `theme.colors.X`), check whether the named token actually exists at that tier (semantic vs. primitive). Flag references to a tier that the brand doesn't define.

**Severity:** Hardcoded **brand-color** literals → **Critical**. Hardcoded other colors → **Major**. Off-scale spacing → **Major**. Off-scale border-radius → **Minor** unless it's a brand-distinctive value (e.g., a specific corner-radius the brand uses everywhere).

**Citation format:** `violates .brand/tokens/colors.md — found '#E2231A' in src/components/Hero.tsx:42, expected token 'color-primary' or var reference`.

### Dimension 2 — Component reuse

**Source of truth:** `.brand/components/*.md` (when present, comprehensive tier) + `sources.design_system_repo` from `.brandrc.yaml` (when present).

**Detection:**
- Read `.brand/components/inventory.md` or `.brand/components/*.md` for the list of components that exist in the project's design system.
- For each component declared there, scan the audit target for re-implementations. Heuristics:
  - A new file or function named after an existing component (e.g., target defines `Button` but `.brand/components/button.md` exists) → likely re-implementation.
  - JSX/HTML structure that matches a documented component but doesn't import it — pull the documented prop API and check for matching usage patterns.

**Severity:** Re-implementing a component that exists → **Major**. Inline duplication of a primitive (e.g., custom button in one place when 3 buttons exist on the page already) → **Minor**.

**Citation format:** `violates .brand/components/button.md — Hero.tsx:18 defines a new button component; reuse <Button variant="primary"> instead`.

### Dimension 3 — Composition anti-patterns

**Source of truth:** `.brand/composition/anti-patterns.md`.

**Detection:** Read the anti-patterns file. For each rule (e.g., "max one primary CTA per viewport", "no full-bleed brand-color backgrounds", "headlines never under 32px"), translate into a checkable signal in the target:
- Code: count primary-button instances per page, check background-color usage on full-bleed sections, etc.
- URL/screenshot: visual count of primary CTAs, identify full-bleed sections.

**Severity:** Documented anti-patterns that are explicitly forbidden in the brand guide → **Critical** or **Major** depending on the wording. "Avoid" rules → **Major**. "Prefer" rules → **Minor**.

**Citation format:** `violates .brand/composition/anti-patterns.md — pages/plan.tsx renders 3 primary CTAs in the hero section; rule says max 1 per viewport`.

### Dimension 4 — Voice

**Source of truth:** `.brand/voice.md` (both prescriptive sections and the `## Observed Voice (live channels)` section, when present).

**Detection:** Extract user-facing strings from the target:
- Code: JSX text content, button labels, aria-labels, error messages, headlines, body copy.
- URL: rendered text content via Playwright snapshot or WebFetch.
- Image: prompt the user to confirm the copy if it's not legibly extractable.

For each string, check against the voice rules:
- **Capitalization** — compare against `.brand/voice.md` "Writing Rules / Capitalization" section. Title case vs. sentence case for headings, buttons, nav.
- **Vocabulary** — flag preferred-term-violations and avoided-term usage. ("'Sign in' not 'Log in'", etc.)
- **Microcopy patterns** — error messages, empty states, button labels — compare structure against the voice rules.
- **Tone** — for body copy, infer the tone of the target's text and compare against the brand's voice attributes. (Loose check; mark these as **Minor** unless the deviation is obvious.)
- **Prescriptive vs. observed conflicts** — if the live website uses different casing than the brand guide prescribes, flag the divergence; defer to whichever has been resolved in `.brand/conflicts.md`.

**Severity:** Avoided-terms appearing in copy → **Critical** (legal/brand-blocking issues). Capitalization rule violations → **Major**. Tone deviations → **Minor**.

**Citation format:** `violates .brand/voice.md — pages/plan.tsx:67 uses 'Get Started' (title case); brand rule is sentence case ('Get started')`.

### Dimension 5 — Visual atmosphere

**Source of truth:** `.brand/overview.md` brand-self-test + `.brand/overview.md` visual-language section.

**Skip this dimension if:** the audit target has no visual representation (code-only file, no URL, no image given).

**Detection:** Use the screenshot — either provided directly, captured via Playwright when auditing a URL, or asked from the practitioner if auditing code that's running somewhere.

For each question in the brand self-test (e.g., "Could this screen belong to a competitor? (should be NO)"), evaluate the target visually and answer YES/NO with a one-line rationale.

**Severity:** Self-test failures on **Critical**-level questions (competitor lookalike, wrong color, wrong logo) → **Critical**. Other failures → **Major** or **Minor** based on the question's brand impact.

**Citation format:** `fails brand self-test Q3 (".brand/overview.md") — "Is the food photography front and center?" — NO; the hero uses an illustration instead, recommend swap to product imagery per brand visual language`.

### Dimension 6 — Conflict consistency

**Source of truth:** `.brand/conflicts.md` (active conflicts and intentional adaptations).

**Detection:** For each entry in `.brand/conflicts.md`:
- **Resolved conflicts** — the target should follow the resolution. Check the target against the recommended resolution; flag if it follows the unresolved direction.
- **Intentional adaptations** — the target should follow the adaptation. (e.g., if the brand documents that web uses Inter instead of Knockout, the target should use Inter.)

**Severity:** Target violates a `resolved-with-rationale` conflict → **Major** (you're making a decision that was already made). Target violates an `intentional-adaptation` → **Major**.

**Citation format:** `violates .brand/conflicts.md — CTA "Get Started" uses title case; conflict #01 was resolved in favor of brand-guide sentence case ("Get started")`.

---

## 2. Aggregate and score

After all applicable dimensions run, build the report:

### 2a. Compute the adherence score

```
score = 100 - (10 × critical_count) - (3 × major_count) - (1 × minor_count)
floor at 0
```

Tier the score:
- **90-100:** Strong brand adherence. Ready to ship.
- **70-89:** Solid base, fixable issues. Resolve criticals + majors.
- **50-69:** Significant drift. Multiple critical or major fixes needed.
- **<50:** Off-brand. Do not ship without rework.

### 2b. Write the report

Path: `.brand/audits/YYYY-MM-DD-<target-name>.md` — where `<target-name>` is a slug of the file path or URL (e.g., `pages-plan.md`, `localhost-3000-plan.md`, `hero-component.md`).

If `.brand/audits/` doesn't exist, create it via `mkdir`. The directory is **additive** — never delete prior audits; each run produces a new dated file.

Report shape per `schema/brand/audits.schema.md`:

```markdown
# Brand Audit — {target}

**Date:** YYYY-MM-DD
**Adherence score:** {score}/100 ({tier label})
**Audit confidence:** HIGH | MEDIUM | LOW (LOW when .brand/ is mostly placeholders or only one dimension ran)

## Summary

One paragraph: what's the target, what was checked, top 3 issues to address first.

## Findings

### Critical ({n})
| # | Dimension | Location | Rule violated | Recommended fix |
|---|-----------|----------|---------------|-----------------|
| 1 | Token compliance | `Hero.tsx:42` | hardcoded `#E2231A` | Replace with `var(--color-primary)` |
| ... |

### Major ({n})
{same shape}

### Minor ({n})
{same shape}

## Brand self-test

(Only when Dimension 5 ran)

| # | Question | Answer | Rationale |
|---|----------|--------|-----------|
| 1 | Could this screen belong to a competitor? (should be NO) | NO ✓ | TruGreen brand red and signature wordmark are present |
| 2 | Is the food photography front and center? | — | N/A for this brand |
| ... |

## Fix-it queue

Top 3-5 actions, ordered by severity then impact:
1. {action}
2. {action}
3. {action}

## Tools used

- Source-code grep on {N} files
- Playwright snapshot of {URL} (or WebFetch fallback / not used)
- Multimodal analysis of {screenshot path} (when applicable)
- Brand package: `.brand/` ({tier}, {N} files populated)

<!--
Generated by /brand-context:audit on YYYY-MM-DD.
Inputs: {target}, {.brand/ tier}.
Dimensions run: {1, 2, 3, 4, 5, 6}.
This audit is additive — earlier audits in `.brand/audits/` are not modified.
-->
```

### 2c. Surface inline summary

After writing the report, post a concise summary to the practitioner — not the full report, just:

- Adherence score + tier
- Count of findings by severity
- Top 3 fix-it items
- Path to the full report file

Example:

> **Audit complete: pages/plan.tsx**
>
> Adherence score: **72/100** (solid base, fixable issues)
> Findings: **2 critical, 5 major, 3 minor**
>
> Top fixes:
> 1. Replace hardcoded `#E2231A` in Hero.tsx (use `var(--color-primary)`)
> 2. CTA "Get Started" is title case — brand rule is sentence case ("Get started")
> 3. Hero renders 3 primary CTAs — anti-pattern says max 1 per viewport
>
> Full report: `.brand/audits/2026-05-06-pages-plan.md`

---

## 3. Re-run behavior

`/brand-context:audit` is **additive** — every run writes a new dated report. Don't overwrite earlier reports; the audit history is the practitioner's audit trail.

When auditing the same target that has a prior report:
- Note prior reports inline: "This is the third audit of `pages/plan.tsx`. Previous: 75/100 (2026-05-04), 68/100 (2026-05-01)."
- Show the score delta: "↑ 7 points since last audit, 4 prior issues resolved."
- Don't re-list resolved findings — only call out new ones and any that are still open.

---

## 4. Failure handling

| Failure | What to do |
|---|---|
| Target file/path doesn't exist | Stop. Tell the practitioner the path is wrong. |
| Target URL fails to load (network, 404) | If Playwright is in use, surface the error. Ask for a different URL or proceed with file-only audit. |
| `.brand/` is missing or all placeholders | Warn: "Brand package is empty. Audit confidence will be LOW." Offer to run `/brand-context:extract` first instead, or proceed. |
| `.brand/voice.md` missing | Skip Dimension 4. Note in summary. |
| `.brand/components/` empty + no `sources.design_system_repo` | Skip Dimension 2. Note in summary. |
| `.brand/composition/anti-patterns.md` missing | Skip Dimension 3. Note in summary. |
| `.brand/overview.md` brand-self-test missing | Skip the self-test portion of Dimension 5. Run the rest of Dimension 5 if a screenshot is available. |
| Conflict between brand-guide and observed-voice rules and `.brand/conflicts.md` is empty | Note in summary; default to brand-guide for severity decisions. |
| Practitioner asks for "all recent work" target | Run `git diff --name-only` against the most recent audit's commit (find via `git log` for `.brand/audits/`). Audit each changed file individually, aggregate. |
| Practitioner has no commits or no prior audits | Audit the working tree as-is; explain we don't have a baseline. |

---

## 5. Pitch mode

In pitch mode (`mode: pitch` in `.brandrc.yaml`):
- Same dimensions run.
- Cap audit confidence at MEDIUM (since the brand package itself was extracted from public sources only).
- In the report, prepend: `> ⚠️ Pitch mode — brand package derived from public sources. Treat as advisory.`

---

## What this skill is NOT

- **Not auto-fix.** It does not modify the audit target. Recommendations only. (Auto-fix is a logical next phase, but explicitly out of scope for v1.)
- **Not CI-only.** It can be run conversationally during iteration, not just before deployment.
- **Not a replacement for code review.** It checks brand adherence, not code quality, security, accessibility (use the dedicated a11y skills for that), or performance.
- **Not a replacement for `/brand-context:check`.** That checks brand-package completeness; this checks whether built work *follows* the package.
