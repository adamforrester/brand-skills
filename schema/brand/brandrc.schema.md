# Schema: .brandrc.yaml

**Purpose:** Project-level configuration. Controls CLI behavior, declares which brand tier the project targets, and stores references to external assets (Figma files, URLs, PDFs, screenshots, design-system repos) used by the brand workflow skills.

**Location:** Project root.
**Created by:** `brand-cli init`.
**Used by:** `brand-cli` commands and the `/brand-context:extract`, `/brand-context:check` skills.

---

## Fields

### Project Identity (required)

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| `brand` | optional | string | The brand this package describes. Defaults to the project directory name. Older configs may use `client`; the alias is read but emits a one-line deprecation warning. |
| `project` | optional | string | Project name within the brand (e.g., "rewards-app", "2026-redesign") |
| `tier` | required | enum | Target completeness tier: `minimum`, `standard`, or `comprehensive` |

### Deployment (optional)

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| `deploy.platform` | optional | enum | `netlify` or `vercel` |
| `deploy.repo` | optional | string | GitHub repo (e.g., "username/project-name") |

### Brand Sources (optional)

References to source materials for the extraction pipeline. Drives what `/brand-context:extract` crawls without prompting the practitioner during extraction.

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| `sources.website` | optional | string | Primary website URL (always crawled for voice + token extraction) |
| `sources.website_pages` | optional | string[] | Additional paths beyond homepage to crawl (e.g., ["/about", "/products", "/contact"]) |
| `sources.social.twitter` | optional | string | X/Twitter profile URL |
| `sources.social.instagram` | optional | string | Instagram profile URL |
| `sources.social.linkedin` | optional | string | LinkedIn company page URL |
| `sources.social.facebook` | optional | string | Facebook page URL |
| `sources.social.tiktok` | optional | string | TikTok profile URL |
| `sources.app_store.ios` | optional | string | iOS App Store listing URL |
| `sources.app_store.android` | optional | string | Google Play Store listing URL |
| `sources.figma` | optional | string[] | Figma file IDs for extraction via Figma Console MCP (variables) and Figma MCP (design context) |
| `sources.figma_variable_collections` | optional | string[] | Specific variable collection names to extract |
| `sources.live_urls` | optional | string[] | Live product URLs for token extraction via Layout CLI |
| `sources.brand_guide` | optional | string | Path to brand guide PDF (relative to project root) |
| `sources.screenshots` | optional | string[] | Paths to brand reference screenshots |
| `sources.asset_dir` | optional | string | Directory scanned for brand assets (PDFs, screenshots, DTCG token files). Defaults to `./assets`. When set, the SKILL's Stage 0 asset scan honors this path before falling back to legacy alternatives. |
| `sources.design_system_repo` | optional | string | Local path or remote git URL of a design-system repo. When set, Stage 6 of `/brand-context:extract` runs and produces `.brand/components/*.md` regardless of tier. |

### Outputs (optional)

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| `outputs` | optional | string[] | Additional paths to mirror `brand.md` into when `brand-cli refresh-context` runs. Each entry is a path relative to project root. Equivalent to passing `--also-write <path>` for each entry; flag and field are merged and deduplicated. |

### Tool Configuration (optional)

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| `tools.agent` | optional | string | Primary agent tool. Free-form. Common values: `claude-code`, `cursor`, `vscode-copilot`, `codex`, `gemini`, `cline`, `aider`, `other`. |

---

## Example

```yaml
# .brandrc.yaml — brand-skills project configuration
brand: "Wendy's"
project: "rewards-app-2026"
tier: standard
mode: standard

deploy:
  platform: netlify
  repo: jsmith/wendys-rewards

sources:
  website: "https://www.wendys.com"
  website_pages:
    - "/menu"
    - "/rewards"
    - "/about"
    - "/careers"
  social:
    twitter: "https://x.com/Wendys"
    instagram: "https://instagram.com/wendys"
    linkedin: "https://linkedin.com/company/wendys"
  app_store:
    ios: "https://apps.apple.com/app/wendys/id540518599"
    android: "https://play.google.com/store/apps/details?id=com.wendys.nutritiontool"
  figma:
    - "abc123def456"
    - "ghi789jkl012"
  figma_variable_collections:
    - "Brand Colors"
    - "Typography"
    - "Spacing"
  live_urls:
    - "https://www.wendys.com"
    - "https://www.wendys.com/rewards"
  brand_guide: "assets/wendys-brand-guide-2026.pdf"

tools:
  agent: claude-code
```

---

## Validation Rules

The `brand-cli` validation pass checks:
1. `tier` is present (`brand` is optional and falls back to the project directory name)
2. `tier` value is one of: `minimum`, `standard`, `comprehensive`
3. If `tier` is `standard` or `comprehensive`, the corresponding `.brand/` files exist
4. If `sources.figma` is set, the Figma Console MCP is configured (via `claude mcp list`)
5. If `deploy.platform` is set, the corresponding MCP is configured
