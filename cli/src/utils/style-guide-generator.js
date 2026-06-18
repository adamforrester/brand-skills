import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse as yamlParse } from 'yaml';

/**
 * Generate a self-contained HTML style guide from a .brand/ directory.
 *
 * Spec: docs/superpowers/specs/2026-06-18-visual-style-guide-design.md
 *
 * Pure function. No fs writes. No AI calls. No Date.now() reads — the
 * `now` ISO string is supplied by the call site (refresh-design.js).
 * This keeps the generator deterministic so the SKILL inline-fallback
 * can produce byte-identical output for the same input.
 *
 * Forgiving on input: missing files, malformed YAML frontmatter, empty
 * placeholder content all degrade silently to empty-state callouts (or
 * silent skips for spacing / surfaces / voice).
 *
 * @param {string} brandDir - absolute path to the .brand/ directory.
 * @param {string} brand - already-normalized brand name (from brandrc-loader).
 * @param {string} now - ISO-8601 timestamp for the footer.
 * @returns {string} self-contained HTML5 document.
 */
export function generateStyleGuide(brandDir, brand, now) {
  const sections = [];

  // 1. Conflicts banner (conditional, top of document)
  const banner = buildConflictsBanner(brandDir);
  if (banner) sections.push(banner);

  // 2. Brand identity header — always renders
  sections.push(buildIdentityHeader(brandDir, brand));

  // 3. Colors — always renders (empty-state callout when no data)
  sections.push(buildColorsSection(brandDir));

  // 4. Typography — always renders (empty-state callout when no data)
  sections.push(buildTypographySection(brandDir));

  // 5. Spacing — silent skip when empty
  const spacing = buildSpacingSection(brandDir);
  if (spacing) sections.push(spacing);

  // 6. Surfaces — silent skip when both rounded + elevation empty
  const surfaces = buildSurfacesSection(brandDir);
  if (surfaces) sections.push(surfaces);

  // 7. Voice — silent skip when no Observed Voice blockquotes
  const voice = buildVoiceSection(brandDir);
  if (voice) sections.push(voice);

  // 8. Footer — always renders
  sections.push(buildFooter(now));

  return [
    '<!DOCTYPE html>',
    '<html lang="en">',
    '<head>',
    '<meta charset="utf-8">',
    `<title>${escapeHtml(brand)} — Brand style guide</title>`,
    '<meta name="viewport" content="width=device-width, initial-scale=1">',
    `<style>${PAGE_CHROME_CSS}</style>`,
    '</head>',
    '<body>',
    '<main class="page">',
    sections.join('\n\n'),
    '</main>',
    '</body>',
    '</html>',
    '',
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Page chrome (neutral; brand-agnostic per spec D8)
// ---------------------------------------------------------------------------

const PAGE_CHROME_CSS = `
*, *::before, *::after { box-sizing: border-box; }
body {
  margin: 0;
  background: #fafafa;
  color: #1a1a1a;
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  font-size: 16px;
  line-height: 1.5;
}
.page { max-width: 960px; margin: 0 auto; padding: 48px 24px; }
@media (min-width: 768px) { .page { padding: 48px; } }
h1 { font-size: 2.5rem; margin: 0 0 0.5rem; letter-spacing: -0.02em; }
h2 { font-size: 1.5rem; margin: 2.5rem 0 1rem; letter-spacing: -0.01em; }
.subtitle { color: #555; font-size: 1.125rem; margin: 0 0 2rem; max-width: 640px; }
.callout {
  background: #f0f0f0; border: 1px solid #e5e5e5; border-radius: 6px;
  padding: 12px 16px; color: #555; font-style: italic; margin: 1rem 0;
}
.banner {
  background: #fff8e1; border: 1px solid #f0ad4e; border-radius: 6px;
  padding: 10px 14px; color: #7a5a00; margin: 0 0 2rem;
  font-size: 0.95rem;
}
.swatches {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 16px; margin: 1rem 0;
}
.swatch { display: flex; flex-direction: column; gap: 6px; }
.swatch-block {
  width: 100%; aspect-ratio: 1; border-radius: 6px;
  border: 1px solid #e5e5e5;
}
.swatch-name {
  font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
  font-size: 0.8125rem; color: #1a1a1a;
}
.swatch-value {
  font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
  font-size: 0.75rem; color: #666;
}
.swatch-group { margin: 1.5rem 0; }
.swatch-group-name {
  font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.08em;
  color: #888; margin: 0 0 0.5rem; font-weight: 600;
}
.type-row { display: flex; flex-direction: column; gap: 4px; padding: 12px 0; border-bottom: 1px solid #f0f0f0; }
.type-row:last-child { border-bottom: none; }
.type-row-meta {
  font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
  font-size: 0.75rem; color: #666;
}
.spacing-row { display: flex; align-items: center; gap: 12px; margin: 8px 0; }
.spacing-bar { background: #0066cc; height: 16px; border-radius: 2px; }
.spacing-meta {
  font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
  font-size: 0.8125rem; color: #555;
}
.surfaces-grid {
  display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 16px; margin: 1rem 0;
}
.surface-sample {
  background: #fff; border: 1px solid #e5e5e5; padding: 16px;
  display: flex; flex-direction: column; gap: 8px;
}
.surface-meta {
  font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
  font-size: 0.75rem; color: #666;
}
blockquote {
  margin: 1rem 0; padding: 12px 16px;
  border-left: 3px solid #0066cc; background: #fff;
  font-style: italic; color: #1a1a1a;
}
footer {
  margin-top: 4rem; padding-top: 1.5rem;
  border-top: 1px solid #e5e5e5; color: #888;
  font-size: 0.8125rem; line-height: 1.6;
}
footer p { margin: 0 0 0.5rem; }
`;

// ---------------------------------------------------------------------------
// Section builders
// ---------------------------------------------------------------------------

function buildConflictsBanner(brandDir) {
  const content = readFileSafe(brandDir, 'conflicts.md');
  if (!content) return null;
  const count = countActiveConflicts(content);
  if (count <= 0) return null;
  const noun = count === 1 ? 'active conflict' : 'active conflicts';
  return `<p class="banner">⚠ ${count} ${noun} — see <code>conflicts.md</code></p>`;
}

function countActiveConflicts(conflictsContent) {
  // Find the H2 "## Active Conflicts" (case-insensitive); count entries until
  // the next H2 or end of file. An "entry" is any line starting with "### "
  // (H3) or "- " (top-level bullet). Lines starting with `<!--` (comments)
  // and blank lines are ignored.
  const lines = conflictsContent.split('\n');
  let inSection = false;
  let count = 0;
  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (/^##\s+Active Conflicts\b/i.test(line)) {
      inSection = true;
      continue;
    }
    if (inSection && /^##\s+/.test(line)) break;
    if (!inSection) continue;
    if (/^###\s+\S/.test(line)) count++;
    else if (/^-\s+\S/.test(line) && !line.startsWith('- _')) count++;
  }
  return count;
}

function buildIdentityHeader(brandDir, brand) {
  const overview = readFileSafe(brandDir, 'overview.md');
  const subtitle = extractIdentitySubtitle(overview);
  const subtitleHtml = subtitle
    ? `<p class="subtitle">${escapeHtml(subtitle)}</p>`
    : `<p class="subtitle callout">No brand identity captured yet. Run /brand-context:extract.</p>`;
  return [
    `<h1>${escapeHtml(brand)}</h1>`,
    subtitleHtml,
  ].join('\n');
}

function buildColorsSection(brandDir) {
  const colors = readFrontmatterKey(brandDir, 'tokens/colors.md', 'colors');
  if (!colors || Object.keys(colors).length === 0) {
    return [
      '<h2>Colors</h2>',
      '<p class="callout">No colors extracted yet. Run /brand-context:extract.</p>',
    ].join('\n');
  }
  return [
    '<h2>Colors</h2>',
    renderColorGroups(colors),
  ].join('\n');
}

function buildTypographySection(brandDir) {
  const typography = readFrontmatterKey(brandDir, 'tokens/typography.md', 'typography');
  if (!typography || Object.keys(typography).length === 0) {
    return [
      '<h2>Typography</h2>',
      '<p class="callout">No typography extracted yet. Run /brand-context:extract.</p>',
    ].join('\n');
  }
  const rows = [];
  for (const [name, spec] of Object.entries(typography)) {
    if (!spec || typeof spec !== 'object') continue;
    const fontFamily = spec.fontFamily ? String(spec.fontFamily) : 'inherit';
    const fontSize = spec.fontSize ? String(spec.fontSize) : 'inherit';
    const fontWeight = spec.fontWeight !== undefined ? String(spec.fontWeight) : 'inherit';
    const lineHeight = spec.lineHeight !== undefined ? String(spec.lineHeight) : 'inherit';
    const inlineStyle = [
      `font-family: ${escapeHtml(escapeCss(fontFamily))}`,
      `font-size: ${escapeHtml(escapeCss(fontSize))}`,
      `font-weight: ${escapeHtml(escapeCss(fontWeight))}`,
      `line-height: ${escapeHtml(escapeCss(lineHeight))}`,
    ].join('; ');
    const meta = [
      escapeHtml(name),
      `${escapeHtml(fontSize)} / ${escapeHtml(fontWeight)}`,
      escapeHtml(fontFamily),
    ].join(' · ');
    rows.push([
      '  <div class="type-row">',
      `    <span style="${inlineStyle}">The quick brown fox jumps over the lazy dog.</span>`,
      `    <span class="type-row-meta">${meta}</span>`,
      '  </div>',
    ].join('\n'));
  }
  if (rows.length === 0) {
    return [
      '<h2>Typography</h2>',
      '<p class="callout">No typography extracted yet. Run /brand-context:extract.</p>',
    ].join('\n');
  }
  return [
    '<h2>Typography</h2>',
    '<div class="type-ramp">',
    rows.join('\n'),
    '</div>',
  ].join('\n');
}

function buildSpacingSection(brandDir) {
  const spacing = readFrontmatterKey(brandDir, 'tokens/spacing.md', 'spacing');
  if (!spacing || Object.keys(spacing).length === 0) return null;
  const entries = Object.entries(spacing).filter(
    ([, value]) => value !== null && value !== undefined && value !== ''
  );
  if (entries.length === 0) return null;

  const maxBarPx = 400;
  const widthForValue = (rawValue) => {
    const px = parsePxLike(String(rawValue));
    if (px === null) return null;
    return Math.min(px, maxBarPx);
  };

  const rows = entries.map(([name, value]) => {
    const width = widthForValue(value);
    const barStyle = width !== null ? `width: ${width}px` : 'width: 16px; opacity: 0.3';
    return [
      '  <div class="spacing-row">',
      `    <div class="spacing-bar" style="${barStyle}"></div>`,
      `    <span class="spacing-meta">${escapeHtml(name)} · ${escapeHtml(String(value))}</span>`,
      '  </div>',
    ].join('\n');
  });
  return [
    '<h2>Spacing</h2>',
    rows.join('\n'),
  ].join('\n');
}

function parsePxLike(value) {
  // Accepts "16px", "1rem" (treated as 16px base), "16", or returns null.
  const trimmed = value.trim();
  const pxMatch = trimmed.match(/^(\d+(?:\.\d+)?)px$/i);
  if (pxMatch) return Number(pxMatch[1]);
  const remMatch = trimmed.match(/^(\d+(?:\.\d+)?)rem$/i);
  if (remMatch) return Number(remMatch[1]) * 16;
  const bareMatch = trimmed.match(/^(\d+(?:\.\d+)?)$/);
  if (bareMatch) return Number(bareMatch[1]);
  return null;
}

function buildSurfacesSection(brandDir) {
  const rounded = readFrontmatterKey(brandDir, 'tokens/surfaces.md', 'rounded');
  const elevation = readFrontmatterKey(brandDir, 'tokens/surfaces.md', 'elevation');
  const roundedEntries = filterPopulatedEntries(rounded);
  const elevationEntries = filterPopulatedEntries(elevation);
  if (roundedEntries.length === 0 && elevationEntries.length === 0) return null;

  const blocks = ['<h2>Surfaces</h2>'];

  if (roundedEntries.length > 0) {
    blocks.push('<p class="swatch-group-name">Rounded</p>');
    blocks.push('<div class="surfaces-grid">');
    for (const [name, value] of roundedEntries) {
      blocks.push([
        '  <div class="surface-sample" style="' + `border-radius: ${escapeHtml(escapeCss(value))}` + '">',
        `    <span class="surface-meta">${escapeHtml(name)} · ${escapeHtml(String(value))}</span>`,
        '  </div>',
      ].join('\n'));
    }
    blocks.push('</div>');
  }

  if (elevationEntries.length > 0) {
    blocks.push('<p class="swatch-group-name">Elevation</p>');
    blocks.push('<div class="surfaces-grid">');
    for (const [name, value] of elevationEntries) {
      const shadow = String(value);
      const inlineShadow = shadow === 'none' ? 'box-shadow: none' : `box-shadow: ${escapeHtml(escapeCss(shadow))}`;
      blocks.push([
        `  <div class="surface-sample" style="${inlineShadow}">`,
        `    <span class="surface-meta">${escapeHtml(name)} · ${escapeHtml(shadow)}</span>`,
        '  </div>',
      ].join('\n'));
    }
    blocks.push('</div>');
  }

  return blocks.join('\n');
}

function filterPopulatedEntries(map) {
  if (!map || typeof map !== 'object') return [];
  return Object.entries(map).filter(
    ([, value]) => value !== null && value !== undefined && value !== ''
  );
}

function buildVoiceSection(brandDir) {
  const content = readFileSafe(brandDir, 'voice.md');
  if (!content) return null;
  const observed = extractObservedVoiceSection(content);
  if (!observed) return null;
  const quotes = extractBlockquotes(observed).slice(0, 3);
  if (quotes.length === 0) return null;
  return [
    '<h2>Voice</h2>',
    quotes.map((q) => `<blockquote>${escapeHtml(q)}</blockquote>`).join('\n'),
  ].join('\n');
}

function extractObservedVoiceSection(voiceContent) {
  // Find the H2 header "## Observed Voice (live channels)" (case-insensitive,
  // tolerant of trailing punctuation) and return everything until the next H2
  // or end of file.
  const lines = voiceContent.split('\n');
  let inSection = false;
  const collected = [];
  for (const line of lines) {
    if (/^##\s+Observed Voice\b/i.test(line)) {
      inSection = true;
      continue;
    }
    if (inSection && /^##\s+/.test(line)) break;
    if (inSection) collected.push(line);
  }
  return collected.join('\n').trim();
}

function extractBlockquotes(sectionContent) {
  // Markdown blockquotes: lines starting with `>` (one or more, possibly with
  // a leading space). Adjacent `>` lines are joined with a space; blank lines
  // delimit separate quotes.
  const blocks = [];
  let current = [];
  for (const rawLine of sectionContent.split('\n')) {
    const line = rawLine.trimEnd();
    const m = line.match(/^>\s?(.*)$/);
    if (m) {
      current.push(m[1]);
    } else if (current.length > 0) {
      blocks.push(current.join(' ').trim());
      current = [];
    }
  }
  if (current.length > 0) blocks.push(current.join(' ').trim());
  return blocks
    .map((b) => b.trim())
    .filter((b) => b.length > 0)
    .filter((b) => !/^_.*_$/.test(b));  // skip italic-only stub lines like "_Stub for tests; not extracted._" wrapped in `>`
}

function buildFooter(now) {
  return [
    '<footer>',
    `<p>Generated ${escapeHtml(now)}.</p>`,
    `<p>Source: <code>.brand/</code> directory; regenerate with <code>brand-cli refresh-design</code>.</p>`,
    `<p>Typography samples use the brand&rsquo;s declared <code>fontFamily</code>. If your system doesn&rsquo;t have the font, your browser falls back to its default.</p>`,
    '</footer>',
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Color rendering
// ---------------------------------------------------------------------------

function renderColorGroups(colors) {
  // Group tokens by the slug before the first hyphen (e.g. "primary-500" -> "primary").
  // Tokens with no hyphen group under "Other".
  const groups = new Map();
  for (const [name, value] of Object.entries(colors)) {
    if (value === null || value === undefined || value === '') continue;
    const dashIdx = name.indexOf('-');
    const groupKey = dashIdx > 0 ? name.slice(0, dashIdx) : 'other';
    if (!groups.has(groupKey)) groups.set(groupKey, []);
    groups.get(groupKey).push({ name, value: String(value) });
  }
  if (groups.size === 0) {
    return '<p class="callout">No colors extracted yet. Run /brand-context:extract.</p>';
  }
  const blocks = [];
  for (const [groupKey, tokens] of groups) {
    blocks.push([
      `<div class="swatch-group">`,
      `  <p class="swatch-group-name">${escapeHtml(groupKey)}</p>`,
      `  <div class="swatches">`,
      ...tokens.map((t) => [
        `    <div class="swatch">`,
        `      <div class="swatch-block" style="background: ${escapeHtml(escapeCss(t.value))}"></div>`,
        `      <span class="swatch-name">${escapeHtml(t.name)}</span>`,
        `      <span class="swatch-value">${escapeHtml(t.value)}</span>`,
        `    </div>`,
      ].join('\n')),
      `  </div>`,
      `</div>`,
    ].join('\n'));
  }
  return blocks.join('\n');
}

// ---------------------------------------------------------------------------
// Helpers — file reading + frontmatter + identity-subtitle extraction
// ---------------------------------------------------------------------------

function readFileSafe(brandDir, relPath) {
  const fullPath = join(brandDir, relPath);
  if (!existsSync(fullPath)) return '';
  try {
    return readFileSync(fullPath, 'utf-8');
  } catch {
    return '';
  }
}

function extractFrontmatter(content) {
  if (!content) return null;
  const trimmed = content.trimStart();
  if (!trimmed.startsWith('---')) return null;
  const rest = trimmed.slice(3);
  const end = rest.indexOf('\n---');
  if (end === -1) return null;
  return rest.slice(0, end).trim();
}

function readFrontmatterKey(brandDir, relPath, key) {
  const content = readFileSafe(brandDir, relPath);
  const fm = extractFrontmatter(content);
  if (!fm) return null;
  try {
    const parsed = yamlParse(fm);
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed[key] || null;
  } catch {
    return null;
  }
}

function extractIdentitySubtitle(overviewContent) {
  if (!overviewContent) return '';
  // Strip frontmatter.
  let body = overviewContent;
  const trimmed = body.trimStart();
  if (trimmed.startsWith('---')) {
    const rest = trimmed.slice(3);
    const end = rest.indexOf('\n---');
    if (end !== -1) body = rest.slice(end + 4);
  }
  // Strip the leading H1 (e.g. "# Brand overview").
  body = body.replace(/^#\s+[^\n]+\n+/, '');
  // Strip leading whitespace and HTML comments (e.g. <!-- Fill this file ... -->).
  body = body.replace(/^\s*<!--[\s\S]*?-->\s*/g, '');
  body = body.trimStart();
  // First non-empty paragraph that isn't a heading or list.
  const paragraphs = body.split(/\n\s*\n/);
  for (const p of paragraphs) {
    const stripped = p.trim();
    if (!stripped) continue;
    if (stripped.startsWith('#')) continue; // skip H2/H3 headings
    if (stripped.startsWith('-') || stripped.startsWith('*')) continue; // skip lists
    if (stripped.startsWith('<!--')) continue; // skip remaining comments
    return stripped.replace(/\n+/g, ' ').trim();
  }
  return '';
}

/**
 * Strip characters that have no legitimate place in a CSS literal token
 * value: `;`, `:`, `{`, `}`, `<`, `>`, and newlines. escapeHtml handles HTML
 * injection but not CSS injection via semicolons — a token value of
 * `red; background: black` would inject a second declaration when
 * concatenated into inline `style="..."`. This sanitizer prevents that.
 *
 * Token values are simple CSS literals like `#0066ff`, `16px`, `Inter`,
 * `0 4px 8px rgba(0,0,0,0.06)`. None of the stripped characters appear
 * legitimately in those (the colon is the property:value separator, not
 * part of the value itself).
 */
function escapeCss(value) {
  if (value === null || value === undefined) return '';
  return String(value).replace(/[;:{}<>\n\r]/g, '');
}

function escapeHtml(input) {
  if (input === null || input === undefined) return '';
  return String(input)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
