# XD-Assumption Inventory

**Status:** Read-only audit. Findings only — no fixes proposed here. Prioritization happens in a follow-up.
**Date:** 2026-06-10
**Scope:** README, the three SKILL.md files, command files, CLI source, schema/, against the question "would a non-XD-practitioner user be blocked, alienated, or confused by this?"

The threshold (per scope clarification): only flag assumptions that **genuinely block or alienate** a non-XD user. Mere XD-flavored vocabulary that doesn't impede use is excluded — otherwise the inventory becomes noise.

Each finding captures:
- **What** — the assumption stated plainly
- **Where** — file path + line/section
- **Who it excludes** — concrete example user
- **Disruption to loosen** — small (rewording) / medium (new config or fallback path) / large (architectural shift)

Findings are grouped by impact, not by file.

---

## Critical (genuinely blocks non-XD use)

### 1. The "comprehensive tier" workflow schemas assume a deliverable-prototype workflow

**What:** The `workflows/*.schema.md` files (build-sequence, deploy, qa-checklist, figma-to-code, code-standards) describe a workflow specifically for **building a coded prototype that ships to a hosting platform**. Build sequences reference Storybook reviews. Deploy targets are Netlify/Vercel. QA checklists reference Lighthouse and Unlighthouse against `localhost:3000`. The "build-sequence" schema's three modes are *"code library exists" / "Figma only" / "pitch mode"* — all three assume a prototype is the output.

**Where:**
- `schema/brand/workflows-build-sequence.schema.md` — entire schema
- `schema/brand/workflows-deploy.schema.md` — entire schema; Netlify-specific example
- `schema/brand/workflows-qa-checklist.schema.md` — entire schema, Lighthouse/Unlighthouse focus
- `schema/brand/workflows-figma-to-code.schema.md` — Figma + Storybook pipeline
- `schema/brand/workflows-code-standards.schema.md` — Next.js/Tailwind defaults
- `cli/src/commands/init.js:32-37` — scaffolds these files at the comprehensive tier
- `schema/brand/brandrc.schema.md:21-26` — `deploy.platform: netlify | vercel` is a top-level `.brandrc.yaml` field

**Who it excludes:** A marketing-ops team using brand-skills to keep AI-generated email copy on-brand. A documentation team building brand-aware docs. A product engineer at a SaaS company who has *no* Figma, *no* prototype, and *no* deploy step — they just want their AI agent to write code in the brand voice. None of these users have a "prototype to deploy" — yet `comprehensive` tier scaffolds five files describing how to deploy one.

**Disruption to loosen:** **Large.** The comprehensive tier's defining files would need to become optional or extension-pluggable. The tier model itself may need rethinking — today "comprehensive" means "comprehensive for an XD prototyping workflow," not "comprehensive for any brand-aware workflow."

---

### 2. `client` is a required field — assumes an agency/consulting context

**What:** `.brandrc.yaml` requires a `client` field. `brand-cli init` prompts: `Client name:`. `score.js`, `refresh-context.js`, and `refresh-design.js` all read it as `cfg?.client`. The README quick-start example uses `--client "ACME Corp"`. The schema describes it as "Client name as used in brand materials."

**Where:**
- `schema/brand/brandrc.schema.md:17` — `client | required | string | Client name`
- `cli/src/commands/init.js:69-73` — required prompt with empty-string validation
- `cli/src/commands/refresh-context.js:19, 26` — `client = projectDir.split('/').pop() || 'Brand'`, overwritten from `.brandrc.yaml`
- `README.md:86, 92` — `--client "ACME Corp"`
- `brand-context-generator.js` — used as `# Brand Context — ${brandName}` heading

**Who it excludes:** An in-house team building their own product's brand-aware AI workflow (no client — they ARE the brand). A solo founder. An open-source project setting up brand context for community contributions.

**Disruption to loosen:** **Small.** Rename to `brand` (already what `brandName` is called in the generator). Make `init` accept the directory name as default. Frame the field as "the brand this package describes" instead of "client name." No structural change.

**Status:** Closed in `feat/de-xd-cleanup`. `client` accepted as a deprecated alias; manifest schema retains `client` as the persisted artifact field name (see [D0] in the de-XD progress doc).

---

### 3. The "tier model" conflates extraction completeness with workflow elaboration

