# brand-skills

> AI-agent skills + CLI for extracting structured brand packages from client assets — Figma variables, live website CSS, social copy, brand-guide PDFs, and reference screenshots — into a `.brand/` directory plus a spec-compliant `design.md` and a project-root `brand.md`.

**Status:** Early access. Pipeline is feature-complete; install paths are stable; documentation is being expanded.

---

## What it does

Run `/brand-context:extract` once, get a structured brand package any AI agent can read:

```
your-project/
├── .brand/
│   ├── overview.md           # identity, personality, audience, visual language, anti-patterns, self-test
│   ├── voice.md              # voice principles + observed live channels
│   ├── tokens/
│   │   ├── colors.md         # YAML frontmatter + prose
│   │   ├── typography.md
│   │   ├── spacing.md
│   │   └── surfaces.md       # rounded + elevation
│   ├── components/           # comprehensive tier — design-system codebase scan
│   ├── conflicts.md          # cross-source divergences with practitioner-resolved status
│   └── ...
├── design.md                 # generated, follows https://github.com/google-labs-code/design.md
├── brand.md                  # generated, dense brand context for any agent
└── .brandrc.yaml             # project config (sources, tier, mode)
```

Three slash commands:
- **`/brand-context:extract`** — runs the full extraction pipeline (or a subset based on what sources are available)
- **`/brand-context:check`** — reports completeness, surfaces gaps, suggests next actions
- **`/brand-context:audit`** — scores a build target (file, URL, or screenshot) against the brand package; produces a severity-ranked findings list and an adherence score; reports go to `.brand/audits/`

A small CLI (`brand-cli`) for the deterministic non-AI bits (scaffold, regenerate root artifacts, score completeness, install MCPs).

---

## Install

### 1. The skill (in Claude Code)

```bash
claude plugin marketplace add adamforrester/brand-skills
claude plugin install brand-context@brand-skills
```

That gives you `/brand-context:extract` and `/brand-context:check` in any Claude Code project.

### 2. The CLI (recommended — speeds up regeneration, no AI tokens needed)

```bash
npm install -g brand-skills
```

Provides `brand-cli init`, `brand-cli refresh-design`, `brand-cli refresh-context`, `brand-cli score`, `brand-cli setup`.

The skill calls into `brand-cli` automatically when present. Without it, the skill falls back to inline regeneration via Claude reasoning — works, just slower and uses more tokens per run.

### 3. Recommended: Playwright MCP (one command, no signup)

```bash
brand-cli setup
```

This detects whether Playwright MCP is installed and offers to add it. Or directly:

```bash
claude mcp add playwright -s user -- npx -y @playwright/mcp@latest
```

Why bother: Playwright gives you computed CSS for Stage 2 (web token extraction) and the accessibility tree for Stage 3 (voice extraction). Without it the skill still works — Stage 2 is skipped, Stage 3 falls back to native `WebFetch` — but quality is meaningfully lower.

### Other optional integrations

