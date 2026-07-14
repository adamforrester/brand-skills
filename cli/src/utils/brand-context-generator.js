import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripLeadingNonFrontmatter } from './frontmatter.js';

/**
 * Generate condensed brand context for any agent that loads project-root
 * brand files (Claude Code, Cursor, GitHub Copilot, Impeccable, etc.).
 *
 * Output is written to `brand.md` at project root by default. Agents read it
 * on every interaction to inform design decisions. The file must be DENSE —
 * every line is loaded into context. Aim for ~200-400 tokens, not a wall of
 * text.
 *
 * Inputs:
 *   - .brand/overview.md     → brand identity, personality, visual language, anti-patterns, self-test
 *   - .brand/voice.md        → voice attributes, anti-attributes (top-level only)
 *
 * Output: a single-file Markdown summary with pointers to deeper sources.
 *
 * The function is forgiving — if .brand/ files are missing or empty, it
 * produces a stub with TODO markers rather than failing.
 */
export function generateBrandContext(brandDir, brandName = 'Brand') {
  const overview = readBrandFile(brandDir, 'overview.md');
  const voice = readBrandFile(brandDir, 'voice.md');

  const sections = [];
  sections.push(`# Brand Context — ${brandName}`);
  sections.push('');
  sections.push('Loaded by AI agents on every interaction. Generated from `.brand/` — edit there, not here. Re-run `brand-cli refresh-context` (or `/brand-context:extract`) to regenerate.');
  sections.push('');

  sections.push(buildIdentityBlock(overview));
  sections.push(buildPersonalityBlock(overview));
  sections.push(buildVisualBlock(overview));
  sections.push(buildVoiceBlock(voice));
  sections.push(buildAntiPatternsBlock(overview));
  sections.push(buildSelfTestBlock(overview));
  sections.push(buildPointersBlock(brandDir));

  return sections.filter(Boolean).join('\n\n') + '\n';
}

function readBrandFile(brandDir, relPath) {
  const fullPath = join(brandDir, relPath);
  if (!existsSync(fullPath)) return '';
  // Normalize CRLF → LF at ingest so every downstream line-oriented regex
  // (frontmatter fences, section pulls, the anti-patterns block) can rely on
  // `\n` boundaries — a Windows-authored overview.md otherwise defeats blank-
  // line stop-lookaheads and drags stray `\r` into extracted content.
  let content = readFileSync(fullPath, 'utf-8').replace(/\r\n/g, '\n');
  // Strip frontmatter (tolerating a leading disclaimer above it)
  const trimmed = stripLeadingNonFrontmatter(content).trimStart();
  if (trimmed.startsWith('---')) {
    const rest = trimmed.slice(3);
    const end = rest.indexOf('\n---');
    if (end !== -1) content = rest.slice(end + 4).trimStart();
  }
  return content;
}

/**
 * Pull a section by H2 heading. Returns the body text (without the heading)
 * up to the next H2 or end of file. Returns empty string if not found.
 *
 * The body is captured in a NAMED group (`body`) rather than a positional one:
 * every caller passes a parenthesised heading alternation (e.g.
 * `(Brand Identity|Identity)`), which is itself a capturing group. A positional
 * `m[1]` would return the matched heading text, not the section body — so each
 * block would render its own heading label as its content. Naming the body
 * group makes extraction robust to however many groups the heading pattern adds.
 */
function pullSection(content, headingPattern) {
  if (!content) return '';
  const re = new RegExp(`##\\s+${headingPattern}[^\\n]*\\n(?<body>[\\s\\S]*?)(?=\\n##\\s|$)`, 'i');
  const m = content.match(re);
  return m ? m.groups.body.trim() : '';
}

function buildIdentityBlock(overview) {
  const block = pullSection(overview, '(Brand Identity|Identity)');
  if (!block) return '## Identity\n\n_Run `/brand-context:extract` to populate from brand sources._';
  return `## Identity\n\n${block}`;
}

