/**
 * Pure merge of a parsed scope payload into a parsed brandrc state.
 * brandrc wins on conflict (per spec §1). "Empty" definition matches spec §1
 * field-type table (string: missing/""/null; array: missing/[]/null;
 * object: missing/{}/null + recurse leaf-by-leaf; boolean: missing only).
 *
 * Returns { merged, filledFromScope: Set<dot-path>, conflicts: [{field, scope_value, brandrc_value}] }.
 *
 * No I/O. SKILL §0a.5 calls this; tests exercise it directly.
 * Spec: docs/superpowers/specs/2026-06-14-scope-json-design.md §3.
 */

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

/**
 * Whether a brandrc value is considered "empty" for merge purposes.
 * Per-type rules from spec §1.
 */
function isEmpty(value) {
  if (value === undefined || value === null) return true;
  if (typeof value === 'string') return value === '';
  if (Array.isArray(value)) return value.length === 0;
  if (isPlainObject(value)) return Object.keys(value).length === 0;
  // Booleans and numbers count as set when present.
  return false;
}

function mergeAtPath(scopeVal, brandrcVal, pathPrefix, filledFromScope, conflicts) {
  // Object: recurse leaf-by-leaf. Even if brandrc has a non-empty object,
  // descend into it so leaf-level merges can happen.
  if (isPlainObject(scopeVal)) {
    const out = isPlainObject(brandrcVal) ? { ...brandrcVal } : {};
    for (const [k, sv] of Object.entries(scopeVal)) {
      if (k === '_comment') continue; // never merge into brandrc
      const childPath = pathPrefix ? `${pathPrefix}.${k}` : k;
      const bv = isPlainObject(brandrcVal) ? brandrcVal[k] : undefined;
      out[k] = mergeAtPath(sv, bv, childPath, filledFromScope, conflicts);
    }
    return out;
  }

  // Leaf: apply the "brandrc wins on conflict" rule.
  if (isEmpty(brandrcVal)) {
    filledFromScope.add(pathPrefix);
    return scopeVal;
  }
  // Brandrc has a set value. If scope provides a different value, log conflict.
  // Use JSON.stringify for deep-equal comparison on arrays/scalars.
  if (JSON.stringify(brandrcVal) !== JSON.stringify(scopeVal)) {
    conflicts.push({
      field: pathPrefix,
      scope_value: scopeVal,
      brandrc_value: brandrcVal,
    });
  }
  return brandrcVal;
}

/**
 * Merge a parsed scope payload into a parsed brandrc state.
 * Pure function; does not mutate inputs.
 */
export function mergeScopeIntoBrandrc(scope, brandrc) {
  const filledFromScope = new Set();
  const conflicts = [];
  const merged = mergeAtPath(scope, brandrc, '', filledFromScope, conflicts);
  return { merged, filledFromScope, conflicts };
}
