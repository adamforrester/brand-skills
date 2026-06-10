/**
 * Suggested-action lookup for health.gaps[*].suggested_action. Maps a
 * (filePath, status) pair to a one-line remediation hint via per-file
 * overrides, per-prefix templates, and a generic fallback. Consumed by
 * health-writer.js. Spec: docs/superpowers/specs/2026-06-10-manifest-and-health-design.md §3.
 */

const PER_FILE_ACTIONS = {
  'voice.md': {
    placeholder: 'Run /brand-context:extract Stage 3, or paste brand voice document into voice.md',
    missing: 'Run /brand-context:extract Stage 3, or paste brand voice document into voice.md',
    partial: 'Re-run /brand-context:extract Stage 3 with more web sources, or hand-author missing sections',
  },
  'overview.md': {
    placeholder: 'Drop a brand-guide PDF into ./assets/ and run /brand-context:extract Stage 4',
    missing: 'Drop a brand-guide PDF into ./assets/ and run /brand-context:extract Stage 4',
    partial: 'Provide additional reference sources and re-run /brand-context:extract Stage 4',
  },
  'CHANGELOG.md': {
    placeholder: 'Created automatically on next /brand-context:extract',
    missing: 'Created automatically on next /brand-context:extract',
  },
};

const PER_PREFIX_ACTIONS = {
  'tokens/': {
    placeholder: 'Run /brand-context:extract Stage 1 (Figma) or Stage 2 (web with Playwright), or paste tokens manually',
    missing: 'Run /brand-context:extract Stage 1 (Figma) or Stage 2 (web with Playwright), or paste tokens manually',
  },
  'composition/': {
    placeholder: 'Hand-author per schema/brand/composition-{filename}.schema.md',
    missing: 'Hand-author per schema/brand/composition-{filename}.schema.md',
  },
  'workflows/': {
    placeholder: 'Hand-author per schema/brand/workflows-{filename}.schema.md (comprehensive tier)',
    missing: 'Hand-author per schema/brand/workflows-{filename}.schema.md (comprehensive tier)',
  },
};

/**
 * Return a one-line remediation hint for a (filePath, status) pair.
 */
export function suggestedAction(filePath, status) {
  const exact = PER_FILE_ACTIONS[filePath];
  if (exact && exact[status]) return exact[status];

  for (const [prefix, actions] of Object.entries(PER_PREFIX_ACTIONS)) {
    if (filePath.startsWith(prefix)) {
      const template = actions[status];
      if (!template) continue;
      const filename = filePath.slice(prefix.length).replace(/\.md$/, '');
      return template.replace('{filename}', filename);
    }
  }

  // Generic fallback.
  return `Populate ${filePath} per schema/brand/${filePath.replace(/\//g, '-').replace(/\.md$/, '.schema.md')}`;
}
