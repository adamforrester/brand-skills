---
description: Audit a target (file, directory, URL, or screenshot) against the project's .brand/ package. Reports adherence score and severity-ranked findings across token compliance, component reuse, composition anti-patterns, voice, visual atmosphere, and active conflicts. Report-only — does not modify the audit target.
argument-hint: "[target — file path, URL, or screenshot path. Optional: skill prompts if missing.]"
---

Invoke the `brand-audit` skill on the target the user names (file path, directory, URL, or image path). The skill handles target resolution, brand-package detection, the six audit dimensions (token compliance, component reuse, composition, voice, visual atmosphere, conflict consistency), severity classification, score computation, report writing to `.brand/audits/`, and the inline summary.

**Pre-flight requirements:**
- A target — file/directory path, URL, or image path. The skill will prompt if missing.
- `.brand/` package exists. Audit confidence is **LOW** when the package is mostly placeholders; the skill warns but proceeds.

**Recommended (not required):**
- **Playwright MCP** — for full-quality URL audits (computed styles + screenshot for the visual-atmosphere dimension). Without it, URL audits fall back to native `WebFetch` (text content only); the visual dimension is skipped.
- **Populated `.brand/`** — token files, voice.md, overview.md, anti-patterns, conflicts. Empty dimensions are skipped with a note in the report.

**Reports** are additive: each run writes a new dated file at `.brand/audits/YYYY-MM-DD-<target>.md`. Prior reports are never modified — the directory is the audit trail. Re-running on the same target shows score delta and which prior findings were resolved.

**This skill is report-only.** It does not modify the target. Auto-fix is a planned future phase.
