const MINIMUM_WEIGHTS = {
  'overview.md': 2,
  'voice.md': 2,
  'tokens/colors.md': 1,
  'tokens/typography.md': 1,
  'tokens/spacing.md': 1,
  'tokens/motion.md': 1,
  'tokens/surfaces.md': 1,
};

const STANDARD_ADDITIONS = {
  'composition/page-types.md': 1,
  'composition/patterns.md': 1,
  'composition/anti-patterns.md': 1,
  'conflicts.md': 1,
  'CHANGELOG.md': 1,
};

const COMPREHENSIVE_ADDITIONS = {
  'workflows/figma-to-code.md': 1,
  'workflows/code-standards.md': 1,
  'workflows/deploy.md': 1,
  'workflows/qa-checklist.md': 1,
};

export function weightsForTier(tier) {
  if (tier === 'minimum') return { ...MINIMUM_WEIGHTS };
  if (tier === 'standard') return { ...MINIMUM_WEIGHTS, ...STANDARD_ADDITIONS };
  if (tier === 'comprehensive') return { ...MINIMUM_WEIGHTS, ...STANDARD_ADDITIONS, ...COMPREHENSIVE_ADDITIONS };
  throw new Error(`Unknown tier: ${tier}`);
}

const COMPLETE_LIKE = new Set(['complete', 'defaults']);

export function readiness(files, weights) {
  let weightedTotal = 0;
  let weightedComplete = 0;
  for (const [path, weight] of Object.entries(weights)) {
    weightedTotal += weight;
    if (COMPLETE_LIKE.has(files[path])) weightedComplete += weight;
  }
  if (weightedTotal === 0) return 0;
  return Math.round((weightedComplete / weightedTotal) * 100) / 100;
}

export function tierLabel(r) {
  if (r >= 0.95) return 'ready';
  if (r >= 0.80) return 'good';
  if (r >= 0.50) return 'partial';
  return 'incomplete';
}

export function confidence({ manifestSeen, hasDefaults, scanCompleteRatio }) {
  if (manifestSeen && !hasDefaults) return 'HIGH';
  if (manifestSeen && hasDefaults) return 'MEDIUM';
  if (!manifestSeen && scanCompleteRatio >= 0.8) return 'MEDIUM';
  return 'LOW';
}
