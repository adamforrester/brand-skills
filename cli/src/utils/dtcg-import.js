/**
 * DTCG (W3C Design Tokens Community Group) import. Reads assets/*.tokens.json,
 * validates the per-token { $value, $type } shape, and returns an in-memory
 * token state grouped by category (colors / typography / spacing / surfaces /
 * motion / unknown). Stage 1 fallback path when figma-console MCP is absent.
 * Spec: docs/superpowers/specs/2026-06-13-mcp-fallback-contract-design.md §3 dtcg-tokens-file.
 */

import { readFileSync } from 'node:fs';

const TYPE_TO_BUCKET = {
  color:          'colors',
  fontFamily:     'typography',
  fontWeight:     'typography',
  lineHeight:     'typography',
  letterSpacing:  'typography',
  duration:       'motion',
  cubicBezier:    'motion',
  shadow:         'surfaces',
};

function emptyState() {
  return { colors: {}, typography: {}, spacing: {}, surfaces: {}, motion: {}, unknown: [] };
}

function isToken(node) {
  return node && typeof node === 'object' && '$value' in node;
}

function walkGroup(node, pathParts, state) {
  if (isToken(node)) {
    if (!('$type' in node)) {
      throw new Error(`DTCG token at '${pathParts.join('.')}' missing $type`);
    }
    placeToken(node, pathParts, state);
    return;
  }
  if (node && typeof node === 'object') {
    for (const [key, child] of Object.entries(node)) {
      if (key.startsWith('$')) continue;
      walkGroup(child, [...pathParts, key], state);
    }
  }
}

// Top-level group names that act as redundant prefixes for their bucket and
// should be dropped from the flattened key. e.g. color.primary → 'primary'
// (the bucket is 'colors'); font.family-base → 'family-base' (typography).
// size.body / weight.regular / spacing.lg keep their top-level prefix because
// it carries semantic meaning within the bucket.
//
// To extend: add a new top-level group name here when a real-world DTCG
// export uses it as a bucket-redundant container (e.g., 'colors' plural,
// 'palette', 'text'). Don't add 'size' or 'weight' — those are semantic
// prefixes within typography.
const REDUNDANT_TOP_GROUPS = new Set(['color', 'font', 'typography']);

function flattenName(pathParts) {
  if (pathParts.length === 0) return '';
  const top = pathParts[0];
  const rest = pathParts.slice(1);
  if (REDUNDANT_TOP_GROUPS.has(top) && rest.length > 0) {
    return rest.join('-');
  }
  return pathParts.join('-');
}

function placeToken(node, pathParts, state) {
  const $type = node.$type;
  const $value = node.$value;
  const flatName = flattenName(pathParts);

  if ($type === 'color') {
    state.colors[flatName] = $value;
    return;
  }
  if ($type === 'dimension') {
    // Heuristic: top-level group 'font' / 'typography' / 'size' is typography
    // sizing; everything else (spacing, space, etc.) is spacing. To extend
    // for new typography-sizing layouts, add the group name to this conditional.
    // The SKILL surfaces uncertainty via unknown[] only for unknown $type
    // values — ambiguous dimension placement is silently bucketed per this rule.
    const top = pathParts[0];
    if (top === 'font' || top === 'typography' || top === 'size') {
      state.typography[flatName] = $value;
    } else {
      state.spacing[flatName] = $value;
    }
    return;
  }
  const bucket = TYPE_TO_BUCKET[$type];
  if (bucket) {
    state[bucket][flatName] = $value;
    return;
  }
  state.unknown.push({ $type, $value, path: pathParts.join('.') });
}

/**
 * Read one DTCG tokens file and return a normalized token state object.
 * Throws on missing $type or invalid JSON.
 */
export function importDtcgFile(absPath) {
  const raw = readFileSync(absPath, 'utf-8');
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`DTCG file ${absPath} is not valid JSON: ${err.message}`);
  }
  const state = emptyState();
  walkGroup(parsed, [], state);
  return state;
}

/**
 * Read multiple DTCG token files and merge. Later files win on key collision
 * within the same bucket. unknown[] entries accumulate.
 */
export function importDtcgFiles(absPaths) {
  const merged = emptyState();
  for (const path of absPaths) {
    const state = importDtcgFile(path);
    for (const bucket of ['colors', 'typography', 'spacing', 'surfaces', 'motion']) {
      Object.assign(merged[bucket], state[bucket]);
    }
    merged.unknown.push(...state.unknown);
  }
  return merged;
}