- **Figma Console MCP** — when Figma is a source, this gives you variable extraction. Install: `claude mcp add figma-console -s user -e FIGMA_ACCESS_TOKEN=YOUR_TOKEN -- npx -y figma-console-mcp@latest`. Needs a [Figma personal access token](https://help.figma.com/hc/en-us/articles/8085703771159).
- **Firecrawl MCP** — paid plan; faster bulk web scraping when you have one. Default is Playwright.

---

## Quick start

```bash
mkdir my-brand && cd my-brand
brand-cli init --brand "ACME Corp"  # `--client` is accepted as a deprecated alias
```

Then add your sources to `.brandrc.yaml`:

```yaml
brand: ACME Corp
tier: standard
mode: standard
industry: B2B SaaS analytics       # optional, free-form; Stages 3+4 use it as a soft tie-breaker prior
sources:
  website: https://acme.example.com
  website_pages: ["/about", "/products"]
  figma: ["abc123def456"]            # optional
  brand_guide: assets/brand-guide.pdf  # optional
  screenshots: [assets/hero.png]       # optional
  social:
    twitter: https://x.com/acmecorp
  design_system_repo: ./packages/ds    # optional; when set, Stage 6 runs at any tier
```

In Claude Code:

```
/brand-context:extract
```

The skill walks you through scope confirmation, runs the pipeline, surfaces conflicts for your decision, and writes everything. Then `/brand-context:check` to see completeness.

---

## How the pipeline works

| Stage | What it does | Fallback chain (top-to-bottom; first-available fires) |
|---|---|---|
| 1 | Figma variable extraction → tokens | `figma-console` MCP (full) → `assets/*.tokens.json` DTCG export (degraded) → SKIP. Pre-condition: `sources.figma` set or DTCG file present. |
| 2 | Web token extraction (computed CSS) → tokens | `playwright` MCP (full) → SKIP. No usable middle tier. |
| 3 | Voice extraction (samples → attributes, tone, vocabulary) | `playwright` MCP (full) → Jina Reader `r.jina.ai` (degraded, keyless HTTP) → native `WebFetch` (degraded, SSR sites only). |
| 4 | Multimodal analysis → `overview.md` | Native `Read` tool + brand-guide PDF or screenshots |
| 5 | Cross-source conflict detection → `conflicts.md` | Outputs from Stages 1–4 |
| 6 | Design-system repo scan → `components/*.md` | Local path or remote git URL. Runs whenever `sources.design_system_repo` is set, regardless of tier. |
| 8 | Regenerate `design.md` + `brand.md` | `brand-cli refresh-design` and `refresh-context` (or inline fallback) |

**Always also emitted:**

- `.brand/manifest.json` — machine-readable record of what extract just did (per-file status, per-stage outcome, MCP availability). Hosts gate on it.
- `.brand/.health.json` — readiness verdict written every time `brand-cli score` (or `/brand-context:check`) runs.

The fallback chains themselves are declared as data in [`schema/mcp-fallback-contract.json`](schema/mcp-fallback-contract.json); both the SKILL prose and the CLI consume it. To audit chains or add a new fallback tier, edit the contract first.

For **embedded use** (a host orchestrator dispatching the SKILL non-interactively), drop a `.brand/.scope.json` file with structured answers to Stage 0's discovery questions. The SKILL pre-fills `.brandrc.yaml` from it, skips the conversational flow for any field already populated, and deletes `.scope.json` after a successful Stage 0 completion. Standalone use is unchanged. Schema: [`schema/brand/scope.schema.json`](schema/brand/scope.schema.json). Spec: [`docs/superpowers/specs/2026-06-14-scope-json-design.md`](docs/superpowers/specs/2026-06-14-scope-json-design.md).

The optional top-level `industry` field flows through both `.brandrc.yaml` and `.brand/.scope.json` as a free-form descriptive string. When set, Stages 3 (voice) and 4 (overview) use it as a soft tie-breaker prior on inference and cite it inline as `*(industry context: <value>)*`. Safe to omit. Spec: [`docs/superpowers/specs/2026-06-15-industry-signal-design.md`](docs/superpowers/specs/2026-06-15-industry-signal-design.md).

Each stage is independently skippable. The skill degrades gracefully — if a source or tool is missing, that stage is skipped or falls back to a simpler method, and the rest of the pipeline runs.

---

## Decoupling notes

This package is intentionally minimal-dependency:

- **No required MCP installs.** Playwright is recommended (Stage 2/3 quality), Figma Console is optional (only when Figma is a source). Without any MCPs, the skill runs Stages 4, 5, 6, 8 plus a degraded Stage 3 via native WebFetch.
- **No required CLI install.** The skill falls back to inline regeneration when `brand-cli` is absent.
- **No tie to any specific agent toolchain.** Output files are generic markdown the skill writes via `Write`/`Edit`. Other tools (Cursor, Copilot, Cline, generic Claude Code) consume them by reading project-root `brand.md` and `design.md` — the same way they consume `CLAUDE.md` or `.cursorrules`.
- **AI-agent context-gathering interop.** Mirror `brand.md` to additional paths via `brand-cli refresh-context --also-write <path>` (repeatable) or by listing them under `outputs: [path, ...]` in `.brandrc.yaml`. Common targets: `.impeccable.md` ([Impeccable](https://github.com/pbakaus/impeccable)), `.cursor/rules/brand.md` (Cursor), `.github/copilot-instructions.md` (Copilot). The legacy `--impeccable` flag is preserved as a deprecated alias of `--also-write .impeccable.md`.

---

## Why this exists

The structured `.brand/` package is the source of truth. `design.md` and `brand.md` are generated artifacts — both small enough to live in agent context, both regenerated whenever `.brand/` changes.

This separation matters because:
1. **`.brand/` is rich.** Per-domain files with prose rationale, citations, and structured frontmatter. A practitioner can edit any one of them without touching the others.
2. **`design.md` is interoperable.** Follows the [google-labs-code/design.md spec](https://github.com/google-labs-code/design.md). Tools that support that spec read it directly.
3. **`brand.md` is dense.** ~200–400 tokens. Loaded by any agent on every interaction without bloating context.

The skill keeps all three in sync.

---

## Repo layout

```
brand-skills/
├── .claude-plugin/marketplace.json   # Claude Code plugin manifest
├── brand-context/                    # the plugin (slash command namespace)
│   ├── skills/
│   │   ├── brand-extract/SKILL.md    # main extraction skill
│   │   ├── brand-check/SKILL.md      # completeness check skill
│   │   └── brand-audit/SKILL.md      # brand-adherence scoring
│   └── commands/
│       ├── extract.md                # → /brand-context:extract
│       ├── check.md                  # → /brand-context:check
│       └── audit.md                  # → /brand-context:audit
├── cli/                              # npm package
│   ├── bin/brand-cli.js
│   └── src/
│       ├── commands/                 # init, setup, refresh-design, refresh-context, score
│       └── utils/                    # generators
├── schema/brand/                     # 17 .brand/ schema reference files
├── package.json                      # ships the CLI to npm
└── README.md
```

---

## Roadmap

- **`/brand-context:audit` auto-fix mode** — today the audit is report-only; future versions will offer to apply low-risk fixes (token swaps, casing corrections) with practitioner confirmation
- **`/brand-context:refresh`** — explicit re-run with a structured diff against the previous extraction (today, re-running `/brand-context:extract` does this implicitly via the additive policies on `voice.md` and `conflicts.md`)
- **Component generation from `.brand/components/`** — emit code stubs in the project's framework
- **Publish to npm** (currently install-from-GitHub)
- **CI integration** — `brand-cli audit` headless mode for pre-merge gates

---

## License

MIT. See `LICENSE`.