**What:** Three tiers are documented (`minimum`, `standard`, `comprehensive`). The `minimum` and `standard` tiers describe brand-extraction completeness — what's *known* about the brand. The `comprehensive` tier doesn't extend that — it adds **workflow files for building prototypes**, which is a different axis entirely. A user can have a fully-extracted brand (overview, voice, all tokens, components, conflicts) without ever wanting `workflows/deploy.md`.

**Where:**
- `schema/brand/README.md:5-13` — tier definitions
- `cli/src/commands/init.js:31-38` — comprehensive tier scaffolds workflows + specs
- `cli/src/commands/score.js:21-26` — comprehensive tier scoring
- `brand-context/skills/brand-extract/SKILL.md:481-571` — Stage 6 only runs at comprehensive tier (DS repo scan — appropriate) but tier gates many other things

**Who it excludes:** Same users as #1. Anyone who wants a *thoroughly extracted* brand without a prototype workflow. The only way to get the design-system repo scan today is to opt into the prototype-workflow scaffolding.

**Disruption to loosen:** **Medium.** Decouple the two axes. Either: (a) introduce an "extensions" model where `xd-prototype-workflow` is one extension and the base tiers stay focused on brand knowledge, or (b) reorder tiers so the DS-repo scan moves to `standard` and `comprehensive` becomes purely the prototype-workflow extension.

