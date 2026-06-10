# DESIGN.md

Architectural overview of `brand-skills`. For day-to-day editing rules, see `CLAUDE.md` at the repo root. For end-user install and usage, see `README.md`.

This file explains *why* the project is shaped the way it is — the constraints that drove the layering, and the invariants that have to hold as the project evolves.

---

## What problem this solves

AI coding agents (Claude Code, Cursor, Copilot, etc.) make plausible-but-wrong design decisions when they don't have the brand in context: they pick generic palettes, write the wrong tone, and re-implement components that already exist. Manually maintaining a "brand context" file per project doesn't scale — every brand has different sources (a PDF here, a Figma file there, a live website everywhere) and the source-of-truth is rarely in one place.

`brand-skills` automates the extraction. The output is a structured `.brand/` package plus two interop artifacts — `design.md` (spec-compliant) and `brand.md` (dense, agent-loadable) — that any AI tool can consume.

---

## Three-layer architecture

The repo is deliberately split into three layers that change at different rates:

```
┌─────────────────────────────────────────────────────────┐
│  schema/brand/*.schema.md                                │
│  Source of truth for .brand/ file shapes.                │
│  Changes rarely. The contract.                           │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│  brand-context/skills/*/SKILL.md                         │
│  AI agent instructions — how to extract, audit, check.   │
│  Changes most often (new sources, new heuristics).       │
└─────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────┐
│  cli/src/                                                │
│  Deterministic regen — init, refresh-design,             │
│  refresh-context, score, setup.                          │
│  Mirrors what SKILL.md does for the no-AI path.          │
└─────────────────────────────────────────────────────────┘
```

**Why three layers and not one:**

- **Schema is separate from instructions** because users edit `.brand/` files by hand. The schema is the contract they read; the SKILL is one consumer of that contract (the AI extraction path), not the contract itself.
- **CLI is separate from SKILL** because deterministic operations (scaffolding files, computing a completeness score, regenerating `design.md` from existing `.brand/` content) shouldn't burn AI tokens or depend on a Claude Code session. Practitioners can run `brand-cli` from any shell.
- **Both CLI and SKILL exist** because not every user has the CLI installed. SKILL files include inline-fallback instructions that produce the same output the CLI would. CLI is canonical; SKILL fallback is the spec in prose.

This is the most important invariant in the repo: **CLI output and SKILL inline-fallback output must be identical for a given input.** If they diverge, fix the SKILL.

---

## Three artifacts, one source of truth

```
.brand/                    ← rich, structured, hand-editable
├── overview.md
├── voice.md
├── tokens/{colors,typography,spacing,surfaces}.md
├── components/*.md
├── conflicts.md
└── audits/*.md

design.md                  ← spec-compliant interop artifact (regenerated)
brand.md                   ← dense agent-context file (regenerated)
```

`.brand/` is the **source of truth**. Practitioners and AI agents edit it. It's deliberately decomposed: per-domain files with prose rationale, citations, and structured frontmatter, so a practitioner can edit `voice.md` without touching `tokens/colors.md`.

