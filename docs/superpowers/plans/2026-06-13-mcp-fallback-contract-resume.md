# MCP Fallback Contract — Resume Note

Brainstorm complete; spec approved by user. Next step: **invoke `superpowers:writing-plans`** to convert the spec into an implementation plan.

**Branch:** `feat/mcp-fallback-contract` (off `main` at the post-merge tip of PR #1).
**Spec:** [`docs/superpowers/specs/2026-06-13-mcp-fallback-contract-design.md`](../specs/2026-06-13-mcp-fallback-contract-design.md)

---

## How to resume in a fresh session

1. Read the spec end-to-end. It's the source of truth for what to implement.
2. Read this resume note for any decisions made post-spec or context that didn't make it into the spec itself.
3. Verify branch state:
   ```
   $ git rev-parse --abbrev-ref HEAD
   feat/mcp-fallback-contract

   $ git log --oneline main..HEAD
   <should show 1 commit: "docs: spec for #3 — MCP fallback contract">
   ```
4. Skim the precedent: the **manifest+health branch** (now merged at commit `3041891`) is the closest pattern. Its progress doc at `docs/superpowers/plans/2026-06-10-manifest-and-health-progress.md` has the D1–D13 decisions and "things that bite" list — the recurring footguns are still active for this branch (ajv/dist/2020.js, apostrophes in heredoc commit messages, plan-pasted `node -e` snippets using `require()` under `"type":"module"`, `engines.node >=22` floor).
5. Invoke `superpowers:writing-plans` with the spec.

---

## Decisions made during brainstorm that may not be obvious from the spec alone

### Why we expanded scope from "pure formalization" to "include DTCG-import + Jina-Reader implementation"

The original task #3 description said "Per stage, declare which MCPs are required vs recommended; on absence emit HALT / DOWNGRADE / SKIP." That's the formalization piece. But user pushback during brainstorm surfaced two real concerns:

1. **figma-console MCP is XD-toolkit-installed; outside that ecosystem almost nobody has it.** The official Figma MCP is more common but loses modes/aliases on read. Without a non-MCP alternative, Stage 1 silently SKIPs for most users with a Figma file.
2. **The contract would be dishonest if it claimed graceful degradation we don't actually have.** Stage 3's "Playwright → WebFetch" today is a real cliff for SPAs.

The user authorized expanding scope to include:
- **DTCG-import** (read `assets/*.tokens.json` and feed into Stage 4 token writing) — Stage 1 Tier 2 fallback that doesn't need any MCP install
- **Jina-Reader integration** (keyless `r.jina.ai` HTTP) — Stage 3 Tier 2 middle tier between Playwright and WebFetch

This is more than formalization, but it's the only way the contract is honest. Plan should treat these as new feature work alongside the contract scaffolding.

### Why we rejected Firecrawl + crawl4ai + standard Figma MCP as Tier 2 candidates

- **Firecrawl** — subscription gate after free trial. Violates minimal-dep invariant.
- **crawl4ai** — no keyless HTTP (cloud is closed beta); pip/Docker only; differentiating features overlap Tier 1 (Playwright) not Tier 2; default content filters strip CTA microcopy. Researched 2026-06-13 by general-purpose subagent; verdict in spec §8.
- **Standard Figma MCP (`plugin:figma:figma`)** — `get_variable_defs` is per-selection only, not file-wide; loses collection names + mode-by-mode values + alias chains. Could be a "walk top-level frames" degraded path but adds significant per-node-walk UX complexity. Filed as candidate task **C8** for follow-up after this branch lands. DTCG-import covers the most common case in the meantime.

Don't re-research these during plan-writing. Spec §8 captures the verdicts.

### Why `version: "2"` is a hard-break with no soft-deprecation

Package isn't on npm yet. No external consumers. Cleaner to hard-reject `version: "1"` payloads from day one than to maintain a dual-schema period. Spec §4 calls this out explicitly.

### Why the contract field is named `dependencies`, not `mcps`

The contract holds entries of all four `kind` values: `mcp`, `http`, `user_artifact`, `native_tool`. The manifest's existing top-level `mcps` field is a misnomer for the broader concept. Brainstorm decision: rename in both (manifest schema bump to `version: "2"`, contract uses `dependencies` from the start). Symmetric naming wins over schema-stability for a pre-1.0 package.

### Why pre-flight notices are interactive by default

The user's framing was about XD-toolkit decoupling honesty — practitioners outside the XD ecosystem need to know what's missing and how to get it before the pipeline runs and produces degraded output they don't understand. Interactive default is the high-trust path for first-time users; embedded mode (`interactive_preflight: false` or env var) auto-proceeds for hosts.

---

## Things that will bite during implementation (from the manifest+health branch)

Hoist these into the implementation plan's "things to know" section — they're not branch-specific:

- **`ajv/dist/2020.js`, not `ajv`.** Draft 2020-12 schemas need the dist entry point.
- **Apostrophes break heredoc commit messages.** Always write to `/tmp/commit-msg.txt` and use `git commit -F`.
- **`package-lock.json` is gitignored.**
- **Don't bump the package version. Don't touch `~/Documents/xd-toolkit`.**
- **Plan-pasted `node -e` snippets that use `require()` are broken in this repo** — `"type":"module"` makes `require` undefined inside `await import()` callbacks. Default to `node --input-type=module -e "..."` with named ESM imports.
- **Plan-pasted bash pipelines have had typos.** Glance at any multi-line bash before pasting it into an implementer prompt.
- **Long-running implementer agents can die mid-flight on token expiration.** If file edits are on disk but the agent didn't commit, run smoke-tests + commit yourself rather than re-dispatching.
- **Per-task two-stage review** (spec compliance, then code quality). Budget for refinement subagents — manifest+health branch ran 8 of 18 tasks (47%) needing refinement.
- **Goldens are coupled to fixture bytes.** Any edit to a populated-fixture file shifts byte counts and breaks deepEqual. Strip list (`generated_at`, `generator`) covers volatility — anything else volatile must be added.
- **`engines.node >=22.0.0`.** The repo's test runner uses `node --test 'cli/test/**/*.test.js'`; glob support didn't land until Node 21. Floor is at LTS 22.

---

## Cross-task contracts to preserve during plan-writing

- **`dependencies` enum sync.** Contract `chain[*].kind` and dependency `kind` must use the same four-value enum. Manifest schema's `dependencies[*].kind` mirrors. Test goldens enforce.
- **Stage key sync.** `1_figma`, `2_web`, `3_voice`, `4_overview`, `5_conflicts`, `6_components`, `8_brand_md`. No Stage 7. Manifest schema's `stages` patternProperties regex `^[1-8]_[a-z_]+$` already accepts.
- **DTCG file glob sync.** `assets/*.tokens.json` appears in: contract dependency entry, SKILL Section 1 prose, CLI `import-tokens` default, integration test fixtures. Single source: contract's `expected_path_glob`.
- **Pre-flight notice text.** Lives in SKILL prose (per Section 5 decision); contract supplies structured fields. SKILL prose templates them into markdown. Tests ensure SKILL prose covers all contract dependency entries.

---

## Estimated scope vs. manifest+health branch precedent

| | Manifest+Health (merged) | MCP Contract (this branch) |
|---|---|---|
| Total tasks | 18 | ~14–16 estimate |
| New tests | 47 | ~15 added (~62 total) |
| New CLI utils | 5 | 3 (`contract-loader`, `dtcg-import`, `jina-fetch`) |
| New schemas | 2 | 2 (contract + contract-schema) |
| Modified schemas | 0 | 1 (manifest `version: 2` bump) |
| New SKILL sections | 0 (only updates to existing) | 1 (`§0.5 Pre-flight dependency check`) |
| New CLI commands | 1 (`emit-manifest`) | 1 (`import-tokens`) |
| Final integration tests | 5 | 4 added |

Slightly smaller branch overall than manifest+health. Larger SKILL prose changes (Stages 1, 2, 3 all touch). Smaller schema layer.