**Status:** Partially closed in `feat/de-xd-cleanup` — Stage 6 gate decoupled from tier (#7 below). The architectural rethink of the `comprehensive` tier itself is deferred to Bucket C / post-1.0.

---

### 4. The `mode: pitch` concept assumes agency-pitch context

**What:** `.brandrc.yaml` has a top-level `mode` field with three values: `standard`, `pitch`, `comprehensive`. "Pitch mode" exists specifically for the agency-pitch use case — extracting from public sources only when you don't have client access yet. The disclaimer: `> ⚠️ PITCH MODE — derived from public sources only. Not validated against internal brand standards.` This vocabulary is alien outside an agency.

**Where:**
- `cli/src/commands/init.js:42-44` — three modes with `pitch` second
- `cli/src/commands/init.js:48` — pitch disclaimer string
- `cli/src/commands/init.js:85` — UI: `pitch — Public sources only: website, social, no internal access`
- `brand-context/skills/brand-extract/SKILL.md` — extensive pitch-mode handling in Sections 4f, 5c, 6e, 8f

**Who it excludes:** Anyone running brand-extraction outside a sales/pitch context. The user understands the *capability* (extract from public sources only) but the *naming* implies the only reason to do that is during a pitch. A research-mode user, a competitive-analysis user, a prospective-employee-doing-a-design-exercise user — all need the same capability under a different label.

**Disruption to loosen:** **Small.** Rename `mode: pitch` to `mode: public-sources-only` (or similar — `public`, `external`). Capability is unchanged. Disclaimer text updated. Probably worth keeping `pitch` as an alias for backward compat with xd-toolkit users.

**Status:** Closed in `feat/de-xd-cleanup`. Loader-level alias keeps legacy `mode: pitch` brandrc files loading; SKILL §4f, §5c, §6e, §8f banner reworded to PUBLIC-SOURCES-ONLY MODE.

---

### 5. The conflicts source-authority hierarchy has "brand team" / "Figma maintained" assumptions

**What:** The default Source Authority Hierarchy (rendered into every `conflicts.md`) reads:
1. Practitioner-provided live brand guide (PDF, recent)
2. Figma variables (if maintained by brand team)
3. Live website CSS
4. Social profiles

This assumes (a) there's a brand team, (b) Figma is part of the brand team's workflow, (c) the user is a "practitioner" provided assets *by* someone else. None of those hold for in-house engineers, indie agencies without dedicated brand teams, or solo founders.

**Where:**
- `schema/brand/conflicts.schema.md:21-25`
- `brand-context/skills/brand-extract/SKILL.md:638-643`

**Who it excludes:** A solo founder where there's no "brand team" — they ARE the brand authority. An engineer at a startup where the brand guide is a Notion page, not a PDF. A team that uses Sketch or Penpot, not Figma.

**Disruption to loosen:** **Small.** Reword the default hierarchy in source-authority terms ("declared brand documentation," "design tool variables," "live experience CSS," "social channel observation") with examples instead of hard-coding "brand team" and "Figma." The hierarchy is overrideable today (`Practitioners may override the hierarchy for a specific project`) — just make the default less narrow.

---

### 6. `--impeccable` flag is the only first-class non-default integration

**What:** `brand-cli refresh-context --impeccable` writes `.impeccable.md` alongside `brand.md`. Impeccable is an XD-internal AI tool. The README explicitly markets this as "Impeccable interop." Schema files reference Impeccable's "context gathering protocol" as an authoritative consumer of the `Key use cases` field. No other consumer (Cursor `.cursorrules`, Copilot `.github/copilot-instructions.md`, Cline) has a parallel flag.

**Where:**
- `cli/src/commands/refresh-context.js:40-48` — `--impeccable` option
- `README.md:140` — "Impeccable interop" decoupling note
- `schema/brand/overview.schema.md:8` — "Auto-generates: `.impeccable.md`"
- `schema/brand/overview.schema.md:43` — "Used by Impeccable's context gathering protocol"
- `brand-context/skills/brand-extract/SKILL.md:706-712` — Impeccable detection logic

**Who it excludes:** Cursor / Copilot / Cline users have to write their own integration; Impeccable users don't. The asymmetry suggests Impeccable is the canonical consumer, when in practice it's one of many.

**Disruption to loosen:** **Medium.** Generalize to `--also-write <path>` or a `[outputs]` section in `.brandrc.yaml` listing additional files to mirror `brand.md` into. Keep `--impeccable` as a convenience alias. Schema files referencing Impeccable as an authoritative consumer should be reframed neutrally (`Used by AI agent context-gathering protocols`).

**Status:** Closed in `feat/de-xd-cleanup`. `--also-write <path>` (repeatable) + `outputs: [path]` brandrc field replace the bespoke flag; `--impeccable` retained as a deprecated alias.

---

### 7. The `tier == comprehensive` gate on Stage 6 (DS repo scan) ties brand intelligence to prototyping

**What:** Stage 6 — the design-system repo scan that produces `.brand/components/*.md` — only runs when `.brandrc.yaml` `tier: comprehensive`. But `comprehensive` tier (per #3) brings the prototype-workflow files. So a user who wants their AI agent to know about the existing component library has to opt into prototype-workflow scaffolding too.

**Where:**
- `brand-context/skills/brand-extract/SKILL.md:482-486` — gating clause
- `cli/src/commands/init.js:31-38` — what comprehensive tier scaffolds

**Who it excludes:** A team with a real component library (most teams) who does *not* want their `.brand/` directory cluttered with deploy and QA workflow files they won't use.

**Disruption to loosen:** **Medium.** Decouple Stage 6 from the tier gate. Make it conditional on `sources.design_system_repo` being set, not on `tier == comprehensive`. A user can then opt into the DS scan without opting into the prototype workflows. Pairs naturally with finding #3.

**Status:** Closed in `feat/de-xd-cleanup`. SKILL §7 header now reads "(any tier)"; the `tier == comprehensive` gating clause is dropped from §0d, §7, the final-summary edge-case table, the pipeline-summary line, and the top-of-file pipeline-output bullet. README pipeline table updated to match.

---

## Significant (hostile to non-XD users, but not strict blockers)

### 8. "Practitioner" is the dominant first-person reference

**What:** SKILL.md files refer to the user as "the practitioner" throughout — 36 occurrences in brand-extract, 7 in brand-audit, 1 in brand-check. "Practitioner" is XD/consulting vocabulary; engineers and product folks rarely call themselves that.

**Where:** `brand-context/skills/brand-extract/SKILL.md` (36×), `brand-audit/SKILL.md` (7×), `brand-check/SKILL.md` (1×), several schema files.

**Who it excludes:** Subtly alienating to users who don't think of themselves as "practitioners." Reads as in-group vocabulary they're not part of.

**Disruption to loosen:** **Small.** Find/replace to "user" or "you." The SKILLs already use "you" in places — consistency would improve readability anyway.

---

### 9. Every example brand is Wendy's, including the `brandrc.schema.md` config example

**What:** Wendy's appears as the canonical example in: `schema/brand/overview.schema.md`, `voice.schema.md`, `brandrc.schema.md`, `brand-context-generator.js` example output. README cites Wendy's twitter style. SKILL.md uses Wendy's red as the recurring "brand color" example. TruGreen appears once in `conflicts.schema.md`.

**Where:** Pervasive across `schema/brand/*.md`. Most prominent in `brandrc.schema.md:67-107` (full example labeled `"# .brandrc.yaml — XD Toolkit project configuration"`).

**Who it excludes:** Reads as "this tool was built for Wendy's-shaped brands" — fast-food, consumer-marketing, agency-managed. A B2B SaaS user reading the docs doesn't see themselves represented. The `# .brandrc.yaml — XD Toolkit project configuration` comment in the example explicitly names the source project.

**Disruption to loosen:** **Small.** Rotate examples across brand archetypes (one consumer, one B2B, one indie, one open-source). Remove the `XD Toolkit project configuration` comment from the example. The example brand could even be a fictional generic ("Acme") to avoid the impression of any single archetype.

---

### 10. `tools.agent` enum is closed and Claude-Code-first

**What:** `.brandrc.yaml` `tools.agent` field accepts `claude-code | cursor | vscode-copilot | codex | gemini`. Anything outside this set (Cline, Aider, custom in-house wrappers) has no slot. The README's "decoupling" claim asserts no agent-specific tie, but the schema closes the enum.

**Where:** `schema/brand/brandrc.schema.md:53`

**Who it excludes:** Any team using an agent not on the list. Forward-compat for agents that don't exist yet.

**Disruption to loosen:** **Small.** Open the enum — change `enum` to `string` with the list as suggested values. Or drop `tools.agent` entirely; nothing in the codebase appears to read it.

**Status:** Closed in `feat/de-xd-cleanup`. `tools.agent` opens to free-form string; suggested values include `cline`, `aider`, and `other`.

---

### 11. README's quick-start path assumes a per-client-project layout

**What:** The README quick-start says `mkdir my-client && cd my-client`. It assumes one repo per client. An in-house team has *one* repo (their product) and *one* brand — they wouldn't `mkdir my-client`. A consultancy with one repo for all clients (one `.brand/` per client subdir) doesn't fit either.

**Where:** `README.md:85-86` (Quick start section)

**Who it excludes:** Any non-agency user. The example reads as "you're a consultant scaffolding a new client engagement."

**Disruption to loosen:** **Small.** Reword to "Set up brand context in your project" + show the install-into-existing-project path as the primary case. Keep the agency-style new-project flow as a secondary example.

---

### 12. `extensions: [ds-pack, ux-design-skills]` — closed to two XD-internal extensions

**What:** The `.brandrc.yaml` `extensions` field accepts `ds-pack` or `ux-design-skills`. Both are XD-toolkit-internal plugins. There's no documented mechanism for a third party to add an extension.

**Where:** `schema/brand/brandrc.schema.md:60`

**Who it excludes:** Anyone outside XD-toolkit. The field exists but is functionally for XD-toolkit users only.

**Disruption to loosen:** **Medium.** Document an extension contract (what an extension can register, where it gets read) — or remove the field until the contract exists. Closed enums without an extension mechanism are worse than no field at all.

**Status:** Closed in `feat/de-xd-cleanup`. `extensions` field removed; loader silently drops it from legacy brandrc files with a one-line warning. Re-introduced in a future minor when an extension contract ships.

---

### 13. `workflows-deploy.schema.md` example: `"practitioner's personal GitHub — not the org repo"`

**What:** The deploy schema's example explicitly says deploys go to the practitioner's *personal* GitHub, not the org's. This is XD-toolkit-specific — XD practitioners build prototypes on personal repos to keep them out of org review processes.

**Where:** `schema/brand/workflows-deploy.schema.md:19, 58`

**Who it excludes:** Anyone who would be alarmed by a deploy schema that recommends pushing to your personal GitHub instead of the company repo. A security-conscious org would consider this a red flag.

**Disruption to loosen:** **Small.** If the workflows tier is preserved (depends on #1, #3, #7 outcome), reword the example to use a project repo, not a personal one.

---

### 14. `assets/` directory created by `init` — not configurable

**What:** `brand-cli init` creates an `assets/` directory at the project root with a README. The brand-extract SKILL hard-codes a list of asset directory names to scan: `./assets/`, `./brand-assets/`, `./.brand-assets/`, `./inputs/`, `./sources/`, project root.

**Where:**
- `cli/src/commands/init.js:152-177`
- `brand-context/skills/brand-extract/SKILL.md:35-41`

**Who it excludes:** A project that already has an `assets/` directory used for something else (frontend asset pipeline, generated content). The init step would create a sibling README; the extract step would scan it and surface project-irrelevant files. Not a strict block, but awkward.

**Disruption to loosen:** **Small.** Allow `.brandrc.yaml` `sources.asset_dir` to override the default. SKILL respects it; init creates only the configured directory.

**Status:** Closed in `feat/de-xd-cleanup`. `sources.asset_dir` row added to brandrc schema; `brand-cli init --asset-dir <path>` persists the override; SKILL §0b honors it before falling back to legacy paths.

---

## Notable (worth knowing, low blocker risk)

### 15. The 50-component cap on Stage 6 is undocumented in the schema

**What:** `brand-extract/SKILL.md:513` caps the design-system scan at 50 components. The cap isn't surfaced anywhere a user would look — not in `components.schema.md`, not in the README. Users with 100+-component libraries silently lose 50+ components from the inventory.

**Where:** `brand-context/skills/brand-extract/SKILL.md:513`

**Who it excludes:** Large design-system teams.

**Disruption to loosen:** **Small.** Either raise the cap, document it prominently, or make it configurable.

---

### 16. The `live_urls` field is poorly described

**What:** `sources.live_urls` is described as "Live product URLs for token extraction via Layout CLI." The "Layout CLI" is unexplained — it's an XD-toolkit-internal tool. A non-XD user reading the schema has no idea what to do with this field.

**Where:** `schema/brand/brandrc.schema.md:45`

**Who it excludes:** Anyone trying to populate `.brandrc.yaml` from the schema.

**Disruption to loosen:** **Small.** Either document Layout CLI's role or drop the field if it's no longer used.

---

### 17. `sources.figma_variable_collections` is documented but its purpose is unclear

**What:** Schema field "Specific variable collection names to extract." Helpful in theory; in practice users won't know whether to set it, what happens if they don't, or what naming convention Figma uses for collection names.

**Where:** `schema/brand/brandrc.schema.md:44`

**Who it excludes:** Anyone setting up Figma extraction without already knowing how Figma variable collections work.

**Disruption to loosen:** **Small.** Add a one-liner explaining the default behavior (extract all collections) and a pointer to where collection names appear in Figma.

---

### 18. `tools.storybook` is documented but appears unused in the codebase

**What:** Schema field declared as a top-level `.brandrc.yaml` setting. No grep hits in `cli/src/` or `brand-context/skills/`.

**Where:** `schema/brand/brandrc.schema.md:54`

**Who it excludes:** Nobody — but presence-of-unused-fields makes the schema harder to trust.

**Disruption to loosen:** **Small.** Drop or wire up.

**Status:** Closed in `feat/de-xd-cleanup`. `tools.storybook` row removed from brandrc schema; loader silently drops it from legacy brandrc files.

---

## What I deliberately didn't flag

- "Practitioner" usage in plain prose where vocabulary alone isn't a blocker (would have inflated to ~50 findings) — captured as one finding (#8) instead.
- Internal Figma vocabulary (`browse_tokens`, `get_variables`) that's necessary for documenting the actual API. Reading those as "XD jargon" would mean the SKILL can't describe what it does.
- The plugin's name (`brand-context`) — not XD-specific.
- The `design.md` spec (external) — not under our control.
- "Brand guide" as a concept — every brand has documentation regardless of XD-vs-not.

---

## Cross-cutting patterns

Three patterns recur across the findings:

1. **Workflow-tier-as-extraction-tier conflation** (#1, #3, #7). The `comprehensive` tier was designed for the XD prototype workflow and pulls in workflow-specific files. This is the single biggest architectural source of XD-coupling.
2. **Agency framing of the user** (#2, #4, #5, #11, #13). `client`, `pitch`, "brand team," "personal GitHub vs org repo," "scaffold a new client engagement" all assume consultant-to-client. Most fixes here are small; the cumulative tone is the issue, not any one item.
3. **Closed integrations / closed enums** (#6, #10, #12). `--impeccable`, `tools.agent`, `extensions` are all XD-internal-first or XD-internal-only. Each is small individually; the pattern is what makes brand-skills feel like an XD plugin even when nothing technical requires it.

If we fix the ten "small" findings cheaply, the bulk of the tone improves. The "large" finding (#1) is the real architectural decision.
