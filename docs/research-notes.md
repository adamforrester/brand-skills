# Research Notes — Comparable Tools

Read-only research pass. Two repos compared against `brand-skills` for ideas worth borrowing or anti-patterns to avoid. Findings only — no auto-adoption. Surface for prioritization.

---

## design-oracle (jomvick/design-oracle)

**Description:** "Analyze any website and extract its complete design system — colors, typography, spacing, components, UX patterns — export as Tailwind config, React components, design tokens, or DESIGN.md report."

**Stack:** Python (FastAPI + ARQ worker + Playwright + BeautifulSoup) backend, Next.js 15 frontend, Redis pub/sub for live progress, SQLite for analyses. Ships a Docker Compose. Also exposes an MCP server.

**Stars:** 3 (very early). Has CI, Docker images, real architecture. Not as polished as the README implies — but the ideas are solid.

### What they do that we don't

- **Style classification ("Design DNA").** They score every site against 13 archetypes (Modern SaaS, Apple-like, Glassmorphism, Neo Brutalism, Corporate, Startup, etc.) using component presence, color palette characteristics, and spacing/radius signals. Output is `style: "Modern SaaS", style_confidence: 76`. We have nothing analogous — our `overview.md` describes personality in prose; theirs gives a typed, comparable label.
- **Component bounding-box detection on the rendered page.** They draw bounding boxes onto a screenshot overlay and ship it as `screenshot-overlay.png`. Useful for visual reports — a practitioner can see *what was detected where*.
- **UX-pattern detection as a discrete step.** Their `patterns.py` looks for "Sticky Navbar," "Social Proof," "Pricing Section," "FAQ Accordion," "Multi-step Funnel," "Dark Mode," etc. — each emitted with a confidence score. We extract tokens; we don't say "this site uses social proof in a pricing-comparison pattern."
- **Visual atmosphere score.** They compute a 0–10 visual score combining typography count, contrast pass, layout quality, and pattern count. Concrete number practitioners can compare across sites.
- **Ships exports as concrete files.** `tailwind.config.js`, `components.jsx`, `design-tokens.json`, `DESIGN.md` — generated and downloadable as separate artifacts. We write `.brand/tokens/*.md` (good) but don't emit downstream-format tokens by default.
- **MCP-server-as-output, not just MCP-as-input.** They expose `analyze_website(url)`, `get_status(id)`, `get_result(id)`, `export_*` as MCP tools. Any agent can drive their analyzer. We *consume* MCPs (Playwright, Figma) but we don't *expose* one. Notable for the multi-tenant constraint.

### Techniques worth borrowing

1. **Style classification with confidence.** Add an "archetype" inference to `overview.md` Stage 4. Currently the schema has a Jungian-archetype field that's optional and rarely used. A typed UI archetype (Modern SaaS / Apple-like / Glassmorphism / etc.) with a confidence score is more useful for AI-agent decisions than a Jungian archetype string. Could feed industry inference (task #5) as a complementary signal.
2. **UX-pattern detection as a separate stage.** Their `patterns.py` is ~70 lines of HTML/CSS heuristics — cheap to port. Output would be a new `.brand/composition/observed-patterns.md` describing what conventions the brand's live experience uses (sticky nav, hero+feature grid, etc.), separate from the prescriptive `composition/patterns.md`.
3. **Bounding-box overlay screenshot.** When Stage 2 captures a homepage, also write `.brand/captures/homepage-overlay.png` with detected components labeled. Costs a Playwright `evaluate` call; pays back in audit-report quality and practitioner trust.
4. **Visual-atmosphere score.** A single numeric quality signal complements our markdown-only `overview.md`. Fits the structured-output direction tasks #2 and #6 are heading.
5. **Expose an MCP server.** When brand-skills runs in a host project, the host could call `extract`, `audit`, `check` as MCP tools instead of as slash-commands or shell-out CLI. This would *be* the multi-tenant contract — host orchestrators don't need to parse markdown or fake "yes" responses; they call typed tools and get typed results. **Worth its own task.**

