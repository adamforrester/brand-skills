---
description: Extract a complete brand package from Figma, live website, brand-guide PDF, and reference screenshots into .brand/, plus regenerate design.md and brand.md at project root. Runs the full pipeline (Stages 1–6 + 8) with graceful degradation when sources or MCPs are missing.
argument-hint: ""
---

Invoke the `brand-extract` skill. It handles pre-flight, scope confirmation, the full extraction pipeline (Figma tokens, web tokens, voice samples, multimodal overview, conflict detection, design-system repo scan), and regeneration of `design.md` and `brand.md` at the project root.

**Pre-flight requirements:**
- `.brandrc.yaml` must exist (run `brand-cli init` first if it doesn't).
- At least one source must be defined (`sources.website`, `sources.figma`, `sources.brand_guide`, or `sources.screenshots`).

**Recommended (not required):**
- **Playwright MCP** — for full Stage 2 (web token) and Stage 3 (voice) quality. Run `brand-cli setup` to install in one command. Without it, Stage 2 is skipped and Stage 3 falls back to native WebFetch.
- **Figma Console MCP** — only when Figma is a source. Needs a Figma personal access token.
- **`brand-cli`** — speeds up Stages 7 (design.md regen) and 8 (brand.md regen). Without it the skill falls back to inline regeneration.

If a pre-flight check fails, the skill surfaces the specific issue and the fix command before stopping. If a recommended tool is missing, the skill warns once and proceeds with the appropriate fallback.
