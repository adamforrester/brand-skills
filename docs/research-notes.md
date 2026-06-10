# Research Notes — Comparable Tools

Read-only research. Three repos compared against `brand-skills` for ideas worth borrowing or anti-patterns to avoid. Findings only — no auto-adoption.

Order is by relevance: dembrandt is the closest peer and the strongest reference. design-oracle and Agent-Reach are secondary.

---

## Primary reference: dembrandt (dembrandt/dembrandt)

**Description:** "Extract a website's design system into design tokens in a few seconds: logo, colors, typography, borders, and more. One command."

**Stack:** Node + TypeScript. CLI (`dembrandt example.com`), npm-published, ships an MCP server alongside. Playwright-driven extraction with anti-bot fallbacks (`--browser=firefox`, `--stealth` opt-in). MIT license, 1.9K stars, actively maintained.

**Companion repo:** [`dembrandt-skills`](https://github.com/dembrandt/dembrandt-skills) — separate, optional skill pack with UX intelligence (algorithmic palette derivation, type scales, accessibility heuristics, a 6-stage UX orchestrator). Same composition pattern as `brand-skills + xd-toolkit`. Validates our split-repo direction.

### What they do better than us today

1. **W3C DTCG token format export** (`--dtcg`). Industry-standard JSON schema. Style Dictionary, Tokens Studio, Figma plugins all consume it. We emit our own markdown shape only.
2. **Motion tokens extracted automatically** — duration scale, easing curves, per-context profiles, hover-state deltas (transform / opacity / background / color). We have `tokens/motion.md` in the schema but Stage 2 never populates it.
3. **Multi-page crawl with confidence boosting** — tokens appearing on N pages get HIGHER confidence scores. We sample a few pages but don't reconcile across them.
4. **WCAG contrast as a real DOM walk, not palette-based.** Simulates hover, focus, disabled states and checks contrast on each. Our `/brand-context:audit` doesn't do this.
5. **MCP server design.** 7 typed tools (`get_design_tokens`, `get_color_palette`, `get_typography`, `get_component_styles`, `get_surfaces`, `get_spacing`, `get_brand_identity`) + `get_job_status` / `cancel_job`. Job queue with sync/async modes — async by default returns `job_id`, `sync: true` blocks. Mature design we can borrow directly when we expose our own MCP.
6. **DESIGN.md export following Google's spec strictly.** They omit sections with no observed evidence; we scaffold placeholder sections.
7. **Brand guide PDF export** (`--brand-guide`). Stakeholder hand-off artifact we don't produce.
8. **Browser-revision discipline.** Their CLI surfaces "Executable doesn't exist" with the exact `npx playwright@<version> install` command to fix. Small UX, real impact when things break.

### What we do better than them

1. **Voice extraction.** dembrandt extracts zero copy/voice. URL-only, visual-only.
2. **Multi-source reconciliation.** dembrandt is URL-only. No PDF, no Figma, no social, no app stores. No `conflicts.md` equivalent.
3. **Brand audit.** They extract; they don't score work-against-brand. `/brand-context:audit` is unique to us.
4. **Industry signal** (planned task #5). Not in dembrandt.
5. **Tier model with comprehensive DS-repo scan.** Our Stage 6 (component inventory from a real codebase) has no analog. Their `get_component_styles` reads styles from rendered HTML, not from source.

### Anti-patterns to avoid

- **Sponsor-gated features.** dembrandt's drift comparison and CI ingest API are in their paid tier. Our roadmap (`/brand-context:audit` auto-fix mode, CI integration) puts those in the free CLI. Stay there.
- **`--stealth` / anti-detection flags.** Their flag has an "only when authorized" caveat. Legal/ethical territory. Don't add these.

### Worth borrowing

| Item | Borrow type | Notes |
|---|---|---|
| **DTCG export format** | Schema | `brand-cli refresh-design --dtcg` → writes `.tokens.json`. Pure schema borrow, no code dependency. |
| **MCP server tool shape** | API design | When we expose our own MCP, model on their `get_*` tools + job queue + sync/async pattern. |
| **Motion token extraction** | Approach | Populate `tokens/motion.md` from CSS transitions/animations. Approach is borrowable; code MIT-licensed if we ever want it. |
| **Multi-page confidence boosting** | Approach | Tokens on multiple pages → HIGH confidence; on one page → MEDIUM/LOW. Small change to our Stage 2 reconciliation. |
| **DESIGN.md "omit empty sections" rule** | Convention | Their version of the spec is stricter than our generator's. Adopt the omit-empty-sections rule for our `design.md`. |
| **WCAG state-simulating contrast walk** | Approach | Add to `/brand-context:audit` Dimension 5. |

---

## Secondary reference: design-oracle (jomvick/design-oracle)

**Description:** "Analyze any website and extract its complete design system." Python (FastAPI + ARQ + Playwright + BeautifulSoup) + Next.js frontend + Redis + SQLite. MCP server. 3 stars, real architecture.

### Worth borrowing

1. **Style classification with confidence ("Design DNA").** Scores sites against 13 archetypes (Modern SaaS, Apple-like, Glassmorphism, Neo Brutalism, Corporate, Startup, etc.) with a confidence score. More useful for AI-agent decisions than the optional Jungian-archetype field in our `overview.md` schema. Could complement task #5 (industry signal).
2. **UX-pattern detection as a separate stage.** ~70 lines of HTML/CSS heuristics in their `patterns.py` — sticky nav, social proof, pricing, FAQ accordion, etc. Output: `.brand/composition/observed-patterns.md` (descriptive — what conventions the live site uses) alongside the prescriptive `composition/patterns.md`.
3. **Bounding-box overlay screenshot.** Useful for audit reports — practitioners see *what was detected where*.
4. **Visual-atmosphere score.** Single 0–10 number combining typography count, contrast pass, layout quality, pattern count.

### Don't copy

- Heavy stack (FastAPI + Redis + ARQ + SQLite + Next.js) for a brand-extraction tool. Our minimal-deps stance is right.
- Single viewport. We already sample desktop + mobile.
- No multi-source reconciliation. Real differentiator we should keep.

---

## Secondary reference: Agent-Reach (Panniantong/Agent-Reach)

**Description:** "Give your AI agent eyes to see the entire internet." Python CLI that registers `SKILL.md` files into the agent's skills directory, then delegates to upstream tools (`yt-dlp`, `twitter-cli`, `gh`, `feedparser`, MCP servers via `mcporter`). 26K stars.

### Worth borrowing

1. **`agent-reach doctor` — channel-by-channel readiness command.** Per-channel `check()` returns ok / missing / blocked. Exact pattern we want for task #3 (MCP-fallback contract) and task #6 (health.json). Suggests a `brand-cli doctor` sibling to `brand-cli score` — score reports data readiness, doctor reports tooling readiness.
2. **Pluggable channel architecture.** Each source = a small swappable module (`channels/web.py`, `channels/twitter.py`, etc.). Sustainable as the source list grows. Probably not urgent until we have a third source type asking for an alternative implementation, but worth knowing.
3. **`--safe` and `--dry-run` flags on installer.** Appropriate for embedded use where the host project doesn't want our installer modifying its environment.

### Don't copy

- All-marketing, light-on-spec README pattern. Stay on our side of that line.
- Agent-recursion UX ("tell the agent: 'tell the agent help me configure X'"). Fragile.

---

## Cross-cutting takeaways

Three patterns recur across all three tools that we don't have:

1. **Typed, structured output as a first-class deliverable.** All three emit JSON sidecars and/or expose APIs. We emit markdown only. Tasks #2 and #6 already address this; the research validates the shape — borrow dembrandt's MCP tool schemas as the reference.
2. **Tooling-readiness as a separate concern from data-readiness.** Pattern from Agent-Reach (`doctor`). Should be a new task.
3. **Pluggability of source extractors / output formats.** dembrandt: DTCG and DESIGN.md and brand-guide-PDF and JSON, all from the same extraction. Agent-Reach: pluggable channels. We do one output (markdown into `.brand/`). Worth thinking about.

### Open strategic question (decision pending)

**Do we depend on dembrandt, borrow from it, or stay independent?**

Three options:

1. **Depend.** Install dembrandt; brand-skills wraps it for the brand-package layer (voice, conflicts, audit, multi-source).
2. **Borrow without dependency.** Adopt patterns and schemas (DTCG, motion, MCP shape, multi-page confidence) but reimplement.
3. **Hybrid.** brand-skills works standalone; if dembrandt is installed (CLI or MCP), defer Stage 2 to it. Same pattern as our existing Playwright-or-fallback graceful degradation.

Decision deferred — see chat discussion. Implications affect tasks #2, #3, and the candidate "expose as MCP server" task.

### Candidate follow-on tasks (not yet filed)

From the research, three new tasks worth considering after current backlog:

1. **DTCG token export** — `brand-cli refresh-design --dtcg`. Small, decoupled, high-value (Style Dictionary + Tokens Studio interop).
2. **`brand-cli doctor`** — tooling readiness sibling to `brand-cli score`. Pairs with #3 + #6.
3. **Expose brand-skills as MCP server** — biggest multi-tenant unlock. Model on dembrandt's design.

Two more from dembrandt specifically:

4. **Motion token extraction in Stage 2** — populate `tokens/motion.md`.
5. **Multi-page confidence boosting in Stage 2** — small change to reconciliation logic.

### What does NOT need to change

- Our minimal-dependency philosophy (no required CLI / MCP / framework).
- Our voice extraction. No comparable feature in any of the three tools.
- Our cross-source conflict detection. Real differentiator.
- Our additive write policies on `voice.md` and `conflicts.md`. All three tools overwrite wholesale; ours is more sophisticated.