### Anti-patterns to avoid

- **Their architecture is heavy for a brand-extraction tool.** FastAPI + Redis + ARQ worker + SQLite + Next.js frontend just to extract tokens from a URL. Our deliberate-minimal-deps stance (no required CLI, no required MCP, output is plain markdown) is the right call. Don't be tempted by the Docker-Compose lifestyle.
- **Single-viewport (1440×900).** They acknowledge it as a limitation. Our Stage 2 already samples desktop + mobile — keep that.
- **No multi-source reconciliation.** They scrape one URL and report what they see. No brand-guide-vs-Figma-vs-live conflict detection. Our Stage 5 / `conflicts.md` is a real differentiator.
- **No voice extraction at all.** They extract visual signals only. Voice as a first-class extraction is ours alone.

### Implications for our task list

- **Task #2 (manifest schema)** can adopt their `style + style_confidence + visual_score + accessibility` shape as the `overview` section's machine-readable summary. Cheaper than designing one cold.
- **Task #5 (industry signal)** can borrow their style-classification approach as one input to industry weighting — "Modern SaaS" archetype + B2B language → industry prior toward enterprise/SaaS.
- **A new task worth adding:** expose brand-skills as an MCP server. Their pattern (`analyze_website`, `get_status`, `get_result`) maps cleanly to `extract`, `check`, `audit`. This is the single biggest multi-tenant unlock — host orchestrators get typed I/O without the slash-command-dispatch hack from feedback #3.

---

## Agent-Reach (Panniantong/Agent-Reach)

**Description:** "Give your AI agent eyes to see the entire internet. Read & search Twitter, Reddit, YouTube, GitHub, Bilibili, XiaoHongShu — one CLI, zero API fees."

**Stack:** Python CLI that registers `SKILL.md` files into the agent's skills directory, then delegates to upstream tools (`yt-dlp`, `twitter-cli`, `rdt-cli`, `gh`, `feedparser`, MCP servers via `mcporter`).

**Stars:** 25,969. Mature, multi-language docs (zh / en / ja / ko).

### What they do that we don't

