/**
 * Tier weight tables, readiness formula, tier-label and confidence
 * derivation. Single source of truth for tier weights — consumed by
 * health-writer.js and score.js. Spec: docs/superpowers/specs/2026-06-10-manifest-and-health-design.md §3, §3.4.
 */

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

/**
 * Return the path→weight map for a given tier ('minimum' | 'standard' | 'comprehensive').
 */
export function weightsForTier(tier) {
  if (tier === 'minimum') return { ...MINIMUM_WEIGHTS };
  if (tier === 'standard') return { ...MINIMUM_WEIGHTS, ...STANDARD_ADDITIONS };
  if (tier === 'comprehensive') return { ...MINIMUM_WEIGHTS, ...STANDARD_ADDITIONS, ...COMPREHENSIVE_ADDITIONS };
  throw new Error(`Unknown tier: ${tier}`);
}

const COMPLETE_LIKE = new Set(['complete', 'defaults']);

/**
 * Walk a {file → status} map against a {file → weight} map and return
 * weighted + unweighted counts of "complete-or-defaults" entries.
 * Single source of truth for the readiness formula's accumulation.
 */
export function weightedCounts(files, weights) {
  let weightedComplete = 0;
  let weightedTotal = 0;
  let completeCount = 0;
  const totalCount = Object.keys(weights).length;
  for (const [path, weight] of Object.entries(weights)) {
    weightedTotal += weight;
    if (COMPLETE_LIKE.has(files[path])) {
      weightedComplete += weight;
      completeCount += 1;
    }
  }
  return { weightedComplete, weightedTotal, completeCount, totalCount };
}

/**
 * Compute weighted readiness ratio (0–1, rounded to 2 decimals) from a files-status map and a weights map.
 */
export function readiness(files, weights) {
  const { weightedComplete, weightedTotal } = weightedCounts(files, weights);
  if (weightedTotal === 0) return 0;
  return Math.round((weightedComplete / weightedTotal) * 100) / 100;
}

/**
 * Map a readiness ratio to a tier label ('ready' | 'good' | 'partial' | 'incomplete').
 */
export function tierLabel(r) {
  if (r >= 0.95) return 'ready';
  if (r >= 0.80) return 'good';
  if (r >= 0.50) return 'partial';
  return 'incomplete';
}

/**
 * Derive a confidence level ('HIGH' | 'MEDIUM' | 'LOW') from manifest presence, defaults flag, and scan-complete ratio.
 */
export function confidence({ manifestSeen, hasDefaults, scanCompleteRatio }) {
  if (manifestSeen && !hasDefaults) return 'HIGH';
  if (manifestSeen && hasDefaults) return 'MEDIUM';
  if (!manifestSeen && scanCompleteRatio >= 0.8) return 'MEDIUM';
  return 'LOW';
}