function buildPersonalityBlock(overview) {
  const block = pullSection(overview, '(Brand Personality|Personality)');
  if (!block) return '';
  return `## Personality\n\n${block}`;
}

function buildVisualBlock(overview) {
  const block = pullSection(overview, '(Visual Language|Visual)');
  if (!block) return '';
  return `## Visual language\n\n${block}`;
}

function buildVoiceBlock(voice) {
  if (!voice) return '';
  // Pull just the top-level voice principles, not the observed-voice section.
  const principles = pullSection(voice, '(Voice Principles|Principles)');
  if (!principles) return '';
  return `## Voice (summary)\n\n${principles}\n\n_Full voice rules live at \`.brand/voice.md\`._`;
}

function buildAntiPatternsBlock(overview) {
  // Aesthetic anti-patterns are typically in the "Competitive Context" section.
  const competitive = pullSection(overview, '(Competitive Context|Competitive|Differentiation)');
  if (!competitive) return '';

  // Try to extract the anti-pattern lines if they're called out specifically.
  // The label is usually a bold inline heading inside Competitive Context, in
  // one of two shapes:
  //   **Aesthetic anti-patterns:**            (block form — bullets follow)
  //   - NOT flashy …
  //   **Aesthetic anti-patterns:** NOT foo, NOT bar.   (inline form)
  // Consume the optional `**` wrapper AND the label itself, capturing ONLY the
  // body in group 1 — returning the whole match (`m[0]`) re-emitted the label
  // and orphaned the trailing `**` under the `## Aesthetic anti-patterns`
  // heading.
  //
  // Anchor the label to the start of a line via `(?:^|\n)` (NOT the `m` flag —
  // under `m`, the `$` in the stop-lookahead would match end-of-LINE and
  // truncate a bulleted block to its first item). This way `$` means end-of-
  // string, so a mid-sentence mention of "anti-patterns" is not promoted.
  //
  // Stop-lookahead: end at the next bold field (`\n**`), end-of-string (`$`),
  // OR a blank line — but NOT a blank line that is followed by another bullet,
  // so a "loose" (blank-line-separated) Markdown list is captured whole instead
  // of truncating to its first item. `readBrandFile` normalizes CRLF→LF, so the
  // `\n` boundaries here are reliable on Windows-authored files too.
  const antiMatch = competitive.match(
    /(?:^|\n)\*{0,2}(?:Aesthetic\s+)?anti-patterns?:?\*{0,2}[ \t]*\n?([\s\S]*?)(?=\n[ \t]*\n(?![ \t]*[-*+] )|\n\*\*|$)/i
  );
  if (antiMatch && antiMatch[1].trim()) {
    return `## Aesthetic anti-patterns\n\n${antiMatch[1].trim()}`;
  }
  return `## Competitive context\n\n${competitive}`;
}

function buildSelfTestBlock(overview) {
  const block = pullSection(overview, '(Brand self-test|Self-test)');
  if (!block) return '';
  return `## Brand self-test (run before presenting)\n\n${block}`;
}

function buildPointersBlock(brandDir) {
  const candidates = [
    ['tokens/colors.md', 'Color tokens'],
    ['tokens/typography.md', 'Typography tokens'],
    ['tokens/spacing.md', 'Spacing tokens'],
    ['tokens/surfaces.md', 'Radius and shadow tokens'],
    ['voice.md', 'Full voice rules'],
    ['composition/anti-patterns.md', 'Composition anti-patterns'],
    ['conflicts.md', 'Active brand conflicts'],
  ];
  const lines = [];
  for (const [rel, label] of candidates) {
    if (existsSync(join(brandDir, rel))) {
      lines.push(`- \`.brand/${rel}\` — ${label}`);
    }
  }
  if (lines.length === 0) return '';
  return `## Deeper context\n\nLoad these files when their domain comes up:\n\n${lines.join('\n')}`;
}