- **Scaffold installer pattern.** A user pastes one URL into their agent: "帮我安装 Agent Reach: https://raw.githubusercontent.com/.../docs/install.md". Agent reads it, installs CLI, registers SKILL.md files, configures MCPs. We have `claude plugin install` — comparable, but there's a UX difference: their model lets *any* agent install the skills via a markdown file the agent can read. We're tied to the Claude Code marketplace.
- **`agent-reach doctor` — channel-by-channel status command.** Each channel module has a `check()` method that returns ok/missing/blocked. Output: a per-channel readiness table the user can act on. We have `brand-cli score` (file-by-file). Their `doctor` model is closer to the "MCP-fallback contract" and "manifest" tasks (#2, #3) — per-channel status with what's needed to enable each.
- **Pluggable channel architecture.** Every platform has a `channels/{name}.py` that registers detection logic. The README explicitly says "不满意？换掉就行" ("not satisfied? just swap it"). Each channel is a thin wrapper around an upstream tool (yt-dlp, twitter-cli, mcporter, etc.). They don't reimplement the upstream tools — they orchestrate them.
- **Cookie / auth flow as agent-driven.** "Tell the agent: 'help me set up Twitter'" — agent walks the user through Cookie-Editor export and stores it locally. We don't have any auth flows yet; if we ever extend brand-skills to authenticated sources (private Figma files, gated brand portals), this is the cleanest pattern.
- **Safety mode and dry-run.** `--safe` (don't auto-install system packages, list them) and `--dry-run` (preview only). Both are appropriate for embedded use where the host project may not want our installer modifying its environment. Our `brand-cli setup` runs `claude mcp add` directly — would benefit from a `--dry-run`.

### Techniques worth borrowing

1. **`brand-cli doctor` as a sibling to `score`.** Score reports brand-package completeness (what's in `.brand/`). Doctor would report tooling readiness (Playwright MCP installed? Figma Console MCP authenticated? CLI version current?). Together they're the two questions a host orchestrator needs answered: "is the brand package ready?" and "is the tooling ready?" Connects to tasks #3 (MCP-fallback contract) and #6 (health.json).
2. **Pluggable-channel pattern for source extractors.** Today our extraction has one path per source type baked into the SKILL — Figma → Stage 1, web → Stage 2, social → Stage 3, etc. If we ever want to add Sketch, Penpot, Notion, Webflow, the SKILL grows linearly. Their channels/ pattern (each source = a small, swappable module) is more sustainable. Probably overkill until we have a third source type asking for an alternative implementation, but worth knowing as a pattern.
3. **Install-via-markdown pattern.** A `docs/install.md` an agent can read and act on (rather than relying on the Claude Code marketplace) makes brand-skills installable from any agent. Pairs with the multi-tenant direction. Could ship alongside the existing plugin install path.
4. **`--safe` / `--dry-run` flags on `brand-cli setup`.** Small ergonomics improvement; meaningful for users running brand-skills inside locked-down corp environments.

### Anti-patterns to avoid

- **Telling the agent "tell the agent 'help me configure Twitter'" is recursive.** It works because Claude is good enough to follow chained instructions, but it's a fragile UX pattern — the user has to remember the magic phrasing. Our slash commands (`/brand-context:extract`) are more discoverable.
- **All marketing, less spec.** The README is heavy on hype, light on the channel contract. A user evaluating whether to extend it has to read the source. Our `schema/brand/` directory is the inverse pattern — the contract is documented before the implementation. Stay on our side of that line.
- **Localized README only via separate files.** `docs/README_en.md`, `docs/README_ja.md` etc. are separate maintenance burdens. We're fine sticking with English-primary; revisit only if international adoption pulls.

### Implications for our task list

- **Task #3 (MCP-fallback contract)** should lean on the `doctor` model — emit per-MCP, per-stage status as structured output, not just inline warnings.
- **A new task worth adding:** `brand-cli doctor` as a tooling-readiness command, separate from `score`. Pairs with #3 + #6.
- **A second new task:** `docs/install.md` — agent-readable install instructions for non-Claude-Code agents. Multi-tenant unlock.

---

## Cross-cutting takeaways

Three patterns recurred across both tools that we don't have:

1. **Typed, structured output as a first-class deliverable.** Both tools emit JSON sidecars and exposed APIs (REST or MCP). We emit markdown only. Tasks #2 and #6 already address this; the research validates the direction and gives us a shape to copy from design-oracle.
2. **Tooling readiness as a separate concern from data readiness.** `agent-reach doctor` (tooling) vs our `brand-cli score` (data). Both should exist. They answer different questions a host orchestrator needs to ask before dispatching.
3. **Pluggability of source extractors.** Both tools are explicitly extensible at the source-channel layer. We aren't yet — adding a new source type means editing the SKILL. Not urgent, but it's the architecture that lets brand-skills grow beyond our current source list without bloating the SKILL.

### Tasks to consider adding (post-prioritization, not adding now)

1. **Expose brand-skills as an MCP server.** Multi-tenant unlock. Hosts call typed tools instead of dispatching slash commands.
2. **`brand-cli doctor`.** Per-MCP, per-source tooling readiness. Pairs with #3 + #6.
3. **`docs/install.md` agent-readable installer.** Lets non-Claude-Code agents adopt the skills without the marketplace.

I'd hold these as candidate tasks but not file them yet — let's prioritize the existing six first, decide which of these are real follow-ons, then add. Avoids backlog bloat.

### What does NOT need to change

- Our minimal-dependency philosophy (no required CLI / MCP / framework). Design-oracle's heavy stack is the wrong direction for us.
- Our voice extraction. No comparable feature in either tool.
- Our cross-source conflict detection. Real differentiator.
- Our additive write policies on `voice.md` and `conflicts.md`. Both tools overwrite wholesale; ours is more sophisticated.
