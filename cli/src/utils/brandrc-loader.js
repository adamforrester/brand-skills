import { existsSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { parse as yamlParse } from 'yaml';
import chalk from 'chalk';
import { warnDeprecated } from './deprecations.js';

/**
 * Load and normalize .brandrc.yaml.
 *
 * Returns a fully-normalized config object regardless of which legacy alias
 * fields the file uses. Callers should not perform alias logic themselves.
 *
 * Normalizations applied:
 *  - client → brand (legacy alias; warn once)
 *  - mode: pitch → mode: public-sources-only (legacy alias; warn once)
 *  - extensions: [...] → dropped + warn once (no extension contract shipped)
 *  - tools.storybook: ... → dropped silently (was never functional)
 *  - brand defaults to basename(projectDir) when neither brand nor client is set
 *
 * Returns: an object with at minimum `{ brand, tier, mode, sources, outputs, tools, ... }`.
 * Other keys from the YAML are passed through untouched.
 *
 * If .brandrc.yaml is absent: returns a defaults-only object (brand=basename(projectDir),
 * sources={}). If parsing fails: prints a chalk-yellow warning and returns the same defaults.
 */
export function loadBrandrc(projectDir) {
  const path = join(projectDir, '.brandrc.yaml');
  const fallbackBrand = basename(projectDir) || 'Brand';

  if (!existsSync(path)) {
    return { brand: fallbackBrand, sources: {} };
  }

  let raw;
  try {
    raw = yamlParse(readFileSync(path, 'utf-8')) ?? {};
  } catch (err) {
    console.log(chalk.yellow(`⚠ Could not parse .brandrc.yaml: ${err.message}`));
    return { brand: fallbackBrand, sources: {} };
  }

  const normalized = { ...raw };

  // client → brand
  if (normalized.client !== undefined && normalized.brand === undefined) {
    normalized.brand = normalized.client;
    warnDeprecated(
      'brandrc.client',
      '.brandrc.yaml `client` is deprecated; use `brand` instead. The alias is read but will be removed in 2.0.'
    );
  } else if (normalized.client !== undefined && normalized.brand !== undefined) {
    warnDeprecated(
      'brandrc.client+brand',
      '.brandrc.yaml has both `client` and `brand`; using `brand`. The `client` alias is deprecated and will be removed in 2.0.'
    );
  }
  delete normalized.client;

  if (normalized.brand === undefined || normalized.brand === '') {
    normalized.brand = fallbackBrand;
  }

  // mode: pitch → mode: public-sources-only
  if (normalized.mode === 'pitch') {
    normalized.mode = 'public-sources-only';
    warnDeprecated(
      'brandrc.mode.pitch',
      '.brandrc.yaml `mode: pitch` is deprecated; use `mode: public-sources-only` instead. The alias is read but will be removed in 2.0.'
    );
  }

  // extensions: [...] → dropped + warn
  if (normalized.extensions !== undefined) {
    warnDeprecated(
      'brandrc.extensions',
      '.brandrc.yaml `extensions` is no longer recognized; ignored. Re-introduced in a future minor when an extension contract ships.'
    );
    delete normalized.extensions;
  }

  // tools.storybook → dropped silently (was never functional)
  if (normalized.tools && Object.prototype.hasOwnProperty.call(normalized.tools, 'storybook')) {
    delete normalized.tools.storybook;
  }

  // Defensive: ensure sources is an object even when YAML omits it
  if (normalized.sources === undefined || normalized.sources === null) {
    normalized.sources = {};
  }

  return normalized;
}