`design.md` and `brand.md` are **generated artifacts**, regenerated from `.brand/` on every extraction:
- `design.md` follows the [google-labs-code/design.md spec](https://github.com/google-labs-code/design.md) so external tools that support that spec can read it directly.
- `brand.md` is dense (~200–400 tokens) and loaded by AI agents on every interaction without bloating context — pointers to deeper `.brand/` files for on-demand loading.

**Never edit `design.md` or `brand.md` by hand.** Edits there are erased on the next regen. Edit `.brand/` and re-run `brand-cli refresh-design` / `brand-cli refresh-context`.

---

## File-write policies

Every `.brand/` file has an explicit policy because the project is multi-tenant in time: a practitioner's hand-edits and an AI extraction's machine-edits both have to coexist without one erasing the other.

| File | Policy | Rationale |
|---|---|---|
| `tokens/*.md` | Overwrite when placeholder; prompt when populated | Tokens are values; replacement is fine when it's scaffolding |
| `voice.md` | **Additive** — Stage 3 owns only `## Observed Voice (live channels)`; prescriptive sections preserved | Voice principles often come from a brand guide; AI extraction is descriptive, not authoritative |
| `overview.md` | Overwrite when placeholder; prompt when populated; merge regenerates only the brand-self-test | Single coherent doc with one safely-regeneratable subsection |
| `conflicts.md` | **Additive** — Active Conflicts rebuilds, but Intentional Adaptations and Resolved Archive are never deleted | The archive is the practitioner's audit trail |
| `components/*.md` | Overwrite per-file when provenance marker present | Auto-generated from repo scan; hand edits go to a sibling file |
| `audits/*.md` | **Additive** — every run is a new dated file | The directory IS the audit trail |
| `design.md`, `brand.md` | Overwrite wholesale | Generated; source is `.brand/` |

The "additive" cases are the load-bearing ones. They're why `voice.md` and `conflicts.md` use `Edit` (surgical replacement) rather than `Write` (full overwrite) in their respective SKILL sections.

---

## Pipeline shape

`brand-extract/SKILL.md` runs eight stages (numbering is historical — there is no Stage 7):

| Stage | Output | Tool dependency |
|---|---|---|
| 1 | `tokens/*.md` from Figma vars | Figma Console MCP |
| 2 | `tokens/*.md` from web computed CSS | Playwright MCP |
| 3 | `voice.md` Observed Voice section | Playwright MCP (preferred) or WebFetch |
| 4 | `overview.md` from PDF + screenshots | Native `Read` (multimodal) |
| 5 | `conflicts.md` from cross-source diffs | None — operates on Stage 1–4 outputs |
| 6 | `components/*.md` from DS repo | Bash (git clone) + Read |
| 8 | `brand.md` regen | `brand-cli refresh-context` (or inline) |
| —  | `design.md` regen | `brand-cli refresh-design` (or inline) |

Every stage is independently skippable. Missing source → skip; missing MCP → skip or degrade. The pipeline never hard-fails on a missing input; it surfaces what was skipped in the final summary.

---

## Audit dimensions

`brand-audit/SKILL.md` checks a target (file / directory / URL / screenshot) against the `.brand/` package across six dimensions, each citing the rule it found violated:

1. **Token compliance** — hardcoded colors, off-scale spacing, font-family literals, off-scale border-radius, references to non-existent tokens
2. **Component reuse** — re-implementations of components already documented in `.brand/components/`
3. **Composition anti-patterns** — rules from `.brand/composition/anti-patterns.md` translated to checkable signals
4. **Voice** — capitalization, vocabulary, microcopy patterns, tone deviations
5. **Visual atmosphere** — the `overview.md` brand-self-test, when a screenshot is available
6. **Conflict consistency** — does the target follow the resolutions captured in `.brand/conflicts.md`?

The score is `100 - 10×critical - 3×major - 1×minor` (floored at 0). Reports are written additively to `.brand/audits/YYYY-MM-DD-<target>.md` — never overwritten.

---

## What's deliberately out of scope

- **Auto-fix.** `/brand-context:audit` is report-only by design. Future versions may add a confirmed-fix mode for low-risk findings, but the report-only contract holds today.
- **CI-only operation.** The skills are built for conversational use during iteration. Headless CI is a planned addition, not a current invariant.
- **Brand strategy.** The tool extracts what's already there; it doesn't generate brand identity from scratch.
- **Component generation.** `.brand/components/` describes what's there; emitting code stubs is a roadmap item, not a current capability.

---

## Decoupling principles

The project is intentionally minimal-dependency:

- **No required MCP installs.** Playwright is recommended (Stage 2/3 quality), Figma Console is optional. With nothing installed, Stages 4, 5, 6, 7, 8 still run and Stage 3 falls back to native `WebFetch`.
- **No required CLI install.** Skills include inline regeneration that produces the same artifacts, just slower.
- **No coupling to a specific agent.** Output is plain markdown; Claude Code, Cursor, Copilot, and Cline all consume it the same way they consume `CLAUDE.md` or `.cursorrules`.

These aren't accidents — they're load-bearing. Every new feature should preserve the graceful-degradation property.
